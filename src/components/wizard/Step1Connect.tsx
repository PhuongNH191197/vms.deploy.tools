import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Server, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useServerStore } from "@/store/serverStore";
import { useWizardStore } from "@/store/wizardStore";
import { testConnection } from "@/lib/tauri/commands";

export default function Step1Connect() {
  const { servers } = useServerStore();
  const {
    selectedServerId, environment,
    setSelectedServer, setEnvironment, setCredential, nextStep, rootPath, setRootPath,
  } = useWizardStore();

  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testErr, setTestErr] = useState("");

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  const [credential, setLocalCredential] = useState("");

  const handleTest = async () => {
    if (!selectedServer || !credential) return;
    setTesting(true); setTestOk(null); setTestErr("");
    try {
      await testConnection({
        host: selectedServer.host,
        port: selectedServer.port,
        username: selectedServer.username,
        authType: selectedServer.auth_type,
        credential,
      });
      setTestOk(true);
      setCredential(credential); // save to store for other steps
    } catch (e) {
      setTestOk(false);
      setTestErr(String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 1 — Kết nối & Thông tin</h2>
        <p className="text-sm text-muted-foreground">Chọn server và môi trường triển khai.</p>
      </div>

      {/* Server selection */}
      <div className="space-y-2">
        <Label className="text-sm">Chọn Server</Label>
        <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
          {servers.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có server. Thêm server từ trang Home.</p>
          )}
          {servers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setSelectedServer(s.id); setTestOk(null); setTestErr(""); }}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors
                ${selectedServerId === s.id
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:bg-muted/30"}`}
            >
              <Server size={16} className={selectedServerId === s.id ? "text-primary" : "text-muted-foreground"} />
              <div className="flex-1">
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{s.host}:{s.port}</div>
              </div>
              <Badge variant="outline" className="capitalize text-xs">{s.group_name}</Badge>
            </button>
          ))}
        </div>
      </div>

      {selectedServer && (
        <>
          <Separator />
          {/* Credential for session */}
          <div className="space-y-2">
            <Label className="text-sm">
              {selectedServer.auth_type === "password" ? "Password SSH" : "Key Path"} để kết nối
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="••••••••"
                value={credential}
                onChange={(e) => setLocalCredential(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !credential}>
                {testing ? <Loader2 size={13} className="animate-spin" /> : "Test"}
              </Button>
            </div>
            {testOk === true && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12} />Kết nối thành công</p>}
            {testOk === false && <p className="text-xs text-destructive">{testErr}</p>}
          </div>

          {/* Root path */}
          <div className="space-y-2">
            <Label className="text-sm">Root path trên server</Label>
            <Input value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder="/opt/vms" />
          </div>
        </>
      )}

      {/* Environment */}
      <div className="space-y-2">
        <Label className="text-sm">Môi trường</Label>
        <RadioGroup value={environment} onValueChange={(v) => setEnvironment(v as "lab" | "production")} className="flex gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="lab" id="env-lab" />
            <Label htmlFor="env-lab" className="cursor-pointer">Lab <span className="text-xs text-muted-foreground">(relaxed validation)</span></Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="production" id="env-prod" />
            <Label htmlFor="env-prod" className="cursor-pointer">Production <span className="text-xs text-destructive">(strict)</span></Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={nextStep} disabled={!selectedServerId || testOk !== true}>
          Tiếp theo →
        </Button>
      </div>
    </div>
  );
}
