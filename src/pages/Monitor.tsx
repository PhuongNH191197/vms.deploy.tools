import { useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle, ChevronDown, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMonitorStore } from "@/store/monitorStore";
import { useServerStore } from "@/store/serverStore";
import { listProjects } from "@/lib/tauri/commands";
import ServerCard from "@/components/ServerCard";
import ContainerTable from "@/components/ContainerTable";
import MultiLogViewer from "@/components/MultiLogViewer";
import type { Project } from "@/types";
import type { MockServer, MockContainer } from "@/types/monitor";

export default function Monitor() {
  const {
    entries,
    startPolling,
    stopAll,
    selectedProject,
    setSelectedProject,
    selectedContainerIds,
    modalContainerIds,
    toggleContainer,
    setSelectedContainers,
    clearSelection,
    isLogModalOpen,
    openLogModal,
    closeLogModal,
    filterServer,
    filterStatus,
    searchQuery,
    setFilterServer,
    setFilterStatus,
    setSearchQuery,
    isRefreshing,
    setRefreshing,
    autoRefresh,
    setAutoRefresh,
    autoRefreshInterval,
    setAutoRefreshInterval,
  } = useMonitorStore();

  const { servers, fetchServers, loading: serversLoading } = useServerStore();
  const [projects, setProjects] = useState<Project[]>([]);

  const tableRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Initial Load
  useEffect(() => {
    fetchServers();
    listProjects()
      .then(setProjects)
      .catch(console.error);
    return () => stopAll();
  }, [fetchServers, stopAll]);

  // 2. Manage Polling
  useEffect(() => {
    servers.forEach((s) => {
      startPolling(s.id);
    });
  }, [servers, startPolling]);

  // 3. Derived Data
  const filteredServers = servers.filter(s => 
    selectedProject === "all" || s.project_id === selectedProject
  );

  const realServers: MockServer[] = filteredServers.map(s => {
    const entry = entries[s.id];
    return {
      id: s.id,
      name: s.name,
      ip: s.host,
      cpu: entry?.metrics?.cpu_percent ?? 0,
      ram: entry?.metrics?.ram_percent ?? 0,
      disk: entry?.metrics?.disk_percent ?? 0,
      containersRunning: entry?.containers?.filter(c => c.status.toLowerCase().includes("up")).length ?? 0,
      containersTotal: entry?.containers?.length ?? 0,
      status: (entry?.status === "unknown" ? "offline" : (entry?.status || "offline")) as "online" | "warning" | "offline",
    };
  });

  const realContainers: MockContainer[] = filteredServers.flatMap(s => {
    const entry = entries[s.id];
    if (!entry) return [];
    return entry.containers.map(c => ({
      id: `${s.id}-${c.name}`,
      serverId: s.id,
      serverName: s.name,
      serverIp: s.host,
      name: c.name,
      image: c.image,
      status: c.status.toLowerCase().includes("up") ? "running" : "exited",
      cpu: c.cpu_perc,
      ram: c.mem_perc,
      uptime: c.created,
    }));
  });

  const TOTAL_RUNNING = realContainers.filter((c) => c.status === "running").length;
  const ALERT_SERVERS = realServers.filter((s) => s.status === "warning").length;

  const currentProjectName = 
    selectedProject === "all" ? "All Projects" : 
    projects.find(p => p.id === selectedProject)?.name ?? "Unknown Project";

  // Auto-refresh simulation (updates UI state, real polling is separate)
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 700);
      }, autoRefreshInterval * 1000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, autoRefreshInterval, setRefreshing]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Manual refresh: re-fetch servers and projects
    fetchServers();
    listProjects().then(setProjects).finally(() => setRefreshing(false));
  };

  const handleServerCardClick = (serverId: string) => {
    const next = filterServer === serverId ? "all" : serverId;
    setFilterServer(next);
    if (next !== "all") {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleViewLogs = (ids: string[]) => {
    openLogModal(ids);
  };

  const modalContainers =
    modalContainerIds.length > 0
      ? realContainers.filter((c) => modalContainerIds.includes(c.id))
      : realContainers.slice(0, 1);

  if (serversLoading && servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="animate-spin text-df-cyan" size={40} />
        <p className="text-sm font-black text-white/40 uppercase tracking-widest">Loading Infrastructure...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 pb-16 animate-fade-in">
      {/* ── Part 1: Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Project selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/[0.09] bg-white/[0.02] hover:border-white/20 transition-all">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#00d4ff", boxShadow: "0 0 8px #00d4ffaa" }}
              />
              <span className="text-[13px] font-bold text-white">{currentProjectName}</span>
              <ChevronDown size={13} className="text-white/35" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[180px]">
            <DropdownMenuItem onClick={() => setSelectedProject("all")} className={cn("text-[12px]", selectedProject === "all" && "text-[#00d4ff]")}>
              All Projects
            </DropdownMenuItem>
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={cn("text-[12px]", p.id === selectedProject && "text-[#00d4ff]")}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Summary badges */}
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] font-bold px-3 py-1 bg-white/[0.04] text-white/50 border-white/10 rounded-lg">
            {realServers.length} servers
          </Badge>
          <Badge className="text-[10px] font-bold px-3 py-1 bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20 rounded-lg">
            {TOTAL_RUNNING} running
          </Badge>
          {ALERT_SERVERS > 0 && (
            <Badge className="text-[10px] font-bold px-3 py-1 bg-[#ffaa00]/10 text-[#ffaa00] border-[#ffaa00]/20 rounded-lg flex items-center gap-1">
              <AlertTriangle size={10} />
              {ALERT_SERVERS} alerts
            </Badge>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Auto-refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white/70 transition-all"
            >
              {autoRefresh ? (
                <ToggleRight size={18} className="text-[#00d4ff]" />
              ) : (
                <ToggleLeft size={18} />
              )}
              Auto
            </button>
            {autoRefresh && (
              <div className="flex items-center gap-1">
                {([5, 10, 30] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setAutoRefreshInterval(n)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold border transition-all",
                      autoRefreshInterval === n
                        ? "bg-[#00d4ff]/10 border-[#00d4ff]/30 text-[#00d4ff]"
                        : "border-white/[0.07] text-white/25 hover:text-white/50"
                    )}
                  >
                    {n}s
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 px-4 btn-ghost-glass rounded-xl text-[11px] font-bold uppercase tracking-wider"
          >
            <RefreshCw
              size={13}
              className={cn("mr-2 text-[#00d4ff]", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Part 2: Server Health Overview ─────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.25em] mb-3">
          Server Health Overview
        </p>
        {realServers.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl">
            <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest">No servers found in this project</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar">
            {realServers.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                isHighlighted={filterServer === s.id}
                onClick={() => handleServerCardClick(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Part 3: Container Table ─────────────────────────────────────────────── */}
      <div ref={tableRef}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.25em]">
            Container Overview
          </p>
          {filterServer !== "all" && (
            <button
              onClick={() => setFilterServer("all")}
              className="text-[10px] text-[#00d4ff] hover:text-white transition-all font-bold uppercase tracking-wider"
            >
              ← All servers
            </button>
          )}
        </div>
        <ContainerTable
          containers={realContainers}
          servers={realServers}
          selectedIds={selectedContainerIds}
          filterServer={filterServer}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
          onToggleSelect={toggleContainer}
          onSetSelection={setSelectedContainers}
          onClearSelection={clearSelection}
          onViewLogs={handleViewLogs}
          onFilterServer={setFilterServer}
          onFilterStatus={setFilterStatus}
          onSearch={setSearchQuery}
        />
      </div>

      {/* ── Part 4: Multi-Log Viewer ────────────────────────────────────────────── */}
      {isLogModalOpen && (
        <MultiLogViewer containers={modalContainers} onClose={closeLogModal} />
      )}
    </div>
  );
}
