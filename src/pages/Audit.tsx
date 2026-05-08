import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useServerStore } from "@/store/serverStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Download, ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

interface AuditRecord {
  id: string;
  server_id: string;
  server_name: string;
  module_name: string;
  module_version: string;
  action: string;
  status: string;
  operator_ip: string;
  operator_host: string;
  log_output: string | null;
  deployed_at: string;
}

const ACTION_BADGES: Record<string, string> = {
  install: "bg-df-cyan/10 text-df-cyan border-df-cyan/20",
  update: "bg-df-purple/10 text-df-purple border-df-purple/20",
  rollback: "bg-df-orange/10 text-df-orange border-df-orange/20",
  remove: "bg-df-red/10 text-df-red border-df-red/20",
};

const STATUS_BADGES: Record<string, string> = {
  success: "badge-active",
  failed: "badge-error",
  in_progress: "bg-white/5 text-white/50 border-white/10 animate-pulse",
};

function fmtDate(s: string) {
  return s.replace("T", " ").slice(0, 19);
}

export default function Audit() {
  const { servers, fetchServers } = useServerStore();

  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [serverId, setServerId] = useState("all");
  const [action, setAction] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => { fetchServers(); }, []);

  const load = async (searchVal?: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await invoke<AuditRecord[]>("get_audit_logs", {
        serverId: serverId === "all" ? null : serverId,
        action: action === "all" ? null : action,
        status: status === "all" ? null : status,
        search: (searchVal ?? search) || null,
      });
      setRecords(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [serverId, action, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    load(searchInput);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    load("");
  };

  const exportPDF = () => {
    const rows = records.map((r) => `
      <tr>
        <td>${fmtDate(r.deployed_at)}</td>
        <td>${r.server_name}</td>
        <td>${r.module_name} @${r.module_version}</td>
        <td>${r.action}</td>
        <td>${r.status}</td>
        <td>${r.operator_ip}<br/><small>${r.operator_host}</small></td>
        <td style="font-size:9px;max-width:200px;overflow:hidden">${(r.log_output ?? "").slice(0, 200)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>VMS Audit Log</title>
<style>
  body{font-family:sans-serif;font-size:11px;padding:20px;background:#070B14;color:#F3F4F6}
  h1{font-size:16px;margin-bottom:2px;font-weight:900;letter-spacing:-0.02em}
  p{font-size:10px;color:#9CA3AF;margin-bottom:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em}
  table{border-collapse:collapse;width:100%;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05)}
  th,td{border:1px solid rgba(255,255,255,0.05);padding:8px 10px;text-align:left;vertical-align:top}
  th{background:rgba(255,255,255,0.03);font-weight:900;text-transform:uppercase;font-size:9px;letter-spacing:0.1em}
  small{color:#9CA3AF}
</style></head>
<body>
<h1>VMS DEPLOY TOOL — AUDIT LOG</h1>
<p>Exported: ${new Date().toLocaleString()} &nbsp;·&nbsp; ${records.length} records</p>
<table>
  <thead><tr>
    <th>TIME</th><th>SERVER</th><th>MODULE</th>
    <th>ACTION</th><th>STATUS</th><th>OPERATOR</th><th>LOG SNIPPET</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };

  const exportCSV = () => {
    const header = "deployed_at,server,module,version,action,status,operator_ip,operator_host";
    const rows = records.map((r) =>
      [r.deployed_at, r.server_name, r.module_name, r.module_version,
        r.action, r.status, r.operator_ip, r.operator_host]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const mainElement = document.getElementById('main-content');
    const handleScroll = () => {
      setScrollOffset(mainElement?.scrollTop ?? 0);
    };
    mainElement?.addEventListener('scroll', handleScroll);
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, []);

  const opacity = Math.min(scrollOffset / 100, 0.85);
  const blur = Math.min(scrollOffset / 5, 20);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex flex-col w-full">
        <div 
          className="sticky top-[108px] z-20 py-4 -mx-10 px-20 transition-all duration-500 ease-out border-b border-white/[0.01] mb-8"
          style={{ 
            backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
            backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
            WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
          }}
        >
          {/* Filters & Search Toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
            <Select value={serverId} onValueChange={setServerId}>
              <SelectTrigger className="h-9 text-[10px] font-black uppercase tracking-widest w-44 bg-white/[0.03] border-white/5 rounded-lg focus:ring-df-cyan/20">
                <SelectValue placeholder="All servers" />
              </SelectTrigger>
              <SelectContent className="glass-dialog border-white/10 rounded-xl">
                <SelectItem value="all" className="text-[11px] font-bold uppercase tracking-widest">All Servers</SelectItem>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[11px] font-bold uppercase tracking-widest">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9 text-[10px] font-black uppercase tracking-widest w-36 bg-white/[0.03] border-white/5 rounded-lg focus:ring-df-cyan/20">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent className="glass-dialog border-white/10 rounded-xl">
                <SelectItem value="all" className="text-[11px] font-bold uppercase tracking-widest">All Actions</SelectItem>
                <SelectItem value="install" className="text-[11px] font-bold uppercase tracking-widest">Install</SelectItem>
                <SelectItem value="update" className="text-[11px] font-bold uppercase tracking-widest">Update</SelectItem>
                <SelectItem value="rollback" className="text-[11px] font-bold uppercase tracking-widest">Rollback</SelectItem>
                <SelectItem value="remove" className="text-[11px] font-bold uppercase tracking-widest">Remove</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-[10px] font-black uppercase tracking-widest w-36 bg-white/[0.03] border-white/5 rounded-lg focus:ring-df-cyan/20">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="glass-dialog border-white/10 rounded-xl">
                <SelectItem value="all" className="text-[11px] font-bold uppercase tracking-widest">All Status</SelectItem>
                <SelectItem value="success" className="text-[11px] font-bold uppercase tracking-widest text-df-green">Success</SelectItem>
                <SelectItem value="failed" className="text-[11px] font-bold uppercase tracking-widest text-df-red">Failed</SelectItem>
                <SelectItem value="in_progress" className="text-[11px] font-bold uppercase tracking-widest text-df-cyan">In Progress</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-[200px] relative">
              <form onSubmit={handleSearch} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-df-text-secondary opacity-50" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="MODULE OR LOG CONTENT..."
                  className="h-9 text-[11px] font-bold pl-9 pr-9 bg-white/[0.03] border-white/5 rounded-lg focus:border-df-cyan/30 focus:ring-df-cyan/10 transition-all uppercase placeholder:opacity-30 w-full"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-df-text-secondary hover:text-df-cyan"
                  >
                    <X size={14} />
                  </button>
                )}
              </form>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                className="inline-flex items-center justify-center h-9 whitespace-nowrap rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-df-cyan/10 text-df-cyan border border-df-cyan/20 hover:bg-df-cyan/20 hover:border-df-cyan/40 transition-all duration-400 shadow-sm"
                onClick={exportCSV}
                disabled={records.length === 0}
              >
                <Download size={14} className="mr-2" /> Export CSV
              </Button>
              <Button
                size="sm"
                className="inline-flex items-center justify-center h-9 whitespace-nowrap rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-white/[0.05] text-df-text-primary border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-400"
                onClick={exportPDF}
                disabled={records.length === 0}
              >
                <ClipboardList size={14} className="mr-2" /> Print PDF
              </Button>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-df-red bg-df-red/10 p-3 rounded-xl border border-df-red/20 mb-6 font-bold">{error}</p>}

        {/* Table Container */}
        <div className="glass-card rounded-2xl border-white/[0.03] overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                  <th className="w-12 px-4 py-4" />
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">TIMESTAMP</th>
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">INFRASTRUCTURE</th>
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">MODULE / VER</th>
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">ACTION</th>
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">OUTCOME</th>
                  <th className="px-4 py-4 text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">OPERATOR</th>
                </tr>
              </thead>
            </table>
          </div>
          
          <ScrollArea className="flex-1">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <Loader2 className="animate-spin text-df-cyan mx-auto mb-4" size={32} />
                      <span className="text-[11px] font-black text-df-text-secondary uppercase tracking-[0.2em]">Analyzing security logs...</span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-24 text-center">
                      <p className="text-sm text-df-text-secondary font-bold uppercase tracking-widest opacity-40">No audit records found.</p>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr
                        className={cn(
                          "group hover:bg-white/[0.02] cursor-pointer transition-all",
                          expanded === r.id ? "bg-white/[0.02]" : ""
                        )}
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      >
                        <td className="w-12 px-4 py-5 text-center">
                          {expanded === r.id
                            ? <ChevronDown size={16} className="text-df-cyan mx-auto" />
                            : <ChevronRight size={16} className="text-df-text-secondary group-hover:text-df-cyan mx-auto transition-colors" />}
                        </td>
                        <td className="px-4 py-5 font-mono text-[11px] text-df-text-secondary whitespace-nowrap">
                          {fmtDate(r.deployed_at)}
                        </td>
                        <td className="px-4 py-5">
                          <span className="text-[13px] font-black text-df-text-primary uppercase tracking-tight">{r.server_name}</span>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[13px] font-bold text-df-cyan tracking-tight">{r.module_name}</span>
                            <span className="text-df-text-secondary font-black text-[9px] uppercase tracking-widest opacity-50">v{r.module_version}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className={cn("text-[9px] font-black tracking-[0.1em] px-2 py-0.5 rounded-lg border uppercase", ACTION_BADGES[r.action] || "bg-white/5")}>
                            {r.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className={cn("text-[9px] font-black tracking-[0.1em] px-2 py-0.5 rounded-lg border uppercase", STATUS_BADGES[r.status] || "bg-white/5")}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-[12px] font-bold text-df-text-primary tracking-tight">{r.operator_ip}</div>
                          <div className="text-[10px] font-black text-df-text-secondary uppercase tracking-widest opacity-40">{r.operator_host}</div>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr className="bg-black/40">
                          <td colSpan={7} className="px-8 py-6">
                            <div className="glass-card p-6 rounded-2xl border-white/5 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <ClipboardList size={80} />
                              </div>
                              <p className="text-[10px] font-black text-df-cyan uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-df-cyan animate-pulse" />
                                Console Execution Log Output
                              </p>
                              {r.log_output ? (
                                <pre className="text-[11px] font-mono text-df-text-secondary max-h-[400px] overflow-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
                                  {r.log_output}
                                </pre>
                              ) : (
                                <p className="text-[11px] text-df-text-secondary italic opacity-40">No console output recorded for this operation.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
          
          <div className="px-6 py-4 border-t border-white/[0.05] bg-white/[0.01] flex justify-between items-center">
             <span className="text-[10px] font-black text-df-text-secondary uppercase tracking-[0.2em]">SECURE AUDIT COMPLIANCE ACTIVE</span>
             <span className="text-[11px] font-bold text-df-cyan tracking-wider">{records.length} Logs Analyzed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
