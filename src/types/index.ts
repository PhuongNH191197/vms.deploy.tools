// Shared TypeScript interfaces — mirrors Rust structs

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  group_name: string;
  last_seen: string | null;
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
  disk_percent: number;
}
