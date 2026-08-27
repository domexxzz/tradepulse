"use client";

import { useEffect, useRef } from "react";

/** จำนวนจุดในแนวขวางและแนวลึกของสนามจุด */
const COLS = 46;
const ROWS = 30;
/** ระยะจากกล้องถึงระนาบใกล้สุด — ค่ายิ่งน้อย เพอร์สเปกทีฟยิ่งชัน */
const NEAR = 3;
const DEPTH = 30;
/** ครึ่งความกว้างของสนามในพิกัดโลก */
const HALF_W = 14;
/** ระยะที่กล้องอยู่เหนือระนาบจุด — คุมว่าสนามจะตกลงมาต่ำแค่ไหนในจอ */
const CAM_HEIGHT = 3.4;

/**
 * พื้นหลัง — สนามจุดเพอร์สเปกทีฟที่กระเพื่อมเป็นคลื่นช้า ๆ
 *
 * ⚠️ ทำไมไม่ใช้ three.js:
 * เว็บที่เป็นต้นแบบโหลด three.js r128 จาก CDN (~600KB) มาวาดฉากนี้ ซึ่งงบ JS
 * ของหน้า landing ทั้งหน้าอยู่ที่ ~150KB gzipped คือใส่แล้วเกินงบไปสามเท่า
 * เพื่อภาพพื้นหลังที่ไม่ได้โต้ตอบอะไรกับผู้ใช้เลย
 *
 * ฉากนี้เป็นแค่ "จุดบนระนาบเดียว ฉายด้วยเพอร์สเปกทีฟ" ไม่มีแสง เงา วัสดุ หรือ
 * กล้องเคลื่อนที่ จึงคำนวณเองด้วย canvas 2D ได้ตรง ๆ — สูตรฉายคือ s = f / z
 * ได้ภาพแบบเดียวกันที่ราคาไม่กี่ KB และไม่ต้องพึ่ง CDN ภายนอก
 *
 * ของเดิมตรงนี้เป็นจุดลอย 10 จุดที่ฮาร์ดโค้ดตำแหน่งไว้ ซึ่งอ่านไม่ออกว่าคืออะไร
 * สนามจุดที่ไล่ระยะแบบนี้สื่อ "พื้นผิวข้อมูล" ได้ตรงกับสินค้ามากกว่า
 *
 * เลเยอร์ CSS เดิม (aurora / grid / beam / grain) ยังอยู่ครบ วาดซ้อนกันอยู่
 */
export function Background3D() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ---- ตัวชี้เมาส์: ใช้กับ aurora ที่เป็น CSS ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const updatePointer = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${event.clientX}px`);
        root.style.setProperty("--pointer-y", `${event.clientY}px`);
      });
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // ---- สนามจุด ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      // จำกัด DPR ไว้ที่ 2 — สูงกว่านี้จอ 3x จะวาดพิกเซลเพิ่มเท่าตัวโดยตาแทบไม่เห็นต่าง
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** วาดหนึ่งเฟรม — t มีหน่วยเป็นวินาที */
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // จุดรวมสายตาอยู่ค่อนไปทางขวา ให้พื้นที่ข้อความฝั่งซ้ายโล่ง
      const cx = w * 0.68;
      const cy = h * 0.3;

      // ⚠️ f ต้องคำนวณจาก NEAR ไม่ใช่ตั้งลอย ๆ จากขนาดจอ
      // ของเดิมใช้ min(w,h)*0.9 ซึ่งที่ z ใกล้สุดทำให้จุดกระจายออกไป ±4,400px
      // คือหลุดจอเกือบทั้งแถว เหลือติดจอแค่ 0.1% ของพิกเซล
      // สูตรนี้ล็อกให้แถวใกล้สุดกว้างประมาณ 2.2 เท่าของจอพอดี แล้วลู่เข้าหาจุดรวมสายตา
      const f = (2.2 * w * NEAR) / (2 * HALF_W);

      for (let iz = 0; iz < ROWS; iz++) {
        // ไล่ระยะแบบไม่เชิงเส้น ให้จุดใกล้ห่างกันมากกว่าจุดไกล เหมือนของจริง
        const z = NEAR + (iz / ROWS) ** 1.6 * DEPTH;
        const scale = f / z;
        // จางลงตามระยะ แต่ไม่ยกกำลังสองเหมือนเดิม ไม่งั้นครึ่งหลังดำสนิท
        const fade = (1 - iz / ROWS) ** 1.2;

        for (let ix = 0; ix < COLS; ix++) {
          const x = (ix / (COLS - 1) - 0.5) * 2 * HALF_W;
          // คลื่นสองชุดความถี่ต่างกัน ทับกันแล้วไม่เห็นรอบซ้ำชัด ๆ
          const y = Math.sin(x * 0.32 + t * 0.5) * 0.5 + Math.sin(z * 0.24 - t * 0.32) * 0.38;

          const sx = cx + x * scale;
          const sy = cy + (y + CAM_HEIGHT) * scale;
          if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

          const r = Math.min(2.1, Math.max(0.55, scale * 0.012));
          const alpha = fade * 0.62;
          if (alpha < 0.02) continue;

          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 240, 107, ${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
    };

    const start = performance.now();
    const loop = (now: number) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const play = () => {
      if (raf) return;
      // ตั้งค่าไว้ว่าลดการเคลื่อนไหว = วาดภาพนิ่งเฟรมเดียว ไม่วนลูป
      if (reduce.matches) {
        draw(0);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      resize();
      if (reduce.matches) draw(0);
    };

    // แท็บที่ถูกซ่อนไม่ต้องเผาซีพียูวาดของที่ไม่มีใครเห็น
    const onVisibility = () => (document.hidden ? stop() : play());

    resize();
    play();
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", onVisibility);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onVisibility);
    };
  }, []);

  return (
    <div ref={rootRef} className="bg3d" aria-hidden>
      <div className="bg3d__aurora" />
      <div className="bg3d__grid" />
      <div className="bg3d__beam" />
      <canvas ref={canvasRef} className="bg3d__field" />
      <div className="bg3d__grain" />
    </div>
  );
}
