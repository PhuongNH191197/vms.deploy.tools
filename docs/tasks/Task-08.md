## Task-08: Tauri IPC Commands (Rust)

STATUS: DONE
DATE: 2026-05-07

FILES_MODIFIED:
  - src-tauri/src/commands/mod.rs   — pub mod server
  - src-tauri/src/lib.rs            — DbState init + register all commands

FILES_CREATED:
  - src-tauri/src/commands/server.rs — 5 commands: add_server, get_servers, delete_server, test_connection, fetch_server_info

NOTES:
  - DbState wraps SqlitePool, managed via tauri::State
  - DB initialized at startup via block_on(db::init_db())
  - All commands: async fn → Result<T, String> (Tauri requirement)
  - Credential encrypted before DB insert
  - test_connection: SSH → echo OK → disconnect
  - fetch_server_info: SSH connect → fetch → update last_seen → disconnect
  - cargo check: PASS

NEXT_TASK: T09 — TypeScript types update
