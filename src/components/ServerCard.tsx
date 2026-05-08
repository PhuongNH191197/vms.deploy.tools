import type { Server as ServerType, ServerStatus } from "@/types";

interface ServerCardProps {
  server: ServerType;
  status: ServerStatus;
  metrics?: {
    cpu_percent: number;
    ram_percent: number;
    disk_percent?: number;
    uptime?: string;
    uptime_seconds?: number;
  };
  onInfo: (id: string) => void;
  index?: number;
}

/* Helper to format seconds to human-readable uptime */
function formatUptime(seconds: number | undefined): string {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / (3600 * 24));
  const hrs = Math.floor((seconds % (3600 * 24)) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/* Tiny SVG sparkline */
function Sparkline() {
  // Use slightly more dynamic random-ish points for demo
  const points = [12, 28, 18, 35, 22, 30, 25, 38, 20, 42, 35];
  const w = 70;
  const h = 24;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / 50) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="drop-shadow-[0_0_8px_rgba(49,232,255,0.8)] opacity-90">
      <path d={d} stroke="url(#spark-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F2FF" />
          <stop offset="100%" stopColor="#AD00FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function ServerCard({ server, status, metrics, onInfo, index = 0 }: ServerCardProps) {
  const isOnline = status === "online" || status === "unknown";
  const cpu = metrics?.cpu_percent ?? 0;
  const ram = metrics?.ram_percent ?? 0;
  const disk = metrics?.disk_percent ?? 0;
  const uptime = metrics?.uptime || formatUptime(metrics?.uptime_seconds);

  return (
    <div
      className="cursor-pointer group relative overflow-hidden animate-fade-in-up"
      style={{
        animationDelay: `${index * 0.05}s`,
        background: "rgba(10, 14, 26, 0.75)",
        backdropFilter: "blur(30px) saturate(160%)",
        WebkitBackdropFilter: "blur(30px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)",
        padding: "20px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,242,255,0.35)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.7), 0 0 25px rgba(0,242,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.09)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
      onClick={() => onInfo(server.id)}
    >
      {/* ── Hover ambient glow ── */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[50px]"
        style={{
          background: "radial-gradient(circle, rgba(0,242,255,0.12) 0%, transparent 70%)",
        }}
      />
      
      {/* ── Header: Name LEFT | Badge RIGHT ── */}
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div>
          <h3 className="text-[14px] font-bold text-white leading-tight">
            {server.name}
          </h3>
          <p className="text-[10px] text-white/35 font-medium mt-0.5 tracking-wide">
            {isOnline ? "Healthy" : "Offline"}
          </p>
        </div>
        <span className="flex-shrink-0 bg-[rgba(34,197,94,0.1)] text-[#22C55E] rounded-full px-2.5 py-0.5 text-[8px] font-black tracking-[0.15em] flex items-center gap-1.5 border border-[rgba(34,197,94,0.2)] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shadow-[0_0_6px_rgba(34,197,94,0.9)] flex-shrink-0" />
          ACTIVE
        </span>
      </div>

      {/* ── CPU ── */}
      <div className="mb-4 relative z-10">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold text-white/50 tracking-wider">CPU</span>
          <span className="text-[11px] font-bold text-white">{cpu}%</span>
        </div>
        <div className="h-[6px] w-full rounded-full bg-black/50 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000" 
            style={{ 
              width: `${cpu}%`,
              background: "linear-gradient(90deg, #00F2FF, #AD00FF)",
              boxShadow: cpu > 70 ? "0 0 12px rgba(0,242,255,0.6), 0 0 6px rgba(173,0,255,0.4)" : "0 0 6px rgba(0,242,255,0.3)",
            }} 
          />
        </div>
      </div>

      {/* ── RAM ── */}
      <div className="mb-5 relative z-10">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold text-white/50 tracking-wider">RAM</span>
          <span className="text-[11px] font-bold text-white">{ram}%</span>
        </div>
        <div className="h-[6px] w-full rounded-full bg-black/50 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000" 
            style={{ 
              width: `${ram}%`,
              background: "linear-gradient(90deg, #AD00FF, #00F2FF)",
              boxShadow: ram > 70 ? "0 0 12px rgba(173,0,255,0.6), 0 0 6px rgba(0,242,255,0.4)" : "0 0 6px rgba(173,0,255,0.3)",
            }} 
          />
        </div>
      </div>

      {/* ── Footer: Disk + Sparkline + Uptime ── */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[9px] font-bold text-white/35 uppercase tracking-widest block">Disk</span>
            <span className="text-[12px] font-bold text-white/85">{disk}%</span>
          </div>
          <Sparkline />
        </div>
        
        <div className="text-right">
          <span className="text-[9px] font-bold text-white/35 uppercase tracking-widest block">Uptime</span>
          <span className="text-[12px] font-bold text-white/85">{uptime}</span>
        </div>
      </div>
    </div>
  );
}
