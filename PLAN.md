# VMS Deploy Tools — Implementation Plan

> Đọc docs/PRD.md để biết full spec trước khi làm bất kỳ task nào.

---

## ⚠️ RULES BẮT BUỘC

### Rule 1 — Context Window Emergency (QUAN TRỌNG NHẤT)
Khi đã dùng **≥ 90% context window**:
1. **DỪNG NGAY** — không tiếp tục code thêm
2. Lưu trạng thái vào `docs/sessions/SESSION_LATEST.md` (xem format bên dưới)
3. Cập nhật task hiện tại sang `[ ] IN_PROGRESS` trong PLAN.md
4. Thông báo: `⚠️ CONTEXT 90% — Session saved. Run: claude --continue`

**Format SESSION_LATEST.md:**
```
## Session State
DATE: YYYY-MM-DD HH:MM
TASK_ID: T0X
TASK_NAME: ...
COMPLETED_SUBTASKS:
  - [x] subtask A
  - [x] subtask B
CURRENT_SUBTASK: subtask C — dừng ở dòng N file X
NEXT_SUBTASK: subtask D
FILES_MODIFIED:
  - path/to/file.rs
  - path/to/file.tsx
BLOCKED_BY: —
NOTES: ...
```

### Rule 2 — Task Report
Sau mỗi task hoàn thành, tạo `docs/tasks/Task-XX.md`:
```
## Task-XX: [Tên task]
STATUS: DONE
DATE: YYYY-MM-DD
FILES_CREATED: [list]
FILES_MODIFIED: [list]
NOTES: [ghi chú quan trọng]
NEXT_TASK: T0Y — [tên]
```

### Rule 3 — Checkpoint sau mỗi task
Sau mỗi task: cập nhật PLAN.md (đổi `[ ]` → `[x]`), update CLAUDE.md Session Checkpoint.

### Rule 4 — Verify trước khi commit
Mỗi sprint: chạy `npx tsc --noEmit` + `cargo check` — fix hết lỗi trước khi commit.

---

## TRẠNG THÁI HIỆN TẠI

**Scaffold: ✅ HOÀN THÀNH**
- Tauri 2.0 + React 18 + TypeScript
- shadcn/ui (19 components) + TailwindCSS dark mode
- Zustand + React Router v6 (5 routes: /, /setup, /update, /monitor, /audit)
- Rust deps: russh, sqlx, tokio, aes-gcm, tracing, thiserror
- DB migration schema: servers, deploy_history, snapshots
- Folder structure: pages/, components/, store/, lib/tauri/, types/, ssh/, scp/, db/, commands/

---

## SPRINT S1 — SSH Core Rust (Tuần 1-2)

**Milestone:** App chạy, kết nối SSH được, hiển thị server info.

### Rust Backend

- [ ] **T01** — Error types + Tracing setup
  - `src-tauri/src/error.rs`: thiserror AppError enum
  - `src-tauri/src/lib.rs`: init tracing_subscriber
  - Subtasks: error.rs → lib.rs tracing init → cargo check

- [ ] **T02** — DB initialization module
  - `src-tauri/src/db/mod.rs`: SqlitePool init, run migrations
  - AppData path: `%APPDATA%/VMS-Tool/db/servers.db`
  - Subtasks: db/mod.rs → pool init fn → migrate fn → cargo check

- [ ] **T03** — Credential encryption (AES-256-GCM)
  - `src-tauri/src/crypto.rs`: encrypt/decrypt fn
  - Key derivation từ fixed app secret + machine ID
  - Subtasks: crypto.rs → test encrypt/decrypt → cargo check

- [ ] **T04** — Server CRUD (sqlx)
  - `src-tauri/src/db/server_repo.rs`: insert, get_all, get_by_id, delete, update_last_seen
  - Subtasks: structs → insert → get_all → get_by_id → delete → cargo check

- [ ] **T05** — SSH connect module (russh)
  - `src-tauri/src/ssh/mod.rs`: SshSession struct, connect(), disconnect()
  - Support: password auth + key auth
  - Timeout: 10s
  - Subtasks: SshSession struct → connect_password → connect_key → disconnect → cargo check

- [ ] **T06** — SSH execute command
  - `src-tauri/src/ssh/mod.rs`: execute(cmd) → String output
  - Subtasks: execute fn → cargo check

