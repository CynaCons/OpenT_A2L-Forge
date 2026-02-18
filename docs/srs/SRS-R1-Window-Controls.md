# SRS-R1: Window Controls

**Status:** Implemented
**Priority:** High
**Category:** UI / Platform Integration

## 1. Requirement

The application shall provide functional window control buttons (minimize, maximize/restore, close) in the custom titlebar that correctly interact with the OS window manager.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R1.1 | Clicking the minimize button minimizes the window to the taskbar. |
| R1.2 | Clicking the maximize button toggles between maximized and restored states. |
| R1.3 | The maximize/restore icon reflects the current window state accurately. |
| R1.4 | Clicking the close button closes the application window. |
| R1.5 | Double-clicking the titlebar drag area toggles maximize state. |
| R1.6 | All buttons have `aria-label` attributes for accessibility and testability. |

## 3. Technical Approach

- Tauri v2 permissions `core:window:allow-minimize`, `core:window:allow-close`, and `core:window:allow-toggle-maximize` added to `src-tauri/capabilities/default.json`.
- Polling-based state check (`setInterval`) replaced with `getCurrentWindow().onResized()` event listener for efficient maximize state tracking.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Capability config | `src-tauri/capabilities/default.json` |
| UI implementation | `src/App.tsx` (titlebar section) |
| E2E test | `tests/e2e/window-controls.spec.ts` |
