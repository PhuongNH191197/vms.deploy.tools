import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/store/wizardStore";
import { Construction } from "lucide-react";

export default function Step5EnvConfig() {
  const { nextStep, prevStep } = useWizardStore();
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 5 — ENV Configuration</h2>
        <p className="text-sm text-muted-foreground">Cấu hình biến môi trường cho từng service.</p>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Construction size={18} />
        <span className="text-sm">Đang phát triển — Sprint S4</span>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep}>Tiếp theo →</Button>
      </div>
    </div>
  );
}
