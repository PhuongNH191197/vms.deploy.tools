import { invoke } from "@tauri-apps/api/core";
import type { Server, ServerInfo, AddServerPayload } from "@/types";

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
