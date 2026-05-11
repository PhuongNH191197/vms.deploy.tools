import { create } from "zustand";
import * as api from "@/lib/tauri/gitlabRunner";
import type {
  GitLabRunnerDto,
  RunnerStatusResult,
  GitLabApiSettingsDto,
  ListRunnersFilter,
  BatchInstallResult,
  BatchRegisterInput,
  BatchRegisterResult,
  BatchGitAuthInput,
  BatchGitAuthResult,
  SingleRunnerConfig,
} from "@/lib/tauri/gitlabRunner";

interface GitLabRunnerState {
  // List
  runners: GitLabRunnerDto[];
  isLoadingList: boolean;
  listError: string | null;

  // Filters
  filterSearch: string;
  filterProject: string | null;
  filterServerId: string | null;
  filterStatus: "all" | "online" | "offline" | "running";

  // Available filter values
  projectNames: string[];

  // Detail panel
  selectedRunner: GitLabRunnerDto | null;
  runnerStatus: RunnerStatusResult | null;
  isLoadingStatus: boolean;

  // Auto refresh
  autoRefresh: boolean;
  autoRefreshInterval: number;
  autoRefreshTimerId: ReturnType<typeof setInterval> | null;

  // Auto scan
  autoScanOnMount: boolean;
  scannedServerIds: Set<string>;
  isScanningServerIds: Set<string>;

  // Wizard
  wizardOpen: boolean;
  wizardMode: "single" | "batch";
  wizardServerId: string | null;

  // Batch wizard state
  batchSelectedServerIds: string[];
  batchInstallResults: BatchInstallResult[];
  batchRegisterConfigs: Record<string, SingleRunnerConfig>;
  batchRegisterResults: BatchRegisterResult[];
  batchGitAuthConfigs: Record<string, { testRepoUrl: string }>;
  batchGitAuthResults: BatchGitAuthResult[];
  isBatchInstalling: boolean;
  isBatchRegistering: boolean;
  isBatchSettingUpAuth: boolean;

  // API settings modal
  apiSettingsOpen: boolean;
  apiSettings: GitLabApiSettingsDto | null;

  // Actions — List
  loadRunners: (filter?: ListRunnersFilter) => Promise<void>;
  loadProjectNames: () => Promise<void>;
  scanRunners: (serverId: string) => Promise<number>;
  triggerAutoScan: (allServerIds: string[]) => Promise<void>;
  checkRunnerStatus: (runnerIdLocal: number) => Promise<void>;
  deleteRunner: (runnerIdLocal: number) => Promise<api.DeleteRunnerResult>;
  setFilter: (key: string, value: unknown) => void;
  selectRunner: (runner: GitLabRunnerDto | null) => void;

  // Actions — Wizard
  openWizard: (serverId?: string) => void;
  openBatchWizard: () => void;
  closeWizard: () => void;
  setBatchSelectedServers: (ids: string[]) => void;
  setBatchRegisterConfig: (serverId: string, config: SingleRunnerConfig) => void;
  triggerBatchInstall: (serverIds: string[]) => Promise<void>;
  triggerBatchRegister: (input: BatchRegisterInput) => Promise<void>;
  triggerBatchGitAuth: (input: BatchGitAuthInput) => Promise<void>;

  // Actions — Auto refresh
  setAutoRefresh: (enabled: boolean) => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;

  // Actions — API settings
  openApiSettings: () => void;
  closeApiSettings: () => void;
  loadApiSettings: (gitlabUrl: string) => Promise<void>;
}

