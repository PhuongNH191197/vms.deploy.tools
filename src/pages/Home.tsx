import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { useMonitorStore } from "@/store/monitorStore";
import AddServerDialog from "@/components/AddServerDialog";
import ServerInfoPanel from "@/components/ServerInfoPanel";
import ServerCard from "@/components/ServerCard";
import type { Server as ServerType, ServerGroup, ServerStatus } from "@/types";

/* ── Demo data matching the reference image exactly ── */
const DEMO_SERVERS: ServerType[] = [
  { id: "demo-1", name: "Web-Server-01", host: "10.0.1.10", port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null },
  { id: "demo-2", name: "API-Gateway-03", host: "10.0.1.30", port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null },
  { id: "demo-3", name: "Database-Cluster-02", host: "10.0.2.10", port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null },
  { id: "demo-4", name: "Load-Balancer-01", host: "10.0.1.50", port: 22, username: "admin", auth_type: "key", group_name: "production", last_seen: null },
  { id: "demo-5", name: "Caching-Server-01", host: "10.0.3.10", port: 22, username: "admin", auth_type: "key", group_name: "staging", last_seen: null },
  { id: "demo-6", name: "Build-Node-04", host: "10.0.4.10", port: 22, username: "admin", auth_type: "key", group_name: "lab", last_seen: null },
];

const DEMO_METRICS: Record<string, { cpu_percent: number; ram_percent: number; disk_percent: number; uptime: string }> = {
  "demo-1": { cpu_percent: 78, ram_percent: 62, disk_percent: 45, uptime: "34 days" },
  "demo-2": { cpu_percent: 55, ram_percent: 71, disk_percent: 45, uptime: "39 days" },
  "demo-3": { cpu_percent: 81, ram_percent: 67, disk_percent: 45, uptime: "34 days" },
  "demo-4": { cpu_percent: 42, ram_percent: 77, disk_percent: 45, uptime: "34 days" },
  "demo-5": { cpu_percent: 52, ram_percent: 62, disk_percent: 25, uptime: "18 days" },
  "demo-6": { cpu_percent: 82, ram_percent: 72, disk_percent: 45, uptime: "34 days" },
};

export default function Home() {
  const { servers, loading, fetchServers } = useServerStore();
  const { entries } = useMonitorStore();
  const [addOpen, setAddOpen] = useState(false);
  const [infoServerId, setInfoServerId] = useState<string | null>(null);

  const { startPolling, stopAll } = useMonitorStore();

  useEffect(() => {
    fetchServers();
    return () => stopAll();
  }, []);

  // Tự động bắt đầu polling khi có danh sách server
  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach(s => {
        // Lưu ý: Trong thực tế, credential (password) thường được lưu trong một store bảo mật
        // Ở đây chúng ta giả định startPolling sẽ lấy từ credentials store nếu đã được set
        startPolling(s.id, s.host, s.port, s.username);
      });
    }
  }, [servers]);

  /* Use real servers if available, otherwise show demo */
  const displayServers = servers.length > 0 ? servers : DEMO_SERVERS;
  const isDemo = servers.length === 0;

  const groups: ServerGroup[] = ["all", "production", "staging", "lab"];

  const filtered = (group: ServerGroup): ServerType[] =>
    group === "all" ? displayServers : displayServers.filter((s) => s.group_name === group);

  const groupCount = (group: ServerGroup) => filtered(group).length;

  const infoServer = displayServers.find((s) => s.id === infoServerId) ?? null;

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
    <div className="flex flex-col">
      <Tabs defaultValue="all" className="w-full">
        <div 
          className="flex items-center justify-between mb-8 sticky top-[108px] z-20 py-4 -mx-10 px-20 transition-all duration-500 ease-out border-b border-white/[0.01]"
          style={{ 
            backgroundColor: scrollOffset > 0 ? `rgba(10, 18, 36, ${opacity})` : 'transparent',
            backdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
            WebkitBackdropFilter: scrollOffset > 0 ? `blur(${blur}px)` : 'none',
          }}
        >
          <TabsList className="bg-white/[0.02] border border-white/5 p-1 rounded-xl">
            {groups.map((g) => (
              <TabsTrigger
                key={g}
                value={g}
                className="capitalize rounded-lg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-df-cyan/10 data-[state=active]:text-df-cyan transition-all duration-400 border border-transparent data-[state=active]:border-df-cyan/20"
              >
                {g}
                <span className="ml-2 opacity-30">
                  {groupCount(g)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <Button
            onClick={() => setAddOpen(true)}
            className="bg-gradient-to-r from-[#00F2FF] to-[#00B4D8] text-[#05080F] rounded-lg px-4 h-9 text-[10px] font-black uppercase tracking-[0.15em] shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:shadow-[0_0_30px_rgba(0,242,255,0.5)] transition-all duration-300 border-0"
          >
            <Plus size={14} className="mr-2 stroke-[3px]" /> THÊM SERVER
          </Button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2
              className="animate-spin text-df-cyan"
              size={48}
            />
            <span className="text-df-text-secondary font-black tracking-widest uppercase text-xs">Loading Infrastructure...</span>
          </div>
        )}

        {!loading &&
          groups.map((g) => (
            <TabsContent key={g} value={g} className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                {filtered(g).map((server, idx) => {
                  const mon = entries[server.id];
                  const status: ServerStatus = isDemo
                    ? "online"
                    : (mon?.status ?? "unknown");

                  // Fix: Luôn gán dữ liệu Demo nếu đang ở chế độ Demo
                  const metrics = isDemo
                    ? DEMO_METRICS[server.id] || { cpu_percent: 0, ram_percent: 0, disk_percent: 0, uptime: "N/A" }
                    : mon?.metrics;

                  return (
                    <ServerCard
                      key={server.id}
                      server={server}
                      status={status}
                      metrics={metrics as any}
                      onInfo={setInfoServerId}
                      index={idx}
                    />
                  );
                })}
              </div>
            </TabsContent>
          ))}
      </Tabs>

      {/* ── Modal Chi tiết Server ── */}
      <Dialog open={!!infoServerId} onOpenChange={(open) => !open && setInfoServerId(null)}>
        <DialogContent className="max-w-2xl bg-transparent border-0 p-0 shadow-none outline-none">
          {infoServer && (
            <ServerInfoPanel 
              server={servers.find(s => s.id === infoServerId)!} 
            />
          )}
        </DialogContent>
      </Dialog>

      <AddServerDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

