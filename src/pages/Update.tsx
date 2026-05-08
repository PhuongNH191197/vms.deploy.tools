import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useServerStore } from "@/store/serverStore";
import { cn } from "@/lib/utils";

interface DeployRecord {
  id: string;
  server_id: string;
  module_name: string;
  module_version: string;
  action: string;
  status: string;
  operator_ip: string;
  operator_host: string;
  log_output: string | null;
  deployed_at: string;
}

interface SnapshotRecord {
  id: string;
  deploy_id: string;
  server_id: string;
  module_name: string;
  compose_backup: string;
  image_tag: string;
  created_at: string;
}

interface DeployEvent {
  step_id: string;
  line: string;
  done: boolean;
  error: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "badge-active",
    failed: "badge-error",
    in_progress: "bg-df-cyan/10 text-df-cyan border-df-cyan/20 animate-pulse",
  };
  return (
    <Badge className={cn("text-[10px] font-black tracking-widest uppercase rounded-lg border-0 px-2.5", map[status] || "bg-white/5 text-white/40")}>
      {status}
    </Badge>
  );
}

interface ServerHistoryProps {
  serverId: string;
}

function ServerHistory({ serverId }: ServerHistoryProps) {
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === serverId);

  const [history, setHistory] = useState<DeployRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [selectedSnap, setSelectedSnap] = useState<SnapshotRecord | null>(null);
  const [credential, setCredential] = useState("");
  const [rolling, setRolling] = useState(false);
  const [rollLogs, setRollLogs] = useState<string[]>([]);
  const [rollDone, setRollDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const EVENT_ID = `rollback-${serverId}`;

  const load = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([
        invoke<DeployRecord[]>("get_deploy_history", { serverId }),
        invoke<SnapshotRecord[]>("get_snapshots", { serverId }),
      ]);
      setHistory(h);
      setSnapshots(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [serverId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [rollLogs]);

  const openRollback = (snap: SnapshotRecord) => {
    setSelectedSnap(snap);
    setRollLogs([]);
    setRollDone(false);
    setRollbackOpen(true);
  };

  const handleRollback = async () => {
    if (!server || !selectedSnap || !credential) return;
    setRolling(true);
    setRollLogs([]);
    setRollDone(false);
    setRollbackOpen(true);

    const unlisten = await listen<DeployEvent>(EVENT_ID, (ev) => {
      const { line, done, error } = ev.payload;
      if (line) setRollLogs((p) => [...p, error ? `[ERR] ${line}` : line]);
      if (done) setRollDone(true);
    });

    try {
      await invoke("rollback_deployment", {
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type, credential,
        rootPath: "/opt/vms",
        appName: selectedSnap.module_name,
        composeBackup: selectedSnap.compose_backup,
        eventId: EVENT_ID,
      });
      await load();
    } catch (e) {
      setRollLogs((p) => [...p, `ERROR: ${e}`]);
    } finally {
      unlisten();
      setRolling(false);
    }
  };

  if (!server) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-black text-df-text-secondary uppercase tracking-[0.2em]">{server.host}:{server.port}</p>
        <Button size="sm" variant="ghost" className="btn-ghost-glass h-8 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Refresh History"}
        </Button>
      </div>

      {history.length === 0 && !loading && (
        <div className="py-20 text-center glass-card rounded-3xl border-dashed border-white/10">
          <p className="text-xs text-df-text-secondary font-bold uppercase tracking-widest opacity-40">Chưa có lịch sử Deployment.</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-4">
          {history.map((rec) => {
            const snaps = snapshots.filter((s) => s.deploy_id === rec.id);
            return (
              <div key={rec.id} className="glass-card p-6 rounded-2xl border-white/[0.03] hover:border-white/10 transition-all space-y-4">
                <div className="flex items-center gap-4">
                  <StatusBadge status={rec.status} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-black text-df-text-primary tracking-tight">{rec.module_name}</h4>
                    <p className="text-[11px] text-df-text-secondary font-medium opacity-60">v{rec.module_version} · by {rec.operator_host}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/10 text-df-cyan bg-df-cyan/5 px-2 py-0.5 rounded-lg mb-1">{rec.action}</Badge>
                    <p className="text-[10px] text-df-text-secondary font-bold uppercase tracking-widest opacity-40">{rec.deployed_at.slice(0, 16).replace("T", " ")}</p>
                  </div>
                </div>
                
                {snaps.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05]">
                    {snaps.map((snap) => (
                      <Button
                        key={snap.id}
                        size="sm"
                        variant="ghost"
                        className="h-8 btn-ghost-glass rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
                        onClick={() => openRollback(snap)}
                      >
                        <RotateCcw size={14} className="text-df-orange" />
                        Rollback to @{snap.image_tag}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rollback dialog */}
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent className="glass-dialog max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-white font-black uppercase tracking-widest text-[16px]">Rollback Deployment</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-[13px] text-df-text-secondary leading-relaxed">
              Bạn đang thực hiện khôi phục module <span className="text-df-text-primary font-bold">{selectedSnap?.module_name}</span> về phiên bản <span className="text-df-cyan font-bold">@{selectedSnap?.image_tag}</span>. 
              Tiến trình sẽ tự động sao lưu cấu hình hiện tại trước khi khôi phục.
            </p>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-df-text-secondary">SSH Credential (Password/Key)</Label>
              <Input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="••••••••"
                className="h-10 input-glass rounded-xl"
              />
            </div>
            
            {(rollLogs.length > 0 || rolling) && (
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase tracking-widest text-df-text-secondary">Tiến trình thực thi</Label>
                 <div ref={logRef} className="h-48 overflow-y-auto bg-black/40 backdrop-blur-xl rounded-2xl p-4 font-mono text-[11px] border border-white/5 custom-scrollbar">
                  {rollLogs.map((l, i) => (
                    <div key={i} className={cn("mb-1", l.startsWith("[ERR]") ? "text-df-red" : "text-df-cyan")}>
                      {l.startsWith("[ERR]") ? "✖ " : "✔ "} {l || " "}
                    </div>
                  ))}
                  {rolling && <div className="animate-pulse text-df-cyan">▊ Processing...</div>}
                </div>
              </div>
            )}

            {rollDone && (
              <div className="bg-df-green/10 border border-df-green/20 p-4 rounded-2xl flex items-center gap-3">
                <CheckCircle2 size={20} className="text-df-green" />
                <span className="text-[13px] font-bold text-df-green">Rollback hoàn tất thành công!</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6" onClick={() => setRollbackOpen(false)} disabled={rolling}>Đóng</Button>
            <Button onClick={handleRollback} disabled={rolling || !credential || rollDone} className="btn-cyan rounded-xl px-8 font-black uppercase tracking-widest">
              {rolling ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RotateCcw size={16} className="mr-2" />}
              Bắt đầu Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Update() {
  const { servers, fetchServers, loading } = useServerStore();
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

  const opacity = Math.min(scrollOffset / 100, 0.85);
  const blur = Math.min(scrollOffset / 5, 20);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex flex-col w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
             <Loader2 size={40} className="animate-spin text-df-purple mb-4" />
             <span className="text-[11px] font-black text-df-text-secondary uppercase tracking-[0.2em]">Loading infrastructure data...</span>
          </div>
        )}

        {!loading && servers.length === 0 && (
          <div className="text-center py-20 glass-card rounded-3xl border-dashed border-white/10">
            <p className="text-sm text-df-text-secondary font-bold uppercase tracking-widest opacity-40">Chưa có server. Vui lòng thêm server từ Dashboard.</p>
          </div>
        )}

        {servers.length > 0 && (
          <Tabs defaultValue={servers[0].id}>
            <div 
              className="sticky top-[108px] z-20 py-4 -mx-10 px-20 transition-all duration-500 ease-out border-b border-white/[0.01] mb-8"
              style={{ 
                backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
                backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
                WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
              }}
            >
              <TabsList className="inline-flex h-10 items-center justify-center text-muted-foreground bg-white/[0.02] border border-white/5 p-1 rounded-xl overflow-x-auto overflow-y-hidden max-w-full">
                {servers.map((s) => (
                  <TabsTrigger 
                    key={s.id} 
                    value={s.id} 
                    className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-df-purple/10 data-[state=active]:text-df-purple transition-all duration-400 border border-transparent data-[state=active]:border-df-purple/20 shrink-0"
                  >
                    {s.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            {servers.map((s) => (
              <TabsContent key={s.id} value={s.id} className="animate-fade-in focus-visible:outline-none">
                <ServerHistory serverId={s.id} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
