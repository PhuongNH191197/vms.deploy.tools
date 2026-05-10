export type ContainerStatus = "running" | "exited" | "restarting";
export type LogPanelLayout = "auto" | 1 | 2 | 3 | 4;

export interface MonitorProject {
  id: string;
  name: string;
}

export interface MockServer {
  id: string;
  name: string;
  ip: string;
  cpu: number;
  ram: number;
  disk: number;
  containersRunning: number;
  containersTotal: number;
  status: "online" | "warning" | "offline";
}

export interface MockContainer {
  id: string;
  serverId: string;
  serverName: string;
  serverIp: string;
  name: string;
  image: string;
  status: ContainerStatus;
  cpu: string;
  ram: string;
  uptime: string;
}
