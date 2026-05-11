import { useState } from "react";
import { Eye, EyeOff, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerGitlabRunner } from "@/lib/tauri/gitlabRunner";

interface Props {
  serverId: string;
  serverName: string;
  onNext: (data: {
    gitlabUrl: string;
    runnerName: string;
    tags: string;
    projectName: string;
    note: string;
    runnerIdLocal: number;
  }) => void;
}

function validateTags(tags: string): boolean {
  if (!tags) return true;
  return /^[a-z0-9,\-\s]*$/i.test(tags);
}

export default function Step2Register({ serverId, serverName, onNext }: Props) {
  const [gitlabUrl, setGitlabUrl] = useState("https://");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [runnerName, setRunnerName] = useState(`runner-${serverName.toLowerCase().replace(/\s+/g, "-")}`);
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [projectName, setProjectName] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors: Record<string, string> = {};
  if (gitlabUrl && !gitlabUrl.startsWith("http")) errors.url = "URL phải bắt đầu bằng http:// hoặc https://";
  if (runnerName && /[^a-zA-Z0-9\-_.]/.test(runnerName)) errors.name = "Chỉ dùng a-z, 0-9, -, _, .";
  if (tags && !validateTags(tags)) errors.tags = "Tags chỉ dùng a-z, 0-9, dấu phẩy, dấu gạch ngang";

  const canSubmit = gitlabUrl && token && runnerName && projectName
    && Object.keys(errors).length === 0 && !isRegistering;

  const handleRegister = async () => {
    setError(null);
    setIsRegistering(true);
    try {
      const result = await registerGitlabRunner({
        server_id: serverId,
        gitlab_url: gitlabUrl.trim().replace(/\/$/, "") + "/",
        registration_token: token,
        runner_name: runnerName.trim(),
        tags: tags.toLowerCase().replace(/\s/g, ""),
        maintenance_note: note,
        project_name: projectName.trim(),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      onNext({
        gitlabUrl: gitlabUrl.trim().replace(/\/$/, "") + "/",
        runnerName: runnerName.trim(),
        tags: tags.toLowerCase().replace(/\s/g, ""),
        projectName: projectName.trim(),
        note,
        runnerIdLocal: result.runner_id_local,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {/* GitLab URL */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">GitLab URL *</Label>
          <Input
            value={gitlabUrl}
            onChange={(e) => setGitlabUrl(e.target.value)}
            placeholder="https://git.elcomlab.com/"
            className="bg-white/5 border-white/15 text-white h-9"
          />
          {errors.url && <p className="text-xs text-red-400">{errors.url}</p>}
        </div>

        {/* Registration Token */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Registration Token *</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GR13489419xxxx"
              className="bg-white/5 border-white/15 text-white h-9 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-white/30">GitLab Project → Settings → CI/CD → Runners</p>
        </div>

        {/* Runner Name */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Runner Name *</Label>
          <Input
            value={runnerName}
            onChange={(e) => setRunnerName(e.target.value)}
            className="bg-white/5 border-white/15 text-white h-9"
          />
          {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Tags (tuỳ chọn)</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vms-thanh-hoa,shell"
            className="bg-white/5 border-white/15 text-white h-9"
          />
          {errors.tags && <p className="text-xs text-red-400">{errors.tags}</p>}
          <p className="text-xs text-white/30">Phân tách bằng dấu phẩy, chữ thường</p>
        </div>

        {/* Project Name */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Project Name *</Label>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Elcom-CMS"
            className="bg-white/5 border-white/15 text-white h-9"
          />
          <p className="text-xs text-white/30">Tên nhóm logic để phân loại runner</p>
        </div>

        {/* Maintenance Note */}
        <div className="space-y-1">
          <Label className="text-xs text-white/60">Maintenance Note (tuỳ chọn)</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú nội bộ"
            className="bg-white/5 border-white/15 text-white h-9"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!canSubmit}
          onClick={handleRegister}
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang đăng ký...
            </>
          ) : (
            <>
              Đăng ký Runner
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
