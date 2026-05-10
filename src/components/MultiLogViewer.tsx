import { useEffect, useState } from "react";
import { X, Play, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import LogPanel from "@/components/LogPanel";
import { useMonitorStore } from "@/store/monitorStore";
import type { MockContainer } from "@/types/monitor";
import type { LogPanelLayout } from "@/types/monitor";

interface Props {
  containers: MockContainer[];
  onClose: () => void;
}

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function resolveGridClass(count: number, layout: LogPanelLayout): string {
  const cols =
    layout !== "auto"
      ? (layout as number)
      : count === 1
      ? 1
      : count === 2
      ? 2
      : count <= 4
      ? 2
      : count <= 6
      ? 3
      : count <= 9
      ? 3
      : 4;
  return GRID_COLS[cols] ?? "grid-cols-4";
}

const LAYOUT_OPTIONS: LogPanelLayout[] = ["auto", 1, 2, 3, 4];

export default function MultiLogViewer({ containers, onClose }: Props) {
  const { logCommand, logPanelLayout, setLogCommand, setLogPanelLayout } = useMonitorStore();
  const [localCommand, setLocalCommand] = useState(logCommand);
  const [activeCommand, setActiveCommand] = useState(logCommand);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRunAll = () => {
    setActiveCommand(localCommand);
    setLogCommand(localCommand);
  };

  const gridClass = resolveGridClass(containers.length, logPanelLayout);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col animate-fade-in"
      style={{
        background: "#060a12",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.07] shrink-0"
        style={{ background: "rgba(13, 19, 32, 0.9)" }}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <LayoutGrid size={15} className="text-[#00d4ff]" />
          <span className="text-[12px] font-bold text-white uppercase tracking-wider">
            Multi-Log Viewer
          </span>
          <span className="text-[11px] text-white/30 font-mono">— {containers.length} containers</span>
        </div>

        {/* Command input */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <Input
            value={localCommand}
            onChange={(e) => setLocalCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRunAll();
            }}
            placeholder="tail -f /opt/vms/application/Logs/Ai/vms_ai.log"
            className="h-8 text-[11px] input-glass rounded-xl border-white/10 font-mono"
          />
          <button
            onClick={handleRunAll}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-bold uppercase tracking-wider border shrink-0 transition-all hover:opacity-80"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
            }}
          >
            <Play size={11} />
            Run All
          </button>
        </div>

        {/* Layout toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[9px] text-white/25 uppercase tracking-widest font-bold mr-1">Layout</span>
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={String(opt)}
              onClick={() => setLogPanelLayout(opt)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                logPanelLayout === opt
                  ? "bg-[#00d4ff]/10 border-[#00d4ff]/35 text-[#00d4ff]"
                  : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/20"
              )}
            >
              {opt === "auto" ? "Auto" : opt}
            </button>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="ml-2 p-2 rounded-xl border border-white/[0.08] text-white/35 hover:text-[#ff4444] hover:border-[#ff4444]/25 transition-all"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Log Grid */}
      <div
        className={cn("flex-1 grid gap-3 p-4 overflow-y-auto custom-scrollbar min-h-0", gridClass)}
      >
        {containers.map((c) => (
          <LogPanel key={c.id} container={c} command={activeCommand} />
        ))}
      </div>
    </div>
  );
}
