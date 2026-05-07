import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, EyeOff, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Server } from "@/types";

type TaskStatus = "pending" | "running" | "success" | "failed";

interface TaskState {
  status: TaskStatus;
  logs: string[];
  expanded: boolean;
}

interface DeployEvent {
  step_id: string;
  line: string;
  done: boolean;
  error: boolean;
}

interface BulkDeployDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  servers: Server[];
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "pending": return <Circle size={14} className="text-muted-foreground" />;
    case "running": return <Loader2 size={14} className="animate-spin text-blue-400" />;
    case "success": return <CheckCircle2 size={14} className="text-green-500" />;
    case "failed":  return <XCircle size={14} className="text-red-500" />;
  }
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = {
    pending: { label: "pending",    variant: "outline"      },
    running: { label: "running…",  variant: "secondary"    },
    success: { label: "success",    variant: "default"      },
    failed:  { label: "failed",     variant: "destructive"  },
  } as const;
  const { label, variant } = cfg[status];
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

export default function BulkDeployDialog({ open, onOpenChange, servers }: BulkDeployDialogProps) {
  const [phase, setPhase] = useState<"config" | "running" | "done">("config");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [credential, setCredential] = useState("");
  const [showCred, setShowCred] = useState(false);
  const [commandsText, setCommandsText] = useState("");
  const [tasks, setTasks] = useState<Record<string, TaskState>>({});

  useEffect(() => {
    if (open) {
      setPhase("config");
      setCredential("");
      setCommandsText("");
      setTasks({});
    }
  }, [open]);

  const commands = commandsText.split("\n").map((s) => s.trim()).filter(Boolean);
  const canStart = credential.trim().length > 0 && commands.length > 0 && servers.length > 0;
  const doneCount = Object.values(tasks).filter(
    (t) => t.status === "success" || t.status === "failed"
  ).length;

  const toggleLog = (id: string) =>
    setTasks((prev) => ({
      ...prev,
      [id]: { ...prev[id], expanded: !prev[id].expanded },
    }));

  const handleStart = async () => {
    const SESSION = Date.now().toString();

    const init: Record<string, TaskState> = {};
    for (const s of servers) init[s.id] = { status: "pending", logs: [], expanded: false };
    setTasks(init);
    setPhase("running");

    // Register all listeners before dispatching tasks
    const unlisteners: (() => void)[] = [];
    for (const server of servers) {
      const evId = `bulk-deploy-${server.id}-${SESSION}`;
      const u = await listen<DeployEvent>(evId, (ev) => {
        const { line, done, error } = ev.payload;
        setTasks((prev) => {
          const t = prev[server.id];
          if (!t) return prev;
          const newLogs = line ? [...t.logs, error ? `[ERR] ${line}` : line] : t.logs;
          const newStatus: TaskStatus = done ? (error ? "failed" : "success") : t.status;
          return { ...prev, [server.id]: { ...t, logs: newLogs, status: newStatus } };
        });
      });
      unlisteners.push(u);
    }

    // Concurrency pool — max 5 parallel
    const queue = [...servers];

    const runOne = async (server: Server) => {
      const evId = `bulk-deploy-${server.id}-${SESSION}`;
      setTasks((prev) => ({
        ...prev,
        [server.id]: { ...prev[server.id], status: "running" },
      }));
      try {
        await invoke("run_deploy_step", {
          host: server.host,
          port: server.port,
          username: server.username,
          authType,
          credential,
          commands,
          eventId: evId,
          stepId: server.id,
        });
      } catch (e) {
        setTasks((prev) => ({
          ...prev,
          [server.id]: {
            ...prev[server.id],
            status: "failed",
            logs: [...(prev[server.id]?.logs ?? []), `Connection failed: ${String(e)}`],
          },
        }));
      }
    };

    const workers = Array.from({ length: Math.min(5, servers.length) }, async () => {
      while (queue.length > 0) {
        const server = queue.shift();
        if (server) await runOne(server);
      }
    });

    await Promise.all(workers);
    unlisteners.forEach((u) => u());
    setPhase("done");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (phase !== "running") onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl flex flex-col gap-0 p-0 max-h-[85vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            Bulk Deploy — {servers.length} server{servers.length !== 1 ? "s" : ""}
            {phase === "running" && ` (${doneCount}/${servers.length} xong)`}
            {phase === "done" && " — Hoàn thành"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {/* ── Config phase ─────────────────────────────────────── */}
          {phase === "config" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Auth type</Label>
                <div className="flex gap-2">
                  {(["password", "key"] as const).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={authType === t ? "default" : "outline"}
                      className="h-7 text-xs capitalize"
                      onClick={() => setAuthType(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  {authType === "password" ? "Password SSH" : "Private key path"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type={showCred ? "text" : "password"}
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 text-sm font-mono"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowCred((v) => !v)}
                  >
                    {showCred ? <EyeOff size={13} /> : <Eye size={13} />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  SSH Commands{" "}
                  <span className="text-muted-foreground">(một lệnh mỗi dòng)</span>
                </Label>
                <textarea
                  value={commandsText}
                  onChange={(e) => setCommandsText(e.target.value)}
                  placeholder={"cd /app\ndocker compose pull\ndocker compose up -d"}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  {commands.length} lệnh × {servers.length} server (tối đa 5 song song)
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Servers đã chọn</Label>
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {servers.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground font-mono">{s.host}:{s.port}</span>
                      <Badge variant="outline" className="text-[10px] capitalize ml-auto">
                        {s.group_name}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Running / Done phase ──────────────────────────────── */}
          {(phase === "running" || phase === "done") && (
            <div className="space-y-1">
              {servers.map((s) => {
                const task = tasks[s.id];
                if (!task) return null;
                return (
                  <div key={s.id} className="border rounded-md overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs">
                      <StatusIcon status={task.status} />
                      <span className="font-medium flex-1 truncate">{s.name}</span>
                      <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                        {s.host}
                      </span>
                      <StatusBadge status={task.status} />
                      {task.logs.length > 0 && (
                        <button
                          className="text-muted-foreground hover:text-foreground ml-1 shrink-0"
                          onClick={() => toggleLog(s.id)}
                        >
                          {task.expanded
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />}
                        </button>
                      )}
                    </div>
                    {task.expanded && task.logs.length > 0 && (
                      <div className="border-t bg-muted/30 px-3 py-2 max-h-36 overflow-y-auto">
                        <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed">
                          {task.logs.join("\n")}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          {phase === "config" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button size="sm" disabled={!canStart} onClick={handleStart}>
                ▶ Start Deploy
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button size="sm" variant="ghost" disabled>
              <Loader2 size={13} className="animate-spin mr-1" />
              Đang deploy…
            </Button>
          )}
          {phase === "done" && (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
