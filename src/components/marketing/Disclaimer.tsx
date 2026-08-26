import { AlertTriangle } from "lucide-react";

export function Disclaimer() {
  return (
    <section aria-label="คำเตือนความเสี่ยง" className="section-sm">
      <div className="container-x">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-down" aria-hidden />
            <div>
              <h2 className="font-semibold">คำเตือนความเสี่ยง</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                QVX เป็นเครื่องมือช่วยวิเคราะห์กราฟและวางแผนการเทรด ไม่ใช่คำแนะนำการลงทุน
                และไม่รับประกันผลกำไร การเทรดมีความเสี่ยง ผู้ใช้งานควรศึกษาข้อมูล ทดสอบระบบ
                และบริหารเงินทุนด้วยตนเอง
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
