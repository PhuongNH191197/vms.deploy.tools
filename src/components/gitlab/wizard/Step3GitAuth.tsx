import { useRef, useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, AlertTriangle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { setupGitAuth } from "@/lib/tauri/gitlabRunner";
import { cn } from "@/lib/utils";

interface Props {
  serverId: string;
  gitlabUrl: string;
  onNext: () => void;
  onSkip: () => void;
}

interface InstallEvent { line: string; done: boolean; error: boolean; }

export default function Step3GitAuth({ serverId, gitlabUrl, onNext, onSkip }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testRepoUrl, setTestRepoUrl] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupLog, setSetupLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const handleSetup = async () => {
    if (!username || !password) return;
    setIsSettingUp(true);
    setSetupLog([]);
    setDone(false);
    setHasError(false);

    const eventId = `gitlab_git_auth_${serverId}`;
    let unlisten: UnlistenFn | null = null;

    unlisten = await listen<InstallEvent>(eventId, ({ payload }) => {
      setSetupLog((prev) => [...prev, payload.line]);
      if (payload.done) {
        setDone(!payload.error);
        setHasError(payload.error);
        setIsSettingUp(false);
        unlisten?.();
      }
    });

    try {
      await setupGitAuth({
        server_id: serverId,
        gitlab_url: gitlabUrl,
        git_username: username,
        git_password: password,
        test_repo_url: testRepoUrl,
      });
    } catch (e) {
      setSetupLog((prev) => [...prev, `Error: ${e}`]);
      setHasError(true);
      setIsSettingUp(false);
      unlisten?.();
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Lưu credentials cho user <code className="text-white/70">gitlab-runner</code> để
        tự động clone repo mà không cần đăng nhập.
      </p>

      <div className="space-y-3">
        {/* GitLab URL (readonly) */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">GitLab URL</Label>
          <Input
            value={gitlabUrl}
            readOnly
            className="bg-white/5 border-white/10 text-white/50 h-9 cursor-not-allowed"
          />
        </div>

        {/* Username */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Username *</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="phuongnh"
            className="bg-white/5 border-white/15 text-white h-9"
          />
        </div>

        {/* Password / PAT */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Password / Personal Access Token *</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Xe6H8gdTFvgQM-o8szD9"
              className="bg-white/5 border-white/15 text-white h-9 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-white/30">
            Sẽ lưu dưới dạng: https://{username || "username"}:****@{gitlabUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </p>
        </div>

        {/* Test Repo URL (optional) */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Test Repository URL <span className="text-white/30">(tuỳ chọn)</span></Label>
          <Input
            value={testRepoUrl}
            onChange={(e) => setTestRepoUrl(e.target.value)}
            placeholder={`${gitlabUrl}group/repo.git`}
            className="bg-white/5 border-white/15 text-white h-9"
          />
          <p className="text-xs text-white/30">Để trống nếu không muốn test clone</p>
        </div>
      </div>

      {/* Log panel */}
      {setupLog.length > 0 && (
        <div
          ref={logRef}
          className="bg-black/60 border border-white/10 rounded-lg p-3 h-36 overflow-y-auto font-mono text-xs space-y-0.5"
        >
          {setupLog.map((line, i) => (
            <div key={i} className={cn(
              "text-green-300",
              line.startsWith("[STEP") && "text-blue-300 font-medium mt-1",
              line.startsWith("[credentials saved") && "text-yellow-300",
              line.includes("thất bại") && "text-red-400",
            )}>
              {line}
            </div>
          ))}
          {isSettingUp && (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang xử lý...
            </div>
          )}
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4" />
          Setup thất bại. Kiểm tra username/password và URL repo.
          <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={handleSetup}>
            Thử lại
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" className="text-white/40 hover:text-white" onClick={onSkip}>
          <SkipForward className="w-4 h-4 mr-1" />
          Bỏ qua
        </Button>

        <div className="flex gap-2">
          {!done && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!username || !password || isSettingUp}
              onClick={handleSetup}
            >
              {isSettingUp ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang setup...</>
              ) : "Lưu credentials"}
            </Button>
          )}
          {done && (
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
