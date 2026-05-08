import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, EyeOff, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Circle, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Server } from "@/types";
import { cn } from "@/lib/utils";

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
    case "pending": return <Circle size={14} className="text-white/20" />;
    case "running": return <Loader2 size={14} className="animate-spin text-df-cyan" />;
    case "success": return <CheckCircle2 size={14} className="text-df-green" />;
    case "failed":  return <XCircle size={14} className="text-df-red" />;
  }
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = {
    pending: { label: "PENDING",    className: "bg-white/5 text-white/40" },
    running: { label: "RUNNING",    className: "bg-df-cyan/10 text-df-cyan border-df-cyan/20 animate-pulse" },
    success: { label: "SUCCESS",    className: "badge-active" },
    failed:  { label: "FAILED",     className: "badge-error"  },
  } as const;
  const { label, className } = cfg[status];
  return <Badge className={cn("text-[9px] font-black tracking-widest px-2 py-0.5 rounded-lg border-0", className)}>{label}</Badge>;
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

  const labelClass = "text-[11px] font-black uppercase tracking-widest text-df-text-secondary mb-2 block";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (phase !== "running") onOpenChange(v);
      }}
    >
      <DialogContent className="glass-dialog max-w-2xl flex flex-col gap-0 p-0 max-h-[85vh] rounded-3xl border-white/10 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-6 bg-white/[0.02] border-b border-white/[0.05] shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-df-purple/10 flex items-center justify-center shadow-neon-purple/20">
                <Rocket size={20} className="text-df-purple" />
             </div>
             <div>
                <DialogTitle className="text-[18px] font-black text-white uppercase tracking-tight">
                  Bulk Infrastructure Deployment
                </DialogTitle>
                <p className="text-[10px] font-bold text-df-text-secondary uppercase tracking-widest mt-1 opacity-50">
                   Targeting {servers.length} node{servers.length !== 1 ? "s" : ""}
                   {phase === "running" && ` • Execution in progress (${doneCount}/${servers.length})`}
                   {phase === "done" && " • Execution Complete"}
                </p>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 min-h-0 custom-scrollbar">
          {/* ── Config phase ─────────────────────────────────────── */}
          {phase === "config" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className={labelClass}>SSH Authorization</Label>
                  <div className="flex gap-2">
                    {(["password", "key"] as const).map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-10 flex-1 btn-ghost-glass rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                          authType === t ? "bg-df-cyan/10 border-df-cyan text-df-cyan shadow-neon-cyan/20" : ""
                        )}
                        onClick={() => setAuthType(t)}
                      >
                        {t === "password" ? <ShieldCheck size={14} className="mr-2" /> : <Terminal size={14} className="mr-2" />}
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className={labelClass}>
                    {authType === "password" ? "SSH Passkey" : "Private Key Path"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showCred ? "text" : "password"}
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      placeholder={authType === "password" ? "••••••••" : "/root/.ssh/id_rsa"}
                      className="h-10 input-glass rounded-xl pr-12 text-sm font-mono"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-df-text-secondary hover:text-df-cyan transition-colors"
                      onClick={() => setShowCred((v) => !v)}
                      tabIndex={-1}
                    >
                      {showCred ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className={labelClass}>
                  Execution Script
                  <span className="text-df-text-secondary opacity-40 ml-2">(One command per line)</span>
                </Label>
                <textarea
                  value={commandsText}
                  onChange={(e) => setCommandsText(e.target.value)}
                  placeholder={"# Example Script\ncd /opt/vms\ndocker compose pull\ndocker compose up -d"}
                  rows={5}
                  className="w-full rounded-2xl input-glass bg-black/20 px-4 py-3 text-[13px] font-mono leading-relaxed placeholder:text-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-df-cyan/50 resize-none min-h-[120px] custom-scrollbar"
                />
                <div className="flex justify-between items-center px-1">
                   <p className="text-[10px] font-black text-df-text-secondary uppercase tracking-widest opacity-40">
                    {commands.length} commands per node • Concurrency: 5
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className={labelClass}>Target Infrastructure</Label>
                <div className="glass-card rounded-2xl border-white/[0.03] divide-y divide-white/[0.03] max-h-48 overflow-y-auto custom-scrollbar">
                  {servers.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-3 group hover:bg-white/[0.02] transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-df-cyan shadow-neon-cyan"></div>
                      <div className="flex-1">
                        <span className="text-[13px] font-black text-df-text-primary uppercase tracking-tight">{s.name}</span>
                        <span className="text-[11px] font-mono text-df-text-secondary ml-3 opacity-40">{s.host}:{s.port}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-white/5 bg-white/5 text-df-text-secondary px-2 py-0.5 rounded-lg group-hover:text-df-cyan transition-colors">
                        {s.group_name}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Running / Done phase ──────────────────────────────── */}
          {(phase === "running" || phase === "done") && (
            <div className="space-y-3 animate-fade-in">
              {servers.map((s) => {
                const task = tasks[s.id];
                if (!task) return null;
                return (
                  <div key={s.id} className="glass-card rounded-2xl border-white/[0.03] overflow-hidden group">
                    <div 
                      className={cn(
                        "flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-all",
                        task.expanded ? "bg-white/[0.02]" : ""
                      )}
                      onClick={() => toggleLog(s.id)}
                    >
                      <StatusIcon status={task.status} />
                      <div className="flex-1 min-w-0">
                         <span className="text-[13px] font-black text-df-text-primary uppercase tracking-tight block truncate">{s.name}</span>
                         <span className="text-[10px] font-mono text-df-text-secondary opacity-40 uppercase tracking-widest">{s.host}</span>
                      </div>
                      <StatusBadge status={task.status} />
                      {task.logs.length > 0 && (
                        <div className="ml-2 opacity-40 group-hover:opacity-100 transition-opacity">
                          {task.expanded
                            ? <ChevronDown size={14} className="text-df-cyan" />
                            : <ChevronRight size={14} />}
                        </div>
                      )}
                    </div>
                    {task.expanded && task.logs.length > 0 && (
                      <div className="bg-black/40 border-t border-white/[0.05] px-6 py-4 animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                           <Terminal size={12} className="text-df-green opacity-60" />
                           <span className="text-[9px] font-black text-df-green uppercase tracking-widest opacity-60">Terminal Execution Log</span>
                        </div>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap text-df-text-secondary leading-relaxed custom-scrollbar max-h-48 overflow-y-auto">
                          {task.logs.map((l, i) => (
                             <div key={i} className={cn("mb-1", l.startsWith("[ERR]") ? "text-df-red" : "text-df-green")}>
                                {l.startsWith("[ERR]") ? "✖ " : "✔ "} {l || " "}
                             </div>
                          ))}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-8 py-6 bg-white/[0.02] border-t border-white/[0.05] shrink-0 gap-3">
          {phase === "config" && (
            <>
              <Button variant="ghost" className="btn-ghost-glass h-11 px-8 rounded-xl" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button disabled={!canStart} onClick={handleStart} className="btn-cyan h-11 px-10 rounded-xl font-black uppercase tracking-widest">
                <Rocket size={18} className="mr-2" />
                Execute Deployment
              </Button>
            </>
          )}
          {phase === "running" && (
            <div className="flex items-center gap-4 w-full">
               <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-df-cyan shadow-neon-cyan transition-all duration-500" 
                    style={{ width: `${(doneCount / servers.length) * 100}%` }}
                  />
               </div>
               <Button variant="ghost" className="btn-ghost-glass h-11 px-8 rounded-xl opacity-50 cursor-not-allowed" disabled>
                <Loader2 size={16} className="animate-spin mr-2" />
                Deploying... {doneCount}/{servers.length}
              </Button>
            </div>
          )}
          {phase === "done" && (
            <Button className="btn-cyan h-11 px-10 rounded-xl font-black uppercase tracking-widest" onClick={() => onOpenChange(false)}>
              Close Terminal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
