"use client";
import { useActionState, use } from "react";
import Link from "next/link";
import { resetPassword, type ResetState } from "@/lib/actions/password";
import { Field, SubmitBtn, ErrorBox, AuthShell } from "@/components/auth/AuthUI";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (!token) {
    return (
      <AuthShell title="ลิงก์ไม่ถูกต้อง">
        <p className="text-sm text-muted">
          ลิงก์นี้ไม่สมบูรณ์ กรุณา
          <Link href="/forgot-password" className="text-brand hover:underline"> ขอลิงก์ใหม่อีกครั้ง</Link>
        </p>
      </AuthShell>
    );
  }

  if (state.ok) {
    return (
      <AuthShell title="ตั้งรหัสผ่านใหม่แล้ว" subtitle="ใช้รหัสผ่านใหม่เข้าสู่ระบบได้เลย">
        <Link
          href="/login"
          className="grid h-11 w-full place-items-center rounded-full bg-gradient-to-r from-brand-strong to-brand-deep text-sm font-semibold text-black transition-all hover:brightness-110"
        >
          เข้าสู่ระบบ
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle="ตั้งรหัสผ่านที่ยาวอย่างน้อย 8 ตัวอักษร">
      <form action={action} className="space-y-4">
        {state.error && <ErrorBox msg={state.error} />}
        <input type="hidden" name="token" value={token} />
        <Field name="password" type="password" label="รหัสผ่านใหม่" placeholder="อย่างน้อย 8 ตัวอักษร" />
        <Field name="confirm" type="password" label="ยืนยันรหัสผ่านใหม่" placeholder="พิมพ์อีกครั้ง" />
        <SubmitBtn pending={pending}>บันทึกรหัสผ่านใหม่</SubmitBtn>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        ลิงก์หมดอายุแล้ว?{" "}
        <Link href="/forgot-password" className="text-brand hover:underline">ขอลิงก์ใหม่</Link>
      </p>
    </AuthShell>
  );
}