- [ ] **T07** — Server info fetch (SSH)
  - `src-tauri/src/ssh/server_info.rs`: fetch OS, CPU cores, RAM, Disk, network
  - Commands: `uname -a`, `nproc`, `free -m`, `df -h`, `hostname`
  - Subtasks: ServerInfo struct → fetch_server_info fn → cargo check

- [ ] **T08** — Tauri IPC Commands (Rust)
  - `src-tauri/src/commands/server.rs`: add_server, get_servers, delete_server, test_connection, fetch_server_info
  - Signature: `async fn cmd(state, args) -> Result<T, String>`
  - Register vào lib.rs invoke_handler
  - Subtasks: server.rs → test_connection cmd → add_server cmd → get_servers cmd → delete_server cmd → fetch_server_info cmd → register → cargo check

### Frontend

- [ ] **T09** — TypeScript types update
  - `src/types/index.ts`: hoàn thiện Server, ServerInfo, DeployHistory, Snapshot types
  - Subtasks: update types → tsc check

- [ ] **T10** — TypeScript command wrappers
  - `src/lib/tauri/commands.ts`: typed wrappers cho tất cả T08 commands
  - Subtasks: wrapper fns → tsc check

- [ ] **T11** — Zustand serverStore
  - `src/store/serverStore.ts`: servers[], addServer, removeServer, setServerInfo
  - Subtasks: store state → actions → tsc check

- [ ] **T12** — Add Server Dialog UI
  - `src/components/AddServerDialog.tsx`
  - Fields: Name, Host, Port (22), Username, Auth type (password/key), Group
  - Password: toggle show/hide (bắt buộc)
  - [Test Connection] button → loading → result (OK / error message)
  - Subtasks: dialog shell → form fields → password toggle → test connection → tsc check

- [ ] **T13** — Server list + Home page
  - `src/pages/Home.tsx`: server list theo tabs (Production/Staging/Lab/All)
  - Mỗi row: status dot, Name, Host, Group, Actions (Info, Delete)
  - [+ Add Server] button → AddServerDialog
  - Subtasks: Home layout → tabs → server row → add button → tsc check

- [ ] **T14** — Server Info panel
  - `src/components/ServerInfoPanel.tsx`: OS, CPU, RAM, Disk
  - Trigger: click server row → fetch info → hiển thị
  - Subtasks: panel UI → fetch on click → tsc check

- [ ] **T15** — Verify S1
  - `npx tsc --noEmit` → 0 errors
  - `cargo check` → clean
  - Manual test: add server → test connection → view info

- [ ] **T16** — Git commit S1
  - `git commit -m "feat(s1): SSH core — connect, server CRUD, server info"`

---

## SPRINT S2 — Server Dashboard + Env Check (Tuần 3-4)

**Milestone:** Home screen hoàn chỉnh, check môi trường server.

- [ ] **T17** — Server status polling (30s)
  - SSH `vmstat`, `free -m`, `df -h` → CPU%, RAM bar, Disk%
  - Status dot: 🟢/🟡/🔴 logic
  - `src/store/monitorStore.ts`

- [ ] **T18** — Env Check UI (Bước 2 Wizard)
  - `src/pages/Setup.tsx` → Bước 2 panel
  - Checklist: Docker, Docker Compose, Git, curl, .NET SDK, FFmpeg, OpenSSL, jq, htop, unzip
  - [Check All]: parallel SSH, spinner per item, version hoặc ❌
  - [Install Missing]: streaming log qua xterm.js

- [ ] **T19** — Terminal component (xterm.js)
  - `src/components/Terminal.tsx`: xterm.js + addon-fit
  - Tauri event listener → write to terminal
  - Rust: emit streaming output line by line

- [ ] **T20** — Verify S2 + Git commit

---

## SPRINT S3 — Wizard Bước 3-4: Networks + Externals (Tuần 5-6)

**Milestone:** Deploy được MinIO + RabbitMQ.

- [ ] **T21** — StepWizard component (7 steps)
  - `src/components/StepWizard.tsx`: step indicator, next/back
  - `src/store/wizardStore.ts`: full state

- [ ] **T22** — Bước 3: Docker Networks
  - Dynamic list input, validate lowercase, [Create All] SSH command

