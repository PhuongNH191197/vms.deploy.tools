import { useRef, useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { batchSetupGitAuth } from "@/lib/tauri/gitlabRunner";
import { useServerStore } from "@/store/serverStore";
import { cn } from "@/lib/utils";

interface Props {
  serverIds: string[];
  gitlabUrl: string;
  onNext: () => void;
  onSkip: () => void;
}

type Status = "pending" | "running" | "done" | "error";

export default function Step3BatchGitAuth({ serverIds, gitlabUrl, onNext, onSkip }: Props) {
  const { servers } = useServerStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testRepoUrls, setTestRepoUrls] = useState<Record<string, string>>(
    Object.fromEntries(serverIds.map((id) => [id, ""]))
  );

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSettingUp, setIsSettingUp] = useState(false);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const getServerName = (id: string) => servers.find((s) => s.id === id)?.name ?? id;

  const handleSetupAll = async () => {
    if (!username || !password) return;
    setIsSettingUp(true);
    setStatuses(Object.fromEntries(serverIds.map((id) => [id, "running" as Status])));
    setErrors({});

    for (const id of serverIds) {
      const eventId = `gitlab_git_auth_${id}`;
      const unlisten = await listen<{ line: string; done: boolean; error: boolean }>(
        eventId,
        ({ payload }) => {
          if (payload.done) {
            setStatuses((prev) => ({ ...prev, [id]: payload.error ? "error" : "done" }));
            if (payload.error) {
              setErrors((prev) => ({ ...prev, [id]: payload.line }));
            }
          }
        }
      );
      unlistenersRef.current.push(unlisten);
    }

    try {
      await batchSetupGitAuth({
        git_username: username,
        git_password: password,
        setups: serverIds.map((id) => ({
          server_id: id,
          gitlab_url: gitlabUrl,
          test_repo_url: testRepoUrls[id] ?? "",
        })),
      });
    } catch (_) {
    } finally {
      setIsSettingUp(false);
      for (const u of unlistenersRef.current) u();
      unlistenersRef.current = [];
    }
  };

  const allDone = serverIds.every((id) => statuses[id] === "done");
  const gitlabHost = gitlabUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Lưu credentials cho user <code className="text-white/70">gitlab-runner</code> trên tất cả {serverIds.length} server.
      </p>

      {/* Shared credentials */}
      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 space-y-3">
        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">Credentials dùng chung</h4>

        <div className="space-y-1">
          <Label className="text-xs text-white/60">Username *</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="phuongnh"
            className="bg-white/5 border-white/15 text-white h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-white/60">Password / PAT *</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Xe6H8gdTFvgQM-o8szD9"
              className="bg-white/5 border-white/15 text-white h-8 text-sm pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {username && (
            <p className="text-xs text-white/30">
              → https://{username}:****@{gitlabHost}
            </p>
          )}
        </div>
      </div>

      {/* Per-server test repo (optional) */}
      <div className="space-y-2 max-h-52 overflow-y-auto">
        {serverIds.map((id) => {
          const status = statuses[id] ?? "pending";
          return (
            <div
              key={id}
              className={cn(
                "flex items-center gap-2 p-2 rounded border",
                status === "done"    && "border-green-500/20 bg-green-500/5",
                status === "error"   && "border-red-500/20 bg-red-500/5",
                status === "running" && "border-blue-500/20 bg-blue-500/5",
                status === "pending" && "border-white/10 bg-white/[0.02]",
              )}
            >
              <div className="w-20 shrink-0 text-xs text-white/60 truncate">{getServerName(id)}</div>
              <Input
                value={testRepoUrls[id] ?? ""}
                onChange={(e) => setTestRepoUrls((prev) => ({ ...prev, [id]: e.target.value }))}
                placeholder={`${gitlabUrl}group/repo.git (tuỳ chọn)`}
                className="bg-white/5 border-white/10 text-white h-7 text-xs flex-1"
              />
              <div className="w-16 text-xs shrink-0 text-right">
                {status === "pending" && <span className="text-white/30">⏳</span>}
                {status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 inline" />}
                {status === "done"    && <span className="text-green-400">✓ OK</span>}
                {status === "error"   && <span className="text-red-400 truncate" title={errors[id]}>✗ Fail</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" className="text-white/40 hover:text-white" onClick={onSkip}>
          <SkipForward className="w-4 h-4 mr-1" />
          Bỏ qua
        </Button>

        <div className="flex gap-2">
          {!allDone && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!username || !password || isSettingUp}
              onClick={handleSetupAll}
            >
              {isSettingUp ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang setup...</>
              ) : `Lưu credentials (${serverIds.length} server)`}
            </Button>
          )}
          {allDone && (
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={onNext}>
              Tiếp theo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
