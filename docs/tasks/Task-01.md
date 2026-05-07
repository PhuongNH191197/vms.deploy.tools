## Task-01: Error types + Tracing setup

STATUS: DONE
DATE: 2026-05-07

FILES_CREATED:
  - src-tauri/src/error.rs     — AppError enum (thiserror): Ssh, Scp, Db, Crypto, Io, Json, NotFound, InvalidInput, Other
  - src-tauri/src/crypto.rs    — placeholder cho T03

FILES_MODIFIED:
  - src-tauri/src/lib.rs       — thêm mod declarations + tracing_subscriber init

NOTES:
  - AppError impl From<AppError> for String để dùng trong Tauri commands (Result<T, String>)
  - Tracing filter: RUST_LOG env hoặc default "vms_deploy_tools=debug"
  - cargo check: PASS

NEXT_TASK: T02 — DB initialization module
