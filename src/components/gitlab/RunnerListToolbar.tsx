import { useEffect } from "react";
import { Search, RefreshCw, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import { useServerStore } from "@/store/serverStore";

export default function RunnerListToolbar() {
  const {
    filterSearch, filterProject, filterServerId, filterStatus,
    projectNames, isLoadingList, isScanningServerIds,
    autoRefresh, autoRefreshInterval,
    setFilter, loadRunners, loadProjectNames,
    scanRunners, openWizard,
    setAutoRefresh,
    filterServerId: currentServerFilter,
  } = useGitLabRunnerStore();

  const { servers } = useServerStore();
  const isScanning = isScanningServerIds.size > 0;

  useEffect(() => {
    const t = setTimeout(() => {
      loadRunners();
    }, 300);
    return () => clearTimeout(t);
  }, [filterSearch, filterProject, filterServerId, filterStatus]);

  const handleManualScan = async () => {
    if (currentServerFilter) {
      await scanRunners(currentServerFilter);
    } else {
      // Scan all servers
      for (const s of servers) {
        scanRunners(s.id); // fire and forget — each updates its own scanning state
      }
      // Reload after a short delay
      setTimeout(() => loadRunners(), 3000);
    }
    await loadProjectNames();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <Input
          placeholder="Tìm runner, tags..."
          value={filterSearch}
          onChange={(e) => setFilter("filterSearch", e.target.value)}
          className="pl-8 h-8 bg-white/5 border-white/15 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50"
        />
      </div>

      {/* Project filter */}
      <Select
        value={filterProject ?? "all"}
        onValueChange={(v) => setFilter("filterProject", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 w-36 bg-white/5 border-white/15 text-sm text-white/80">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent className="bg-[#0d1425] border-white/15">
          <SelectItem value="all">Tất cả project</SelectItem>
          {projectNames.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Server filter */}
      <Select
        value={filterServerId ?? "all"}
        onValueChange={(v) => setFilter("filterServerId", v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 w-36 bg-white/5 border-white/15 text-sm text-white/80">
          <SelectValue placeholder="Server" />
        </SelectTrigger>
        <SelectContent className="bg-[#0d1425] border-white/15">
          <SelectItem value="all">Tất cả server</SelectItem>
          {servers.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filterStatus}
        onValueChange={(v) => setFilter("filterStatus", v)}
      >
        <SelectTrigger className="h-8 w-32 bg-white/5 border-white/15 text-sm text-white/80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#0d1425] border-white/15">
          <SelectItem value="all">Tất cả</SelectItem>
          <SelectItem value="online">Online</SelectItem>
          <SelectItem value="offline">Offline</SelectItem>
          <SelectItem value="running">Running</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Auto refresh toggle */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            autoRefresh
              ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
              : "border-white/15 text-white/40 hover:text-white/70"
          }`}
        >
          Auto {autoRefresh ? `${autoRefreshInterval}s` : "off"}
        </button>
      </div>

      {/* Scan */}
      <Button
        variant="outline"
        size="sm"
        disabled={isScanning}
        onClick={handleManualScan}
        className="h-8 border-white/20 text-white/70 hover:text-white hover:border-white/40"
      >
        {isScanning ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        )}
        Scan
      </Button>

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        disabled={isLoadingList}
        onClick={() => loadRunners()}
        className="h-8 text-white/50 hover:text-white"
      >
        {isLoadingList ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
      </Button>

      {/* Add runner */}
      <Button
        size="sm"
        className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => openWizard()}
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Runner
      </Button>
    </div>
  );
}
