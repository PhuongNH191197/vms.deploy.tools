mod error;
mod crypto;
mod ssh;
pub mod scp;
mod db;
mod commands;

use commands::server::{DbState, add_server, get_servers, delete_server, test_connection, fetch_server_info, get_server_metrics};
use commands::env_check::{check_env_tools, install_env_tool};
use commands::wizard::{create_docker_networks, upload_path, write_vms_env, write_remote_file};
use commands::deploy::{run_ssh_stream, run_deploy_step, save_deploy_record, get_deploy_history, get_snapshots, rollback_deployment, get_audit_logs};
use commands::monitor::{LogStreamState, get_container_info, stream_container_logs, stop_log_stream, docker_container_action, save_metrics_snapshot, get_metrics_history};
use commands::templates::{get_template_config, save_template_config, list_template_files, sync_git_templates};
use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("vms_deploy_tools=debug".parse().unwrap()),
        )
        .with_target(false)
        .init();

    let pool = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(db::init_db())
        .expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(DbState(pool))
        .manage(LogStreamState::new())
        .invoke_handler(tauri::generate_handler![
            add_server,
            get_servers,
            delete_server,
            test_connection,
            fetch_server_info,
            get_server_metrics,
            check_env_tools,
            install_env_tool,
            create_docker_networks,
            upload_path,
            write_vms_env,
            write_remote_file,
            run_ssh_stream,
            run_deploy_step,
            save_deploy_record,
            get_deploy_history,
            get_snapshots,
            rollback_deployment,
            get_container_info,
            stream_container_logs,
            stop_log_stream,
            docker_container_action,
            get_audit_logs,
            save_metrics_snapshot,
            get_metrics_history,
            get_template_config,
            save_template_config,
            list_template_files,
            sync_git_templates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
