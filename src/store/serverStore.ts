import { create } from "zustand";
import type { Server, ServerInfo } from "@/types";
import * as cmds from "@/lib/tauri/commands";

interface ServerState {
  servers: Server[];
  serverInfoMap: Record<string, ServerInfo>;
  loading: boolean;
  error: string | null;

  fetchServers: () => Promise<void>;
  addServer: (payload: Parameters<typeof cmds.addServer>[0]) => Promise<string>;
  removeServer: (id: string) => Promise<void>;
  setServerInfo: (serverId: string, info: ServerInfo) => void;
  clearError: () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  serverInfoMap: {},
  loading: false,
  error: null,

  fetchServers: async () => {
    set({ loading: true, error: null });
    try {
      const servers = await cmds.getServers();
      set({ servers, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addServer: async (payload) => {
    const id = await cmds.addServer(payload);
    await get().fetchServers();
    return id;
  },

  removeServer: async (id) => {
    await cmds.deleteServer(id);
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    }));
  },

  setServerInfo: (serverId, info) => {
    set((state) => ({
      serverInfoMap: { ...state.serverInfoMap, [serverId]: info },
    }));
  },

  clearError: () => set({ error: null }),
}));
