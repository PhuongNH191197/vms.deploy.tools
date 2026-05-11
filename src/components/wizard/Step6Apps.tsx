import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Eye, Loader2, ChevronDown, ChevronRight, PackagePlus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { AppModule } from "@/store/wizardStore";
import { generateCombinedCompose } from "@/lib/composeGenerator";

// ── VMS Project Presets ───────────────────────────────────────────────────────

interface PresetModule {
  name: string;
  gitUrl: string;
  group: "Frontend" | "Backend";
}

const VMS_PRESETS: PresetModule[] = [
  { name: "vms_vas", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.vas.git", group: "Frontend" },
  { name: "vms_ups", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.ups.git", group: "Frontend" },
  { name: "vms_web", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.git", group: "Frontend" },
  { name: "vms_ai", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.ai.git", group: "Backend" },
  { name: "vms_center", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.center.git", group: "Backend" },
  { name: "vms_device", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.device.git", group: "Backend" },
  { name: "vms_identity", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.identityserver4.git", group: "Backend" },
  { name: "vms_logs", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.logs.git", group: "Backend" },
  { name: "vms_notification", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.notification.git", group: "Backend" },
  { name: "vms_system", gitUrl: "https://git.elcomlab.com/vms/source/elcom.vms.system.git", group: "Backend" },
];

function PresetPanel({ onAdd }: { onAdd: (presets: PresetModule[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleGroup = (group: "Frontend" | "Backend") => {
    const groupNames = VMS_PRESETS.filter((p) => p.group === group).map((p) => p.name);
    const allSelected = groupNames.every((n) => selected.has(n));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) groupNames.forEach((n) => next.delete(n));
      else groupNames.forEach((n) => next.add(n));
      return next;
    });
  };

  const handleAdd = () => {
    const toAdd = VMS_PRESETS.filter((p) => selected.has(p.name));
    onAdd(toAdd);
    setSelected(new Set());
    setOpen(false);
  };

  return (
    <div className="border border-dashed border-white/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] text-sm text-white/60"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <PackagePlus size={13} />
        <span className="font-medium">VMS Project Presets</span>
        <span className="text-xs text-white/30 ml-1">({VMS_PRESETS.length} modules)</span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-3 space-y-3">
          {(["Frontend", "Backend"] as const).map((group) => {
            const groupModules = VMS_PRESETS.filter((p) => p.group === group);
            const allChecked = groupModules.every((p) => selected.has(p.name));
            return (
              <div key={group} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleGroup(group)}
                    className="w-3.5 h-3.5 accent-blue-500"
                  />
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{group}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 pl-5">
                  {groupModules.map((p) => (
                    <label key={p.name} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected.has(p.name)}
                        onChange={() => toggle(p.name)}
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      <span className="text-xs text-white/70 font-mono group-hover:text-white">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-white/30">{selected.size} module được chọn</span>
            <Button
              size="sm"
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              disabled={selected.size === 0}
              onClick={handleAdd}
            >
              <Plus size={11} className="mr-1" />
              Thêm {selected.size > 0 ? selected.size : ""} module
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Module Card ───────────────────────────────────────────────────────────────

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

// ── Main Step ─────────────────────────────────────────────────────────────────

export default function Step6Apps() {
  const { apps, addApp, selectedServerId, credential, dockerNetworks, rootPath, nextStep, prevStep } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saved, setSaved] = useState(false);

  const composableApps = apps.filter((a) => a.source !== "git");
  const composeContent = generateCombinedCompose(apps, dockerNetworks, rootPath);

  const handleAddPresets = (presets: PresetModule[]) => {
    const existingNames = new Set(apps.map((a) => a.name));
    for (const p of presets) {
      if (existingNames.has(p.name)) continue;
      useWizardStore.getState().addApp();
      // Get the newly added app (last in list) and update it
      const newApps = useWizardStore.getState().apps;
      const newId = newApps[newApps.length - 1].id;
      useWizardStore.getState().updateApp(newId, {
        name: p.name,
        source: "git",
        gitUrl: p.gitUrl,
        gitBranch: "test/master",
        gitToken: "",
      });
    }
  };

  const handleSaveCompose = async () => {
    if (!server || composableApps.length === 0) return;
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

      <PresetPanel onAdd={handleAddPresets} />

      <ScrollArea className="h-[260px] pr-1">
        <div className="space-y-2">
          {apps.map((app) => <ModuleCard key={app.id} module={app} />)}
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có module nào. Chọn từ preset hoặc nhấn [+ Add Module].</p>
          )}
        </div>
      </ScrollArea>

      <Button size="sm" variant="outline" onClick={addApp}>
        <Plus size={13} className="mr-1" />Add Module
      </Button>

      {composableApps.length > 0 && (
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
