import { FileText, RotateCcw, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
}: {
  icon: React.ReactNode;
  label: string;
  hoverClass: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "p-1.5 rounded-lg border border-white/[0.07] text-white/30 transition-all",
            hoverClass
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

const COL = "grid-cols-[1.5rem_minmax(100px,1fr)_minmax(90px,1fr)_minmax(110px,1.5fr)_88px_56px_56px_64px_88px]";

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
}: Props) {
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
    if (allSelected) {
      onClearSelection();
    } else {
      onSetSelection(filteredIds);
    }
  };

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
                    <span className="text-[11px] text-white/65 font-mono truncate">{c.serverName}</span>
                    <span className="text-[9px] text-white/25 font-mono truncate">{c.serverIp}</span>
                  </div>

                  <div className="flex items-center min-w-0">
                    <span className="text-[11px] font-bold text-white font-mono truncate">{c.name}</span>
                  </div>

                  <div className="flex items-center min-w-0">
                    <span className="text-[10px] text-white/35 font-mono truncate">{c.image}</span>
                  </div>

                  <div className="flex items-center">
                    <StatusBadge status={c.status} />
                  </div>

                  <div className="flex items-center">
                    <span className="text-[11px] font-mono text-[#00d4ff] tabular-nums">{c.cpu}</span>
                  </div>

                  <div className="flex items-center">
                    <span className="text-[11px] font-mono text-[#a855f7] tabular-nums">{c.ram}</span>
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
                    <ActionBtn
                      icon={<RotateCcw size={12} />}
                      label="Restart"
                      hoverClass="hover:text-[#ffaa00] hover:border-[#ffaa00]/20"
                    />
                    <ActionBtn
                      icon={<Square size={12} />}
                      label="Stop"
                      hoverClass="hover:text-[#ff4444] hover:border-[#ff4444]/20"
                    />
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
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(0,212,255,0.06)",
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

            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-white/[0.07] text-white/40 hover:text-[#ffaa00] hover:border-[#ffaa00]/20 transition-all">
              <RotateCcw size={12} />
              Restart All
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
      </div>
    </TooltipProvider>
  );
}
