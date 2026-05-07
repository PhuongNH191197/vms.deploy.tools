## Task-04: Server CRUD (sqlx)

STATUS: DONE (completed in T02)
DATE: 2026-05-07

FILES_CREATED:
  - src-tauri/src/db/server_repo.rs — ServerRow, CreateServerInput, 5 CRUD functions

NOTES:
  - Done together with T02 (DB init)
  - Functions: insert_server, get_all_servers, get_by_id, delete_server, update_last_seen
  - All use prepared statements (sqlx query/query_as macros)
  - cargo check: PASS

NEXT_TASK: T05 — SSH connect module
