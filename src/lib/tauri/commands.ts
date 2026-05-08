import { invoke } from "@tauri-apps/api/core";
import type { Server, ServerInfo, AddServerPayload, ServerMetrics, MetricsPoint, ToolCheckResult, ToolMeta } from "@/types";

export async function addServer(payload: AddServerPayload): Promise<string> {
  return invoke("add_server", { payload });
}

export async function getServers(): Promise<Server[]> {
  return invoke("get_servers");
}

export async function deleteServer(id: string): Promise<void> {
  return invoke("delete_server", { id });
}

export async function testConnection(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
}): Promise<string> {
  return invoke("test_connection", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
  });
}

export async function getServerMetrics(serverId: string): Promise<ServerMetrics> {
  return invoke("get_server_metrics", { serverId });
}

export async function checkEnvTools(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
  tools: string[];
}): Promise<ToolCheckResult[]> {
  return invoke("check_env_tools", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
    tools: params.tools,
  });
}

export async function installEnvTool(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
  tool: string;
  eventId: string;
}): Promise<void> {
  return invoke("install_env_tool", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
    tool: params.tool,
    eventId: params.eventId,
  });
}

export async function listSupportedTools(): Promise<ToolMeta[]> {
  return invoke("list_supported_tools");
}

export async function runAptUpdate(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
  eventId: string;
}): Promise<void> {
  return invoke("run_apt_update", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
    eventId: params.eventId,
  });
}

export async function fetchServerInfo(serverId: string): Promise<ServerInfo> {
  return invoke("fetch_server_info", { serverId });
}

export async function saveMetricsSnapshot(params: {
  serverId: string;
  cpuPercent: number;
  ramPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskPercent: number;
}): Promise<void> {
  return invoke("save_metrics_snapshot", {
    serverId: params.serverId,
    cpuPercent: params.cpuPercent,
    ramPercent: params.ramPercent,
    ramUsedMb: params.ramUsedMb,
    ramTotalMb: params.ramTotalMb,
    diskPercent: params.diskPercent,
  });
}

export async function getMetricsHistory(
  serverId: string,
  hours?: number,
): Promise<MetricsPoint[]> {
  return invoke("get_metrics_history", { serverId, hours: hours ?? 24 });
}