- [ ] **T23** — Bước 4: External Services
  - 2-column layout: available list / selected + config
  - Source: Online pull / Offline .tar
  - SCP upload folder → `{root}/external/{service}/`

- [ ] **T24** — SCP module (russh-sftp)
  - `src-tauri/src/scp/mod.rs`: upload file/folder, progress events
  - Tauri emit progress → React progress bar

- [ ] **T25** — Verify S3 + Git commit

---

## SPRINT S4 — ENV Config + vms.env (Tuần 7-8)

**Milestone:** File vms.env sinh đúng.

- [ ] **T26** — Bước 5: ENV Configuration UI
  - Tab bar per service, form fields per ENV var
  - Auto-fill từ server info
  - [Preview vms.env] modal

- [ ] **T27** — vms.env generation (Rust)
  - Command: generate_vms_env → write file qua SCP
  - Template: key=value per line, grouped by service

- [ ] **T28** — Verify S4 + Git commit

---

## SPRINT S5 — App Deploy + Rollback (Tuần 9-11)

**Milestone:** Deploy 1 app, rollback OK.

- [ ] **T29** — Bước 6: Applications UI
  - Source: Online/Offline/.tar/Git
  - Generate Combined Compose

- [ ] **T30** — Bước 7: Deploy Execution
  - Deployment Plan UI với step badges
  - Terminal streaming realtime
  - [Pause]/[Cancel]

- [ ] **T31** — Snapshot + Rollback
  - Auto snapshot sau deploy success
  - `src-tauri/src/db/snapshot_repo.rs`
  - Rollback flow: compose down → restore → compose up

- [ ] **T32** — Update page (FR-03)
  - Multi-tab per server
  - Module list: container status, image tag, uptime
  - [Rollback] dropdown 5 versions

- [ ] **T33** — Verify S5 + Git commit

---

## SPRINT S6 — Monitor + Logs (Tuần 12-14)

**Milestone:** Live logs, metrics realtime.

- [ ] **T34** — Monitor page (FR-04)
  - Server group tabs + server sub-tabs
  - CPU gauge, RAM bar, Disk per partition
  - Auto-refresh 5s

- [ ] **T35** — Container table
  - Name, Image, Status badge, CPU%, RAM, Uptime
  - [Logs][Restart][Stop] per container
  - Confirm dialog: Restart, Stop

- [ ] **T36** — Log streaming (docker logs -f)
  - xterm.js panel, Tauri event stream
  - [Pause/Resume][Clear][Download][Tail: 100/200/500]
  - Text search + highlight

- [ ] **T37** — Verify S6 + Git commit

---

## SPRINT S7 — Audit + Polish (Tuần 15-16)

**Milestone:** v1.0 production ready.

- [ ] **T38** — Audit Log page (FR-07)
  - Table: action, server, operator_ip, deployed_at, status
  - Filter: server, IP, date range, action, status
  - Full-text search log_output
  - Export CSV

- [ ] **T39** — Security hardening
  - Confirm dialogs: delete server, rollback, stop container, remove service
  - Password never in logs/terminal
  - Error boundaries tất cả pages

- [ ] **T40** — Polish + Performance
  - Loading states tất cả async ops
  - Error messages user-friendly
  - Window title + app icon
  - Memory check: < 200MB

- [ ] **T41** — Final verify + Git tag v1.0
  - tsc --noEmit PASS
  - cargo check PASS
  - `git tag v1.0.0`

---

## PROGRESS TRACKER

| Sprint | Status | Tasks |
|--------|--------|-------|
| Scaffold | ✅ DONE | Tất cả deps + folder structure |
| S1 — SSH Core | ✅ DONE | T01–T16 |
| S2 — Dashboard | ✅ DONE | T17–T20 |
| S3 — Wizard 3-4 | 🔄 NEXT | T21–T25 |
| S4 — ENV | ⏳ | T26–T28 |
| S5 — Deploy | ⏳ | T29–T33 |
| S6 — Monitor | ⏳ | T34–T37 |
| S7 — Audit | ⏳ | T38–T41 |

---

## SESSION HISTORY

| Session | Date | Tasks Done | Last Task |
|---------|------|-----------|-----------|
| S00 | 2026-05-07 | Scaffold hoàn chỉnh (12 bước) | Git push |

---

*File này được cập nhật sau mỗi task. Đừng sửa thủ công.*
