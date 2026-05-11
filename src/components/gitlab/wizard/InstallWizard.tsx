import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import Step1Install from "./Step1Install";
import Step2Register from "./Step2Register";
import Step3GitAuth from "./Step3GitAuth";
import Step4Done from "./Step4Done";
import Step1BatchInstall from "./Step1BatchInstall";
import Step2BatchRegister from "./Step2BatchRegister";
import Step3BatchGitAuth from "./Step3BatchGitAuth";
import Step4BatchDone from "./Step4BatchDone";

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

const SINGLE_STEPS = ["Cài đặt", "Đăng ký", "Git Auth", "Xong"];
const BATCH_STEPS  = ["Chọn Server", "Đăng ký", "Git Auth", "Xong"];

export default function InstallWizard({ onComplete, onCancel }: Props) {
  const { wizardMode } = useGitLabRunnerStore();

  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState<{
    serverId: string;
    serverName: string;
    gitlabUrl: string;
    runnerName: string;
    tags: string;
    projectName: string;
    note: string;
    runnerIdLocal: number;
    batchServerIds: string[];
    batchGitlabUrl: string;
    batchProjectName: string;
  }>({
    serverId: "",
    serverName: "",
    gitlabUrl: "",
    runnerName: "",
    tags: "",
    projectName: "",
    note: "",
    runnerIdLocal: 0,
    batchServerIds: [],
    batchGitlabUrl: "",
    batchProjectName: "",
  });

  const steps = wizardMode === "batch" ? BATCH_STEPS : SINGLE_STEPS;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0d1425] border border-white/15 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">
              {wizardMode === "batch" ? "Cài đặt nhiều server" : "Thêm GitLab Runner"}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {steps.map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 text-xs ${
                      idx + 1 === step
                        ? "text-blue-400"
                        : idx + 1 < step
                        ? "text-white/50"
                        : "text-white/25"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                        idx + 1 === step
                          ? "bg-blue-500/30 border-blue-500/60 text-blue-300"
                          : idx + 1 < step
                          ? "bg-white/10 border-white/20 text-white/60"
                          : "bg-transparent border-white/15 text-white/20"
                      }`}
                    >
                      {idx + 1 < step ? "✓" : idx + 1}
                    </div>
                    {label}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-6 h-px bg-white/10" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/40 hover:text-white"
            onClick={onCancel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {wizardMode === "single" ? (
            <>
              {step === 1 && (
                <Step1Install
                  initialServerId={wizardData.serverId}
                  onNext={(serverId, serverName) => {
                    setWizardData((d) => ({ ...d, serverId, serverName }));
                    setStep(2);
                  }}
                />
              )}
              {step === 2 && (
                <Step2Register
                  serverId={wizardData.serverId}
                  serverName={wizardData.serverName}
                  onNext={(data) => {
                    setWizardData((d) => ({ ...d, ...data }));
                    setStep(3);
                  }}
                />
              )}
              {step === 3 && (
                <Step3GitAuth
                  serverId={wizardData.serverId}
                  gitlabUrl={wizardData.gitlabUrl}
                  onNext={() => setStep(4)}
                  onSkip={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <Step4Done
                  serverName={wizardData.serverName}
                  runnerName={wizardData.runnerName}
                  tags={wizardData.tags}
                  gitlabUrl={wizardData.gitlabUrl}
                  onDone={onComplete}
                />
              )}
            </>
          ) : (
            <>
              {step === 1 && (
                <Step1BatchInstall
                  onNext={(serverIds) => {
                    setWizardData((d) => ({ ...d, batchServerIds: serverIds }));
                    setStep(2);
                  }}
                />
              )}
              {step === 2 && (
                <Step2BatchRegister
                  serverIds={wizardData.batchServerIds}
                  onNext={(gitlabUrl, projectName) => {
                    setWizardData((d) => ({ ...d, batchGitlabUrl: gitlabUrl, batchProjectName: projectName }));
                    setStep(3);
                  }}
                />
              )}
              {step === 3 && (
                <Step3BatchGitAuth
                  serverIds={wizardData.batchServerIds}
                  gitlabUrl={wizardData.batchGitlabUrl}
                  onNext={() => setStep(4)}
                  onSkip={() => setStep(4)}
                />
              )}
              {step === 4 && (
                <Step4BatchDone
                  onDone={onComplete}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
