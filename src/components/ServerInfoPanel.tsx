import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Cpu, Database, Activity, Server as ServerIcon } from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { fetchServerInfo } from "@/lib/tauri/commands";
import type { Server, ServerInfo } from "@/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";


export default function ServerInfoPanel({ server }: { server: Server }) {
  const { serverInfoMap, setServerInfo } = useServerStore();
  const [loading, setLoading] = useState(false);

  const info: ServerInfo | undefined = serverInfoMap[server.id];

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchServerInfo(server.id);
      setServerInfo(server.id, result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!info) load();
  }, [server.id]);

  const ramPct = info ? Math.round((info.ram_used_mb / info.ram_total_mb) * 100) : 0;
  const uptime = info ? formatUptime(info.uptime_seconds) : "";

  const Label = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[10px] font-black text-df-text-secondary uppercase tracking-[0.15em] opacity-60">{children}</span>
  );

  const Value = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={cn("text-[12px] font-bold text-df-text-primary tracking-tight", className)}>{children}</span>
  );

  return (
    <div className="w-full max-w-[950px] flex flex-col animate-in fade-in zoom-in duration-300 glass-card border border-white/10 relative overflow-hidden shadow-[0_50px_150px_rgba(0,0,0,0.9)] rounded-[2rem]">
      {/* ── Ambient Background Glows ── */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-df-cyan/5 blur-[120px] -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-df-purple/5 blur-[120px] -mb-48 pointer-events-none" />

      {/* ── Header: Compact & Info-rich ── */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.05] bg-white/[0.02] relative z-10">
        <div className="flex items-center gap-5">
           <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/10 shadow-inner">
              <ServerIcon size={22} className="text-white/80" />
           </div>
           <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-black text-white tracking-tight leading-none">{server.name}</h2>
                <Badge className="bg-df-cyan/10 text-df-cyan border-df-cyan/20 px-2 py-0.5 text-[10px] font-mono font-bold rounded-md">
                  {server.host}
                </Badge>
                {!loading && (
                   <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-df-green/10 border border-df-green/20 ml-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-df-green animate-pulse shadow-[0_0_8px_#22C55E]" />
                      <span className="text-[9px] font-black text-df-green uppercase tracking-widest">Stable</span>
                   </div>
                )}
              </div>
              <p className="text-[10px] font-bold text-df-text-secondary uppercase tracking-[0.2em] mt-2 opacity-50">
                Infrastructure Control & Monitoring
              </p>
           </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-8 py-8 relative z-10 custom-scrollbar max-h-[70vh]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Column 1: System Specs ── */}
          <div className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-[11px] font-black text-df-purple uppercase tracking-[0.2em] opacity-80">
              <Cpu size={14} /> System Specs
            </h3>
            
            <div className="glass-card p-5 rounded-2xl border-white/[0.05] bg-white/[0.01] space-y-4 flex-1">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Hostname</Label>
                  <Value className="text-df-purple font-mono text-[12px]">{info?.hostname || "---"}</Value>
                </div>
                <div className="flex flex-col gap-1.5 pt-3 border-t border-white/[0.03]">
                  <Label>Operating System</Label>
                  <Value>{info?.os || "---"}</Value>
                </div>
                <div className="flex flex-col gap-1.5 pt-3 border-t border-white/[0.03]">
                  <Label>Logical Cores</Label>
                  <Value>{info?.cpu_cores || 0} vCPUs</Value>
                </div>
                <div className="flex flex-col gap-1.5 pt-3 border-t border-white/[0.03]">
                   <Label>System Uptime</Label>
                   <Value className="text-df-cyan font-mono">{uptime || "---"}</Value>
                </div>
              </div>
            </div>
          </div>

          {/* ── Column 2: Live Resources ── */}
          <div className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-[11px] font-black text-df-cyan uppercase tracking-[0.2em] opacity-80">
              <Activity size={14} /> Live Resources
            </h3>
            
            <div className="glass-card p-5 rounded-2xl border-white/[0.05] bg-black/10 space-y-8 flex-1">
              {/* CPU */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <Label>CPU Load</Label>
                  <Value className="text-df-cyan">0%</Value>
                </div>
                <Progress value={0} className="h-1.5 bg-white/5" />
              </div>

              {/* RAM */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <Label>Memory</Label>
                  <Value className="text-df-purple">{ramPct}%</Value>
                </div>
                <Progress value={ramPct} className="h-1.5 bg-white/5" />
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-right">
                  {info?.ram_used_mb || 0} / {info?.ram_total_mb || 0} MB
                </p>
              </div>

              {/* Disk */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <Label>Storage</Label>
                  <Value className="text-white/60">{info?.disk_percent ?? 0}%</Value>
                </div>
                <Progress value={info?.disk_percent ?? 0} className="h-1.5 bg-white/5" />
              </div>
            </div>
          </div>

          {/* ── Column 3: Connectivity ── */}
          <div className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-[11px] font-black text-white/50 uppercase tracking-[0.2em] opacity-80">
              <Database size={14} /> Connectivity
            </h3>
            
            <div className="flex flex-col gap-4 flex-1">
              <div className="glass-card p-5 rounded-2xl border-white/[0.05] bg-white/[0.01] space-y-4">
                <div className="flex justify-between items-center">
                  <Label>SSH Port</Label>
                  <Value className="text-df-cyan">{server.port}</Value>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/[0.03]">
                  <Label>User</Label>
                  <Value>{server.username}</Value>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-white/[0.03]">
                  <Label>Auth</Label>
                  <Badge className="bg-white/5 text-white/50 border-white/10 uppercase text-[8px] px-2">{server.auth_type}</Badge>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border-white/[0.05] bg-white/[0.01] flex-1 flex flex-col justify-center gap-2">
                 <Label>Kernel Version</Label>
                 <Value className="font-mono text-[10px] opacity-40 leading-relaxed break-all">
                   {info?.kernel || "Pending sync..."}
                 </Value>
              </div>
            </div>
          </div>

        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="px-8 py-5 border-t border-white/[0.05] bg-white/[0.01] relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5 opacity-30">
           <Activity size={12} className="text-white" />
           <span className="text-[9px] font-bold text-white uppercase tracking-widest">
             Auto-sync: 5s | Last: {new Date().toLocaleTimeString()}
           </span>
        </div>
        
        <Button 
          variant="ghost" 
          className="h-10 px-6 btn-ghost-glass rounded-lg text-[10px] font-black uppercase tracking-[0.2em] gap-2.5 border-white/5 hover:border-df-cyan/30 transition-all" 
          onClick={load} 
          disabled={loading}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Force Sync
        </Button>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
