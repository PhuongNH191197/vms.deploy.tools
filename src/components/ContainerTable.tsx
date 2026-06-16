import { useState } from "react";
import { FileText, RotateCcw, Square, Play, X, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MockContainer, MockServer } from "@/types/monitor";

interface Props {
  containers: MockContainer[];
  servers: MockServer[];
  selectedIds: string[];
  filterServer: string;
  filterStatus: string;
  searchQuery: string;
  onToggleSelect: (id: string) => void;
  onSetSelection: (ids: string[]) => void;
  onClearSelection: () => void;
  onViewLogs: (ids: string[]) => void;
  onFilterServer: (s: string) => void;
  onFilterStatus: (s: string) => void;
  onSearch: (q: string) => void;
  onContainerAction: (
    serverId: string,
    containerName: string,
    action: "start" | "stop" | "restart"
  ) => Promise<string>;
}

interface ConfirmState {
  open: boolean;
  serverId: string;
  containerName: string;
  action: "stop" | "restart";
}

function StatusBadge({ status }: { status: MockContainer["status"] }) {
  const cfg = {
    running: { label: "Running", cls: "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20" },
    exited: { label: "Exited", cls: "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/20" },
    restarting: { label: "Restarting", cls: "bg-[#ffaa00]/10 text-[#ffaa00] border-[#ffaa00]/20" },
  }[status];
  return (
    <span
      className={cn(
        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

function ActionBtn({
  icon,
  label,
  hoverClass,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hoverClass: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "p-1.5 rounded-lg border border-white/[0.07] text-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed",
            !disabled && hoverClass
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const COL =
  "grid-cols-[1.5rem_minmax(100px,1fr)_minmax(90px,1fr)_minmax(110px,1.5fr)_88px_56px_56px_64px_88px]";

export default function ContainerTable({
  containers,
  servers,
  selectedIds,
  filterServer,
  filterStatus,
  searchQuery,
  onToggleSelect,
  onSetSelection,
  onClearSelection,
  onViewLogs,
  onFilterServer,
  onFilterStatus,
  onSearch,
  onContainerAction,
}: Props) {
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    serverId: "",
    containerName: "",
    action: "stop",
  });
  const [acting, setActing] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [batchAction, setBatchAction] = useState<"start" | "stop" | "restart" | null>(null);
  const [batchActing, setBatchActing] = useState(false);
  const [batchErr, setBatchErr] = useState("");

  const filtered = containers.filter((c) => {
    if (filterServer !== "all" && c.serverId !== filterServer) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredIds = filtered.map((c) => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const someSelected = filteredIds.some((id) => selectedIds.includes(id));
  const selectionCount = selectedIds.length;

  const handleHeaderCheck = () => {
    if (allSelected) onClearSelection();
    else onSetSelection(filteredIds);
  };

  const openConfirm = (c: MockContainer, action: "stop" | "restart") => {
    setActionErr("");
    setConfirm({ open: true, serverId: c.serverId, containerName: c.name, action });
  };

  const handleConfirmAction = async () => {
    setActing(true);
    setActionErr("");
    try {
      await onContainerAction(confirm.serverId, confirm.containerName, confirm.action);
      setConfirm((p) => ({ ...p, open: false }));
    } catch (e) {
      setActionErr(String(e));
    } finally {
      setActing(false);
    }
  };

  // Start a stopped container — non-destructive, no confirm dialog.
  const handleStart = async (c: MockContainer) => {
    setNotice("");
    setStartingId(c.id);
    try {
      await onContainerAction(c.serverId, c.name, "start");
    } catch (e) {
      setNotice(`Khởi động "${c.name}" thất bại: ${String(e)}`);
    } finally {
      setStartingId(null);
    }
  };

  // Restart every selected container — works across different servers.
  const selectedContainers = containers.filter((c) => selectedIds.includes(c.id));

  const handleBatch = async () => {
    if (!batchAction) return;
    setBatchActing(true);
    setBatchErr("");
    const results = await Promise.allSettled(
      selectedContainers.map((c) => onContainerAction(c.serverId, c.name, batchAction))
    );
    const failures = results
      .map((r, i) => ({ r, c: selectedContainers[i] }))
      .filter(({ r }) => r.status === "rejected")
      .map(({ r, c }) => `${c.name}: ${String((r as PromiseRejectedResult).reason)}`);

    setBatchActing(false);
    if (failures.length > 0) {
      setBatchErr(failures.join("\n"));
    } else {
      setBatchAction(null);
      onClearSelection();
    }
  };

  const BATCH_META = {
    start: {
      label: "Khởi Động",
      color: "bg-[#00ff88]/80 hover:bg-[#00ff88]",
      iconCls: "text-[#00ff88]",
      boxCls: "bg-[#00ff88]/10 border-[#00ff88]/20",
    },
    stop: {
      label: "Dừng",
      color: "bg-red-500/80 hover:bg-red-500",
      iconCls: "text-red-400",
      boxCls: "bg-red-500/10 border-red-500/20",
    },
    restart: {
      label: "Khởi Động Lại",
      color: "bg-amber-500/80 hover:bg-amber-500",
      iconCls: "text-amber-400",
      boxCls: "bg-amber-500/10 border-amber-500/20",
    },
  } as const;
  const batchMeta = batchAction ? BATCH_META[batchAction] : null;
  const BatchIcon = batchAction === "start" ? Play : batchAction === "stop" ? Square : RotateCcw;

  const actionLabel = confirm.action === "stop" ? "Dừng" : "Khởi Động Lại";
  const actionColor =
    confirm.action === "stop"
      ? "bg-red-500/80 hover:bg-red-500"
      : "bg-amber-500/80 hover:bg-amber-500";

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Select value={filterServer} onValueChange={onFilterServer}>
            <SelectTrigger className="h-9 w-44 text-[11px] input-glass rounded-xl border-white/10">
              <SelectValue placeholder="All Servers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {servers
                .filter((s) => s.status !== "offline")
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={onFilterStatus}>
            <SelectTrigger className="h-9 w-36 text-[11px] input-glass rounded-xl border-white/10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="exited">Exited</SelectItem>
              <SelectItem value="restarting">Restarting</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-xs">
            <Input
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search container name..."
              className="h-9 text-[11px] input-glass rounded-xl border-white/10"
            />
          </div>

          <span className="ml-auto text-[10px] text-white/25 font-bold uppercase tracking-widest">
            {filtered.length} containers
          </span>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden border border-white/[0.06]"
          style={{ background: "rgba(13, 19, 32, 0.4)" }}
        >
          {/* Header */}
          <div
            className={cn("grid gap-x-3 px-4 py-2.5 border-b border-white/[0.05]", COL)}
            style={{ background: "rgba(255,255,255,0.025)" }}
          >
            <div className="flex items-center">
              <Checkbox
                checked={allSelected}
                data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                onCheckedChange={handleHeaderCheck}
                className="w-3.5 h-3.5 rounded border-white/20"
              />
            </div>
            {["Server", "Container", "Image", "Status", "CPU", "RAM", "Uptime", "Actions"].map(
              (h) => (
                <span
                  key={h}
                  className="text-[9px] font-black text-white/25 uppercase tracking-widest self-center"
                >
                  {h}
                </span>
              )
            )}
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/[0.03]">
            {filtered.map((c) => {
              const selected = selectedIds.includes(c.id);
              const isRunning = c.status === "running";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "grid gap-x-3 px-4 py-3 transition-colors duration-150 border-l-2",
                    COL,
                    selected
                      ? "bg-[#00d4ff]/[0.04] border-l-[#00d4ff]/40 hover:bg-[#00d4ff]/[0.06]"
                      : "border-l-transparent hover:bg-white/[0.015]"
                  )}
                >
                  <div className="flex items-center">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleSelect(c.id)}
                      className="w-3.5 h-3.5 rounded border-white/20"
                    />
                  </div>

                  <div className="flex flex-col justify-center min-w-0">
                    <span className="text-[11px] text-white/65 font-mono truncate">
                      {c.serverName}
                    </span>
                    <span className="text-[9px] text-white/25 font-mono truncate">
                      {c.serverIp}
                    </span>
                  </div>

                  <div className="flex items-center min-w-0">
                    <span className="text-[11px] font-bold text-white font-mono truncate">
                      {c.name}
                    </span>
                  </div>

                  <div className="flex items-center min-w-0">
                    <span className="text-[10px] text-white/35 font-mono truncate">{c.image}</span>
                  </div>

                  <div className="flex items-center">
                    <StatusBadge status={c.status} />
                  </div>

                  <div className="flex items-center">
                    <span className="text-[11px] font-mono text-[#00d4ff] tabular-nums">
                      {c.cpu}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <span className="text-[11px] font-mono text-[#a855f7] tabular-nums">
                      {c.ram}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <span className="text-[10px] text-white/40 tabular-nums">{c.uptime}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <ActionBtn
                      icon={<FileText size={12} />}
                      label="View Logs"
                      hoverClass="hover:text-[#00d4ff] hover:border-[#00d4ff]/20"
                      onClick={() => onViewLogs([c.id])}
                    />
                    {isRunning ? (
                      <>
                        <ActionBtn
                          icon={<RotateCcw size={12} />}
                          label="Restart"
                          hoverClass="hover:text-[#ffaa00] hover:border-[#ffaa00]/20"
                          onClick={() => openConfirm(c, "restart")}
                        />
                        <ActionBtn
                          icon={<Square size={12} />}
                          label="Stop"
                          hoverClass="hover:text-[#ff4444] hover:border-[#ff4444]/20"
                          onClick={() => openConfirm(c, "stop")}
                        />
                      </>
                    ) : (
                      <ActionBtn
                        icon={
                          startingId === c.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )
                        }
                        label="Start"
                        hoverClass="hover:text-[#00ff88] hover:border-[#00ff88]/20"
                        onClick={() => handleStart(c)}
                        disabled={startingId === c.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-14">
              <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest">
                No containers match the filter
              </p>
            </div>
          )}
        </div>

        {/* Sticky selection bar */}
        {selectionCount > 0 && (
          <div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl animate-fade-in-up"
            style={{
              background: "rgba(10, 15, 28, 0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(0, 212, 255, 0.18)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(0,212,255,0.06)",
            }}
          >
            <span className="text-[12px] font-bold">
              <span className="text-[#00d4ff]">{selectionCount}</span>
              <span className="text-white/50"> containers selected</span>
            </span>

            <div className="h-4 w-px bg-white/10" />

            <button
              onClick={() => onViewLogs(selectedIds)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-80"
              style={{
                background: "rgba(0,212,255,0.1)",
                border: "1px solid rgba(0,212,255,0.25)",
                color: "#00d4ff",
              }}
            >
              <FileText size={12} />
              Xem Logs
            </button>

            <button
              onClick={() => {
                setBatchErr("");
                setBatchAction("start");
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/[0.07] text-white/40 hover:text-[#00ff88] hover:border-[#00ff88]/20 transition-all"
            >
              <Play size={12} />
              Start All
            </button>

            <button
              onClick={() => {
                setBatchErr("");
                setBatchAction("restart");
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/[0.07] text-white/40 hover:text-[#ffaa00] hover:border-[#ffaa00]/20 transition-all"
            >
              <RotateCcw size={12} />
              Restart All
            </button>

            <button
              onClick={() => {
                setBatchErr("");
                setBatchAction("stop");
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/[0.07] text-white/40 hover:text-[#ff4444] hover:border-[#ff4444]/20 transition-all"
            >
              <Square size={12} />
              Stop All
            </button>

            <button
              onClick={onClearSelection}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] text-white/25 hover:text-white/60 transition-all"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}

        {/* Confirm Action Dialog */}
        <Dialog
          open={confirm.open}
          onOpenChange={(v) => {
            if (!v && !acting) setConfirm((p) => ({ ...p, open: false }));
          }}
        >
          <DialogContent className="glass-dialog sm:max-w-[380px] rounded-3xl border-white/10 p-8">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    confirm.action === "stop"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-amber-500/10 border-amber-500/20"
                  )}
                >
                  <AlertTriangle
                    size={20}
                    className={confirm.action === "stop" ? "text-red-400" : "text-amber-400"}
                  />
                </div>
                <DialogTitle className="text-[16px] font-black text-white uppercase tracking-tight">
                  {actionLabel} Container
                </DialogTitle>
              </div>
            </DialogHeader>

            <p className="text-[13px] text-df-text-secondary mb-2">
              {confirm.action === "stop" ? "Dừng" : "Khởi động lại"} container{" "}
              <span className="text-white font-black font-mono">"{confirm.containerName}"</span>?
            </p>

            {actionErr && (
              <p className="text-[11px] text-red-400 font-bold mt-2 break-all">{actionErr}</p>
            )}

            <DialogFooter className="mt-6 gap-3">
              <Button
                variant="ghost"
                className="btn-ghost-glass rounded-xl px-5 h-11"
                onClick={() => setConfirm((p) => ({ ...p, open: false }))}
                disabled={acting}
              >
                Hủy
              </Button>
              <Button
                disabled={acting}
                className={cn(
                  "rounded-xl px-6 h-11 font-black uppercase tracking-widest text-white border-0",
                  actionColor
                )}
                onClick={handleConfirmAction}
              >
                {acting ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
                {actionLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Action Confirm Dialog (Start/Stop/Restart All) */}
        <Dialog
          open={batchAction !== null}
          onOpenChange={(v) => {
            if (!v && !batchActing) setBatchAction(null);
          }}
        >
          <DialogContent className="glass-dialog sm:max-w-[420px] rounded-3xl border-white/10 p-8">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    batchMeta?.boxCls
                  )}
                >
                  <BatchIcon size={20} className={batchMeta?.iconCls} />
                </div>
                <DialogTitle className="text-[16px] font-black text-white uppercase tracking-tight">
                  {batchMeta?.label} Tất Cả
                </DialogTitle>
              </div>
            </DialogHeader>

            <p className="text-[13px] text-df-text-secondary mb-2">
              {batchMeta?.label}{" "}
              <span className="text-white font-black">{selectedContainers.length}</span> container
              đã chọn (trên {new Set(selectedContainers.map((c) => c.serverId)).size} server)?
            </p>

            {batchErr && (
              <pre className="text-[11px] text-red-400 font-bold mt-2 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                {batchErr}
              </pre>
            )}

            <DialogFooter className="mt-6 gap-3">
              <Button
                variant="ghost"
                className="btn-ghost-glass rounded-xl px-5 h-11"
                onClick={() => setBatchAction(null)}
                disabled={batchActing}
              >
                Hủy
              </Button>
              <Button
                disabled={batchActing}
                className={cn(
                  "rounded-xl px-6 h-11 font-black uppercase tracking-widest text-white border-0",
                  batchMeta?.color
                )}
                onClick={handleBatch}
              >
                {batchActing ? <Loader2 size={15} className="mr-2 animate-spin" /> : null}
                {batchMeta?.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Action error toast */}
        {notice && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl animate-fade-in-up"
            style={{
              background: "rgba(28, 12, 12, 0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 68, 68, 0.25)",
            }}
          >
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-bold text-red-300 break-all">{notice}</span>
            <button onClick={() => setNotice("")} className="text-white/30 hover:text-white/70">
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
