"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function CheckoutButton({
  planCode,
  className,
  children,
}: {
  planCode: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.url) {
        // external Stripe Checkout URL
        window.location.assign(data.url);
      } else {
        setMsg(data.error ?? "เกิดข้อผิดพลาด");
        setLoading(false);
      }
    } catch {
      setMsg("เชื่อมต่อไม่สำเร็จ");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={loading}
        className={cn(className, loading && "opacity-60")}
        aria-busy={loading}
      >
        {loading ? "กำลังไปหน้าชำระเงิน…" : children}
      </button>
      {msg && <p className="mt-2 text-center text-xs text-down" role="alert">{msg}</p>}
    </div>
  );
}
