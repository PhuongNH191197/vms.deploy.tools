import { create } from "zustand";

// TODO: Server management store
interface ServerStore {
  servers: unknown[];
}

export const useServerStore = create<ServerStore>(() => ({
  servers: [],
}));
