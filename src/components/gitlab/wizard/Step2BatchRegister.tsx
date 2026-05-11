import { useRef, useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { batchRegisterGitlabRunner } from "@/lib/tauri/gitlabRunner";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import { useServerStore } from "@/store/serverStore";
import { cn } from "@/lib/utils";
import type { BatchRegisterResult } from "@/lib/tauri/gitlabRunner";

interface Props {
  serverIds: string[];
  onNext: (gitlabUrl: string, projectName: string) => void;
}

type PerServerStatus = "pending" | "done" | "error";

export default function Step2BatchRegister({ serverIds, onNext }: Props) {
  const { batchRegisterConfigs, setBatchRegisterConfig } = useGitLabRunnerStore();
  const { servers } = useServerStore();

  const [gitlabUrl, setGitlabUrl] = useState("https://");
  const [regToken, setRegToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [projectName, setProjectName] = useState("");

  const [expandedServer, setExpandedServer] = useState<string | null>(serverIds[0] ?? null);
  const [perServerStatus, setPerServerStatus] = useState<Record<string, PerServerStatus>>({});
  const [perServerMsg, setPerServerMsg] = useState<Record<string, string>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [_results, setResults] = useState<BatchRegisterResult[]>([]);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const getServerName = (id: string) => servers.find((s) => s.id === id)?.name ?? id;

  const getConfig = (id: string) => batchRegisterConfigs[id] ?? {
    server_id: id,
    runner_name: `runner-${getServerName(id).toLowerCase().replace(/\s+/g, "-")}`,
    tags: "",
    maintenance_note: "",
  };

  const handleCopyToAll = (field: "runner_name" | "tags" | "maintenance_note", value: string) => {
    for (const id of serverIds) {
      setBatchRegisterConfig(id, { ...getConfig(id), [field]: value });
    }
  };

  const handleRegisterAll = async () => {
    if (!gitlabUrl || !regToken || !projectName) return;
    setIsRegistering(true);
    setPerServerStatus({});
    setPerServerMsg({});

    // Subscribe to all event streams
    for (const id of serverIds) {
      const eventId = `gitlab_runner_register_${id}`;
      const unlisten = await listen<{ line: string; done: boolean; error: boolean }>(
        eventId,
        ({ payload }) => {
          if (payload.done) {
            setPerServerStatus((prev) => ({
              ...prev,
              [id]: payload.error ? "error" : "done",
            }));
            if (payload.error) {
              setPerServerMsg((prev) => ({ ...prev, [id]: payload.line }));
            }
          }
        }
      );
      unlistenersRef.current.push(unlisten);
    }

    try {
      const res = await batchRegisterGitlabRunner({
        gitlab_url: gitlabUrl.trim().replace(/\/$/, "") + "/",
        registration_token: regToken,
        project_name: projectName.trim(),
        runners: serverIds.map((id) => getConfig(id)),
      });
      setResults(res);
      // Update statuses from results
      for (const r of res) {
        setPerServerStatus((prev) => ({
          ...prev,
          [r.server_id]: r.success ? "done" : "error",
        }));
        if (!r.success && r.error) {
          setPerServerMsg((prev) => ({ ...prev, [r.server_id]: r.error ?? "" }));
        }
      }
    } catch (e) {
      // noop
    } finally {
      setIsRegistering(false);
      for (const u of unlistenersRef.current) u();
      unlistenersRef.current = [];
    }
  };

  const allDone = serverIds.length > 0 && serverIds.every((id) => perServerStatus[id] === "done");
  const canRegister = gitlabUrl && regToken && projectName
    && serverIds.every((id) => getConfig(id).runner_name.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Shared fields */}
      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">Thông tin chung</h4>

        <div className="space-y-1">
          <Label className="text-xs text-white/60">GitLab URL *</Label>
          <div className="flex gap-2">
            <Input
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              placeholder="https://git.elcomlab.com/"
              className="bg-white/5 border-white/15 text-white h-8 text-sm flex-1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-white/60">Registration Token *</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={regToken}
              onChange={(e) => setRegToken(e.target.value)}
              placeholder="GR13489419xxxx"
              className="bg-white/5 border-white/15 text-white h-8 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-white/60">Project Name *</Label>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Elcom-CMS"
            className="bg-white/5 border-white/15 text-white h-8 text-sm"
          />
        </div>
      </div>

      {/* Per-server accordions */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {serverIds.map((id) => {
          const cfg = getConfig(id);
          const status = perServerStatus[id];
          const isOpen = expandedServer === id;

          return (
            <div
              key={id}
              className={cn(
                "border rounded-lg overflow-hidden",
                status === "done" && "border-green-500/30",
                status === "error" && "border-red-500/30",
                !status && "border-white/10",
              )}
            >
              <button
                onClick={() => setExpandedServer(isOpen ? null : id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">{getServerName(id)}</span>
                  <span className="text-xs text-white/30">{cfg.runner_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === "done" && <span className="text-xs text-green-400">✓ OK</span>}
                  {status === "error" && <span className="text-xs text-red-400">✗ Fail</span>}
                  {!status && <span className="text-xs text-white/30">⏳</span>}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/10 p-3 space-y-2 bg-white/[0.01]">
                  <div className="space-y-1">
                    <Label className="text-xs text-white/50">Runner Name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={cfg.runner_name}
                        onChange={(e) => setBatchRegisterConfig(id, { ...cfg, runner_name: e.target.value })}
                        className="bg-white/5 border-white/15 text-white h-7 text-xs flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-white/50">Tags</Label>
                      <button
                        onClick={() => handleCopyToAll("tags", cfg.tags)}
                        className="text-xs text-blue-400/60 hover:text-blue-400 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy sang tất cả
                      </button>
                    </div>
                    <Input
                      value={cfg.tags}
                      onChange={(e) => setBatchRegisterConfig(id, { ...cfg, tags: e.target.value })}
                      placeholder="vms-thanh-hoa,shell"
                      className="bg-white/5 border-white/15 text-white h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-white/50">Note</Label>
                    <Input
                      value={cfg.maintenance_note}
                      onChange={(e) => setBatchRegisterConfig(id, { ...cfg, maintenance_note: e.target.value })}
                      className="bg-white/5 border-white/15 text-white h-7 text-xs"
                    />
                  </div>
                  {status === "error" && perServerMsg[id] && (
                    <p className="text-xs text-red-400">{perServerMsg[id]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Register button */}
      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-white/40">
          {serverIds.length} server
        </span>
        <div className="flex gap-2">
          {!allDone && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canRegister || isRegistering}
              onClick={handleRegisterAll}
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang đăng ký...
                </>
              ) : (
                `Đăng ký tất cả (${serverIds.length} server)`
              )}
            </Button>
          )}
          {allDone && (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onNext(gitlabUrl.trim().replace(/\/$/, "") + "/", projectName)}
            >
              Tiếp theo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
