import { invoke } from "@tauri-apps/api/core";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CheckInstallResult {
  installed: boolean;
  version: string | null;
  error: string | null;
}

export interface RegisterRunnerInput {
  server_id: string;
  gitlab_url: string;
  registration_token: string;
  runner_name: string;
  tags: string;
  maintenance_note: string;
  project_name: string;
}

export interface RegisterRunnerResult {
  success: boolean;
  runner_id_local: number;
  message: string;
}

export interface SetupGitAuthInput {
  server_id: string;
  gitlab_url: string;
  git_username: string;
  git_password: string;
  test_repo_url: string;
}

export interface ScannedRunner {
  runner_name: string;
  tags: string;
  executor: string;
  gitlab_url: string;
  token_masked: string;
}

export interface ListRunnersFilter {
  server_id?: string;
  project_name?: string;
  status?: string;
  search?: string;
}

export interface GitLabRunnerDto {
  id: number;
  server_id: string;
  server_name: string;
  project_name: string;
  runner_name: string;
  tags: string;
  executor: string;
  gitlab_url: string;
  token_masked: string;
  status: "online" | "offline" | "running" | "unknown";
  last_job_status: string;
  last_checked_at: string | null;
  created_at: string;
}

export interface JobInfo {
  job_id: number;
  job_name: string;
  pipeline_id: number;
  branch: string;
  started_at: string;
  duration_secs: number | null;
  web_url: string;
}

export interface RunnerStatusResult {
  runner_id_local: number;
  status: "online" | "offline" | "running";
  active_jobs: JobInfo[];
}

export interface GitLabApiSettingsInput {
  gitlab_url: string;
  api_token: string;
  description: string;
}

export interface GitLabApiSettingsDto {
  id: number;
  gitlab_url: string;
  description: string;
  has_token: boolean;
  created_at: string;
  updated_at: string;
}

export interface BatchInstallResult {
  server_id: string;
  server_name: string;
  success: boolean;
  version: string | null;
  error: string | null;
}

export interface SingleRunnerConfig {
  server_id: string;
  runner_name: string;
  tags: string;
  maintenance_note: string;
}

export interface BatchRegisterInput {
  gitlab_url: string;
  registration_token: string;
  project_name: string;
  runners: SingleRunnerConfig[];
}

export interface BatchRegisterResult {
  server_id: string;
  server_name: string;
  success: boolean;
  runner_id_local: number | null;
  error: string | null;
}

export interface SingleGitAuthConfig {
  server_id: string;
  gitlab_url: string;
  test_repo_url: string;
}

export interface BatchGitAuthInput {
  git_username: string;
  git_password: string;
  setups: SingleGitAuthConfig[];
}

export interface BatchGitAuthResult {
  server_id: string;
  server_name: string;
  success: boolean;
  error: string | null;
}

// ── Commands ──────────────────────────────────────────────────────────────────

export async function checkGitlabRunnerInstalled(
  serverId: string
): Promise<CheckInstallResult> {
  return invoke("check_gitlab_runner_installed", { serverId });
}

export async function installGitlabRunner(serverId: string): Promise<void> {
  return invoke("install_gitlab_runner", { serverId });
}

export async function registerGitlabRunner(
  payload: RegisterRunnerInput
): Promise<RegisterRunnerResult> {
  return invoke("register_gitlab_runner", { payload });
}

export async function setupGitAuth(
  payload: SetupGitAuthInput
): Promise<void> {
  return invoke("setup_git_auth", { payload });
}

export async function scanRunnersFromServer(
  serverId: string
): Promise<ScannedRunner[]> {
  return invoke("scan_runners_from_server", { serverId });
}

export async function listGitlabRunners(
  filter?: ListRunnersFilter
): Promise<GitLabRunnerDto[]> {
  return invoke("list_gitlab_runners", { filter: filter ?? null });
}

export async function checkRunnerStatus(
  runnerIdLocal: number
): Promise<RunnerStatusResult> {
  return invoke("check_runner_status", { runnerIdLocal });
}

export async function saveGitlabApiSettings(
  payload: GitLabApiSettingsInput
): Promise<number> {
  return invoke("save_gitlab_api_settings", { payload });
}

export async function getGitlabApiSettings(
  gitlabUrl: string
): Promise<GitLabApiSettingsDto | null> {
  return invoke("get_gitlab_api_settings", { gitlabUrl });
}

export async function batchInstallGitlabRunner(
  serverIds: string[]
): Promise<BatchInstallResult[]> {
  return invoke("batch_install_gitlab_runner", { serverIds });
}

export async function batchRegisterGitlabRunner(
  payload: BatchRegisterInput
): Promise<BatchRegisterResult[]> {
  return invoke("batch_register_gitlab_runner", { payload });
}

export async function batchSetupGitAuth(
  payload: BatchGitAuthInput
): Promise<BatchGitAuthResult[]> {
  return invoke("batch_setup_git_auth", { payload });
}

export interface DeleteRunnerResult {
  unregistered_on_server: boolean;
  unregister_error: string | null;
}

export async function deleteGitlabRunner(
  runnerIdLocal: number
): Promise<DeleteRunnerResult> {
  return invoke("delete_gitlab_runner", { runnerIdLocal });
}

export async function getGitlabProjectNames(): Promise<string[]> {
  return invoke("get_gitlab_project_names");
}
