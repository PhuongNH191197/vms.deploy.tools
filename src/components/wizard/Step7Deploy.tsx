import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/store/wizardStore";
import { Construction } from "lucide-react";

export default function Step7Deploy() {
  const { prevStep, reset } = useWizardStore();
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 7 — Deploy</h2>
        <p className="text-sm text-muted-foreground">Xác nhận và thực hiện triển khai.</p>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Construction size={18} />
        <span className="text-sm">Đang phát triển — Sprint S4</span>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button variant="outline" onClick={reset}>Reset Wizard</Button>
      </div>
    </div>
  );
}
