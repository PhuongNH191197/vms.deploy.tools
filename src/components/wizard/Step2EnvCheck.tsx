// Step 2 — Kiểm tra & Cài đặt Môi trường
// Reuses env check logic; server credential passed via parent/store
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import Terminal from "@/components/Terminal";
import { checkEnvTools, installEnvTool } from "@/lib/tauri/commands";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { ToolCheckResult } from "@/types";

const ALL_TOOLS = ["docker", "docker-compose", "git", "curl", "wget", "dotnet", "ffmpeg", "openssl", "jq", "htop", "unzip"];

export default function Step2EnvCheck() {
  const { selectedServerId, credential, setEnvResults, nextStep, prevStep } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ToolCheckResult[]>([]);
  const [installTool, setInstallTool] = useState<string | null>(null);
  const [installEventId, setInstallEventId] = useState("");
  const [error, setError] = useState("");

  if (!server) return null;

  const handleCheckAll = async () => {
    setChecking(true); setError(""); setResults([]);
    try {
      const res = await checkEnvTools({ host: server.host, port: server.port, username: server.username, authType: server.auth_type, credential, tools: ALL_TOOLS });
      setResults(res);
      setEnvResults(res);
    } catch (e) { setError(String(e)); }
    finally { setChecking(false); }
  };

  const handleInstall = async (tool: string) => {
    const eid = `wiz-install-${tool}-${Date.now()}`;
    setInstallTool(tool); setInstallEventId(eid);
    await installEnvTool({ host: server.host, port: server.port, username: server.username, authType: server.auth_type, credential, tool, eventId: eid });
  };

  const installed = results.filter((r) => r.installed);
  const missing = results.filter((r) => !r.installed);
  const progress = results.length > 0 ? Math.round((installed.length / results.length) * 100) : 0;
  const allOk = results.length > 0 && missing.length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 2 — Kiểm tra & Cài đặt Môi trường</h2>
        <p className="text-sm text-muted-foreground">Server: <code className="font-mono">{server.host}</code></p>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleCheckAll} disabled={checking}>
          {checking && <Loader2 size={14} className="mr-1 animate-spin" />}Check All
        </Button>
        {missing.length > 0 && (
          <Button variant="outline" onClick={() => missing.forEach((t) => handleInstall(t.name))}>
            <Download size={13} className="mr-1" />Install Missing ({missing.length})
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{installed.length}/{results.length} installed</span><span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {results.length > 0 && (
        <ScrollArea className="h-48 border rounded-lg">
          <div className="p-3 space-y-1">
            {results.map((r) => (
              <div key={r.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20">
                <div className="flex items-center gap-2">
                  {r.installed ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-destructive" />}
                  <span className="text-sm font-mono">{r.name}</span>
                  {r.version && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{r.version}</span>}
                </div>
                {!r.installed && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleInstall(r.name)}>
                    <Download size={11} className="mr-1" />Install
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {installTool && installEventId && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Installing: <code>{installTool}</code></p>
          <Terminal eventId={installEventId} className="h-36" onDone={() => handleCheckAll()} />
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep} disabled={!allOk}>Tiếp theo →</Button>
      </div>
    </div>
  );
}
