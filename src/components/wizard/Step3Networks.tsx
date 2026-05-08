import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Plus, Trash2, Loader2, Network } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { NetworkCreateResult } from "@/store/wizardStore";

const NETWORK_RE = /^[a-z0-9][a-z0-9_-]*$/;

export default function Step3Networks() {
  const { selectedServerId, credential, dockerNetworks, networkResults, setDockerNetworks, setNetworkResults, nextStep, prevStep } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [inputs, setInputs] = useState<string[]>(dockerNetworks.length > 0 ? dockerNetworks : [""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const addInput = () => setInputs((p) => [...p, ""]);
  const removeInput = (i: number) => setInputs((p) => p.filter((_, idx) => idx !== i));
  const updateInput = (i: number, v: string) => setInputs((p) => p.map((x, idx) => idx === i ? v.toLowerCase() : x));

  const validInputs = inputs.filter((n) => NETWORK_RE.test(n.trim()));
  const hasInvalid = inputs.some((n) => n.trim() !== "" && !NETWORK_RE.test(n.trim()));

  const handleCreate = async () => {
    if (!server || validInputs.length === 0) return;
    setCreating(true); setError("");
    try {
      const results: NetworkCreateResult[] = await invoke("create_docker_networks", {
        host: server.host, port: server.port, username: server.username,
        authType: server.auth_type, credential, networks: validInputs,
      });
      setDockerNetworks(validInputs);
      setNetworkResults(results);
    } catch (e) { setError(String(e)); }
    finally { setCreating(false); }
  };

  const allOk = networkResults.length > 0 && networkResults.every((r) => r.created || r.already_existed);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 3 — Docker Networks</h2>
        <p className="text-sm text-muted-foreground">Tạo Docker networks trên server <code className="font-mono">{server?.host}</code></p>
      </div>

      {/* Network inputs */}
      <div className="space-y-2">
        {inputs.map((val, i) => {
          const invalid = val.trim() !== "" && !NETWORK_RE.test(val.trim());
          return (
            <div key={i} className="flex gap-2 items-center">
              <Network size={14} className="text-muted-foreground shrink-0" />
              <Input
                value={val}
                onChange={(e) => updateInput(i, e.target.value)}
                placeholder="my-network"
                className={invalid ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {inputs.length > 1 && (
                <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => removeInput(i)}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={addInput} className="mt-1">
          <Plus size={13} className="mr-1" />Add Network
        </Button>
        {hasInvalid && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle size={12} />Chỉ dùng chữ thường, số, dấu gạch ngang/dưới.
          </p>
        )}
      </div>

      <Button onClick={handleCreate} disabled={creating || validInputs.length === 0}>
        {creating && <Loader2 size={14} className="mr-1 animate-spin" />}
        Create All ({validInputs.length})
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Results */}
      {networkResults.length > 0 && (
        <div className="border rounded-lg divide-y">
          {networkResults.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-2.5">
              {r.created && <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
              {r.already_existed && <CheckCircle2 size={15} className="text-yellow-400 shrink-0" />}
              {r.error && <XCircle size={15} className="text-destructive shrink-0" />}
              <span className="font-mono text-sm flex-1">{r.name}</span>
              {r.created && <Badge className="bg-green-600 text-xs">Created</Badge>}
              {r.already_existed && <Badge variant="secondary" className="text-xs">Already exists</Badge>}
              {r.error && <span className="text-xs text-destructive truncate max-w-[200px]">{r.error}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep} disabled={validInputs.length > 0 && !allOk}>
          Tiếp theo →
        </Button>
      </div>
    </div>
  );
}
