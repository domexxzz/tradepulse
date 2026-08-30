"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginUser, type AuthState } from "@/lib/actions/auth";
import { Field, SubmitBtn, ErrorBox, AuthShell } from "@/components/auth/AuthUI";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginUser, {});
  return (
    <AuthShell title="เข้าสู่ระบบ" subtitle="ยินดีต้อนรับกลับสู่ QVX">
      <form action={action} className="space-y-4">
        {state.error && <ErrorBox msg={state.error} />}
        {/* type="text" ไม่ใช่ "email" — ไม่งั้นเบราว์เซอร์บล็อกชื่อผู้ใช้ที่ไม่มี @ ตั้งแต่ก่อนส่งฟอร์ม */}
        <Field
          name="email"
          type="text"
          label="อีเมล หรือ ชื่อผู้ใช้"
          placeholder="you@example.com หรือ yourname"
        />
        <Field name="password" type="password" label="รหัสผ่าน" placeholder="••••••••" />
        <SubmitBtn pending={pending}>เข้าสู่ระบบ</SubmitBtn>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-brand hover:underline">
          ลืมรหัสผ่าน?
        </Link>
      </p>
      <p className="mt-6 text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="text-brand hover:underline">สมัครสมาชิก</Link>
      </p>
    </AuthShell>
  );
}
