<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

---

# VMS Deployment Tool — Project Memory

## Project
Desktop app Windows: DevOps deploy 20+ Linux servers qua SSH.
Stack: Tauri 2.0 + React 18 + TypeScript + Rust backend.
File: docs/PRD.md — đọc file này để biết full spec.

## Architecture Law (KHÔNG BAO GIỜ VI PHẠM)
- RUST = SSH, SCP, SQLite, file I/O, encryption, process exec
- REACT = TẤT CẢ UI, state, routing, display
- IPC = Tauri invoke() + events. KHÔNG làm SSH trong React.

## Rust Rules
- Tauri commands: luôn Result<T, String>, KHÔNG unwrap()
- SQL: sqlx prepared statements, KHÔNG string concat
- Log: tracing crate, KHÔNG BAO GIỜ log password/secret/token
- Credentials: AES-256-GCM encrypt trước khi lưu DB
- Errors: dùng thiserror crate

## React Rules
- Functional components + hooks only
- shadcn/ui cho components, TailwindCSS cho styles
- Zustand cho global state
- invoke() chỉ trong src/lib/tauri/commands.ts
- Error boundary ở mọi page-level component

## Security Rules
- Password fields: toggle show/hide bắt buộc
- Confirm dialog: delete, rollback, stop container, remove
- Audit log: auto capture operator_ip + hostname

## Sprint Hiện Tại
SPRINT: P3 — DONE (production ready)
FOCUS: —
STATUS: ✅ COMPLETE

## Progress Tracker
- [x] S1: SSH core + Server CRUD + UI DONE. Committed feat(s1).
- [x] S2: Server Dashboard + Env Check UI DONE. Committed feat(s2).
- [x] S3: Wizard 7 steps + SCP module DONE. Committed feat(s3).
- [x] S4: ENV Config + vms.env generation DONE. Committed feat(s4).
- [x] S5: App deploy + Rollback + Update page DONE. Committed feat(s5).
- [x] S6: Monitor + Logs xterm.js DONE. Committed feat(s6).
- [x] S7: Audit log + Multi-tab + Polish DONE. Committed feat(s7).

## Token Warning Rule
Khi còn khoảng 20% context window:
1. Dừng lại, KHÔNG tiếp tục code
2. Cập nhật section "Session Checkpoint" bên dưới
3. Thông báo: "⚠️ TOKEN THẤP — Đã lưu checkpoint. Chạy claude --continue để tiếp tục."

## Session Checkpoint
LAST_ACTION: Testing wizard Step1→Step7 với Docker server 127.0.0.1:2222 — fix loạt bugs UX + install reliability
CURRENT_FILE: —
NEXT_STEP: Test tiếp Step3→Step7 end-to-end (Step1+Step2 đã pass). Cần build lại app trước khi test (có thay đổi Rust).
BLOCKED_BY: —
NOTES: tsc 0 errors, cargo check 0 errors 4 pre-existing warnings. Chưa commit session hôm nay.

### Test environment (Docker server):
- Container: `vms-test-server` → `127.0.0.1:2222`, root/Elcom@123
- Image: rastasheep/ubuntu-sshd:18.04 + docker socket mount + docker CLI v20.10 + docker-compose v5.1.3
- Compose test file: `C:\test-vms\minio\docker-compose.yml`
- Start container nếu tắt: `docker start vms-test-server`

### Bugs đã fix SESSION HÔM NAY (2026-05-08):
1. **Step3 không skip được** — `disabled={!allOk && networkResults.length === 0}` → `disabled={validInputs.length > 0 && !allOk}`
2. **Step4 không skip được** — bỏ `disabled={selected.length === 0}`
3. **Step7 không upload docker-compose.yml cho apps** — extract `generateCombinedCompose` → `src/lib/composeGenerator.ts`, Step7 auto-upload trước khi chạy app commands
4. **Step2 Install All chạy parallel** — rewrite hoàn toàn: sequential `for...of await`, log panel tích lũy, per-tool recheck ngay sau install → checkmark xanh tức thì
5. **install_env_tool luôn return Ok(()) dù fail** — giờ return `Err` khi output chứa `__ERROR__` → frontend log `✗ failed` đúng
6. **dpkg lock khi install** — Ubuntu 18.04 background `unattended-upgrades` giữ lock → fix: `apt_retry()` dùng `flock -w 60s` chờ lock free thay vì kill process
7. **apt-get update chạy N lần** — tách thành `run_apt_update` Tauri command, chạy 1 lần trước toàn bộ install loop; mỗi tool chỉ `apt-get install`

### Files thay đổi SESSION HÔM NAY:
- `src/components/wizard/Step2EnvCheck.tsx` — rewrite hoàn toàn (sequential install, real-time log, per-tool recheck)
- `src/components/wizard/Step3Networks.tsx` — fix skip condition
- `src/components/wizard/Step4Externals.tsx` — bỏ mandatory disabled
- `src/components/wizard/Step7Deploy.tsx` — auto-upload compose cho apps, import composeGenerator
- `src/components/wizard/Step6Apps.tsx` — import từ composeGenerator thay vì define local
- `src/lib/composeGenerator.ts` — NEW: shared generateCombinedCompose utility
- `src/lib/tauri/commands.ts` — thêm `runAptUpdate`
- `src-tauri/src/commands/env_check.rs` — apt_retry(), apt_update_cmd(), run_apt_update command, install_env_tool return Err on fail, install_command return Option<String>
- `src-tauri/src/lib.rs` — register run_apt_update
- `build-release.bat` — NEW: one-click build .msi + .exe

### Bugs đã fix SESSION TRƯỚC (tham khảo):
1. Step2 EnvCheck sai kết quả — `command -v` gate
2. Install tool báo Done nhưng chưa cài — root detection, DEBIAN_FRONTEND
3. Tool list cứng frontend → backend-driven list_supported_tools()
4. Nút "← Home" thiếu ở Setup page
5. docker-compose.yml không upload — Step7 upload tar + compose trước docker commands
6. tarPath hardcoded sai
7. composeFolderPath chỉ show offline
8. SFTP file không flush — file.shutdown().await
