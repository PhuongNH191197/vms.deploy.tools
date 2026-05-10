import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Pencil, Trash2, FolderKanban, Server, Loader2, AlertTriangle,
  ChevronRight, ChevronDown, Zap,
} from "lucide-react";
import { listProjects, createProject, updateProject, deleteProject } from "@/lib/tauri/commands";
import { useServerStore } from "@/store/serverStore";
import { useMonitorStore } from "@/store/monitorStore";
import type { Project, Server as ServerType } from "@/types";
import { cn } from "@/lib/utils";

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return "–";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MetricBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-[5px] rounded-full bg-black/50 overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold text-white/70 w-7 text-right">{value}%</span>
    </div>
  );
}

const PRESET_COLORS = [
  "#31E8FF", "#C084FC", "#4ADE80", "#FB923C", "#F59E0B",
  "#F472B6", "#60A5FA", "#A78BFA", "#34D399", "#E879F9",
];

interface FormState { name: string; description: string; color: string; }
const emptyForm: FormState = { name: "", description: "", color: "#31E8FF" };

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

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { servers, fetchServers } = useServerStore();
  const { entries, startPolling, stopPolling } = useMonitorStore();
  useEffect(() => { fetchServers(); }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = () => {
    setLoading(true);
    listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setFormError(""); setDialogOpen(true); };
  const openEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(p);
    setForm({ name: p.name, description: p.description, color: p.color });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Tên project không được để trống."); return; }
    setSaving(true); setFormError("");
    try {
      if (editTarget) await updateProject(editTarget.id, form);
      else await createProject(form);
      setDialogOpen(false);
      load();
    } catch (e) { setFormError(String(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError("");
    try { await deleteProject(deleteTarget.id); setDeleteTarget(null); load(); }
    catch (e) { setDeleteError(String(e)); }
    finally { setDeleting(false); }
  };

  const getProjectServers = (projectId: string): ServerType[] =>
    servers.filter(s => s.project_id === projectId);

  const handleExpand = (projectId: string) => {
    if (expandedId === projectId) {
      const prev = getProjectServers(projectId);
      prev.forEach(s => stopPolling(s.id));
      setExpandedId(null);
    } else {
      if (expandedId) {
        const prev = getProjectServers(expandedId);
        prev.forEach(s => stopPolling(s.id));
      }
      setExpandedId(projectId);
      const next = servers.filter(s => s.project_id === projectId);
      next.forEach(s => startPolling(s.id, s.host, s.port, s.username));
    }
  };

  const labelClass = "text-[11px] font-black uppercase tracking-widest text-df-text-secondary mb-2 block";

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.2)" }}>
            <FolderKanban size={22} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-black text-white tracking-tight">Projects</h1>
            <p className="text-[11px] text-df-text-secondary font-bold uppercase tracking-widest opacity-60">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="btn-cyan rounded-xl px-5 h-10 font-black uppercase tracking-widest text-[11px] gap-2">
          <Plus size={16} /> New Project
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-df-cyan opacity-60" />
        </div>
      )}

      {/* Empty */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 glass-card rounded-3xl border-dashed border-white/10">
          <FolderKanban size={48} className="text-amber-400 opacity-30" />
          <p className="text-sm font-black text-df-text-secondary uppercase tracking-widest opacity-50">Chưa có project nào</p>
          <Button onClick={openCreate} className="btn-cyan rounded-xl px-6 h-10 font-black uppercase tracking-widest text-[11px] gap-2 mt-2">
            <Plus size={14} /> Tạo Project Đầu Tiên
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && projects.length > 0 && (
        <div className="glass-card rounded-2xl border border-white/[0.05] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-8 pl-4"></TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">Project</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30">Mô Tả</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 text-center w-24">Servers</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 w-32">Ngày Tạo</TableHead>
                <TableHead className="w-20 pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const isExpanded = expandedId === p.id;
                const projServers = getProjectServers(p.id);

                return (
                  <>
                    {/* Project row */}
                    <TableRow
                      key={p.id}
                      className={cn(
                        "border-white/[0.04] cursor-pointer transition-colors group",
                        isExpanded ? "bg-white/[0.04] border-b-0" : "hover:bg-white/[0.025]"
                      )}
                      onClick={() => handleExpand(p.id)}
                    >
                      <TableCell className="pl-4 w-8">
                        {isExpanded
                          ? <ChevronDown size={14} className="text-white/40" />
                          : <ChevronRight size={14} className="text-white/25 group-hover:text-white/50 transition-colors" />
                        }
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                            <FolderKanban size={15} style={{ color: p.color }} />
                          </div>
                          <span className="text-[13px] font-black text-white">{p.name}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-[12px] text-white/50">{p.description || "—"}</span>
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={cn("text-[12px] font-black", p.server_count > 0 ? "text-white" : "text-white/25")}>
                          {p.server_count}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-[11px] text-white/40 font-mono">
                          {new Date(p.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      </TableCell>

                      <TableCell className="pr-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {p.server_count > 0 && (
                            <button type="button"
                              title="Bulk deploy to all servers in project"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-[#22D3EE] hover:bg-[#22D3EE]/10 transition-colors"
                              onClick={e => { e.stopPropagation(); navigate(`/bulk-deploy?project=${p.id}`); }}>
                              <Zap size={13} />
                            </button>
                          )}
                          <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-df-cyan hover:bg-df-cyan/10 transition-colors" onClick={e => openEdit(p, e)}>
                            <Pencil size={13} />
                          </button>
                          <button type="button"
                            className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                              p.server_count > 0 ? "text-white/10 cursor-not-allowed" : "text-white/30 hover:text-df-red hover:bg-df-red/10")}
                            title={p.server_count > 0 ? "Gỡ hết server trước khi xóa" : "Xóa project"}
                            onClick={e => { e.stopPropagation(); if (p.server_count === 0) { setDeleteError(""); setDeleteTarget(p); } }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded servers sub-table */}
                    {isExpanded && (
                      <TableRow key={`${p.id}-expanded`} className="border-white/[0.04] hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <div className="mx-4 mb-4 mt-1 rounded-xl border border-white/[0.06] overflow-hidden"
                            style={{ background: "rgba(0,0,0,0.2)" }}>
                            {projServers.length === 0 ? (
                              <div className="flex items-center justify-center py-8 gap-3">
                                <Server size={16} className="text-white/20" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-white/25">
                                  Chưa có server nào trong project này
                                </span>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-white/[0.05] hover:bg-transparent">
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 pl-4 w-40">Server</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-36">Host</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-20">ENV</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-16">Status</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-28">CPU</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-28">RAM</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-20">Disk</TableHead>
                                    <TableHead className="text-[8px] font-black uppercase tracking-widest text-white/25 w-20">Uptime</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {projServers.map(s => {
                                    const entry = entries[s.id];
                                    const isOnline = entry?.status === "online" || entry?.status === "warning";
                                    const cpu  = entry?.metrics?.cpu_percent  ?? 0;
                                    const ram  = entry?.metrics?.ram_percent  ?? 0;
                                    const disk = entry?.metrics?.disk_percent ?? 0;
                                    const uptime = formatUptime(entry?.metrics?.uptime_seconds);
                                    const cpuColor = cpu >= 85 ? "#f87171" : cpu >= 70 ? "#fbbf24" : "#4ade80";
                                    const ramColor = ram >= 85 ? "#f87171" : ram >= 70 ? "#fbbf24" : "#c084fc";
                                    return (
                                      <TableRow key={s.id} className="border-white/[0.04] hover:bg-white/[0.025]">
                                        <TableCell className="pl-4">
                                          <span className="text-[12px] font-black text-white">{s.name}</span>
                                        </TableCell>
                                        <TableCell>
                                          <span className="font-mono text-[11px] text-df-cyan/70">{s.host}:{s.port}</span>
                                        </TableCell>
                                        <TableCell><EnvBadge env={s.group_name} /></TableCell>
                                        <TableCell>
                                          {entry ? (
                                            <span className={cn("flex items-center gap-1.5 text-[10px] font-bold", isOnline ? "text-green-400" : "text-white/30")}>
                                              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isOnline ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)]" : "bg-white/20")} />
                                              {isOnline ? "Online" : "Offline"}
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-1.5 text-[10px] text-white/20">
                                              <Loader2 size={10} className="animate-spin" /> —
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {entry ? <MetricBar value={cpu} color={cpuColor} /> : <span className="text-[10px] text-white/20">—</span>}
                                        </TableCell>
                                        <TableCell>
                                          {entry ? <MetricBar value={ram} color={ramColor} /> : <span className="text-[10px] text-white/20">—</span>}
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-[11px] font-bold text-white/70">{entry ? `${disk}%` : "—"}</span>
                                        </TableCell>
                                        <TableCell>
                                          <span className="text-[11px] font-bold text-white/70">{entry ? uptime : "—"}</span>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-dialog sm:max-w-[440px] rounded-3xl border-white/10 p-8">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <FolderKanban size={20} className="text-amber-400" />
              </div>
              <DialogTitle className="text-[18px] font-black text-white uppercase tracking-tight">
                {editTarget ? "Sửa Project" : "Tạo Project Mới"}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className={labelClass}>Tên Project</Label>
              <Input className="input-glass rounded-xl h-11" placeholder="My Awesome Project" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className={labelClass}>Mô Tả</Label>
              <Input className="input-glass rounded-xl h-11" placeholder="Mô tả ngắn về project..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label className={labelClass}>Màu Sắc</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button"
                    className={cn("w-7 h-7 rounded-lg transition-all border-2", form.color === c ? "scale-110 border-white" : "border-transparent opacity-70 hover:opacity-100")}
                    style={{ background: c, boxShadow: form.color === c ? `0 0 10px ${c}` : undefined }}
                    onClick={() => setForm(f => ({ ...f, color: c }))} />
                ))}
              </div>
            </div>
            {formError && <p className="text-[11px] text-df-red font-bold uppercase tracking-widest">{formError}</p>}
          </div>
          <DialogFooter className="mt-8 gap-3">
            <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6 h-12" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-cyan rounded-xl px-8 h-12 font-black uppercase tracking-widest">
              {saving && <Loader2 size={16} className="mr-2 animate-spin text-df-bg-deep" />}
              {editTarget ? "Lưu Thay Đổi" : "Tạo Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) { setDeleteTarget(null); setDeleteError(""); } }}>
        <DialogContent className="glass-dialog sm:max-w-[400px] rounded-3xl border-white/10 p-8">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-df-red/10 flex items-center justify-center border border-df-red/20">
                <AlertTriangle size={20} className="text-df-red" />
              </div>
              <DialogTitle className="text-[18px] font-black text-white uppercase tracking-tight">Xóa Project</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-[13px] text-df-text-secondary mb-2">
            Xóa project <span className="text-white font-black">"{deleteTarget?.name}"</span>? Không thể hoàn tác.
          </p>
          {deleteError && <p className="text-[11px] text-df-red font-bold uppercase tracking-widest mt-3">{deleteError}</p>}
          <DialogFooter className="mt-8 gap-3">
            <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6 h-12" onClick={() => { setDeleteTarget(null); setDeleteError(""); }}>Hủy</Button>
            <Button onClick={handleDelete} disabled={deleting} className="rounded-xl px-8 h-12 font-black uppercase tracking-widest bg-df-red/80 hover:bg-df-red text-white border-0">
              {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
