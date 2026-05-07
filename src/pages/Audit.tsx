import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const ACTION_COLORS: Record<string, string> = {
  install: "bg-blue-600",
  update: "bg-purple-600",
  rollback: "bg-orange-500",
  remove: "bg-destructive",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-600",
  failed: "bg-destructive",
  in_progress: "bg-blue-500",
};

function fmtDate(s: string) {
  return s.replace("T", " ").slice(0, 19);
}

export default function Audit() {
  const { servers, fetchServers } = useServerStore();
  const navigate = useNavigate();

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
  body{font-family:sans-serif;font-size:11px;padding:20px}
  h1{font-size:14px;margin-bottom:2px}
  p{font-size:10px;color:#666;margin-bottom:12px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f0f0f0;font-weight:600}
  tr:nth-child(even){background:#fafafa}
  small{color:#999}
</style></head>
<body>
<h1>VMS Deploy Tool — Audit Log</h1>
<p>Xuất: ${new Date().toLocaleString()} &nbsp;·&nbsp; ${records.length} records</p>
<table>
  <thead><tr>
    <th>Thời gian</th><th>Server</th><th>Module</th>
    <th>Action</th><th>Status</th><th>Operator</th><th>Log</th>
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

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col p-6 overflow-auto max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <ClipboardList size={22} className="text-primary" />
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/")}>
            ← Home
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="All servers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All servers</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="install">install</SelectItem>
              <SelectItem value="update">update</SelectItem>
              <SelectItem value="rollback">rollback</SelectItem>
              <SelectItem value="remove">remove</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="success">success</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="in_progress">in_progress</SelectItem>
            </SelectContent>
          </Select>

          <form onSubmit={handleSearch} className="flex gap-1 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Module or log..."
                className="h-8 text-xs pl-7 pr-7"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <Button size="sm" type="submit" className="h-8 text-xs px-3">Go</Button>
          </form>

          <div className="flex gap-1 ml-auto">
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              onClick={exportCSV} disabled={records.length === 0}
            >
              <Download size={12} className="mr-1" /> CSV
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              onClick={exportPDF} disabled={records.length === 0}
            >
              <Download size={12} className="mr-1" /> PDF
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Không có records nào.</p>
        ) : (
          <ScrollArea className="flex-1">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="w-6 px-2 py-2" />
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Thời gian</th>
                    <th className="text-left px-3 py-2 font-medium">Server</th>
                    <th className="text-left px-3 py-2 font-medium">Module</th>
                    <th className="text-left px-3 py-2 font-medium">Action</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <>
                      <tr
                        key={r.id}
                        className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          {expanded === r.id
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {fmtDate(r.deployed_at)}
                        </td>
                        <td className="px-3 py-2 font-medium">{r.server_name}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono">{r.module_name}</span>
                          <span className="text-muted-foreground ml-1 text-[10px]">@{r.module_version}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`${ACTION_COLORS[r.action] ?? "bg-muted"} text-[10px] px-1.5`}>
                            {r.action}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`${STATUS_COLORS[r.status] ?? "bg-muted"} text-[10px] px-1.5`}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div>{r.operator_ip}</div>
                          <div className="text-[10px] opacity-70">{r.operator_host}</div>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr key={`${r.id}-log`}>
                          <td colSpan={7} className="px-4 py-3 border-b bg-muted/10">
                            {r.log_output ? (
                              <pre className="text-[10px] font-mono text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap leading-relaxed">
                                {r.log_output}
                              </pre>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic">No log output.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground mt-2">{records.length} records</p>
      </div>
    </div>
  );
}
