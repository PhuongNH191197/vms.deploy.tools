import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Loader2, RefreshCw } from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { fetchServerInfo } from "@/lib/tauri/commands";
import type { Server, ServerInfo } from "@/types";

interface Props {
  server: Server;
  onClose: () => void;
}

export default function ServerInfoPanel({ server, onClose }: Props) {
  const { serverInfoMap, setServerInfo } = useServerStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const info: ServerInfo | undefined = serverInfoMap[server.id];

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchServerInfo(server.id);
      setServerInfo(server.id, result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!info) load();
  }, [server.id]);

  const ramPct = info ? Math.round((info.ram_used_mb / info.ram_total_mb) * 100) : 0;
  const uptime = info ? formatUptime(info.uptime_seconds) : "";

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">{server.name}</span>
        <Button size="icon" variant="ghost" onClick={onClose}><X size={14} /></Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Meta */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Host</span>
            <span className="font-mono text-xs">{server.host}:{server.port}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Username</span>
            <span className="text-xs">{server.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auth</span>
            <Badge variant="outline" className="text-xs">{server.auth_type}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nhóm</span>
            <Badge variant="outline" className="capitalize text-xs">{server.group_name}</Badge>
          </div>
        </div>

        <Separator />

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-3">
            <p>{error}</p>
          </div>
        )}

        {info && !loading && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hostname</span>
              <span className="font-mono text-xs">{info.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">OS</span>
              <span className="text-xs">{info.os}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kernel</span>
              <span className="text-xs font-mono">{info.kernel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPU cores</span>
              <span>{info.cpu_cores}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uptime</span>
              <span className="text-xs">{uptime}</span>
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">RAM</span>
                <span>{info.ram_used_mb} / {info.ram_total_mb} MB ({ramPct}%)</span>
              </div>
              <Progress value={ramPct} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Disk (/)</span>
                <span>{info.disk_used_gb.toFixed(1)} / {info.disk_total_gb.toFixed(1)} GB ({info.disk_percent}%)</span>
              </div>
              <Progress value={info.disk_percent} className="h-1.5" />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t">
        <Button variant="outline" size="sm" className="w-full" onClick={load} disabled={loading}>
          <RefreshCw size={13} className="mr-1" /> Refresh Info
        </Button>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