export const useGitLabRunnerStore = create<GitLabRunnerState>((set, get) => ({
  runners: [],
  isLoadingList: false,
  listError: null,

  filterSearch: "",
  filterProject: null,
  filterServerId: null,
  filterStatus: "all",
  projectNames: [],

  selectedRunner: null,
  runnerStatus: null,
  isLoadingStatus: false,

  autoRefresh: false,
  autoRefreshInterval: 30,
  autoRefreshTimerId: null,

  autoScanOnMount: true,
  scannedServerIds: new Set(),
  isScanningServerIds: new Set(),

  wizardOpen: false,
  wizardMode: "single",
  wizardServerId: null,

  batchSelectedServerIds: [],
  batchInstallResults: [],
  batchRegisterConfigs: {},
  batchRegisterResults: [],
  batchGitAuthConfigs: {},
  batchGitAuthResults: [],
  isBatchInstalling: false,
  isBatchRegistering: false,
  isBatchSettingUpAuth: false,

  apiSettingsOpen: false,
  apiSettings: null,

  // ── List actions ────────────────────────────────────────────────────────────

  loadRunners: async (filter?: ListRunnersFilter) => {
    const state = get();
    const f: ListRunnersFilter = filter ?? {
      server_id: state.filterServerId ?? undefined,
      project_name: state.filterProject ?? undefined,
      status: state.filterStatus === "all" ? undefined : state.filterStatus,
      search: state.filterSearch || undefined,
    };
    set({ isLoadingList: true, listError: null });
    try {
      const runners = await api.listGitlabRunners(f);
      set({ runners, isLoadingList: false });
    } catch (e) {
      set({ listError: String(e), isLoadingList: false });
    }
  },

  loadProjectNames: async () => {
    try {
      const names = await api.getGitlabProjectNames();
      set({ projectNames: names });
    } catch (_) {}
  },

  scanRunners: async (serverId: string) => {
    set((s) => ({ isScanningServerIds: new Set([...s.isScanningServerIds, serverId]) }));
    try {
      const scanned = await api.scanRunnersFromServer(serverId);
      set((s) => {
        const next = new Set(s.scannedServerIds);
        next.add(serverId);
        const scanning = new Set(s.isScanningServerIds);
        scanning.delete(serverId);
        return { scannedServerIds: next, isScanningServerIds: scanning };
      });
      await get().loadRunners();
      return scanned.length;
    } catch (_) {
      set((s) => {
        const scanning = new Set(s.isScanningServerIds);
        scanning.delete(serverId);
        return { isScanningServerIds: scanning };
      });
      return 0;
    }
  },

  triggerAutoScan: async (allServerIds: string[]) => {
    const state = get();
    if (!state.autoScanOnMount) return;

    // Load current runners to know which servers already have data
    const currentRunners = await api.listGitlabRunners().catch(() => [] as GitLabRunnerDto[]);
    const serversWithRunners = new Set(currentRunners.map((r) => r.server_id));

    let newCount = 0;
    for (const sid of allServerIds) {
      if (serversWithRunners.has(sid)) continue;
      if (state.scannedServerIds.has(sid)) continue;
      const count = await get().scanRunners(sid);
      newCount += count;
    }

    if (newCount > 0) {
      await get().loadProjectNames();
    }
  },

  checkRunnerStatus: async (runnerIdLocal: number) => {
    set({ isLoadingStatus: true });
    try {
      const result = await api.checkRunnerStatus(runnerIdLocal);
      set((state) => ({
        runnerStatus: result,
        isLoadingStatus: false,
        runners: state.runners.map((r) =>
          r.id === runnerIdLocal ? { ...r, status: result.status as GitLabRunnerDto["status"] } : r
        ),
      }));
    } catch (e) {
      set({ isLoadingStatus: false });
      throw e;
    }
  },

  deleteRunner: async (runnerIdLocal: number) => {
    const result = await api.deleteGitlabRunner(runnerIdLocal);
    set((state) => ({
      runners: state.runners.filter((r) => r.id !== runnerIdLocal),
      selectedRunner: state.selectedRunner?.id === runnerIdLocal ? null : state.selectedRunner,
    }));
    return result;
  },

  setFilter: (key: string, value: unknown) => {
    set({ [key]: value } as Partial<GitLabRunnerState>);
  },

  selectRunner: (runner) => {
    set({ selectedRunner: runner, runnerStatus: null });
  },

  // ── Wizard actions ──────────────────────────────────────────────────────────

  openWizard: (serverId?: string) => {
    set({ wizardOpen: true, wizardMode: "single", wizardServerId: serverId ?? null });
  },

  openBatchWizard: () => {
    set({ wizardOpen: true, wizardMode: "batch", wizardServerId: null });
  },

  closeWizard: () => {
    set({
      wizardOpen: false,
      wizardMode: "single",
      wizardServerId: null,
      batchSelectedServerIds: [],
      batchInstallResults: [],
      batchRegisterResults: [],
      batchGitAuthResults: [],
      isBatchInstalling: false,
      isBatchRegistering: false,
      isBatchSettingUpAuth: false,
    });
  },

  setBatchSelectedServers: (ids) => {
    set((state) => {
      const configs = { ...state.batchRegisterConfigs };
      const authConfigs = { ...state.batchGitAuthConfigs };
      // Init default config for newly selected servers
      for (const id of ids) {
        if (!configs[id]) {
          configs[id] = { server_id: id, runner_name: `runner-${id}`, tags: "", maintenance_note: "" };
        }
        if (!authConfigs[id]) {
          authConfigs[id] = { testRepoUrl: "" };
        }
      }
      return { batchSelectedServerIds: ids, batchRegisterConfigs: configs, batchGitAuthConfigs: authConfigs };
    });
  },

  setBatchRegisterConfig: (serverId, config) => {
    set((state) => ({
      batchRegisterConfigs: { ...state.batchRegisterConfigs, [serverId]: config },
    }));
  },

  triggerBatchInstall: async (serverIds: string[]) => {
    set({ isBatchInstalling: true, batchInstallResults: [] });
    try {
      const results = await api.batchInstallGitlabRunner(serverIds);
      set({ batchInstallResults: results, isBatchInstalling: false });
    } catch (e) {
      set({ isBatchInstalling: false });
      throw e;
    }
  },

  triggerBatchRegister: async (input: BatchRegisterInput) => {
    set({ isBatchRegistering: true, batchRegisterResults: [] });
    try {
      const results = await api.batchRegisterGitlabRunner(input);
      set({ batchRegisterResults: results, isBatchRegistering: false });
      await get().loadRunners();
    } catch (e) {
      set({ isBatchRegistering: false });
      throw e;
    }
  },

  triggerBatchGitAuth: async (input: BatchGitAuthInput) => {
    set({ isBatchSettingUpAuth: true, batchGitAuthResults: [] });
    try {
      const results = await api.batchSetupGitAuth(input);
      set({ batchGitAuthResults: results, isBatchSettingUpAuth: false });
    } catch (e) {
      set({ isBatchSettingUpAuth: false });
      throw e;
    }
  },

  // ── Auto refresh ────────────────────────────────────────────────────────────

  setAutoRefresh: (enabled: boolean) => {
    if (enabled) {
      get().startAutoRefresh();
    } else {
      get().stopAutoRefresh();
    }
  },

  startAutoRefresh: () => {
    get().stopAutoRefresh(); // clear existing
    const interval = get().autoRefreshInterval * 1000;
    const timerId = setInterval(() => {
      get().loadRunners();
    }, interval);
    set({ autoRefresh: true, autoRefreshTimerId: timerId });
  },

  stopAutoRefresh: () => {
    const id = get().autoRefreshTimerId;
    if (id) clearInterval(id);
    set({ autoRefresh: false, autoRefreshTimerId: null });
  },

  // ── API settings ────────────────────────────────────────────────────────────

  openApiSettings: () => set({ apiSettingsOpen: true }),
  closeApiSettings: () => set({ apiSettingsOpen: false }),

  loadApiSettings: async (gitlabUrl: string) => {
    try {
      const settings = await api.getGitlabApiSettings(gitlabUrl);
      set({ apiSettings: settings });
    } catch (_) {}
  },
}));
