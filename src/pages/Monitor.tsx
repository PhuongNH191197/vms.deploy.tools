import { useEffect, useRef, useState } from "react";
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
  RotateCcw, Square, Play, ChevronDown, ChevronUp,
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
import { cn } from "@/lib/utils";

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
    <div className="space-y-4 pt-2">
      <button
        className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-df-text-secondary hover:text-df-cyan transition-colors"
        onClick={toggle}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Lịch sử Metrics
      </button>

      {open && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            {([1, 6, 24] as const).map((h) => (
              <Button
                key={h}
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 text-[11px] font-bold px-3 rounded-lg border border-white/5",
                  hours === h ? "bg-df-cyan/10 text-df-cyan border-df-cyan/20 shadow-neon-cyan" : "text-df-text-secondary hover:text-df-text-primary hover:bg-white/5"
                )}
                onClick={() => changeRange(h)}
              >
                {h}h
              </Button>
            ))}
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0 ml-1 rounded-lg border border-white/5 hover:bg-white/5 text-df-text-secondary"
              onClick={() => load()} disabled={loading}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </Button>
            <span className="text-[10px] font-bold text-df-text-secondary/50 uppercase tracking-widest ml-auto">{data.length} pts collected</span>
          </div>

          {data.length === 0 && !loading && (
            <p className="text-xs text-df-text-secondary italic py-4">Chưa có dữ liệu lịch sử.</p>
          )}

          {data.length > 0 && (
            <div className="h-[200px] w-full glass-card p-4 rounded-2xl">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} unit="%" width={40} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      background: "rgba(13, 19, 32, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 12,
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10, fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="CPU"  stroke="#31E8FF" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="RAM"  stroke="#A855F7" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Disk" stroke="#F97316" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
      <div className="space-y-6 max-w-sm animate-fade-in-up">
        <p className="text-[13px] text-df-text-secondary font-medium leading-relaxed">
          Monitoring cho <span className="text-df-text-primary font-bold">{server.name}</span> đang tắt. 
          Vui lòng nhập credential để bắt đầu.
        </p>
        <div className="space-y-2">
          <Label className="text-[11px] font-black uppercase tracking-widest text-df-text-secondary">{server.auth_type === "password" ? "SSH Password" : "SSH Key Path"}</Label>
          <div className="flex gap-2">
            <Input
              type={showCred ? "text" : "password"}
              value={credInput}
              onChange={(e) => setCredInput(e.target.value)}
              placeholder="••••••••"
              className="h-10 text-sm input-glass rounded-xl"
            />
            <Button size="icon" variant="ghost" className="h-10 w-10 btn-ghost-glass rounded-xl" onClick={() => setShowCred((v) => !v)}>
              {showCred ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
        </div>
        <Button size="lg" onClick={handleConnect} disabled={!credInput} className="btn-cyan rounded-xl w-full">
          <Activity size={18} className="mr-2" />Bắt đầu Monitor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Metrics Grid */}
      {metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="CPU" value={metrics.cpu_percent} unit="%" color="cyan" />
          <MetricCard label="RAM" value={metrics.ram_percent} unit="%" sub={`${metrics.ram_used_mb}/${metrics.ram_total_mb} MB`} color="purple" />
          <MetricCard label="Disk" value={metrics.disk_percent} unit="%" sub={`${metrics.disk_used_gb}/${metrics.disk_total_gb} GB`} color="orange" />
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[13px] text-df-text-secondary font-bold uppercase tracking-widest py-6">
          <Loader2 size={18} className="animate-spin text-df-cyan" />
          Đang thu thập dữ liệu...
        </div>
      )}

      <MetricsHistoryChart serverId={server.id} />

      <div className="h-px w-full bg-white/[0.05]" />

      {/* Containers */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-black text-df-text-secondary uppercase tracking-[0.2em]">Docker Containers ({containers.length})</p>
            <Button size="sm" variant="ghost" className="h-7 px-2 btn-ghost-glass rounded-lg" onClick={() => loadContainers(cred?.credential ?? credInput)} disabled={loadingContainers}>
              {loadingContainers ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="h-7 px-3 text-[11px] font-black text-df-red hover:bg-df-red/10 rounded-lg uppercase tracking-widest" onClick={stopMonitor}>Ngừng Monitoring</Button>
        </div>

        {containerErr && <p className="text-xs text-df-red bg-df-red/10 p-3 rounded-xl border border-df-red/20">{containerErr}</p>}

        {containers.length > 0 && (
          <div className="space-y-3">
            {containers.map((c) => {
              const isUp = c.status.toLowerCase().startsWith("up");
              return (
                <div key={c.name} className="flex items-center gap-4 px-5 py-4 glass-card rounded-2xl border-white/[0.03] hover:border-white/10 transition-all">
                  <div
                    className={cn("w-2.5 h-2.5 rounded-full shrink-0", isUp ? "dot-green animate-pulse-glow" : "dot-red")}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-black text-df-text-primary truncate">{c.name}</p>
                    <p className="text-[11px] text-df-text-secondary font-medium truncate opacity-60">{c.image}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[11px] font-black text-df-cyan uppercase tracking-tighter">{c.cpu_perc} CPU</p>
                    <p className="text-[11px] font-black text-df-purple uppercase tracking-tighter">{c.mem_perc} MEM</p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-black px-2.5 py-0.5 rounded-lg border-0 tracking-widest",
                      isUp ? "badge-active" : "badge-error"
                    )}
                  >
                    {c.status.slice(0, 12).toUpperCase()}
                  </Badge>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm" variant="ghost" className="h-8 px-3 btn-ghost-glass text-[10px] font-black uppercase rounded-lg"
                      onClick={() => setLogContainer(logContainer === c.name ? null : c.name)}
                    >
                      Logs
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-8 w-8 p-0 btn-ghost-glass rounded-lg hover:text-df-orange"
                      onClick={() => setActionDialog({ container: c.name, action: "restart" })}
                      title="Restart"
                    >
                      <RotateCcw size={14} />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className={cn("h-8 w-8 p-0 btn-ghost-glass rounded-lg", isUp ? "hover:text-df-red" : "hover:text-df-green")}
                      onClick={() => setActionDialog({ container: c.name, action: isUp ? "stop" : "start" })}
                      title={isUp ? "Stop" : "Start"}
                    >
                      {isUp ? <Square size={14} /> : <Play size={14} />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {containers.length === 0 && !loadingContainers && !containerErr && (
          <div className="text-center py-12 glass-card rounded-3xl border-dashed border-white/10">
            <p className="text-xs text-df-text-secondary font-bold uppercase tracking-widest opacity-50">Không có container nào đang chạy.</p>
          </div>
        )}
      </div>

      {/* Log panel */}
      {logContainer && (
        <div className="animate-fade-in-up">
          <Separator className="bg-white/5 my-6" />
          <LogPanel
            container={logContainer}
            conn={connInfo}
            onClose={() => setLogContainer(null)}
          />
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) setActionDialog(null); }}>
        <DialogContent className="glass-dialog max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-widest text-[16px]">Xác nhận Thao tác</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-df-text-secondary leading-relaxed">
            Bạn có chắc chắn muốn <span className="text-df-cyan font-bold uppercase tracking-widest">{actionDialog?.action}</span> container <code className="font-mono text-df-text-primary bg-white/5 px-1.5 py-0.5 rounded">{actionDialog?.container}</code>?
          </p>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6" onClick={() => setActionDialog(null)} disabled={actioning}>Hủy</Button>
            <Button
              className={cn("rounded-xl px-6 font-bold", actionDialog?.action === "stop" ? "bg-df-red hover:bg-df-red/80 text-white" : "btn-cyan")}
              onClick={handleContainerAction}
              disabled={actioning}
            >
              {actioning ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Xác nhận
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
  label: string; value: number; unit: string; sub?: string; color: "cyan" | "purple" | "orange";
}) {
  const barClass = { cyan: "neon-bar-cyan", purple: "neon-bar-purple", orange: "neon-bar-orange" }[color];
  const textClass = { cyan: "text-df-cyan", purple: "text-df-purple", orange: "text-df-orange" }[color];
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="glass-card p-5 space-y-4 rounded-2xl border-white/[0.05]">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-black text-df-text-secondary uppercase tracking-[0.15em]">{label}</span>
        <span className={cn("text-[18px] font-black", textClass)}>{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-[10px] bg-white/[0.04] rounded-full overflow-hidden p-[2px]">
        <div className={cn("h-full rounded-full transition-all duration-1000", barClass)} style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="text-[10px] font-bold text-df-text-secondary opacity-50 uppercase tracking-widest">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitor() {
  const { servers, fetchServers } = useServerStore();
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    const mainElement = document.getElementById('main-content');
    const handleScroll = () => {
      setScrollOffset(mainElement?.scrollTop ?? 0);
    };
    mainElement?.addEventListener('scroll', handleScroll);
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, []);

  const groups = ["production", "staging", "lab"] as const;
  const byGroup = (g: string) => servers.filter((s) => s.group_name === g);
  const hasGroup = (g: string) => byGroup(g).length > 0;

  const opacity = Math.min(scrollOffset / 100, 0.85);
  const blur = Math.min(scrollOffset / 5, 20);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex flex-col w-full">
        {servers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 glass-card rounded-3xl border-dashed border-white/10">
            <p className="text-sm text-df-text-secondary font-bold uppercase tracking-widest mb-4 opacity-50">Chưa có server nào được kết nối.</p>
          </div>
        )}

        {servers.length > 0 && (
          <Tabs defaultValue={groups.find(hasGroup) ?? "lab"}>
            <div 
              className="sticky top-[108px] z-20 py-4 -mx-10 px-20 transition-all duration-500 ease-out border-b border-white/[0.01] mb-8"
              style={{ 
                backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
                backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
                WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
              }}
            >
              <TabsList className="inline-flex h-10 items-center justify-center text-muted-foreground bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                {groups.filter(hasGroup).map((g) => (
                  <TabsTrigger 
                    key={g} 
                    value={g} 
                    className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-df-cyan/10 data-[state=active]:text-df-cyan transition-all duration-400 border border-transparent data-[state=active]:border-df-cyan/20"
                  >
                    {g} <span className="ml-2 opacity-30">{byGroup(g).length}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {groups.filter(hasGroup).map((g) => (
              <TabsContent key={g} value={g} className="animate-fade-in">
                <Tabs defaultValue={byGroup(g)[0]?.id} orientation="vertical">
                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* Server sub-tabs */}
                    <TabsList className="flex flex-row lg:flex-col h-auto gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-xl lg:w-56 shrink-0 overflow-x-auto lg:overflow-x-visible">
                      {byGroup(g).map((s) => (
                        <TabsTrigger 
                          key={s.id} 
                          value={s.id} 
                          className="inline-flex items-center justify-start whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-df-cyan/10 data-[state=active]:text-df-cyan transition-all duration-400 border border-transparent data-[state=active]:border-df-cyan/20 flex-1 lg:w-full"
                        >
                          {s.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* Server panels */}
                    <div className="flex-1 min-w-0">
                      <ScrollArea className="max-h-[calc(100vh-280px)] pr-4">
                        {byGroup(g).map((s) => (
                          <TabsContent key={s.id} value={s.id} className="mt-0">
                            <ServerPanel server={s} />
                          </TabsContent>
                        ))}
                      </ScrollArea>
                    </div>
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
