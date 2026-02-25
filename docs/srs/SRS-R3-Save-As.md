# SRS-R3: Save A2L with Native Dialog

**Status:** Implemented
**Priority:** Medium
**Category:** File I/O

## 1. Requirement

When saving an A2L file that has no existing file path (new or unsaved file), the application shall present a native OS "Save As" dialog instead of a browser prompt.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R3.1 | Saving a file with an existing path writes directly without a dialog. |
| R3.2 | Saving a new/untitled file opens a native Save-As dialog. |
| R3.3 | The dialog defaults to `.a2l` extension filter. |
| R3.4 | Cancelling the dialog does not save or alter state. |
| R3.5 | After successful save, the file path is stored for subsequent quick saves. |

## 3. Technical Approach

- Imported `save` from `@tauri-apps/plugin-dialog` alongside existing `open`.
- Replaced `window.prompt()` fallback with `save()` call using appropriate filters.
- `dialog:default` permission (added in R2) also covers `allow-save`.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Frontend implementation | `src/App.tsx:handleSaveA2l()` |
| E2E test | `tests/e2e/save-as.spec.ts` |
