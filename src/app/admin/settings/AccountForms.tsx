"use client";
import { useActionState } from "react";
import {
  changeAdminPassword,
  changeAdminEmail,
  type AccountState,
} from "@/lib/actions/admin-account";

/**
 * ฟอร์มต้องเป็น client component เพราะใช้ useActionState เพื่อโชว์ผลลัพธ์
 * โดยไม่ต้องรีโหลดหน้า — ส่วนหน้าแม่ยังเป็น server component ที่อ่านข้อมูลจริง
 */

function Msg({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p className="rounded-xl border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="rounded-xl border border-up/30 bg-up/10 px-3 py-2 text-sm text-up">
        {state.ok}
      </p>
    );
  }
  return null;
}

const input =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const label = "block text-xs font-medium text-muted mb-1.5";
const button =
  "rounded-full bg-brand px-5 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(
    changeAdminPassword,
    {}
  );
  return (
    <form action={action} className="space-y-3">
      <Msg state={state} />
      <div>
        <label className={label} htmlFor="currentPassword">รหัสผ่านเดิม</label>
        {/* autoComplete บอกให้ตัวจัดการรหัสผ่านกรอกและบันทึกค่าให้ถูกช่อง */}
        <input id="currentPassword" name="currentPassword" type="password" required
          autoComplete="current-password" className={input} placeholder="••••••••" />
      </div>
      <div>
        <label className={label} htmlFor="newPassword">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
        <input id="newPassword" name="newPassword" type="password" required minLength={8}
          autoComplete="new-password" className={input} placeholder="••••••••" />
      </div>
      <div>
        <label className={label} htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8}
          autoComplete="new-password" className={input} placeholder="••••••••" />
      </div>
      <button className={button} disabled={pending}>
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}

export function EmailForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(
    changeAdminEmail,
    {}
  );
  return (
    <form action={action} className="space-y-3">
      <Msg state={state} />
      <div>
        <label className={label} htmlFor="email">อีเมล</label>
        <input id="email" name="email" type="email" required defaultValue={current ?? ""}
          autoComplete="email" className={input} placeholder="you@example.com" />
      </div>
      <div>
        <label className={label} htmlFor="emailPassword">รหัสผ่าน (ยืนยันตัวตน)</label>
        <input id="emailPassword" name="password" type="password" required
          autoComplete="current-password" className={input} placeholder="••••••••" />
      </div>
      <button className={button} disabled={pending}>
        {pending ? "กำลังบันทึก…" : current ? "เปลี่ยนอีเมล" : "ผูกอีเมล"}
      </button>
    </form>
  );
}
