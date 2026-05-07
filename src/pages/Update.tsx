import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useServerStore } from "@/store/serverStore";
import { useNavigate } from "react-router-dom";

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
    success: "bg-green-600",
    failed: "bg-destructive",
    in_progress: "bg-blue-600",
  };
  return <Badge className={`text-[10px] ${map[status] ?? "bg-muted"}`}>{status}</Badge>;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-mono">{server.host}:{server.port}</p>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {history.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử deploy.</p>
      )}

      {history.length > 0 && (
        <div className="border rounded-lg divide-y">
          {history.map((rec) => {
            const snaps = snapshots.filter((s) => s.deploy_id === rec.id);
            return (
              <div key={rec.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <StatusBadge status={rec.status} />
                  <span className="font-medium text-sm">{rec.module_name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{rec.action}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{rec.deployed_at.slice(0, 16).replace("T", " ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  v{rec.module_version} · by {rec.operator_host}
                </div>
                {snaps.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {snaps.slice(0, 5).map((snap) => (
                      <Button
                        key={snap.id}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => openRollback(snap)}
                      >
                        <RotateCcw size={10} />
                        Rollback {snap.module_name}@{snap.image_tag}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback — {selectedSnap?.module_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Khôi phục về <code className="font-mono">{selectedSnap?.image_tag}</code>.
              Sẽ chạy <code>compose down → restore → compose up</code>.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">SSH Credential</Label>
              <Input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="••••••••"
                className="h-8 text-sm"
              />
            </div>
            {rollLogs.length > 0 && (
              <div ref={logRef} className="h-36 overflow-y-auto bg-[#0d1117] rounded-lg p-3 font-mono text-xs text-green-400">
                {rollLogs.map((l, i) => (
                  <div key={i} className={l.startsWith("[ERR]") ? "text-red-400" : ""}>{l || " "}</div>
                ))}
                {rolling && <div className="animate-pulse">▊</div>}
              </div>
            )}
            {rollDone && <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12} />Rollback hoàn thành</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRollbackOpen(false)} disabled={rolling}>Đóng</Button>
              <Button onClick={handleRollback} disabled={rolling || !credential || rollDone}>
                {rolling ? <><Loader2 size={13} className="mr-1 animate-spin" />Rolling back…</> : <><RotateCcw size={13} className="mr-1" />Rollback</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Update() {
  const { servers, fetchServers, loading } = useServerStore();
  const navigate = useNavigate();

  useEffect(() => { fetchServers(); }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <History size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Update & Rollback</h1>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>← Home</Button>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading servers…</p>}

        {!loading && servers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Chưa có server. Thêm server từ Home.</p>
        )}

        {servers.length > 0 && (
          <Tabs defaultValue={servers[0].id}>
            <ScrollArea>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                {servers.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
            {servers.map((s) => (
              <TabsContent key={s.id} value={s.id}>
                <ServerHistory serverId={s.id} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
