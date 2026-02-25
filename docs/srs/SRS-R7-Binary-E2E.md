# SRS-R7: Binary E2E Tests

**Status:** Implemented
**Priority:** Low
**Category:** Testing

## 1. Requirement

The project shall include end-to-end tests that run against the real Tauri backend (without mocks) to validate that permissions and IPC commands work correctly in the built application.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R7.1 | A `binary` project is defined in `playwright.config.ts` targeting `tests/e2e/binary/`. |
| R7.2 | Binary tests connect to `http://localhost:1420` with `npm run tauri dev` running. |
| R7.3 | Window control buttons are present and do not throw permission errors. |
| R7.4 | The ELF dialog opens without permission errors. |

## 3. Technical Approach

- Playwright config extended with a `binary` project.
- Tests use real IPC calls (no mocked `__TAURI_INTERNALS__`).
- Tests verify UI elements are present and functional.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Playwright config | `playwright.config.ts` |
| Binary tests | `tests/e2e/binary/` |
