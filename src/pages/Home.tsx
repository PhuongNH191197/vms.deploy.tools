import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Trash2, Info, Server, Circle } from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { useMonitorStore } from "@/store/monitorStore";
import AddServerDialog from "@/components/AddServerDialog";
import ServerInfoPanel from "@/components/ServerInfoPanel";
import type { Server as ServerType, ServerGroup, ServerStatus } from "@/types";

function StatusDot({ status }: { status: ServerStatus }) {
  const colors: Record<ServerStatus, string> = {
    online: "text-green-500",
    warning: "text-yellow-400",
    offline: "text-red-500",
    unknown: "text-muted-foreground",
  };
  return <Circle size={10} className={`fill-current ${colors[status]}`} />;
}

export default function Home() {
  const { servers, loading, fetchServers, removeServer } = useServerStore();
  const { entries } = useMonitorStore();
  const [addOpen, setAddOpen] = useState(false);
  const [infoServerId, setInfoServerId] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const groups: ServerGroup[] = ["all", "production", "staging", "lab"];

  const filtered = (group: ServerGroup): ServerType[] =>
    group === "all" ? servers : servers.filter((s) => s.group_name === group);

  const groupCount = (group: ServerGroup) => filtered(group).length;

  const infoServer = servers.find((s) => s.id === infoServerId) ?? null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Main panel */}
      <div className="flex-1 flex flex-col p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Server size={22} className="text-primary" />
            <h1 className="text-xl font-semibold">Server Dashboard</h1>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} className="mr-1" /> Thêm Server
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              {groups.map((g) => (
                <TabsTrigger key={g} value={g} className="capitalize">
                  {g} <span className="ml-1 text-xs text-muted-foreground">({groupCount(g)})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.map((g) => (
              <TabsContent key={g} value={g}>
                {filtered(g).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    Chưa có server nào trong nhóm này.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="w-6 px-3 py-2" />
                          <th className="text-left px-4 py-2 font-medium">Tên</th>
                          <th className="text-left px-4 py-2 font-medium">Host</th>
                          <th className="text-left px-4 py-2 font-medium">Nhóm</th>
                          <th className="text-left px-4 py-2 font-medium w-28">CPU</th>
                          <th className="text-left px-4 py-2 font-medium w-28">RAM</th>
                          <th className="text-right px-4 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered(g).map((server) => {
                          const mon = entries[server.id];
                          const status: ServerStatus = mon?.status ?? "unknown";
                          const metrics = mon?.metrics;
                          return (
                          <tr key={server.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-3"><StatusDot status={status} /></td>
                            <td className="px-4 py-3 font-medium">{server.name}</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{server.host}:{server.port}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="capitalize text-xs">{server.group_name}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {metrics ? (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">{metrics.cpu_percent}%</div>
                                  <Progress value={metrics.cpu_percent} className="h-1" />
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {metrics ? (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">{metrics.ram_percent}%</div>
                                  <Progress value={metrics.ram_percent} className="h-1" />
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Server Info"
                                onClick={() => setInfoServerId(server.id)}
                              >
                                <Info size={14} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Xóa"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Xóa server "${server.name}"?`)) removeServer(server.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Side panel: Server Info */}
      {infoServer && (
        <ServerInfoPanel
          server={infoServer}
          onClose={() => setInfoServerId(null)}
        />
      )}

      <AddServerDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
