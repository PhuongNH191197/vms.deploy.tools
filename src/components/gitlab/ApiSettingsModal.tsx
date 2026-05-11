import { useEffect, useState } from "react";
import { X, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import { saveGitlabApiSettings } from "@/lib/tauri/gitlabRunner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiSettingsModal({ open, onClose }: Props) {
  const { apiSettings, loadApiSettings } = useGitLabRunnerStore();

  const [gitlabUrl, setGitlabUrl] = useState("https://");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Pre-fill if settings already loaded
      if (apiSettings) {
        setGitlabUrl(apiSettings.gitlab_url);
        setDescription(apiSettings.description);
      }
    }
  }, [open, apiSettings]);

  const handleUrlBlur = async () => {
    if (gitlabUrl && gitlabUrl.startsWith("http")) {
      await loadApiSettings(gitlabUrl.trim().replace(/\/$/, "") + "/");
    }
  };

  const handleSave = async () => {
    if (!gitlabUrl || !apiToken) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveGitlabApiSettings({
        gitlab_url: gitlabUrl.trim().replace(/\/$/, "") + "/",
        api_token: apiToken,
        description,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadApiSettings(gitlabUrl.trim().replace(/\/$/, "") + "/");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d1425] border border-white/15 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">GitLab API Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/40 hover:text-white"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-white/40">
            Lưu Personal Access Token để kiểm tra trạng thái runner qua GitLab API.
            Token cần scope: <code className="text-white/60">read_api</code>
          </p>

          {/* GitLab URL */}
          <div className="space-y-1">
            <Label className="text-xs text-white/60">GitLab URL *</Label>
            <Input
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://git.elcomlab.com/"
              className="bg-white/5 border-white/15 text-white h-9"
            />
          </div>

          {/* API Token */}
          <div className="space-y-1">
            <Label className="text-xs text-white/60">API Token *</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="glpat-xxxxxxxxxxxx"
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
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs text-white/60">Mô tả (tuỳ chọn)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Elcom GitLab Production"
              className="bg-white/5 border-white/15 text-white h-9"
            />
          </div>

          {/* Existing config notice */}
          {apiSettings?.has_token && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã cấu hình cho {apiSettings.gitlab_url}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button
            variant="ghost"
            className="text-white/50 hover:text-white"
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!gitlabUrl || !apiToken || isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-300" />
            ) : null}
            {saved ? "Đã lưu!" : apiSettings?.has_token ? "Cập nhật" : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
