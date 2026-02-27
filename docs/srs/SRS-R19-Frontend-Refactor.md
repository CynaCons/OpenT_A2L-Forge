# SRS-R19 — Frontend Component Split

**Status:** Implemented
**Priority:** Medium
**Last Updated:** 2026-02-27

## Overview

The frontend was refactored from a monolithic `App.tsx` (~2,068 lines) into 15 focused component files organized into four directories: `layout/`, `panels/`, `dialogs/`, and `editors/`. `App.tsx` was reduced to ~967 lines and serves as the state orchestrator and router, while presentation logic is delegated to dedicated components. All `data-testid` attributes were preserved throughout the refactor.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R19.1 | **Layout components** — Extract `TitleBar`, `MenuBar`, `ActivityBar`, and `StatusBar` into `src/components/layout/`. These handle window chrome, navigation, menus, and status display. | Done |
| R19.2 | **Panel components** — Extract `ExplorerPanel`, `EntityDetailPanel`, `ElfSidebarPanel`, `ElfMainPanel`, and `SettingsPanel` into `src/components/panels/`. These handle the main content areas of the application. | Done |
| R19.3 | **Dialog components** — Extract `DeleteDialog`, `ConflictDialog`, `PreviewDialog`, `UnsavedDialog`, and `CreateEntityDialog` into `src/components/dialogs/`. These handle modal interactions. | Done |
| R19.4 | **Editor components** — Extract `MeasurementEditor`, `CharacteristicEditor`, `AxisPtsEditor`, `CompuMethodEditor`, `CompuVtabEditor`, and `RecordLayoutEditor` into `src/components/editors/`. These handle entity-specific form editing. | Done |
| R19.5 | **App.tsx as orchestrator** — `App.tsx` retains all application state, Tauri command invocations, event handlers, and top-level routing logic. It passes state and callbacks as props to child components. | Done |
| R19.6 | **data-testid preservation** — All existing `data-testid` attributes remain functional after the refactor. No E2E test selectors are broken. | Done |

## Acceptance Criteria

- `App.tsx` is reduced from ~2,068 lines to ~967 lines.
- All 15 component files exist in the correct directories under `src/components/`.
- Each component has a clear, single responsibility.
- All existing Playwright E2E tests pass without modification.
- `tsc --noEmit` compiles cleanly with no type errors.
- `npm run dev` launches without runtime errors.

## Test References

| Test | File | Description |
|------|------|-------------|
| All E2E tests | `tests/e2e/*.spec.ts` | All existing E2E tests pass unchanged, validating that the component split preserved all UI behavior and `data-testid` attributes. |

## Implementation Notes

### Component Directory Structure

```
src/components/
  layout/
    TitleBar.tsx        — Window title, filename, dirty indicator, window controls
    MenuBar.tsx         — File menu (New, Open, Save, Save As, Recent Files)
    ActivityBar.tsx     — Sidebar icon buttons (Explorer, ELF Inspector, Settings)
    StatusBar.tsx       — File path, entity counts, error/warning messages
  panels/
    ExplorerPanel.tsx   — Entity tree with search, load-more, entity selection
    EntityDetailPanel.tsx — Selected entity details view with property grid
    ElfSidebarPanel.tsx — ELF symbol list in sidebar mode
    ElfMainPanel.tsx    — Full ELF inspector with toolbar, filters, symbol table
    SettingsPanel.tsx   — Application settings, shortcuts reference, about
  dialogs/
    DeleteDialog.tsx    — Confirm entity deletion
    ConflictDialog.tsx  — ELF import symbol conflict resolution
    PreviewDialog.tsx   — ELF import preview before committing
    UnsavedDialog.tsx   — Unsaved changes confirmation (save/discard/cancel)
    CreateEntityDialog.tsx — Manual entity creation with type-specific forms
  editors/
    MeasurementEditor.tsx    — Edit Measurement fields (grouped sections)
    CharacteristicEditor.tsx — Edit Characteristic fields (grouped sections)
    AxisPtsEditor.tsx        — Edit AxisPts fields (grouped sections)
    CompuMethodEditor.tsx    — Edit/create CompuMethod (coeffs, tab ref)
    CompuVtabEditor.tsx      — Edit/create CompuVtab (dynamic value pairs)
    RecordLayoutEditor.tsx   — Edit/create RecordLayout (FncValues datatype)
```

### Props Pattern

Components receive state and callbacks via props from `App.tsx`. For example:

- `ExplorerPanel` receives: entity list, search state, selection handler, load-more handler
- `EntityDetailPanel` receives: selected entity data, edit mode flag, edit handler
- `ElfMainPanel` receives: ELF symbols, filter state, import handlers
- `CreateEntityDialog` receives: open flag, module name, close handler, created callback

### Migration Approach

- Components were extracted one at a time, starting with layout, then panels, then dialogs, then editors.
- Each extraction was verified with `tsc --noEmit` and a dev server smoke test.
- No state management changes were made — `App.tsx` remains the single source of truth for all application state.
