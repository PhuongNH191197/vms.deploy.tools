import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Package } from "lucide-react";
import { useWizardStore } from "@/store/wizardStore";

interface ServiceDef {
  name: string;
  displayName: string;
  defaultPorts: string;
  defaultVersion: string;
}

const AVAILABLE_SERVICES: ServiceDef[] = [
  { name: "minio",         displayName: "MinIO",          defaultPorts: "9000, 9001", defaultVersion: "RELEASE.2024-01-01T00-00-00Z" },
  { name: "rabbitmq",      displayName: "RabbitMQ",       defaultPorts: "5672, 15672", defaultVersion: "3.12-management" },
  { name: "keycloak",      displayName: "Keycloak",       defaultPorts: "8080",        defaultVersion: "23.0" },
  { name: "redis",         displayName: "Redis",          defaultPorts: "6379",        defaultVersion: "7.2-alpine" },
  { name: "elasticsearch", displayName: "Elasticsearch",  defaultPorts: "9200, 9300",  defaultVersion: "8.11.0" },
  { name: "grafana",       displayName: "Grafana",        defaultPorts: "3000",        defaultVersion: "latest" },
  { name: "prometheus",    displayName: "Prometheus",     defaultPorts: "9090",        defaultVersion: "latest" },
  { name: "custom-1",     displayName: "Custom 1",       defaultPorts: "—",           defaultVersion: "latest" },
  { name: "custom-2",     displayName: "Custom 2",       defaultPorts: "—",           defaultVersion: "latest" },
  { name: "custom-3",     displayName: "Custom 3",       defaultPorts: "—",           defaultVersion: "latest" },
];

export default function Step4Externals() {
  const { selectedExternals, addExternal, removeExternal, updateExternal, nextStep, prevStep } = useWizardStore();
  const [configuring, setConfiguring] = useState<string | null>(null);

  const isSelected = (name: string) => selectedExternals.some((x) => x.name === name);

  const toggleService = (svc: ServiceDef) => {
    if (isSelected(svc.name)) {
      removeExternal(svc.name);
      if (configuring === svc.name) setConfiguring(null);
    } else {
      addExternal({
        name: svc.name,
        displayName: svc.displayName,
        source: "online",
        version: svc.defaultVersion,
        tarPath: "",
        composeFolderPath: "",
      });
      setConfiguring(svc.name);
    }
  };

  const selected = selectedExternals;
  const configSvc = selected.find((x) => x.name === configuring);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 4 — External Services</h2>
        <p className="text-sm text-muted-foreground">Chọn services cần cài đặt và cấu hình source.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 min-h-[280px]">
        {/* Left: available services */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</p>
          <ScrollArea className="h-[280px] border rounded-lg">
            <div className="p-2 space-y-1">
              {AVAILABLE_SERVICES.map((svc) => {
                const sel = isSelected(svc.name);
                return (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => toggleService(svc)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm
                      ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}
                  >
                    {sel
                      ? <Minus size={13} className="shrink-0 text-primary" />
                      : <Plus size={13} className="shrink-0 text-muted-foreground" />}
                    <span className="flex-1 font-medium">{svc.displayName}</span>
                    <span className="text-[10px] text-muted-foreground">{svc.defaultPorts}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right: selected + config */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Selected ({selected.length})
          </p>
          {selected.length === 0 ? (
            <div className="h-[280px] border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
              Chưa chọn service nào
            </div>
          ) : (
            <ScrollArea className="h-[280px] border rounded-lg">
              <div className="p-2 space-y-1">
                {selected.map((svc) => (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => setConfiguring(svc.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors text-sm
                      ${configuring === svc.name ? "bg-muted" : "hover:bg-muted/40"}`}
                  >
                    <Package size={13} className="text-primary shrink-0" />
                    <span className="flex-1 font-medium">{svc.displayName}</span>
                    <Badge variant="outline" className="text-[10px]">{svc.source}</Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Config panel */}
      {configSvc && (
        <>
          <Separator />
          <div className="border rounded-lg p-4 space-y-4 bg-muted/10">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-primary" />
              <span className="font-semibold text-sm">{configSvc.displayName} — Cấu hình</span>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label className="text-xs">Nguồn</Label>
              <RadioGroup
                value={configSvc.source}
                onValueChange={(v) => updateExternal(configSvc.name, { source: v as "online" | "offline" })}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="online" id={`src-online-${configSvc.name}`} />
                  <Label htmlFor={`src-online-${configSvc.name}`} className="cursor-pointer text-sm">Online pull</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="offline" id={`src-offline-${configSvc.name}`} />
                  <Label htmlFor={`src-offline-${configSvc.name}`} className="cursor-pointer text-sm">Offline .tar</Label>
                </div>
              </RadioGroup>
            </div>

            {configSvc.source === "online" && (
              <div className="space-y-1">
                <Label className="text-xs">Version / Tag</Label>
                <Input
                  value={configSvc.version}
                  onChange={(e) => updateExternal(configSvc.name, { version: e.target.value })}
                  placeholder="latest"
                  className="h-8 text-sm"
                />
              </div>
            )}

            {configSvc.source === "offline" && (
              <div className="space-y-1">
                <Label className="text-xs">.tar image path (local Windows)</Label>
                <Input
                  value={configSvc.tarPath}
                  onChange={(e) => updateExternal(configSvc.name, { tarPath: e.target.value })}
                  placeholder="C:\images\minio.tar"
                  className="h-8 text-sm"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Folder chứa docker-compose.yml (local Windows)</Label>
              <Input
                value={configSvc.composeFolderPath}
                onChange={(e) => updateExternal(configSvc.name, { composeFolderPath: e.target.value })}
                placeholder="C:\configs\minio"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Sẽ được upload lên server khi Deploy</p>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep}>
          Tiếp theo →{selected.length > 0 ? ` (${selected.length} services)` : ""}
        </Button>
      </div>
    </div>
  );
}
