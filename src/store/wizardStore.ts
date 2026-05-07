import { create } from "zustand";
import type { ToolCheckResult } from "@/types";

export interface EnvVar {
  key: string;
  value: string;
}

export interface ExternalServiceConfig {
  name: string;
  displayName: string;
  source: "online" | "offline";
  version: string;
  tarPath: string;
  composeFolderPath: string;
}

export interface NetworkCreateResult {
  name: string;
  created: boolean;
  already_existed: boolean;
  error: string | null;
}

interface WizardState {
  currentStep: number;

  // Step 1
  selectedServerId: string | null;
  environment: "lab" | "production";
  credential: string; // in-memory only, never persisted

  // Step 2 (env check results carried from Setup Step 2)
  envCheckResults: ToolCheckResult[];

  // Step 3
  dockerNetworks: string[];
  networkResults: NetworkCreateResult[];

  // Step 4
  selectedExternals: ExternalServiceConfig[];
  rootPath: string;

  // Step 5
  envVars: Record<string, EnvVar[]>; // keyed by service name

  // Actions
  setStep: (n: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setSelectedServer: (id: string | null) => void;
  setEnvironment: (env: "lab" | "production") => void;
  setCredential: (c: string) => void;
  setEnvResults: (results: ToolCheckResult[]) => void;
  setDockerNetworks: (networks: string[]) => void;
  setNetworkResults: (results: NetworkCreateResult[]) => void;
  addExternal: (svc: ExternalServiceConfig) => void;
  removeExternal: (name: string) => void;
  updateExternal: (name: string, patch: Partial<ExternalServiceConfig>) => void;
  setRootPath: (path: string) => void;
  setEnvVarsForService: (service: string, vars: EnvVar[]) => void;
  addEnvVar: (service: string) => void;
  updateEnvVar: (service: string, index: number, patch: Partial<EnvVar>) => void;
  removeEnvVar: (service: string, index: number) => void;
  reset: () => void;
}

const DEFAULT: Pick<WizardState,
  "currentStep" | "selectedServerId" | "environment" | "credential" | "envCheckResults" |
  "dockerNetworks" | "networkResults" | "selectedExternals" | "rootPath" | "envVars"
> = {
  currentStep: 1,
  selectedServerId: null,
  environment: "lab",
  credential: "",
  envCheckResults: [],
  dockerNetworks: [],
  networkResults: [],
  selectedExternals: [],
  rootPath: "/opt/vms",
  envVars: {},
};

export const useWizardStore = create<WizardState>((set) => ({
  ...DEFAULT,

  setStep: (n) => set({ currentStep: Math.max(1, Math.min(7, n)) }),
  nextStep: () => set((s) => ({ currentStep: Math.min(7, s.currentStep + 1) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) })),

  setSelectedServer: (id) => set({ selectedServerId: id }),
  setEnvironment: (env) => set({ environment: env }),
  setCredential: (c) => set({ credential: c }),
  setEnvResults: (results) => set({ envCheckResults: results }),

  setDockerNetworks: (networks) => set({ dockerNetworks: networks }),
  setNetworkResults: (results) => set({ networkResults: results }),

  addExternal: (svc) =>
    set((s) => ({
      selectedExternals: s.selectedExternals.find((x) => x.name === svc.name)
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

  setRootPath: (path) => set({ rootPath: path }),

  setEnvVarsForService: (service, vars) =>
    set((s) => ({ envVars: { ...s.envVars, [service]: vars } })),

  addEnvVar: (service) =>
    set((s) => ({
      envVars: {
        ...s.envVars,
        [service]: [...(s.envVars[service] ?? []), { key: "", value: "" }],
      },
    })),

  updateEnvVar: (service, index, patch) =>
    set((s) => ({
      envVars: {
        ...s.envVars,
        [service]: (s.envVars[service] ?? []).map((v, i) =>
          i === index ? { ...v, ...patch } : v
        ),
      },
    })),

  removeEnvVar: (service, index) =>
    set((s) => ({
      envVars: {
        ...s.envVars,
        [service]: (s.envVars[service] ?? []).filter((_, i) => i !== index),
      },
    })),

  reset: () => set({ ...DEFAULT }),
}));
