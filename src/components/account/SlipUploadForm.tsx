"use client";
/* eslint-disable @next/next/no-img-element */
import { useActionState, useState } from "react";
import { submitSlip, type SlipState } from "@/lib/actions/payment";

/**
 * บีบรูปสลิปฝั่ง client ก่อนส่ง
 *
 * รูปถ่ายจากมือถือมัก 2-5MB พอแปลงเป็น base64 (โตขึ้น ~33%) แล้วยิงผ่าน Server Action
 * จะทะลุเพดาน body แล้วพังเป็น 413 (server error) — ลูกค้าจ่ายเงินไม่ได้เลย
 * สลิปเป็นรูปข้อความ ย่อกว้างเหลือ 1280px + JPEG คุณภาพ 0.82 ก็ยังอ่านเลขบัญชี/ยอด/เวลาชัด
 * และเหลือขนาดหลักร้อย KB ทำให้ทั้งส่งผ่านและเก็บใน DB เบาลงมาก
 */
async function compressSlip(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const MAX_W = 1280;
  const scale = Math.min(1, MAX_W / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับการย่อรูป");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.82);
}

export function SlipUploadForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<SlipState, FormData>(submitSlip, {});
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string>("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    setBusy(true);
    try {
      setPreview(await compressSlip(file));
    } catch {
      setPreview("");
      setFileError("อ่านรูปไม่สำเร็จ ลองเลือกรูปใหม่ หรือถ่ายใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (state.ok) {
    return (
      <div className="rounded-lg border border-up/30 bg-up/10 px-4 py-3 text-sm text-up">
        {state.note ?? "ส่งสลิปเรียบร้อย รอทีมงานตรวจสอบ"}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{state.error}</div>}
      {fileError && <div className="rounded-lg border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{fileError}</div>}
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="slip" value={preview} />
      <input
        type="file"
        accept="image/*"
        onChange={onFile}
        disabled={busy}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink hover:file:bg-brand-strong disabled:opacity-50"
      />
      {busy && <p className="text-sm text-muted">กำลังเตรียมรูป…</p>}
      {preview && <img src={preview} alt="ตัวอย่างสลิป" className="max-h-64 rounded-xl border border-border" />}
      <button
        type="submit"
        disabled={pending || busy || !preview}
        className="h-11 w-full rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-strong disabled:opacity-50"
      >
        {pending ? "กำลังส่ง…" : "ส่งสลิปยืนยันการโอน"}
      </button>
    </form>
  );
}
