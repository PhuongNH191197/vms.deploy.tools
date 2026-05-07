import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, Loader2, ChevronRight, Settings,
  Download, Eye, EyeOff,
} from "lucide-react";
import Terminal from "@/components/Terminal";
import { checkEnvTools, installEnvTool } from "@/lib/tauri/commands";
import type { ToolCheckResult } from "@/types";

const ALL_TOOLS = [
  "docker", "docker-compose", "git", "curl", "wget",
  "dotnet", "ffmpeg", "openssl", "jq", "htop", "unzip",
];

interface ConnInfo {
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  credential: string;
}

type CheckState = "idle" | "checking" | "done";
type InstallState = "idle" | "installing" | "done";

export default function Setup() {
  const [conn, setConn] = useState<ConnInfo>({ host: "", port: 22, username: "root", authType: "password", credential: "" });
  const [showCred, setShowCred] = useState(false);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [results, setResults] = useState<ToolCheckResult[]>([]);
  const [installTool, setInstallTool] = useState<string | null>(null);
  const [installState, setInstallState] = useState<InstallState>("idle");
  const [installEventId, setInstallEventId] = useState<string>("");
  const [error, setError] = useState("");

  const setC = (f: Partial<ConnInfo>) => setConn((p) => ({ ...p, ...f }));

  const handleCheckAll = async () => {
    if (!conn.host || !conn.credential) { setError("Nhập host và credential trước."); return; }
    setError("");
    setCheckState("checking");
    setResults([]);
    try {
      const res = await checkEnvTools({
        host: conn.host, port: conn.port, username: conn.username,
        authType: conn.authType, credential: conn.credential, tools: ALL_TOOLS,
      });
      setResults(res);
      setCheckState("done");
    } catch (e) {
      setError(String(e));
      setCheckState("idle");
    }
  };

  const handleInstall = async (tool: string) => {
    const eid = `install-${tool}-${Date.now()}`;
    setInstallTool(tool);
    setInstallEventId(eid);
    setInstallState("installing");
    try {
      await installEnvTool({
        host: conn.host, port: conn.port, username: conn.username,
        authType: conn.authType, credential: conn.credential, tool, eventId: eid,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallState("done");
    }
  };

  const missing = results.filter((r) => !r.installed);
  const installed = results.filter((r) => r.installed);
  const progress = results.length > 0 ? Math.round((installed.length / results.length) * 100) : 0;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Setup Wizard</h1>
          <Badge variant="outline" className="ml-2">Bước 2 — Kiểm tra Môi trường</Badge>
        </div>

        {/* Connection form */}
        <div className="border rounded-lg p-4 space-y-3 mb-6">
          <p className="text-sm font-medium text-muted-foreground">Thông tin kết nối SSH</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Host / IP</Label>
              <Input placeholder="192.168.1.100" value={conn.host} onChange={(e) => setC({ host: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Port</Label>
              <Input type="number" value={conn.port} onChange={(e) => setC({ port: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Username</Label>
              <Input value={conn.username} onChange={(e) => setC({ username: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password / Key Path</Label>
              <div className="relative">
                <Input
                  type={showCred ? "text" : "password"}
                  value={conn.credential}
                  onChange={(e) => setC({ credential: e.target.value })}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowCred((v) => !v)}
                  tabIndex={-1}
                >
                  {showCred ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button onClick={handleCheckAll} disabled={checkState === "checking"}>
            {checkState === "checking" && <Loader2 size={14} className="mr-1 animate-spin" />}
            Check All
          </Button>
          {missing.length > 0 && checkState === "done" && (
            <Button variant="outline" onClick={() => missing.forEach((t) => handleInstall(t.name))}>
              <Download size={14} className="mr-1" /> Install All Missing ({missing.length})
            </Button>
          )}
        </div>

        {/* Progress */}
        {results.length > 0 && (
          <div className="mb-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{installed.length}/{results.length} tools installed</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-3 space-y-1">
              {results.map((r) => (
                <div key={r.name} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    {r.installed
                      ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                      : <XCircle size={15} className="text-destructive shrink-0" />}
                    <span className="text-sm font-mono font-medium">{r.name}</span>
                    {r.version && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.version}</span>
                    )}
                  </div>
                  {!r.installed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={installState === "installing" && installTool === r.name}
                      onClick={() => handleInstall(r.name)}
                    >
                      {installState === "installing" && installTool === r.name
                        ? <Loader2 size={12} className="animate-spin" />
                        : <><Download size={12} className="mr-1" />Install</>}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Install terminal */}
        {installTool && installEventId && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight size={14} className="text-primary" />
                <span className="font-medium">Installing: <code className="font-mono">{installTool}</code></span>
                {installState === "done" && <Badge className="bg-green-600 text-xs">Done</Badge>}
              </div>
              <Terminal
                eventId={installEventId}
                className="h-48"
                onDone={() => setInstallState("done")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
