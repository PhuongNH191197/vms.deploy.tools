import { cn } from "@/lib/utils";
import type { MockServer } from "@/types/monitor";

interface Props {
  server: MockServer;
  isHighlighted: boolean;
  onClick: () => void;
}

function MiniBar({ value, warn, danger }: { value: number; warn?: boolean; danger?: boolean }) {
  const barColor = danger
    ? "bg-[#ff4444]"
    : warn
    ? "bg-[#ffaa00]"
    : value > 60
    ? "bg-[#00d4ff]"
    : "bg-[#00ff88]";

  return (
    <div className="h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", barColor)}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export default function ServerCard({ server, isHighlighted, onClick }: Props) {
  const isOffline = server.status === "offline";
  const isWarning = server.status === "warning";

  const dotColor = isOffline ? "#ff4444" : isWarning ? "#ffaa00" : "#00ff88";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-[220px] p-4 rounded-2xl cursor-pointer select-none",
        "border transition-all duration-300",
        "hover:scale-[1.02]",
        isHighlighted
          ? "bg-[#00d4ff]/[0.07] border-[#00d4ff]/40 shadow-[0_0_24px_rgba(0,212,255,0.12)]"
          : isWarning
          ? "bg-[#ffaa00]/[0.04] border-[#ffaa00]/20 hover:border-[#ffaa00]/40"
          : isOffline
          ? "bg-white/[0.02] border-white/[0.05] opacity-60 hover:border-white/[0.1]"
          : "bg-[#0f1117] border-white/[0.08] hover:border-white/[0.18]"
      )}
    >
      {/* Status + Name + IP */}
      <div className="flex items-start gap-2 mb-3">
        <div
          className={cn("w-2 h-2 rounded-full mt-[3px] shrink-0", !isOffline && "animate-pulse-glow")}
          style={{
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}88`,
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-white leading-tight truncate">{server.name}</p>
          <p className="text-[10px] text-white/35 font-mono mt-0.5">{server.ip}</p>
        </div>
        {isWarning && (
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#ffaa00]/15 text-[#ffaa00] border border-[#ffaa00]/20 shrink-0">
            WARN
          </span>
        )}
        {isOffline && (
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#ff4444]/15 text-[#ff4444] border border-[#ff4444]/20 shrink-0">
            OFF
          </span>
        )}
      </div>

      {/* Metric bars */}
      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-white/35 uppercase tracking-wider font-bold">CPU</span>
            <span className={cn("text-[10px] font-bold tabular-nums", server.cpu > 80 ? "text-[#ffaa00]" : "text-white/60")}>
              {server.cpu}%
            </span>
          </div>
          <MiniBar value={server.cpu} warn={server.cpu > 80} />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-white/35 uppercase tracking-wider font-bold">RAM</span>
            <span className={cn("text-[10px] font-bold tabular-nums", server.ram > 90 ? "text-[#ff4444]" : "text-white/60")}>
              {server.ram}%
            </span>
          </div>
          <MiniBar value={server.ram} warn={server.ram > 80} danger={server.ram > 90} />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-white/35 uppercase tracking-wider font-bold">Disk</span>
            <span className="text-[10px] font-bold tabular-nums text-white/60">{server.disk}%</span>
          </div>
          <MiniBar value={server.disk} />
        </div>
      </div>

      {/* Container count */}
      <div className="pt-2.5 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Containers</span>
        <span className="text-[11px] font-bold tabular-nums">
          <span className={isOffline ? "text-white/25" : "text-[#00ff88]"}>
            {server.containersRunning}
          </span>
          <span className="text-white/25"> / {server.containersTotal}</span>
        </span>
      </div>
    </div>
  );
}
