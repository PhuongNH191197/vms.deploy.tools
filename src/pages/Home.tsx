import { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, AlertTriangle, Loader2, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Info, ChevronDown, X
} from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { useMonitorStore } from "@/store/monitorStore";
import { listProjects } from "@/lib/tauri/commands";
import AddServerDialog from "@/components/AddServerDialog";
import ServerInfoPanel from "@/components/ServerInfoPanel";
import type { Server as ServerType, Project } from "@/types";
import { cn } from "@/lib/utils";

const DEMO_SERVERS: ServerType[] = [
  { id: "demo-1", name: "Web-Server-01",        host: "10.0.1.10",  port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null, project_id: null },
  { id: "demo-2", name: "API-Gateway-03",        host: "10.0.1.30",  port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null, project_id: null },
  { id: "demo-3", name: "Database-Cluster-02",   host: "10.0.2.10",  port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null, project_id: null },
  { id: "demo-4", name: "Load-Balancer-01",       host: "10.0.1.50",  port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null, project_id: null },
  { id: "demo-5", name: "Caching-Server-01",      host: "10.0.3.10",  port: 22, username: "admin", auth_type: "key", group_name: "staging",    last_seen: null, project_id: null },
  { id: "demo-6", name: "Build-Node-04",          host: "10.0.4.10",  port: 22, username: "admin", auth_type: "key", group_name: "lab",        last_seen: null, project_id: null },
];

const DEMO_METRICS: Record<string, { cpu_percent: number; ram_percent: number; disk_percent: number; uptime: string }> = {
  "demo-1": { cpu_percent: 78, ram_percent: 62, disk_percent: 45, uptime: "34d" },
  "demo-2": { cpu_percent: 55, ram_percent: 71, disk_percent: 38, uptime: "39d" },
  "demo-3": { cpu_percent: 81, ram_percent: 67, disk_percent: 62, uptime: "34d" },
  "demo-4": { cpu_percent: 42, ram_percent: 77, disk_percent: 45, uptime: "34d" },
  "demo-5": { cpu_percent: 52, ram_percent: 62, disk_percent: 25, uptime: "18d" },
  "demo-6": { cpu_percent: 82, ram_percent: 72, disk_percent: 55, uptime: "34d" },
};

type SortKey = "none" | "cpu_asc" | "cpu_desc" | "ram_asc" | "ram_desc" | "disk_asc" | "disk_desc";

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return "–";
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function metricColor(value: number) {
  if (value >= 85) return "text-red-400";
  if (value >= 70) return "text-amber-400";
  return "text-green-400";
}

function EnvBadge({ env }: { env: string }) {
  const cfg: Record<string, string> = {
    production: "bg-df-red/10 text-df-red border-df-red/20",
    staging:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
    lab:        "bg-df-cyan/10 text-df-cyan border-df-cyan/20",
  };
  return (
    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", cfg[env] ?? "bg-white/5 text-white/50 border-white/10")}>
      {env}
    </span>
  );
}

