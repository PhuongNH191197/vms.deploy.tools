import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Eye, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { AppModule } from "@/store/wizardStore";
import { generateCombinedCompose } from "@/lib/composeGenerator";

interface ModuleCardProps {
  module: AppModule;
}

function ModuleCard({ module }: ModuleCardProps) {
  const { updateApp, removeApp } = useWizardStore();
  const [expanded, setExpanded] = useState(true);
  const u = (patch: Partial<AppModule>) => updateApp(module.id, patch);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 bg-muted/10"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="font-medium text-sm flex-1">
          {module.name || <span className="text-muted-foreground italic">Unnamed module</span>}
        </span>
        <Badge variant="outline" className="text-[10px]">{module.source}</Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => { e.stopPropagation(); removeApp(module.id); }}
        >
          <Trash2 size={11} />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Module name</Label>
            <Input
              value={module.name}
              onChange={(e) => u({ name: e.target.value })}
              placeholder="my-app"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Source</Label>
            <RadioGroup
              value={module.source}
              onValueChange={(v) => u({ source: v as AppModule["source"] })}
              className="flex gap-4"
            >
              {(["online", "offline", "git"] as const).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <RadioGroupItem value={s} id={`src-${module.id}-${s}`} />
                  <Label htmlFor={`src-${module.id}-${s}`} className="text-xs cursor-pointer capitalize">{s}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {module.source === "online" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Image</Label>
                <Input value={module.image} onChange={(e) => u({ image: e.target.value })} placeholder="registry/image" className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tag</Label>
                <Input value={module.version} onChange={(e) => u({ version: e.target.value })} placeholder="latest" className="h-8 text-sm font-mono" />
              </div>
            </div>
          )}

          {module.source === "offline" && (
            <div className="space-y-1">
              <Label className="text-xs">.tar path trên server (đã upload)</Label>
              <Input value={module.tarServerPath} onChange={(e) => u({ tarServerPath: e.target.value })} placeholder="/opt/vms/tars/myapp.tar" className="h-8 text-sm font-mono" />
            </div>
          )}

          {module.source === "git" && (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Git URL</Label>
                <Input value={module.gitUrl} onChange={(e) => u({ gitUrl: e.target.value })} placeholder="https://github.com/org/repo.git" className="h-8 text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Branch</Label>
                  <Input value={module.gitBranch} onChange={(e) => u({ gitBranch: e.target.value })} placeholder="main" className="h-8 text-sm font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Token (optional)</Label>
                  <Input type="password" value={module.gitToken} onChange={(e) => u({ gitToken: e.target.value })} placeholder="ghp_..." className="h-8 text-sm font-mono" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Step6Apps() {
  const { apps, addApp, selectedServerId, credential, dockerNetworks, rootPath, nextStep, prevStep } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saved, setSaved] = useState(false);

  const composeContent = generateCombinedCompose(apps, dockerNetworks, rootPath);

  const handleSaveCompose = async () => {
    if (!server) return;
    setSaving(true); setSaveErr(""); setSaved(false);
    try {
      await invoke("write_remote_file", {
        host: server.host, port: server.port, username: server.username,
        authType: server.auth_type, credential, remotePath: `${rootPath}/docker-compose.yml`,
        content: composeContent,
      });
      setSaved(true);
    } catch (e) { setSaveErr(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 6 — Applications</h2>
        <p className="text-sm text-muted-foreground">Cấu hình các ứng dụng cần deploy.</p>
      </div>

      <ScrollArea className="h-[300px] pr-1">
        <div className="space-y-2">
          {apps.map((app) => <ModuleCard key={app.id} module={app} />)}
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có module nào. Nhấn [+ Add Module] để thêm.</p>
          )}
        </div>
      </ScrollArea>

      <Button size="sm" variant="outline" onClick={addApp}>
        <Plus size={13} className="mr-1" />Add Module
      </Button>

      {apps.length > 0 && (
        <>
          <Separator />
          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye size={13} className="mr-1" />Preview docker-compose.yml
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-sm font-mono">{rootPath}/docker-compose.yml</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
                  <pre className="text-xs font-mono p-4 bg-muted rounded-lg whitespace-pre-wrap">{composeContent}</pre>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={handleSaveCompose} disabled={saving || !server}>
              {saving && <Loader2 size={13} className="mr-1 animate-spin" />}
              {saved ? "✓ Đã lưu compose" : "Lưu docker-compose.yml lên server"}
            </Button>
            {saveErr && <span className="text-xs text-destructive truncate max-w-xs">{saveErr}</span>}
          </div>
        </>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep}>Tiếp theo →</Button>
      </div>
    </div>
  );
}
