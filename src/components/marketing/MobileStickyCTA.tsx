import { Button } from "@/components/ui/Button";
import { plans } from "@/config/plans";
import { formatTHB } from "@/lib/utils";

export function MobileStickyCTA() {
  // ดึงจากคอนฟิกเสมอ — เดิม hardcode "฿990" ไว้ ถ้าขึ้นราคาแถบนี้จะแสดงราคาผิด
  const cheapestPerMonth = Math.min(...plans.map((p) => p.perMonthTHB));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-md md:hidden">
      <div className="container-x flex items-center gap-3">
        <p className="text-sm">
          <span className="font-semibold">เริ่มต้น {formatTHB(cheapestPerMonth)}</span>
          <span className="text-muted">/เดือน</span>
        </p>
        <Button href="#pricing" className="ml-auto">ดูแพ็กเกจ</Button>
      </div>
    </div>
  );
}
