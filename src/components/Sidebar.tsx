import { NavLink } from "react-router-dom";
import {
  Home,
  Rocket,
  Layers,
  Bell,
  Settings,
  FolderKanban,
  Zap,
  GitMerge,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/", color: "#31E8FF", glowColor: "rgba(49,232,255" },
  { icon: FolderKanban, label: "projects", path: "/projects", color: "#F59E0B", glowColor: "rgba(245,158,11" },
  { icon: Zap, label: "bulk deploy", path: "/bulk-deploy", color: "#22D3EE", glowColor: "rgba(34,211,238" },
  { icon: Rocket, label: "deployments", path: "/update", color: "#C084FC", glowColor: "rgba(192,132,252" },
  { icon: Layers, label: "infrastructure", path: "/setup", color: "#4ADE80", glowColor: "rgba(74,222,128" },
  { icon: Bell, label: "alerts", path: "/monitor", color: "#FB923C", glowColor: "rgba(251,146,60" },
  { icon: GitMerge, label: "gitlab runner", path: "/gitlab-runner", color: "#E2734A", glowColor: "rgba(226,115,74" },
  { icon: Settings, label: "settings", path: "/audit", color: "#94A3B8", glowColor: "rgba(148,163,184" },
];

export default function Sidebar() {
  return (
    <aside
      className="w-[220px] min-w-[220px] flex flex-col h-screen relative z-20 border-r border-white/[0.08] overflow-hidden"
    style={{
      zIndex: -999,
    }}
    >
      {/* ── Brand ── */}
      <div className="pl-5 pt-10 pb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex-shrink-0">
            <img src="/logo.svg" alt="HawkNest" className="w-full h-full object-contain" />
          </div>
          <span className="text-[20px] font-bold tracking-tighter text-white">
            HawkNest
          </span>
        </div>
      </div>

      {/* ── Nav Items — nav NOT padded so NavLink spans full width for flush indicator ── */}
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3.5 py-3 transition-all duration-400 group relative",
                isActive ? "text-white" : "hover:bg-white/[0.025]"
              )
            }
            style={{ paddingLeft: "25px", paddingRight: "12px" }}
          >
            {({ isActive }) => (
              <>
                {/* ── Indicator bar: flush with sidebar LEFT edge ── */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full animate-fade-in"
                    style={{
                      background: item.color,
                      boxShadow: `0 0 10px ${item.glowColor},1)), 0 0 22px ${item.glowColor},0.6)), 0 0 40px ${item.glowColor},0.25))`,
                    }}
                  />
                )}

                {/* ── Active row background box (has horizontal margin) ── */}
                {isActive && (
                  <div
                    className="absolute top-0 bottom-0 rounded-xl"
                    style={{
                      left: "10px",
                      right: "8px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                    }}
                  />
                )}

                {/* ── Icon: bloom glow, no container ── */}
                <item.icon
                  size={20}
                  className="relative z-10 flex-shrink-0"
                  style={{
                    color: item.color,
                    filter: isActive
                      ? `drop-shadow(0 0 3px ${item.glowColor},1)) drop-shadow(0 0 8px ${item.glowColor},1)) drop-shadow(0 0 18px ${item.glowColor},0.8)) drop-shadow(0 0 35px ${item.glowColor},0.5))`
                      : `drop-shadow(0 0 3px ${item.glowColor},0.9)) drop-shadow(0 0 8px ${item.glowColor},0.75)) drop-shadow(0 0 16px ${item.glowColor},0.45))`,
                    transition: "filter 0.4s ease",
                  }}
                />

                {/* ── Label ── */}
                <span
                  className={cn(
                    "text-[15px] font-semibold tracking-wide transition-all duration-400 truncate relative z-10",
                    isActive ? "text-white" : "text-white/50 group-hover:text-white/75"
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom Info ── */}
      <div className="pl-6 pt-4 pb-[4.5rem] border-t border-white/10">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.25em]">VMS Deploy Tools</span>
          <span className="text-[10px] font-semibold text-df-cyan/70">v1.0.0 Stable</span>
        </div>
        <div className="mt-3 flex flex-col gap-0.5">
          <span className="text-[9px] text-white/40">Created by <span className="text-white/70 font-semibold">PhuongNH</span></span>
          <span className="text-[9px] text-white/35">Apr – May 2026</span>
        </div>
      </div>
    </aside>
  );
}
