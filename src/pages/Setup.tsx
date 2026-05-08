import { useState, useEffect } from "react";
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
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const mainElement = document.getElementById('main-content');
    const handleScroll = () => {
      setScrollOffset(mainElement?.scrollTop ?? 0);
    };
    mainElement?.addEventListener('scroll', handleScroll);
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, []);

  const opacity = Math.min(scrollOffset / 100, 0.85);
  const blur = Math.min(scrollOffset / 5, 20);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 flex flex-col w-full">
        <div 
          className="sticky top-[108px] z-20 py-4 -mx-10 px-20 transition-all duration-500 ease-out border-b border-white/[0.01] mb-8"
          style={{ 
            backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
            backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
            WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
          }}
        >
          <StepWizard current={currentStep} />
        </div>

        <div className="flex-1 max-w-4xl w-full animate-fade-in-up">
          <StepContent step={currentStep} />
        </div>
      </div>
    </div>
  );
}
