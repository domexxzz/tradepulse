"use client";
import { useState } from "react";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else {
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
        className="rounded-full border border-brand/40 px-6 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
      >
        {loading ? "กำลังเปิด…" : "จัดการ / ยกเลิกแพ็คเกจ"}
      </button>
      {msg && <p className="mt-2 text-xs text-down">{msg}</p>}
    </div>
  );
}
