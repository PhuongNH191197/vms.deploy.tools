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
SPRINT: S1 — Tuần 1-2
FOCUS: Project scaffold + SSH Core Rust
STATUS: 🔄 IN PROGRESS
NEXT: Viết src-tauri/src/ssh/mod.rs

## Progress Tracker
- [x] S1: SSH core + Server CRUD + UI DONE. Committed feat(s1).
- [x] S2: Server Dashboard + Env Check UI DONE. Committed feat(s2).
- [x] S3: Wizard 7 steps + SCP module DONE. Committed feat(s3).
- [ ] S4: ENV Config + vms.env generation
- [ ] S5: App module deploy + Rollback
- [ ] S6: Monitor + Logs xterm.js
- [ ] S7: Audit log + Multi-tab + Polish

## Token Warning Rule
Khi còn khoảng 20% context window:
1. Dừng lại, KHÔNG tiếp tục code
2. Cập nhật section "Session Checkpoint" bên dưới
3. Thông báo: "⚠️ TOKEN THẤP — Đã lưu checkpoint. Chạy claude --continue để tiếp tục."

## Session Checkpoint
LAST_ACTION: Sprint S3 hoàn thành — Setup.tsx wizard container, Steps 1-7, SCP module, upload_path command
CURRENT_FILE: —
NEXT_STEP: Sprint S4 — ENV Config UI + vms.env generation
BLOCKED_BY: —
NOTES: tsc PASS, cargo check 0 errors 5 warnings. feat(s3) committed 19 files. Steps 5-7 are placeholders.
