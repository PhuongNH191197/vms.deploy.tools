import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Activity, Eye, EyeOff, Loader2, RefreshCw,
  RotateCcw, Square, Play, MonitorDot, ChevronDown, ChevronUp,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useServerStore } from "@/store/serverStore";
import { useMonitorStore } from "@/store/monitorStore";
import { getMetricsHistory } from "@/lib/tauri/commands";
import LogPanel from "@/components/LogPanel";
import type { Server, MetricsPoint } from "@/types";

interface ContainerInfo {
  name: string;
  image: string;
  status: string;
  created: string;
  cpu_perc: string;
  mem_perc: string;
}

// ── Metrics history chart ─────────────────────────────────────────────────────

function MetricsHistoryChart({ serverId }: { serverId: string }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(1);
  const [data, setData] = useState<MetricsPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (h = hours) => {
    setLoading(true);
    try {
      const pts = await getMetricsHistory(serverId, h);
      setData(pts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) load();
    setOpen((v) => !v);
  };

  const changeRange = (h: number) => {
    setHours(h);
    load(h);
  };

  const chartData = data.map((p) => ({
    time: p.recorded_at.slice(11, 16),
    CPU: p.cpu_percent,
    RAM: p.ram_percent,
    Disk: p.disk_percent,
  }));

  return (
    <div className="space-y-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={toggle}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Lịch sử metrics
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {([1, 6, 24] as const).map((h) => (
              <Button
                key={h}
                size="sm"
                variant={hours === h ? "default" : "ghost"}
                className="h-6 text-xs px-2"
                onClick={() => changeRange(h)}
              >
                {h}h
              </Button>
            ))}
            <Button
              size="sm" variant="ghost" className="h-6 w-6 p-0 ml-1"
              onClick={() => load()} disabled={loading}
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            </Button>
            <span className="text-[10px] text-muted-foreground ml-1">{data.length} điểm</span>
          </div>

          {data.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">Chưa có dữ liệu (monitor cần chạy ít nhất 1 chu kỳ).</p>
          )}

          {data.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" width={36} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Line type="monotone" dataKey="CPU"  stroke="#3b82f6" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="RAM"  stroke="#a855f7" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="Disk" stroke="#f97316" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-server panel ─────────────────────────────────────────────────────────

interface ServerPanelProps {
  server: Server;
}

function ServerPanel({ server }: ServerPanelProps) {
  const { entries, credentials, setCredential, startPolling, stopPolling } = useMonitorStore();
  const entry = entries[server.id];
  const cred = credentials[server.id];

  const [credInput, setCredInput] = useState("");
  const [showCred, setShowCred] = useState(false);
  const [connected, setConnected] = useState(!!cred);

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [containerErr, setContainerErr] = useState("");

  const [logContainer, setLogContainer] = useState<string | null>(null);

  const [actionDialog, setActionDialog] = useState<{ container: string; action: string } | null>(null);
  const [actioning, setActioning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connInfo = {
    host: server.host, port: server.port,
    username: server.username, authType: server.auth_type,
    credential: cred?.credential ?? credInput,
  };

  const loadContainers = async (credential: string) => {
    setLoadingContainers(true);
    setContainerErr("");
    try {
      const result = await invoke<ContainerInfo[]>("get_container_info", {
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type, credential,
      });
      setContainers(result);
    } catch (e) {
      setContainerErr(String(e));
    } finally {
      setLoadingContainers(false);
    }
  };

  const startMonitor = (credential: string) => {
    setCredential(server.id, { authType: server.auth_type, credential });
    startPolling(server.id, server.host, server.port, server.username);
    setConnected(true);
    loadContainers(credential);

    // Poll containers every 5s
    intervalRef.current = setInterval(() => loadContainers(credential), 5000);
  };

  const stopMonitor = () => {
    stopPolling(server.id);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setConnected(false);
    setContainers([]);
    setLogContainer(null);
  };

  // Resume if already credentialed
  useEffect(() => {
    if (cred) {
      startMonitor(cred.credential);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = () => startMonitor(credInput);

  const handleContainerAction = async () => {
    if (!actionDialog) return;
    setActioning(true);
    try {
      await invoke("docker_container_action", {
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential: cred?.credential ?? credInput,
        container: actionDialog.container,
        action: actionDialog.action,
      });
      setActionDialog(null);
      await loadContainers(cred?.credential ?? credInput);
    } catch (e) {
      alert(String(e));
    } finally {
      setActioning(false);
    }
  };

  const metrics = entry?.metrics;

  // Not connected yet
  if (!connected) {
    return (
      <div className="space-y-4 max-w-sm">
        <p className="text-sm text-muted-foreground">Nhập credential để bắt đầu monitoring.</p>
        <div className="space-y-1">
          <Label className="text-xs">{server.auth_type === "password" ? "Password SSH" : "Key path"}</Label>
          <div className="flex gap-2">
            <Input
              type={showCred ? "text" : "password"}
              value={credInput}
              onChange={(e) => setCredInput(e.target.value)}
              placeholder="••••••••"
              className="h-8 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowCred((v) => !v)}>
              {showCred ? <EyeOff size={13} /> : <Eye size={13} />}
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={handleConnect} disabled={!credInput}>
          <Activity size={13} className="mr-1" />Bắt đầu Monitor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metrics */}
      {metrics ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="CPU" value={metrics.cpu_percent} unit="%" color="blue" />
          <MetricCard label="RAM" value={metrics.ram_percent} unit="%" sub={`${metrics.ram_used_mb}/${metrics.ram_total_mb} MB`} color="purple" />
          <MetricCard label="Disk" value={metrics.disk_percent} unit="%" sub={`${metrics.disk_used_gb}/${metrics.disk_total_gb} GB`} color="orange" />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />Loading metrics…
        </div>
      )}

      <MetricsHistoryChart serverId={server.id} />

      <Separator />

      {/* Containers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Containers ({containers.length})</p>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => loadContainers(cred?.credential ?? credInput)} disabled={loadingContainers}>
            {loadingContainers ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs ml-auto text-destructive" onClick={stopMonitor}>Stop</Button>
        </div>

        {containerErr && <p className="text-xs text-destructive">{containerErr}</p>}

        {containers.length > 0 && (
          <div className="border rounded-lg divide-y text-sm">
            {containers.map((c) => {
              const isUp = c.status.toLowerCase().startsWith("up");
              return (
                <div key={c.name} className="flex items-center gap-3 px-3 py-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${isUp ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.image}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right shrink-0">
                    <p>{c.cpu_perc} CPU</p>
                    <p>{c.mem_perc} MEM</p>
                  </div>
                  <Badge
                    variant={isUp ? "default" : "destructive"}
                    className={`text-[10px] shrink-0 ${isUp ? "bg-green-700" : ""}`}
                  >
                    {c.status.slice(0, 12)}
                  </Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-6 text-[10px] px-1.5"
                      onClick={() => setLogContainer(logContainer === c.name ? null : c.name)}
                    >
                      Logs
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setActionDialog({ container: c.name, action: "restart" })}
                      title="Restart"
                    >
                      <RotateCcw size={10} />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setActionDialog({ container: c.name, action: isUp ? "stop" : "start" })}
                      title={isUp ? "Stop" : "Start"}
                    >
                      {isUp ? <Square size={10} /> : <Play size={10} />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {containers.length === 0 && !loadingContainers && !containerErr && (
          <p className="text-xs text-muted-foreground">No running containers.</p>
        )}
      </div>

      {/* Log panel */}
      {logContainer && (
        <>
          <Separator />
          <LogPanel
            container={logContainer}
            conn={connInfo}
            onClose={() => setLogContainer(null)}
          />
        </>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận {actionDialog?.action}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {actionDialog?.action} container <code className="font-mono">{actionDialog?.container}</code>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionDialog(null)} disabled={actioning}>Hủy</Button>
            <Button
              variant={actionDialog?.action === "stop" ? "destructive" : "default"}
              onClick={handleContainerAction}
              disabled={actioning}
            >
              {actioning ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              {actionDialog?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, unit, sub, color,
}: {
  label: string; value: number; unit: string; sub?: string; color: "blue" | "purple" | "orange";
}) {
  const barColor = { blue: "bg-blue-500", purple: "bg-purple-500", orange: "bg-orange-500" }[color];
  const textColor = { blue: "text-blue-400", purple: "text-purple-400", orange: "text-orange-400" }[color];
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="border rounded-lg p-3 space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitor() {
  const { servers, fetchServers } = useServerStore();
  const navigate = useNavigate();

  useEffect(() => { fetchServers(); }, []);

  const groups = ["production", "staging", "lab"] as const;
  const byGroup = (g: string) => servers.filter((s) => s.group_name === g);
  const hasGroup = (g: string) => byGroup(g).length > 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <MonitorDot size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Monitor</h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/")}>← Home</Button>
        </div>

        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Chưa có server.</p>
        )}

        {servers.length > 0 && (
          <Tabs defaultValue={groups.find(hasGroup) ?? "lab"}>
            <TabsList className="mb-4">
              {groups.filter(hasGroup).map((g) => (
                <TabsTrigger key={g} value={g} className="capitalize">
                  {g} <span className="ml-1 text-xs text-muted-foreground">({byGroup(g).length})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.filter(hasGroup).map((g) => (
              <TabsContent key={g} value={g}>
                <Tabs defaultValue={byGroup(g)[0]?.id} orientation="vertical">
                  <div className="flex gap-4">
                    {/* Server sub-tabs */}
                    <TabsList className="flex flex-col h-auto gap-1 w-40 shrink-0">
                      {byGroup(g).map((s) => (
                        <TabsTrigger key={s.id} value={s.id} className="w-full text-left text-xs justify-start">
                          {s.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* Server panels */}
                    <ScrollArea className="flex-1 max-h-[calc(100vh-180px)]">
                      {byGroup(g).map((s) => (
                        <TabsContent key={s.id} value={s.id}>
                          <ServerPanel server={s} />
                        </TabsContent>
                      ))}
                    </ScrollArea>
                  </div>
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
