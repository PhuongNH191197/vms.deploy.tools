## Task-02: DB initialization module

STATUS: DONE
DATE: 2026-05-07

FILES_MODIFIED:
  - src-tauri/src/db/mod.rs       — init_db(), run_migrations(), get_db_path()

FILES_CREATED:
  - src-tauri/src/db/server_repo.rs — ServerRow, CreateServerInput, insert/get_all/get_by_id/delete/update_last_seen

NOTES:
  - DB path: %APPDATA%/VMS-Tool/db/servers.db (auto-create dir)
  - sqlx::migrate! path: ./src/db/migrations (relative to Cargo.toml)
  - SqlitePool: max_connections=5, mode=rwc (create if not exist)
  - cargo check: PASS

NEXT_TASK: T03 — Credential encryption (AES-256-GCM)
