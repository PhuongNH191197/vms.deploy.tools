import { Rocket } from "lucide-react";
import StepWizard from "@/components/StepWizard";
import Step1Connect from "@/components/wizard/Step1Connect";
import Step2EnvCheck from "@/components/wizard/Step2EnvCheck";
import Step3Networks from "@/components/wizard/Step3Networks";
import Step4Externals from "@/components/wizard/Step4Externals";
import Step5EnvConfig from "@/components/wizard/Step5EnvConfig";
import Step6Apps from "@/components/wizard/Step6Apps";
import Step7Deploy from "@/components/wizard/Step7Deploy";
import { useWizardStore } from "@/store/wizardStore";

function StepContent({ step }: { step: number }) {
  switch (step) {
    case 1: return <Step1Connect />;
    case 2: return <Step2EnvCheck />;
    case 3: return <Step3Networks />;
    case 4: return <Step4Externals />;
    case 5: return <Step5EnvConfig />;
    case 6: return <Step6Apps />;
    case 7: return <Step7Deploy />;
    default: return null;
  }
}

export default function Setup() {
  const { currentStep } = useWizardStore();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Rocket size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Deploy Wizard</h1>
        </div>

        <div className="mb-8">
          <StepWizard current={currentStep} />
        </div>

        <div className="flex-1">
          <StepContent step={currentStep} />
        </div>
      </div>
    </div>
  );
}
