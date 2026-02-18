# OpenT A2L-Forge — Agent Conventions

## Project Overview

Tauri v2 desktop app for editing ASAP2/A2L calibration files with ELF binary import.

- **Frontend:** React + TypeScript + MUI (Material UI)
- **Backend:** Rust (Tauri v2 commands)
- **Test framework:** Playwright (E2E), cargo test (Rust integration)

## Architecture

| Path | Role |
|------|------|
| `src/App.tsx` | Main frontend — all views, state, handlers |
| `src/components/editors/` | Entity editors (Measurement, Characteristic, AxisPts) |
| `src-tauri/src/lib.rs` | Rust backend — core functions + Tauri command wrappers |
| `src-tauri/tests/integration.rs` | Rust integration tests using real fixture files |
| `tests/e2e/` | Playwright E2E tests (real binary via CDP) |
| `external/a2ltool/fixtures/` | A2L fixture files |
| `docs/srs/` | SRS requirement documents |

## Build & Run

```bash
npm run dev              # Start Vite dev server (frontend only)
npm run tauri dev        # Start full Tauri app (frontend + backend)
npm run tauri build      # Build release binary
```

## Test Commands

```bash
# Rust integration tests
cargo test --manifest-path src-tauri/Cargo.toml

# Playwright E2E tests (requires release binary built first)
npx playwright test
```

## Conventions

- **NO MOCKS**: E2E tests must NEVER use mocked backends. All Playwright tests must run against the real release executable (.exe) using real files on the filesystem. The mock test project and `mocks.ts` are banned — do not create or use them.
- **E2E tests**: Only use `--project=binary` (real Tauri binary via CDP). Tests must use real A2L and ELF fixture files.
- **data-testid**: All interactive UI elements must have `data-testid` attributes. Tests use `page.getByTestId()`.
- **SRS docs**: Stored in `docs/srs/SRS-R[N]-*.md`. Index at `docs/srs/SRS-INDEX.md`.
- **PLAN.md**: Must be updated in realtime for each task or subtask accomplished.
- **Smoke test**: Always run `npm run dev` or `npm run tauri dev` before reporting completion to verify no crashes.
- **Fixtures**: A2L fixtures in `external/a2ltool/fixtures/a2l/`, ELF fixtures in `external/a2ltool/fixtures/elf/`.
- **Core functions**: Backend logic is in `core_*` functions (no Tauri dependency). Tauri commands are thin wrappers.
- **TaskList/TodoList**: Always use TaskCreate/TaskUpdate/TaskList tools to track work progress. Never work without a task list.
- **SRS references**: Always refer to existing SRS documents and update them when features change. Create new SRS docs for new features.
- **PLAN.md format**: Always update PLAN.md by appending sub-iterations at the bottom. Use only checklist elements (`- [x]`/`- [ ]`) and version summary one-liners. Never rewrite existing entries.
