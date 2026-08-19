"use client";
import { useActionState } from "react";
import Link from "next/link";
import { registerUser, type AuthState } from "@/lib/actions/auth";
import { Field, SubmitBtn, ErrorBox, AuthShell } from "@/components/auth/AuthUI";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerUser, {});
  return (
    <AuthShell title="สมัครสมาชิก" subtitle="เริ่มใช้งานอินดิเคเตอร์ TradePulse">
      <form action={action} className="space-y-4">
        {state.error && <ErrorBox msg={state.error} />}
        <Field name="name" type="text" label="ชื่อ" placeholder="ชื่อของคุณ" />
        <Field name="email" type="email" label="อีเมล" placeholder="you@example.com" />
        <Field name="password" type="password" label="รหัสผ่าน" placeholder="อย่างน้อย 6 ตัวอักษร" />
        <SubmitBtn pending={pending}>สมัครสมาชิก</SubmitBtn>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="text-brand hover:underline">เข้าสู่ระบบ</Link>
      </p>
    </AuthShell>
  );
}
