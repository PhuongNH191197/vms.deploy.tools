import { create } from "zustand";

// TODO: Server monitoring state store
interface MonitorStore {
  metrics: Record<string, unknown>;
}

export const useMonitorStore = create<MonitorStore>(() => ({
  metrics: {},
}));