// Custom project dropdown with search
function ProjectFilter({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = projects.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  const selected = projects.find(p => p.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-9 px-3 input-glass rounded-xl text-[11px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors min-w-[140px]"
      >
        {selected ? (
          <><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selected.color }} />{selected.name}</>
        ) : <span>All Projects</span>}
        <ChevronDown size={12} className="ml-auto opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-52 glass-dialog border border-white/10 rounded-xl p-2 shadow-xl">
          <Input
            className="input-glass rounded-lg h-8 text-[11px] mb-2"
            placeholder="Tìm project..."
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            <button type="button" onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className={cn("w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors", !value ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white")}>
              All Projects
            </button>
            {filtered.map(p => (
              <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); setQ(""); }}
                className={cn("w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-2 transition-colors", value === p.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white")}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />{p.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-[10px] text-white/30 text-center py-2">Không tìm thấy</p>}
          </div>
        </div>
      )}
    </div>
  );
}


const PAGE_SIZE = 10;

export default function Home() {
  const { servers, loading, fetchServers, removeServer } = useServerStore();
  const { entries } = useMonitorStore();
  const { startPolling, stopAll } = useMonitorStore();

  const [addOpen, setAddOpen] = useState(false);
  const [infoServerId, setInfoServerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServerType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("none");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchServers();
    listProjects().then(setProjects).catch(() => {});
    return () => stopAll();
  }, []);

  useEffect(() => {
    if (servers.length > 0) servers.forEach(s => startPolling(s.id, s.host, s.port, s.username));
  }, [servers]);

  const isDemo = servers.length === 0;
  const allServers = isDemo ? DEMO_SERVERS : servers;

  const getMetrics = (id: string) => {
    if (isDemo) return DEMO_METRICS[id] ?? { cpu_percent: 0, ram_percent: 0, disk_percent: 0, uptime: "N/A" };
    const e = entries[id];
    return { cpu_percent: e?.metrics?.cpu_percent ?? 0, ram_percent: e?.metrics?.ram_percent ?? 0, disk_percent: e?.metrics?.disk_percent ?? 0, uptime: formatUptime(e?.metrics?.uptime_seconds) };
  };

  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  // Filter
  const filtered = useMemo(() => {
    let list = allServers;
    if (projectFilter) list = list.filter(s => s.project_id === projectFilter);
    if (envFilter !== "all") list = list.filter(s => s.group_name === envFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.host.toLowerCase().includes(q));
    }
    return list;
  }, [allServers, projectFilter, envFilter, searchQuery]);

  // Sort
  const sorted = useMemo(() => {
    if (sort === "none") return filtered;
    return [...filtered].sort((a, b) => {
      const ma = getMetrics(a.id);
      const mb = getMetrics(b.id);
      const [key, dir] = sort.split("_") as [string, string];
      const va = key === "cpu" ? ma.cpu_percent : key === "ram" ? ma.ram_percent : ma.disk_percent;
      const vb = key === "cpu" ? mb.cpu_percent : key === "ram" ? mb.ram_percent : mb.disk_percent;
      return dir === "asc" ? va - vb : vb - va;
    });
  }, [filtered, sort, entries]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page khi filter thay đổi
  useEffect(() => { setPage(1); }, [projectFilter, envFilter, searchQuery, sort]);

  const infoServer = allServers.find(s => s.id === infoServerId) ?? null;

  const sortIcon = (key: string) => {
    if (sort === `${key}_asc`) return <ArrowUp size={9} />;
    if (sort === `${key}_desc`) return <ArrowDown size={9} />;
    return <ArrowUpDown size={9} className="opacity-40" />;
  };
  const cycleSort = (key: string) => {
    if (sort === `${key}_asc`) setSort(`${key}_desc` as SortKey);
    else if (sort === `${key}_desc`) setSort("none");
    else setSort(`${key}_asc` as SortKey);
  };

  const pageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <ProjectFilter projects={projects} value={projectFilter} onChange={setProjectFilter} />

        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="input-glass rounded-xl h-9 w-[130px] text-[11px] font-black uppercase tracking-widest">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-dialog border-white/10 rounded-xl">
            <SelectItem value="all"        className="text-[11px] font-black uppercase tracking-widest">All Envs</SelectItem>
            <SelectItem value="production" className="text-[11px] font-black uppercase tracking-widest">Production</SelectItem>
            <SelectItem value="staging"    className="text-[11px] font-black uppercase tracking-widest">Staging</SelectItem>
            <SelectItem value="lab"        className="text-[11px] font-black uppercase tracking-widest">Lab</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Input
              className="input-glass rounded-xl h-9 w-full text-[12px] pr-8"
              placeholder="Tìm tên, IP..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setSearchQuery(searchInput); }}
            />
            {searchInput && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                onClick={() => { setSearchQuery(""); setSearchInput(""); }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <Button
          onClick={() => setAddOpen(true)}
          className="ml-auto bg-gradient-to-r from-[#00F2FF] to-[#00B4D8] text-[#05080F] rounded-xl px-4 h-9 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.25)] border-0 gap-1.5"
        >
          <Plus size={14} className="stroke-[3px]" /> Thêm Server
        </Button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-df-cyan opacity-60" />
        </div>
      )}

      {/* ── Table ── */}
      {!loading && (
        <div className="glass-card rounded-2xl border border-white/[0.05] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-10 text-[9px] font-black uppercase tracking-widest text-white/30 pl-4">#</TableHead>
                <TableHead className="min-w-[200px] text-[9px] font-black uppercase tracking-widest text-white/30">Server</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">Host</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">ENV</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">Project</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 cursor-pointer select-none hover:text-white/60 transition-colors" onClick={() => cycleSort("cpu")}>
                  <div className="flex items-center gap-1">CPU {sortIcon("cpu")}</div>
                </TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 cursor-pointer select-none hover:text-white/60 transition-colors" onClick={() => cycleSort("ram")}>
                  <div className="flex items-center gap-1">RAM {sortIcon("ram")}</div>
                </TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 cursor-pointer select-none hover:text-white/60 transition-colors" onClick={() => cycleSort("disk")}>
                  <div className="flex items-center gap-1">Disk {sortIcon("disk")}</div>
                </TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">Uptime</TableHead>
                <TableHead className="w-16 text-[9px] font-black uppercase tracking-widest text-white/30 text-right pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow className="border-0">
                  <TableCell colSpan={10} className="text-center py-16 text-[11px] text-white/30 font-black uppercase tracking-widest">
                    Không có server nào
                  </TableCell>
                </TableRow>
              )}
              {paginated.map((server, idx) => {
                const m = getMetrics(server.id);
                const proj = server.project_id ? projectMap[server.project_id] : null;
                const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1;

                return (
                  <TableRow
                    key={server.id}
                    className="border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition-colors group"
                    onClick={() => !isDemo && setInfoServerId(server.id)}
                  >
                    <TableCell className="pl-4 text-[11px] text-white/30 font-bold">{rowNum}</TableCell>

                    <TableCell className="min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-white truncate max-w-[180px]" title={server.name}>{server.name}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-[11px] text-df-cyan/80">{server.host}:{server.port}</span>
                    </TableCell>

                    <TableCell>
                      <EnvBadge env={server.group_name} />
                    </TableCell>

                    <TableCell>
                      {proj ? (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: proj.color }} />
                          {proj.name}
                        </span>
                      ) : <span className="text-[10px] text-white/20">—</span>}
                    </TableCell>

                    <TableCell>
                      <span className={cn("text-[12px] font-black", metricColor(m.cpu_percent))}>{m.cpu_percent}%</span>
                    </TableCell>

                    <TableCell>
                      <span className={cn("text-[12px] font-black", metricColor(m.ram_percent))}>{m.ram_percent}%</span>
                    </TableCell>

                    <TableCell>
                      <span className={cn("text-[12px] font-black", metricColor(m.disk_percent))}>{m.disk_percent}%</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-[11px] font-bold text-white/50">{m.uptime}</span>
                    </TableCell>

                    <TableCell className="pr-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isDemo && (
                          <>
                            <button type="button" title="Chi tiết"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-df-cyan hover:bg-df-cyan/10 transition-colors"
                              onClick={() => setInfoServerId(server.id)}>
                              <Info size={13} />
                            </button>
                            <button type="button" title="Xóa"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              onClick={() => setDeleteTarget(server)}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} / {sorted.length} servers
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safePage === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-colors"
              onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} />
            </button>
            {pageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="w-7 text-center text-white/30 text-[11px]">…</span>
              ) : (
                <button key={p} type="button"
                  className={cn("w-7 h-7 rounded-lg text-[11px] font-black transition-colors",
                    safePage === p ? "bg-df-cyan/15 text-df-cyan border border-df-cyan/30" : "text-white/40 hover:text-white hover:bg-white/5")}
                  onClick={() => setPage(p as number)}>
                  {p}
                </button>
              )
            )}
            <button type="button" disabled={safePage === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-colors"
              onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Server Detail Modal ── */}
      <Dialog open={!!infoServerId} onOpenChange={(open) => !open && setInfoServerId(null)}>
        <DialogContent className="max-w-2xl bg-transparent border-0 p-0 shadow-none outline-none">
          {infoServer && <ServerInfoPanel server={infoServer} />}
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="glass-dialog sm:max-w-[400px] rounded-3xl border-white/10 p-8">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <DialogTitle className="text-[18px] font-black text-white uppercase tracking-tight">Xóa Server</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-[13px] text-df-text-secondary">
            Xóa server <span className="text-white font-black">"{deleteTarget?.name}"</span>?<br />
            Toàn bộ lịch sử deploy và metrics sẽ bị xóa. Không thể hoàn tác.
          </p>
          <DialogFooter className="mt-8 gap-3">
            <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6 h-12" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button disabled={deleting}
              className="rounded-xl px-8 h-12 font-black uppercase tracking-widest bg-red-500/80 hover:bg-red-500 text-white border-0"
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try { await removeServer(deleteTarget.id); } finally { setDeleting(false); setDeleteTarget(null); }
              }}>
              {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddServerDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
