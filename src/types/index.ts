// Shared TypeScript interfaces — mirrors Rust structs

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
  server_count: number;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  group_name: string;
  last_seen: string | null;
  project_id: string | null;
}

export interface ServerInfo {
  hostname: string;
  os: string;
  kernel: string;
  cpu_cores: number;
  ram_total_mb: number;
  ram_used_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  uptime_seconds: number;
}

export interface AddServerPayload {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  credential: string;
  group_name: string;
  project_id: string | null;
}

export interface DeployHistory {
  id: string;
  server_id: string;
  module_name: string;
  module_version: string;
  action: "install" | "update" | "rollback" | "remove";
  status: "success" | "failed" | "in_progress";
  operator_ip: string;
  operator_host: string;
  snapshot_path: string | null;
  log_output: string | null;
  deployed_at: string;
}

export interface Snapshot {
  id: string;
  deploy_id: string;
  server_id: string;
  module_name: string;
  compose_backup: string;
  image_tag: string;
  created_at: string;
}

export interface ServerMetrics {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  ram_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  uptime_seconds?: number;
}

export interface MetricsPoint {
  id: string;
  server_id: string;
  cpu_percent: number;
  ram_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_percent: number;
  recorded_at: string;
}

export interface ToolCheckResult {
  name: string;
  installed: boolean;
  version: string | null;
}

export interface ToolMeta {
  name: string;
  description: string;
}

export type ServerGroup = "production" | "staging" | "lab" | "all";
export type AuthType = "password" | "key";
export type ServerStatus = "online" | "warning" | "offline" | "unknown";
