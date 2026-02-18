# SRS-R2: ELF File Dialog

**Status:** Implemented
**Priority:** High
**Category:** Platform Integration

## 1. Requirement

The application shall present a native OS file picker dialog when the user requests to load an ELF binary file.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R2.1 | Clicking "Load ELF Binary" opens the native OS file picker. |
| R2.2 | The dialog filters for ELF file extensions (`.elf`, `.out`, `.bin`, `.axf`) by default. |
| R2.3 | Selecting a valid ELF file loads and displays its symbol table. |
| R2.4 | No permission errors appear in the console when opening the dialog. |

## 3. Technical Approach

- Added `dialog:default` permission to `src-tauri/capabilities/default.json`, granting `allow-open`, `allow-save`, `allow-ask`, `allow-confirm`, and `allow-message`.
- The `tauri-plugin-dialog` was already initialized in the Rust backend but lacked frontend permission.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Capability config | `src-tauri/capabilities/default.json` |
| Frontend dialog call | `src/App.tsx:handleOpenElfDialog()` |
| E2E test | `tests/e2e/elf-integration.spec.ts` |
