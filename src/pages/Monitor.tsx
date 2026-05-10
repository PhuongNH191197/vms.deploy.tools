import { useEffect, useRef } from "react";
import { RefreshCw, AlertTriangle, ChevronDown, ToggleLeft, ToggleRight } from "lucide-react";
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
import ServerCard from "@/components/ServerCard";
import ContainerTable from "@/components/ContainerTable";
import MultiLogViewer from "@/components/MultiLogViewer";
import type { MockServer, MockContainer, MonitorProject } from "@/types/monitor";

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_PROJECTS: MonitorProject[] = [
  { id: "prod", name: "VMS Production" },
  { id: "staging", name: "VMS Staging" },
  { id: "lab", name: "Lab" },
];

const MOCK_SERVERS: MockServer[] = [
  {
    id: "s1", name: "server1", ip: "192.168.1.101",
    cpu: 45, ram: 62, disk: 38, containersRunning: 3, containersTotal: 3, status: "online",
  },
  {
    id: "s2", name: "server2", ip: "192.168.1.102",
    cpu: 82, ram: 91, disk: 55, containersRunning: 2, containersTotal: 3, status: "warning",
  },
  {
    id: "s3", name: "server3", ip: "192.168.1.103",
    cpu: 23, ram: 41, disk: 20, containersRunning: 3, containersTotal: 3, status: "online",
  },
  {
    id: "s4", name: "server4", ip: "192.168.1.104",
    cpu: 67, ram: 73, disk: 48, containersRunning: 2, containersTotal: 2, status: "online",
  },
  {
    id: "s5", name: "server5", ip: "192.168.1.105",
    cpu: 12, ram: 28, disk: 15, containersRunning: 4, containersTotal: 4, status: "online",
  },
  {
    id: "s6", name: "server6", ip: "192.168.1.106",
    cpu: 0, ram: 0, disk: 0, containersRunning: 0, containersTotal: 2, status: "offline",
  },
];

const MOCK_CONTAINERS: MockContainer[] = [
  { id: "s1-vms_ai",     serverId: "s1", serverName: "server1", serverIp: "192.168.1.101", name: "vms_ai",     image: "vms/ai:latest",     status: "running",  cpu: "0.8%",  ram: "2.1%",  uptime: "2d 4h"  },
  { id: "s1-vms_api",    serverId: "s1", serverName: "server1", serverIp: "192.168.1.101", name: "vms_api",    image: "vms/api:latest",    status: "running",  cpu: "1.2%",  ram: "3.4%",  uptime: "2d 4h"  },
  { id: "s1-vms_worker", serverId: "s1", serverName: "server1", serverIp: "192.168.1.101", name: "vms_worker", image: "vms/worker:latest", status: "running",  cpu: "0.5%",  ram: "1.8%",  uptime: "2d 4h"  },
  { id: "s2-vms_ai",     serverId: "s2", serverName: "server2", serverIp: "192.168.1.102", name: "vms_ai",     image: "vms/ai:latest",     status: "running",  cpu: "12.4%", ram: "18.2%", uptime: "1d 12h" },
  { id: "s2-vms_api",    serverId: "s2", serverName: "server2", serverIp: "192.168.1.102", name: "vms_api",    image: "vms/api:latest",    status: "exited",   cpu: "0%",    ram: "0%",    uptime: "—"      },
  { id: "s2-vms_worker", serverId: "s2", serverName: "server2", serverIp: "192.168.1.102", name: "vms_worker", image: "vms/worker:latest", status: "running",  cpu: "8.1%",  ram: "11.5%", uptime: "1d 12h" },
  { id: "s3-vms_ai",     serverId: "s3", serverName: "server3", serverIp: "192.168.1.103", name: "vms_ai",     image: "vms/ai:latest",     status: "running",  cpu: "0.3%",  ram: "1.2%",  uptime: "5d 8h"  },
  { id: "s3-vms_api",    serverId: "s3", serverName: "server3", serverIp: "192.168.1.103", name: "vms_api",    image: "vms/api:latest",    status: "running",  cpu: "0.9%",  ram: "2.8%",  uptime: "5d 8h"  },
  { id: "s3-vms_worker", serverId: "s3", serverName: "server3", serverIp: "192.168.1.103", name: "vms_worker", image: "vms/worker:latest", status: "running",  cpu: "0.4%",  ram: "1.5%",  uptime: "5d 8h"  },
  { id: "s4-vms_ai",     serverId: "s4", serverName: "server4", serverIp: "192.168.1.104", name: "vms_ai",     image: "vms/ai:latest",     status: "running",  cpu: "5.6%",  ram: "8.3%",  uptime: "3d 2h"  },
  { id: "s4-vms_worker", serverId: "s4", serverName: "server4", serverIp: "192.168.1.104", name: "vms_worker", image: "vms/worker:latest", status: "running",  cpu: "4.2%",  ram: "6.7%",  uptime: "3d 2h"  },
  { id: "s5-vms_ai",     serverId: "s5", serverName: "server5", serverIp: "192.168.1.105", name: "vms_ai",     image: "vms/ai:latest",     status: "running",  cpu: "0.2%",  ram: "0.8%",  uptime: "10d 6h" },
  { id: "s5-vms_api",    serverId: "s5", serverName: "server5", serverIp: "192.168.1.105", name: "vms_api",    image: "vms/api:latest",    status: "running",  cpu: "0.5%",  ram: "1.4%",  uptime: "10d 6h" },
  { id: "s5-vms_worker", serverId: "s5", serverName: "server5", serverIp: "192.168.1.105", name: "vms_worker", image: "vms/worker:latest", status: "running",  cpu: "0.3%",  ram: "0.9%",  uptime: "10d 6h" },
  { id: "s5-nginx",      serverId: "s5", serverName: "server5", serverIp: "192.168.1.105", name: "nginx",      image: "nginx:alpine",      status: "running",  cpu: "0.1%",  ram: "0.3%",  uptime: "10d 6h" },
];

// ── Derived counts ─────────────────────────────────────────────────────────────

const TOTAL_RUNNING = MOCK_CONTAINERS.filter((c) => c.status === "running").length;
const ALERT_SERVERS = MOCK_SERVERS.filter((s) => s.status === "warning").length;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Monitor() {
  const {
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

  const tableRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentProject =
    MOCK_PROJECTS.find((p) => p.id === selectedProject) ?? MOCK_PROJECTS[0];

  // Auto-refresh simulation
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
    setTimeout(() => setRefreshing(false), 900);
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
      ? MOCK_CONTAINERS.filter((c) => modalContainerIds.includes(c.id))
      : MOCK_CONTAINERS.slice(0, 1);

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
              <span className="text-[13px] font-bold text-white">{currentProject.name}</span>
              <ChevronDown size={13} className="text-white/35" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[180px]">
            {MOCK_PROJECTS.map((p) => (
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
            {MOCK_SERVERS.length} servers
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
        <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar">
          {MOCK_SERVERS.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              isHighlighted={filterServer === s.id}
              onClick={() => handleServerCardClick(s.id)}
            />
          ))}
        </div>
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
          containers={MOCK_CONTAINERS}
          servers={MOCK_SERVERS}
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
