# SRS-R5: ELF File Watching & ECU Address Update

**Status:** Implemented
**Priority:** Medium
**Category:** File Monitoring / Data Sync

## 1. Requirement

The application shall monitor loaded ELF files for changes on disk and provide a mechanism to synchronize ECU addresses between ELF symbols and A2L measurements.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R5.1 | After loading an ELF file, the application watches it for modifications. |
| R5.2 | When the ELF file changes, a notification banner appears in the ELF view. |
| R5.3 | The banner offers "Reload" and "Dismiss" actions. |
| R5.4 | An "Update ECU Addresses" button matches A2L measurements to ELF symbols by name. |
| R5.5 | The update reports how many addresses were updated. |
| R5.6 | Loading a new ELF file stops the previous file watcher. |

## 3. Technical Approach

- Added `notify = "6"` crate for cross-platform file watching.
- `AppState` extended with `elf_path`, `elf_symbols_cache`, and `watcher_shutdown` channel.
- `load_elf_symbols` spawns a watcher thread that emits `elf-changed` events via Tauri's event system.
- `update_ecu_addresses` command matches measurement names to cached ELF symbols and updates addresses.
- Frontend listens for `elf-changed` events and displays a notification banner.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Rust watcher + command | `src-tauri/src/lib.rs` |
| Frontend event listener | `src/App.tsx` (useEffect for elf-changed) |
| UI controls | `src/App.tsx` (Update ECU Addresses button, banner) |
| E2E test | `tests/e2e/elf-watcher.spec.ts` |
