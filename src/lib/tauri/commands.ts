import { invoke } from "@tauri-apps/api/core";
import type { Server, ServerInfo, AddServerPayload, ServerMetrics, ToolCheckResult } from "@/types";

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

export async function getServerMetrics(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
}): Promise<ServerMetrics> {
  return invoke("get_server_metrics", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
  });
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

export async function fetchServerInfo(params: {
  host: string;
  port: number;
  username: string;
  authType: string;
  credential: string;
  serverId?: string;
}): Promise<ServerInfo> {
  return invoke("fetch_server_info", {
    host: params.host,
    port: params.port,
    username: params.username,
    authType: params.authType,
    credential: params.credential,
    serverId: params.serverId ?? null,
  });
}
