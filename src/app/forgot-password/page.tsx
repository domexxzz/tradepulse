"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotState } from "@/lib/actions/password";
import { Field, SubmitBtn, ErrorBox, AuthShell } from "@/components/auth/AuthUI";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  return (
    <AuthShell title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้">
      {state.ok ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-up/30 bg-up/10 px-3.5 py-3 text-sm text-up">
            ถ้าอีเมลนี้มีบัญชีอยู่ในระบบ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว
            <br />
            ลิงก์ใช้ได้ 60 นาที (ถ้าไม่เจอในกล่องจดหมาย ลองดูในโฟลเดอร์สแปม)
          </div>
          <Link href="/login" className="block text-center text-sm text-brand hover:underline">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        <>
          <form action={action} className="space-y-4">
            {state.error && <ErrorBox msg={state.error} />}
            <Field name="email" type="email" label="อีเมล" placeholder="you@example.com" />
            <SubmitBtn pending={pending}>ส่งลิงก์ตั้งรหัสผ่านใหม่</SubmitBtn>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            นึกรหัสผ่านออกแล้ว?{" "}
            <Link href="/login" className="text-brand hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
