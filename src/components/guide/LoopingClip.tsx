"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * คลิปสาธิตแบบวนลูป — ไม่มีแถบควบคุมของเบราว์เซอร์ ลากหาตำแหน่งไม่ได้
 *
 * ทำไมไม่ใช่ <video autoPlay loop> เฉย ๆ:
 *
 * 1. คลิปรวมกัน 28 MB ถ้าใส่ autoPlay ตรง ๆ หน้า /guide จะโหลดทั้ง 4 คลิปทันที
 *    ที่เปิดหน้า จึงใช้ preload="none" แล้วสั่งเล่นเองตอนเลื่อนมาถึงด้วย
 *    IntersectionObserver และหยุดเมื่อเลื่อนพ้น
 *
 * 2. คลิปยาว 3-4 นาทีที่เล่นเองวนไปเรื่อย ๆ โดยผู้ใช้หยุดไม่ได้ ผิด WCAG 2.2.2
 *    (Pause, Stop, Hide) จึงมีปุ่มหยุดเล็ก ๆ ที่มุมแทนแถบควบคุมเต็ม
 *    และเคารพ prefers-reduced-motion ด้วยการไม่เล่นเองถ้าผู้ใช้ตั้งค่าไว้
 *
 * 3. เมื่อผู้ใช้กดหยุดเอง ต้องไม่ถูก IntersectionObserver สั่งเล่นซ้ำตอนเลื่อนกลับมา
 *    จึงจำสถานะไว้ใน ref แยกจาก state ที่ใช้วาดปุ่ม
 */
export function LoopingClip({
  src,
  poster,
  label,
  eager = false,
}: {
  src: string;
  poster: string;
  label: string;
  /** คลิปที่อยู่เหนือ fold — โหลด metadata ล่วงหน้าเพื่อให้เฟรมแรกขึ้นเร็ว ไม่ต้องรอ observer */
  eager?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** ผู้ใช้กดหยุดเองหรือเปล่า — แยกจาก paused เพราะ IntersectionObserver ก็สั่งหยุดได้ */
  const pausedByUserRef = useRef(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // React ไม่ได้ตั้ง muted ให้เสมอตอน hydrate และเบราว์เซอร์จะบล็อก autoplay ถ้าไม่ muted
    el.muted = true;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      pausedByUserRef.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!pausedByUserRef.current) {
            el.play().catch(() => setPaused(true));
          }
        } else {
          el.pause();
        }
      },
      // คลิปเหนือ fold ต้องเล่นทันทีที่เห็น — บนจอเตี้ย ๆ คลิป Hero โผล่แค่ ~30%
      // ตอนเปิดหน้า ถ้าใช้ threshold เดียวกับคลิปล่าง ๆ มันจะนิ่งอยู่จนกว่าจะเลื่อน
      // ส่วนคลิปล่าง fold ใช้ค่าสูงกว่าเพื่อไม่ให้เริ่มเล่นตั้งแต่เพิ่งโผล่ขอบจอ
      { threshold: eager ? 0 : 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager]);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      pausedByUserRef.current = false;
      el.play().catch(() => setPaused(true));
    } else {
      pausedByUserRef.current = true;
      el.pause();
    }
  };

  return (
    // กันภาพกระโดด (CLS) ตอนคลิปยังไม่โหลด — คลิปทุกตัวครอปเป็น 736x348 เท่ากันหมด
    // ถ้าเปลี่ยนสัดส่วนตอนเข้ารหัสใหม่ ต้องแก้ตรงนี้ด้วย (ดูหมายเหตุใน config/guide.ts)
    <div className="relative aspect-[736/348] overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        className="block h-full w-full cursor-pointer object-cover"
        loop
        muted
        playsInline
        preload={eager ? "metadata" : "none"}
        poster={poster}
        aria-label={label}
        onClick={toggle}
        onPause={() => setPaused(true)}
        onPlay={() => setPaused(false)}
      >
        <source src={src} type="video/mp4" />
        เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
      </video>

      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? `เล่นคลิป ${label}` : `หยุดคลิป ${label}`}
        className="absolute bottom-2.5 left-2.5 grid h-8 w-8 place-items-center rounded-full
                   bg-background/70 text-foreground backdrop-blur transition-colors
                   hover:bg-background focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
