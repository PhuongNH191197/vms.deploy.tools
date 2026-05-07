mod error;
mod crypto;
mod ssh;
mod scp;
mod db;
mod commands;

use commands::server::{DbState, add_server, get_servers, delete_server, test_connection, fetch_server_info, get_server_metrics};
use commands::env_check::{check_env_tools, install_env_tool};
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
        .invoke_handler(tauri::generate_handler![
            add_server,
            get_servers,
            delete_server,
            test_connection,
            fetch_server_info,
            get_server_metrics,
            check_env_tools,
            install_env_tool,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
