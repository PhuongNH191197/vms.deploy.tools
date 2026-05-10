import { create } from "zustand";
import type { ServerMetrics, ServerStatus } from "@/types";
import type { LogPanelLayout, RealContainer } from "@/types/monitor";
import { getServerMetrics, saveMetricsSnapshot, getContainerInfo, dockerContainerAction } from "@/lib/tauri/commands";

interface SessionCredential {
  authType: string;
  credential: string;
}

interface MonitorEntry {
  metrics: ServerMetrics | null;
  containers: RealContainer[];
  status: ServerStatus;
  lastUpdated: number;
}

interface MonitorState {
  // ── SSH polling (existing) ────────────────────────────────────────────────
  entries: Record<string, MonitorEntry>;
  credentials: Record<string, SessionCredential>;
  intervals: Record<string, ReturnType<typeof setInterval>>;
  setCredential: (serverId: string, cred: SessionCredential) => void;
  startPolling: (serverId: string) => void;
  stopPolling: (serverId: string) => void;
  stopAll: () => void;

  // ── Monitor page UI state ────────────────────────────────────────────────
  selectedProject: string;
  selectedContainerIds: string[];   // checkbox selections
  modalContainerIds: string[];      // containers shown in log modal
  isLogModalOpen: boolean;
  logCommand: string;
  logPanelLayout: LogPanelLayout;
  filterServer: string;
  filterStatus: string;
  searchQuery: string;
  isRefreshing: boolean;
  autoRefresh: boolean;
  autoRefreshInterval: 5 | 10 | 30;

  setSelectedProject: (id: string) => void;
  toggleContainer: (id: string) => void;
  setSelectedContainers: (ids: string[]) => void;
  clearSelection: () => void;
  openLogModal: (ids: string[]) => void;
  closeLogModal: () => void;
  setLogCommand: (cmd: string) => void;
  setLogPanelLayout: (layout: LogPanelLayout) => void;
  setFilterServer: (s: string) => void;
  setFilterStatus: (s: string) => void;
  setSearchQuery: (q: string) => void;
  setRefreshing: (v: boolean) => void;
  setAutoRefresh: (v: boolean) => void;
  setAutoRefreshInterval: (n: 5 | 10 | 30) => void;
  dockerAction: (serverId: string, container: string, action: "start" | "stop" | "restart") => Promise<string>;
}

function calcStatus(metrics: ServerMetrics | null, error = false): ServerStatus {
  if (error || !metrics) return "offline";
  if (metrics.cpu_percent > 80 || metrics.ram_percent > 90) return "warning";
  return "online";
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  // ── SSH polling ───────────────────────────────────────────────────────────
  entries: {},
  credentials: {},
  intervals: {},

  setCredential: (serverId, cred) =>
    set((s) => ({ credentials: { ...s.credentials, [serverId]: cred } })),

  startPolling: (serverId) => {
    const existing = get().intervals[serverId];
    if (existing) clearInterval(existing);

    const poll = async () => {
      try {
        const [metrics, containers] = await Promise.all([
          getServerMetrics(serverId),
          getContainerInfo({ serverId }).catch(() => [] as RealContainer[]),
        ]);

        set((s) => ({
          entries: {
            ...s.entries,
            [serverId]: {
              metrics,
              containers,
              status: calcStatus(metrics),
              lastUpdated: Date.now(),
            },
          },
        }));

        saveMetricsSnapshot({
          serverId,
          cpuPercent: metrics.cpu_percent,
          ramPercent: metrics.ram_percent,
          ramUsedMb: metrics.ram_used_mb,
          ramTotalMb: metrics.ram_total_mb,
          diskPercent: metrics.disk_percent,
        }).catch(() => { });
      } catch (e) {
        set((s) => ({
          entries: {
            ...s.entries,
            [serverId]: {
              metrics: null,
              containers: [],
              status: "offline",
              lastUpdated: Date.now(),
            },
          },
        }));
      }
    };

    poll();
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
    Object.values(get().intervals).forEach(clearInterval);
    set({ intervals: {}, credentials: {} });
  },

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedProject: "all",
  selectedContainerIds: [],
  modalContainerIds: [],
  isLogModalOpen: false,
  logCommand: "df -h",
  logPanelLayout: "auto",
  filterServer: "all",
  filterStatus: "all",
  searchQuery: "",
  isRefreshing: false,
  autoRefresh: false,
  autoRefreshInterval: 10,

  setSelectedProject: (id) => set({ selectedProject: id }),

  toggleContainer: (id) =>
    set((s) => ({
      selectedContainerIds: s.selectedContainerIds.includes(id)
        ? s.selectedContainerIds.filter((x) => x !== id)
        : [...s.selectedContainerIds, id],
    })),

  setSelectedContainers: (ids) => set({ selectedContainerIds: ids }),
  clearSelection: () => set({ selectedContainerIds: [] }),

  openLogModal: (ids) => set({ isLogModalOpen: true, modalContainerIds: ids }),
  closeLogModal: () => set({ isLogModalOpen: false }),

  setLogCommand: (cmd) => set({ logCommand: cmd }),
  setLogPanelLayout: (layout) => set({ logPanelLayout: layout }),
  setFilterServer: (s) => set({ filterServer: s }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setRefreshing: (v) => set({ isRefreshing: v }),
  setAutoRefresh: (v) => set({ autoRefresh: v }),
  setAutoRefreshInterval: (n) => set({ autoRefreshInterval: n }),
  dockerAction: async (serverId, container, action) => {
    return await dockerContainerAction({ serverId, container, action: action as any });
  },
}));
