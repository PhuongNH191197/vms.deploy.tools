import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useServerStore } from "@/store/serverStore";
import { checkGitlabRunnerInstalled, installGitlabRunner } from "@/lib/tauri/gitlabRunner";
import type { CheckInstallResult } from "@/lib/tauri/gitlabRunner";
import { cn } from "@/lib/utils";

interface Props {
  initialServerId?: string;
  onNext: (serverId: string, serverName: string) => void;
}

interface InstallEvent { line: string; done: boolean; error: boolean; }

export default function Step1Install({ initialServerId, onNext }: Props) {
  const { servers } = useServerStore();
  const [selectedId, setSelectedId] = useState(initialServerId ?? "");
  const [checkResult, setCheckResult] = useState<CheckInstallResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installDone, setInstallDone] = useState(false);
  const [installError, setInstallError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialServerId) handleSelectServer(initialServerId);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [installLog]);

  const handleSelectServer = async (id: string) => {
    setSelectedId(id);
    setCheckResult(null);
    setInstallLog([]);
    setInstallDone(false);
    setInstallError(false);
    if (!id) return;

    setIsChecking(true);
    try {
      const result = await checkGitlabRunnerInstalled(id);
      setCheckResult(result);
    } catch (e) {
      setCheckResult({ installed: false, version: null, error: String(e) });
    } finally {
      setIsChecking(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedId) return;
    setIsInstalling(true);
    setInstallLog([]);
    setInstallDone(false);
    setInstallError(false);

    const eventId = `gitlab_runner_install_${selectedId}`;
    let unlisten: UnlistenFn | null = null;

    unlisten = await listen<InstallEvent>(eventId, ({ payload }) => {
      setInstallLog((prev) => [...prev, payload.line]);
      if (payload.done) {
        setInstallDone(!payload.error);
        setInstallError(payload.error);
        setIsInstalling(false);
        unlisten?.();
      }
    });

    try {
      await installGitlabRunner(selectedId);
    } catch (e) {
      setInstallLog((prev) => [...prev, `Error: ${e}`]);
      setInstallError(true);
      setIsInstalling(false);
      unlisten?.();
    }
  };

  const canProceed = checkResult?.installed || installDone;
  const serverName = servers.find((s) => s.id === selectedId)?.name ?? selectedId;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-white mb-1">Chọn server</h3>
        <Select value={selectedId} onValueChange={handleSelectServer}>
          <SelectTrigger className="bg-white/5 border-white/15 text-white h-9">
            <SelectValue placeholder="Chọn server..." />
          </SelectTrigger>
          <SelectContent className="bg-[#0d1425] border-white/15">
            {servers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({s.host})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Check result */}
      {isChecking && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang kiểm tra gitlab-runner...
        </div>
      )}

      {checkResult && !isChecking && (
        <div className={cn(
          "flex items-start gap-3 p-3 rounded-lg border text-sm",
          checkResult.installed
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-white/5 border-white/15 text-white/60"
        )}>
          {checkResult.installed ? (
            <>
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Đã cài gitlab-runner</div>
                <div className="text-xs mt-0.5 opacity-80">{checkResult.version}</div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-white/60 hover:text-white"
                    onClick={() => setCheckResult({ ...checkResult, installed: false })}
                  >
                    Cài lại
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
              <div>
                <div>Chưa cài gitlab-runner</div>
                {checkResult.error && (
                  <div className="text-xs text-red-400 mt-0.5">{checkResult.error}</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Install button */}
      {checkResult && !checkResult.installed && !isInstalling && !installDone && (
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleInstall}
          disabled={!selectedId}
        >
          Cài đặt gitlab-runner
        </Button>
      )}

      {/* Log panel */}
      {(isInstalling || installLog.length > 0) && (
        <div
          ref={logRef}
          className="bg-black/60 border border-white/10 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-green-300 space-y-0.5"
        >
          {installLog.map((line, i) => (
            <div key={i} className={cn(
              line.startsWith("[STEP") && "text-blue-300 font-medium mt-1",
              (line.startsWith("FAILED") || installError) && i === installLog.length - 1 && "text-red-400",
            )}>
              {line}
            </div>
          ))}
          {isInstalling && (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang cài đặt...
            </div>
          )}
        </div>
      )}

      {installError && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4" />
          Cài đặt thất bại.
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-red-400 hover:text-red-300"
            onClick={handleInstall}
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!canProceed}
          onClick={() => onNext(selectedId, serverName)}
        >
          Tiếp theo
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
