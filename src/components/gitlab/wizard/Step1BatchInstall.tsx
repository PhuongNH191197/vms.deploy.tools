import { useRef, useState } from "react";
import { ChevronRight, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useServerStore } from "@/store/serverStore";
import { checkGitlabRunnerInstalled, batchInstallGitlabRunner } from "@/lib/tauri/gitlabRunner";
import type { CheckInstallResult } from "@/lib/tauri/gitlabRunner";
import { cn } from "@/lib/utils";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";

interface Props {
  onNext: (serverIds: string[]) => void;
}

type ServerInstallStatus = "unchecked" | "checking" | "installed" | "not_installed" | "installing" | "done" | "error";

interface ServerState {
  id: string;
  name: string;
  status: ServerInstallStatus;
  checkResult: CheckInstallResult | null;
  log: string[];
  logOpen: boolean;
}

interface InstallEvent { line: string; done: boolean; error: boolean; }

export default function Step1BatchInstall({ onNext }: Props) {
  const { servers } = useServerStore();
  const { setBatchSelectedServers } = useGitLabRunnerStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [serverStates, setServerStates] = useState<Record<string, ServerState>>({});
  const [isInstalling, setIsInstalling] = useState(false);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const updateServer = (id: string, patch: Partial<ServerState>) => {
    setServerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const toggleSelect = async (serverId: string) => {
    const next = new Set(selected);
    if (next.has(serverId)) {
      next.delete(serverId);
    } else {
      next.add(serverId);
      const server = servers.find((s) => s.id === serverId)!;
      if (!serverStates[serverId]) {
        setServerStates((prev) => ({
          ...prev,
          [serverId]: { id: serverId, name: server.name, status: "checking", checkResult: null, log: [], logOpen: false },
        }));
        const result = await checkGitlabRunnerInstalled(serverId).catch((e) => ({
          installed: false, version: null, error: String(e),
        }));
        updateServer(serverId, {
          status: result.installed ? "installed" : "not_installed",
          checkResult: result,
        });
      }
    }
    setSelected(next);
  };

  const handleSelectAll = () => {
    if (selected.size === servers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(servers.map((s) => s.id)));
      // Check all unvisited
      for (const s of servers) {
        if (!serverStates[s.id]) toggleSelect(s.id);
      }
    }
  };

  const handleInstallAll = async () => {
    const toInstall = [...selected].filter((id) => serverStates[id]?.status === "not_installed");
    if (toInstall.length === 0) return;

    setIsInstalling(true);

    // Set all to installing
    for (const id of toInstall) {
      updateServer(id, { status: "installing", log: [] });
    }

    // Subscribe to events
    for (const id of toInstall) {
      const eventId = `gitlab_runner_install_${id}`;
      const unlisten = await listen<InstallEvent>(eventId, ({ payload }) => {
        setServerStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            log: [...(prev[id]?.log ?? []), payload.line],
            ...(payload.done ? { status: payload.error ? "error" : "done" } : {}),
          },
        }));
      });
      unlistenersRef.current.push(unlisten);
    }

    await batchInstallGitlabRunner(toInstall).catch(() => {});
    setIsInstalling(false);
  };

  const retryServer = async (serverId: string) => {
    updateServer(serverId, { status: "installing", log: [] });
    const eventId = `gitlab_runner_install_${serverId}`;
    const unlisten = await listen<InstallEvent>(eventId, ({ payload }) => {
      setServerStates((prev) => ({
        ...prev,
        [serverId]: {
          ...prev[serverId],
          log: [...(prev[serverId]?.log ?? []), payload.line],
          ...(payload.done ? { status: payload.error ? "error" : "done" } : {}),
        },
      }));
    });
    unlistenersRef.current.push(unlisten);
    await batchInstallGitlabRunner([serverId]).catch(() => {});
  };

  const allOk = [...selected].every((id) => {
    const s = serverStates[id];
    return s?.status === "installed" || s?.status === "done";
  });

  const notInstalledCount = [...selected].filter((id) => serverStates[id]?.status === "not_installed").length;

  const handleNext = () => {
    const ids = [...selected];
    setBatchSelectedServers(ids);
    onNext(ids);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Chọn server ({selected.size} đã chọn)</h3>
        <button
          onClick={handleSelectAll}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {selected.size === servers.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
        </button>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {servers.map((server) => {
          const st = serverStates[server.id];
          const isChecked = selected.has(server.id);

          return (
            <div
              key={server.id}
              className={cn(
                "border rounded-lg overflow-hidden transition-colors",
                isChecked ? "border-blue-500/30 bg-blue-500/5" : "border-white/10 bg-white/[0.02]"
              )}
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(server.id)}
                  className="w-4 h-4 accent-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{server.name}</div>
                  <div className="text-xs text-white/40">{server.host}</div>
                </div>

                {/* Status badge */}
                {st?.status === "checking" && (
                  <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                )}
                {st?.status === "installed" && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" /> Đã cài
                  </span>
                )}
                {st?.status === "not_installed" && (
                  <span className="text-xs text-white/40">Chưa cài</span>
                )}
                {(st?.status === "installing") && (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                )}
                {st?.status === "done" && (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                {st?.status === "error" && (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}

                {/* Log toggle */}
                {st && st.log.length > 0 && (
                  <button
                    onClick={() => updateServer(server.id, { logOpen: !st.logOpen })}
                    className="text-white/30 hover:text-white/60"
                  >
                    {st.logOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}

                {/* Retry */}
                {st?.status === "error" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-red-400"
                    onClick={() => retryServer(server.id)}
                  >
                    Thử lại
                  </Button>
                )}
              </div>

              {/* Collapsible log */}
              {st?.logOpen && st.log.length > 0 && (
                <div className="bg-black/40 border-t border-white/10 p-2 max-h-28 overflow-y-auto font-mono text-xs space-y-0.5">
                  {st.log.map((line, i) => (
                    <div key={i} className={cn(
                      "text-green-300",
                      line.startsWith("[STEP") && "text-blue-300",
                      line.includes("FAILED") && "text-red-400",
                    )}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Install button */}
      {notInstalledCount > 0 && !isInstalling && (
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleInstallAll}
        >
          Cài đặt {notInstalledCount} server chưa có
        </Button>
      )}

      {isInstalling && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang cài đặt song song...
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-white/40">
          {selected.size === 0 ? "Chưa chọn server" : `${selected.size} server được chọn`}
        </p>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={selected.size < 1 || !allOk}
          onClick={handleNext}
        >
          Tiếp theo
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
