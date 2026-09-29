import Link from "next/link";
import { Clock, MessageCircle, ArrowRight } from "lucide-react";
import { site, hasLineContact, hasDiscord, discordInviteUrl } from "@/config/site";
import { DiscordIcon } from "@/components/common/DiscordIcon";

/**
 * ป้ายแจ้งว่าหยุดรับชำระเงินชั่วคราว พร้อมช่องทางติดต่อ
 *
 * ใช้ทั้งหน้าราคา (คนที่ยังไม่ได้จ่าย) และหน้าชำระเงิน (คนที่โอนมาแล้ว)
 * จึงต้องมีช่องทางติดต่อติดมาด้วยเสมอ — คนที่โอนเงินไปแล้วแล้วเจอหน้าปิด
 * โดยไม่มีทางติดต่อ จะคิดว่าโดนโกง
 *
 * แสดงเฉพาะช่องทางที่ตั้งค่าไว้จริง ไม่ขึ้นปุ่มที่กดแล้วไม่ไปไหน
 */
export function SalesPausedNotice({
  variant = "default",
  className = "",
}: {
  /** "paid" = ข้อความสำหรับคนที่โอนเงินมาแล้ว */
  variant?: "default" | "paid";
  className?: string;
}) {
  const paid = variant === "paid";

  return (
    <div className={`card-surface rounded-2xl border border-amber-400/30 p-6 ${className}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Clock className="h-4 w-4 shrink-0 text-amber-400" />
        {paid ? "หยุดรับชำระเงินชั่วคราว" : "ระบบชำระเงินจะเปิดเร็ว ๆ นี้"}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        {paid ? (
          <>
            ขณะนี้เราหยุดรับชำระเงินชั่วคราวเพื่อปรับปรุงระบบให้เสถียรก่อน
            <br />
            <span className="text-foreground">
              ถ้าคุณโอนเงินมาแล้ว เงินของคุณยังอยู่ครบ
            </span>{" "}
            ทีมงานบันทึกทุกรายการไว้และจะติดต่อกลับทุกคน — หากต้องการรับเงินคืนหรือสอบถาม
            ทักมาได้ตามช่องทางด้านล่าง
          </>
        ) : (
          <>
            ตอนนี้ยังสมัครบัญชีไว้ก่อนได้ แต่ยังไม่เปิดให้ชำระเงิน
            เราขอปรับระบบให้เสถียรก่อนแล้วจะเปิดรับอีกครั้ง
          </>
        )}
      </p>

      {/*
        ทางออกของคนที่โอนเงินมาแล้วแต่ยังไม่ได้ส่งสลิป — ต้องมาก่อนช่องทางติดต่อ
        เพราะเขาแก้เองได้ใน 30 วินาที ไม่ต้องรอแอดมินตอบ
        ถ้าไม่มีลิงก์นี้ เขาจะหาที่แนบสลิปไม่เจอเลย (ปุ่มสมัครถูกปิดไปหมดแล้ว)
        แล้วกลายเป็นงานที่ทีมงานต้องตอบทีละคนโดยที่ช่วยอะไรไม่ได้จริง
      */}
      <Link
        href="/account/pay/transferred"
        className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm transition-colors hover:bg-brand/10"
      >
        <span>
          <span className="font-medium text-foreground">โอนเงินมาแล้วแต่ยังไม่ได้แนบสลิป?</span>
          <span className="mt-0.5 block text-xs text-muted">แนบที่นี่ ทีมงานจะตรวจสอบและเปิดสิทธิ์ให้</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        {hasLineContact && (
          <a
            href={site.contact.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#06C755] px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            ติดต่อผ่าน LINE
          </a>
        )}
        {hasDiscord && (
          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#5865F2] px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            <DiscordIcon className="h-4 w-4" />
            ติดต่อผ่าน Discord
          </a>
        )}
        {site.contact.email && (
          <a
            href={`mailto:${site.contact.email}`}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm hover:bg-surface-2"
          >
            อีเมล {site.contact.email}
          </a>
        )}
        <Link
          href="/account/support"
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm hover:bg-surface-2"
        >
          หน้าช่วยเหลือ
        </Link>
      </div>
    </div>
  );
}
