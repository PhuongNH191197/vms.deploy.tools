import { create } from "zustand";
import type { EnvVar, AppModule, ExternalServiceConfig } from "@/store/wizardStore";

export interface ServerProgress {
  status: "pending" | "running" | "done" | "failed";
  pct: number;
  logs: string[];
}

interface BulkState {
  currentStep: number;
  // Step 1
  selectedServerIds: string[];
  credential: string;
  authType: "password" | "key";
  environment: "lab" | "production";
  rootPath: string;
  // Step 2
  dockerNetworks: string[];
  selectedExternals: ExternalServiceConfig[];
  envVars: Record<string, EnvVar[]>;
  apps: AppModule[];
  // Step 3
  serverProgress: Record<string, ServerProgress>;

  setCurrentStep: (n: number) => void;
  toggleServer: (id: string) => void;
  setAllServers: (ids: string[]) => void;
  setCredential: (c: string) => void;
  setAuthType: (t: "password" | "key") => void;
  setEnvironment: (e: "lab" | "production") => void;
  setRootPath: (p: string) => void;
  setDockerNetworks: (nets: string[]) => void;
  addExternal: (svc: ExternalServiceConfig) => void;
  removeExternal: (name: string) => void;
  updateExternal: (name: string, patch: Partial<ExternalServiceConfig>) => void;
  setEnvVarsForService: (svc: string, vars: EnvVar[]) => void;
  addEnvVar: (svc: string) => void;
  updateEnvVar: (svc: string, idx: number, patch: Partial<EnvVar>) => void;
  removeEnvVar: (svc: string, idx: number) => void;
  addApp: () => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, patch: Partial<AppModule>) => void;
  initProgress: (ids: string[]) => void;
  setProgress: (id: string, p: Partial<ServerProgress>) => void;
  appendLog: (id: string, line: string) => void;
  reset: () => void;
}

const DEFAULT: Omit<BulkState, keyof Omit<BulkState, keyof {
  currentStep: number; selectedServerIds: string[]; credential: string;
  authType: "password" | "key"; environment: "lab" | "production"; rootPath: string;
  dockerNetworks: string[]; selectedExternals: ExternalServiceConfig[];
  envVars: Record<string, EnvVar[]>; apps: AppModule[];
  serverProgress: Record<string, ServerProgress>;
}>> = {
  currentStep: 1,
  selectedServerIds: [],
  credential: "",
  authType: "password",
  environment: "lab",
  rootPath: "/opt/vms",
  dockerNetworks: [],
  selectedExternals: [],
  envVars: {},
  apps: [],
  serverProgress: {},
};

export const useBulkDeployStore = create<BulkState>((set) => ({
  ...DEFAULT,

  setCurrentStep: (n) => set({ currentStep: n }),

  toggleServer: (id) =>
    set((s) => ({
      selectedServerIds: s.selectedServerIds.includes(id)
        ? s.selectedServerIds.filter((x) => x !== id)
        : [...s.selectedServerIds, id],
    })),

  setAllServers: (ids) => set({ selectedServerIds: ids }),
  setCredential: (c) => set({ credential: c }),
  setAuthType: (t) => set({ authType: t }),
  setEnvironment: (e) => set({ environment: e }),
  setRootPath: (p) => set({ rootPath: p }),
  setDockerNetworks: (nets) => set({ dockerNetworks: nets }),

  addExternal: (svc) =>
    set((s) => ({
      selectedExternals: s.selectedExternals.some((x) => x.name === svc.name)
        ? s.selectedExternals
        : [...s.selectedExternals, svc],
    })),

  removeExternal: (name) =>
    set((s) => ({ selectedExternals: s.selectedExternals.filter((x) => x.name !== name) })),

  updateExternal: (name, patch) =>
    set((s) => ({
      selectedExternals: s.selectedExternals.map((x) =>
        x.name === name ? { ...x, ...patch } : x
      ),
    })),

  setEnvVarsForService: (svc, vars) =>
    set((s) => ({ envVars: { ...s.envVars, [svc]: vars } })),

  addEnvVar: (svc) =>
    set((s) => ({
      envVars: { ...s.envVars, [svc]: [...(s.envVars[svc] ?? []), { key: "", value: "" }] },
    })),

  updateEnvVar: (svc, idx, patch) =>
    set((s) => ({
      envVars: {
        ...s.envVars,
        [svc]: (s.envVars[svc] ?? []).map((v, i) => (i === idx ? { ...v, ...patch } : v)),
      },
    })),

  removeEnvVar: (svc, idx) =>
    set((s) => ({
      envVars: {
        ...s.envVars,
        [svc]: (s.envVars[svc] ?? []).filter((_, i) => i !== idx),
      },
    })),

  addApp: () =>
    set((s) => ({
      apps: [
        ...s.apps,
        {
          id: crypto.randomUUID(),
          name: "",
          source: "online",
          image: "",
          version: "latest",
          tarServerPath: "",
          gitUrl: "",
          gitBranch: "main",
          gitToken: "",
        },
      ],
    })),

  removeApp: (id) => set((s) => ({ apps: s.apps.filter((a) => a.id !== id) })),

  updateApp: (id, patch) =>
    set((s) => ({ apps: s.apps.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

  initProgress: (ids) =>
    set({
      serverProgress: Object.fromEntries(
        ids.map((id) => [id, { status: "pending", pct: 0, logs: [] }])
      ),
    }),

  setProgress: (id, p) =>
    set((s) => ({
      serverProgress: { ...s.serverProgress, [id]: { ...s.serverProgress[id], ...p } },
    })),

  appendLog: (id, line) =>
    set((s) => ({
      serverProgress: {
        ...s.serverProgress,
        [id]: { ...s.serverProgress[id], logs: [...(s.serverProgress[id]?.logs ?? []), line] },
      },
    })),

  reset: () => set({ ...DEFAULT }),
}));
