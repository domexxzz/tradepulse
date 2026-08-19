import { Button } from "@/components/ui/Button";

export function MobileStickyCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-md md:hidden">
      <div className="container-x flex items-center gap-3">
        <p className="text-sm">
          <span className="font-semibold">เริ่มต้น ฿990</span>
          <span className="text-muted">/เดือน</span>
        </p>
        <Button href="#pricing" className="ml-auto">ดูแพ็กเกจ</Button>
      </div>
    </div>
  );
}
