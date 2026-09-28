import { aiEngineStatus } from "@/lib/ai/gateway";
import { AdminAiChat } from "@/components/admin/AdminAiChat";

// ตัวเลขต้องสดทุกครั้งที่เปิด ห้ามแคช
export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  const engine = await aiEngineStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[length:var(--display-sm)]">ถาม AI (แอดมิน)</h1>
        <p className="mt-1 text-sm text-muted">
          ถามสถานะธุรกิจเป็นภาษาไทยได้เลย — AI อ่านข้อมูลจริงในระบบ ณ วินาทีที่ถาม
          {!engine.available && <span className="text-down"> · ตอนนี้ยังไม่มีเครื่องไหนตอบได้</span>}
        </p>
      </div>

      <AdminAiChat available={engine.available} />

      <p className="text-xs text-muted">
        AI ตอบจากสรุปที่ระบบคำนวณให้เท่านั้น — <strong>ไม่ได้เขียนคำสั่งฐานข้อมูลเอง</strong> และไม่ส่งอีเมล
        เลขอ้างอิงการโอน หรือรูปสลิปออกนอกระบบ · ตัวเลขที่ได้ควรเช็กซ้ำกับหน้าจริงก่อนใช้ตัดสินใจเรื่องเงิน
      </p>
    </div>
  );
}
