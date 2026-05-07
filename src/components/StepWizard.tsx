import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Kết nối" },
  { n: 2, label: "Môi trường" },
  { n: 3, label: "Networks" },
  { n: 4, label: "Externals" },
  { n: 5, label: "ENV Config" },
  { n: 6, label: "Apps" },
  { n: 7, label: "Deploy" },
];

interface Props {
  current: number;
  onStepClick?: (step: number) => void;
}

export default function StepWizard({ current, onStepClick }: Props) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = step.n < current;
        const active = step.n === current;

        return (
          <div key={step.n} className="flex items-center">
            {/* Step circle */}
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(step.n)}
              className={cn(
                "flex flex-col items-center gap-1 group disabled:cursor-default",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors border-2",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {done ? <Check size={14} strokeWidth={3} /> : step.n}
              </div>
              <span
                className={cn(
                  "text-[10px] whitespace-nowrap",
                  active ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 mx-1 mb-4 rounded-full transition-colors",
                  done ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
