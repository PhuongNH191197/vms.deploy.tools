import { create } from "zustand";
import type { ServerMetrics, ServerStatus } from "@/types";
import { getServerMetrics, saveMetricsSnapshot } from "@/lib/tauri/commands";

interface SessionCredential {
  authType: string;
  credential: string;
}

interface MonitorEntry {
  metrics: ServerMetrics | null;
  status: ServerStatus;
  lastUpdated: number;
}

interface MonitorState {
  entries: Record<string, MonitorEntry>;
  credentials: Record<string, SessionCredential>; // in-memory only, cleared on unmount
  intervals: Record<string, ReturnType<typeof setInterval>>;

  setCredential: (serverId: string, cred: SessionCredential) => void;
  startPolling: (serverId: string, host: string, port: number, username: string) => void;
  stopPolling: (serverId: string) => void;
  stopAll: () => void;
}

function calcStatus(metrics: ServerMetrics | null, error = false): ServerStatus {
  if (error || !metrics) return "offline";
  if (metrics.cpu_percent > 80 || metrics.ram_percent > 90) return "warning";
  return "online";
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  entries: {},
  credentials: {},
  intervals: {},

  setCredential: (serverId, cred) => {
    set((s) => ({ credentials: { ...s.credentials, [serverId]: cred } }));
  },

  startPolling: (serverId) => {
    const existing = get().intervals[serverId];
    if (existing) clearInterval(existing);

    const poll = async () => {
      try {
        const metrics = await getServerMetrics(serverId);
        set((s) => ({
          entries: {
            ...s.entries,
            [serverId]: { metrics, status: calcStatus(metrics), lastUpdated: Date.now() },
          },
        }));
        saveMetricsSnapshot({
          serverId,
          cpuPercent: metrics.cpu_percent,
          ramPercent: metrics.ram_percent,
          ramUsedMb: metrics.ram_used_mb,
          ramTotalMb: metrics.ram_total_mb,
          diskPercent: metrics.disk_percent,
        }).catch(() => {});
      } catch {
        set((s) => ({
          entries: {
            ...s.entries,
            [serverId]: { metrics: null, status: "offline", lastUpdated: Date.now() },
          },
        }));
      }
    };

    poll(); // immediate first fetch
    const interval = setInterval(poll, 5_000);

    set((s) => ({ intervals: { ...s.intervals, [serverId]: interval } }));
  },

  stopPolling: (serverId) => {
    const interval = get().intervals[serverId];
    if (interval) {
      clearInterval(interval);
      set((s) => {
        const { [serverId]: _, ...rest } = s.intervals;
        return { intervals: rest };
      });
    }
  },

  stopAll: () => {
    const intervals = get().intervals;
    Object.values(intervals).forEach(clearInterval);
    set({ intervals: {}, credentials: {} });
  },
}));
