# Product Requirements Document: OpenT A2L-Forge

**Version:** 1.0
**Date:** 2026-02-17
**Product:** OpenT A2L-Forge

## 1. Vision

OpenT A2L-Forge is an open-source desktop application for viewing, editing, and creating ASAP2 (A2L) calibration description files used in automotive embedded systems development. It combines a modern UI with ELF binary import capabilities, enabling engineers to build and maintain A2L files directly from compiled firmware.

## 2. Target Users

- **Automotive embedded engineers** who develop ECU firmware and need to create or update A2L files for calibration and measurement tools (e.g., INCA, CANape, XCP clients).
- **Calibration engineers** who modify measurement and characteristic definitions, adjust limits, and manage conversion methods.
- **Test and integration engineers** who need to inspect A2L files, verify symbol mappings, and validate calibration metadata against firmware builds.

## 3. Feature Summary

### Iteration 1: Core A2L I/O
- Open and parse existing A2L files from disk via native file dialog.
- Display project metadata (PROJECT, MODULE, HEADER).
- Export/save A2L files with format preservation and validation warnings.

### Iteration 2: Entity Editing
- Tree-based entity browser for MODULE, MEASUREMENT, CHARACTERISTIC, and AXIS_PTS.
- Search and filter across all entities by name.
- Full editors for MEASUREMENT, CHARACTERISTIC, and AXIS_PTS with field validation.
- Edit PROJECT/HEADER metadata (name, long identifier, header comment).

### Iteration 3: Templates and Creation
- Create new empty A2L database with minimal PROJECT/MODULE structure.
- (Planned) Template-based A2L creation with baseline and powertrain presets.

### Iteration 4: ELF Import
- Load ELF binaries and parse symbol tables (goblin crate).
- Display symbols in a sortable, filterable table (name, address, size, type, section, bind).
- Search symbols by name with real-time filtering.
- Filter by ELF type (FUNC/OBJECT), section (.text/.data/.bss), and bind (LOCAL/GLOBAL).
- Smart data type inference from symbol byte size (e.g., 4 bytes maps to FLOAT32_IEEE).
- Preview dialog with batch configuration before import.
- Conflict detection when symbol names already exist as measurements; user can Skip or Replace All.
- Module selector for multi-module A2L projects.
- DWARF debug info parsing (gimli crate) for richer type names and struct member expansion.
- ELF file watching with automatic change notification and ECU address update.

### Iteration 4.5-4.7: Platform Fixes, Testing, and Stability
- Native window controls (minimize, maximize, close) via Tauri permissions.
- Native file dialogs for all file operations (open A2L, open ELF, save A2L).
- data-testid convention on all interactive UI elements for stable E2E testing.
- Comprehensive E2E test suite: 30 mock Playwright tests + 10 binary Playwright tests + 9 Rust integration tests.

### Iteration 5 (Planned): Validation and Integrity
- Cross-reference validation engine.
- Pre-export validation report.
- Undo/redo and autosave with crash recovery.

### Iteration 6 (Planned): Performance and UX
- Large file performance targets (A2L 10-50 MB, ELF 50-200 MB).
- Batch edit operations and advanced search filters.

### Iteration 7 (Planned): Packaging and Release
- Cross-platform builds for Windows, Linux, and macOS.
- Signed installer artifacts.
- Quickstart documentation and in-app help.

## 4. Key User Workflows

### Workflow 1: Open, Edit, and Save A2L

1. User launches OpenT A2L-Forge.
2. User clicks "Open A2L" and selects a file via the native dialog (or clicks a recent file).
3. The entity tree populates with modules, measurements, characteristics, and axis points.
4. User searches or browses the tree to locate an entity.
5. User clicks an entity to view its details, then clicks "Edit" to modify fields.
6. User saves changes; the updated A2L is written to disk.

### Workflow 2: Import ELF Symbols as Measurements

1. User loads an A2L file (or creates a new one).
2. User switches to the ELF Inspector tab and clicks "Load ELF."
3. The symbol table loads and displays in a filterable, sortable table.
4. User applies filters (type: OBJECT, section: .data) and/or searches by name.
5. User selects symbols via checkboxes and clicks "Add to A2L."
6. The preview dialog shows selected symbols with inferred A2L types; user adjusts as needed.
7. User confirms; if conflicts exist, the conflict dialog offers Skip All or Replace All.
8. Measurements are created in the selected module.

### Workflow 3: Conflict Resolution on Re-Import

1. User has previously imported symbols from an ELF file.
2. User loads an updated ELF (or the watcher detects a change).
3. User selects symbols and initiates import.
4. The conflict dialog lists symbols that already exist.
5. User chooses "Replace All" to update existing measurements with new addresses/types, or "Skip All" to import only new symbols.

### Workflow 4: ECU Address Update from Rebuilt ELF

1. User has an A2L file with measurements and a loaded ELF.
2. The firmware is rebuilt; the ELF file watcher detects the change and shows a banner.
3. User clicks "Update ECU Addresses" to re-match measurement names against the new symbol table.
4. Addresses are updated for all matched measurements; a summary is displayed.

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|--------|--------|
| A2L file open (< 5 MB) | < 2 seconds |
| A2L file open (5-50 MB) | < 10 seconds |
| ELF symbol table load (< 50 MB) | < 3 seconds |
| ELF symbol table load (50-200 MB) | < 10 seconds |
| Entity search filtering | < 100 ms perceived latency |
| Symbol table sorting | < 200 ms for 10,000+ symbols |

### 5.2 Cross-Platform

- Built with Tauri v2 (Rust backend + WebView frontend).
- Primary target: Windows (WebView2).
- Secondary targets: Linux (WebKitGTK), macOS (WebKit).
- Native OS file dialogs and window controls on all platforms.

### 5.3 Testability

- All interactive UI elements have `data-testid` attributes (see SRS-R9).
- E2E tests use `page.getByTestId()` for selector stability.
- Mock-based Playwright tests run without a compiled backend.
- Binary Playwright tests validate real IPC against the release build.
- Rust integration tests validate core parsing and mapping logic.

### 5.4 Data Integrity

- A2L export preserves original formatting and ordering where possible.
- Conflict detection prevents accidental duplicate measurements.
- File watching uses debounced events to avoid partial-write reads.

### 5.5 Accessibility

- Window control buttons have `aria-label` attributes.
- Keyboard navigation supported for tree, table, and dialog interactions.

## 6. Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 |
| Backend language | Rust |
| A2L parsing | `a2lfile` crate |
| ELF parsing | `goblin` crate |
| DWARF parsing | `gimli` crate |
| File watching | `notify` crate |
| Frontend framework | React 18 + TypeScript |
| UI library | Material UI (MUI) |
| E2E testing | Playwright |
| Integration testing | Rust `#[test]` with real fixture files |

## 7. SRS Document Index

| ID | Title | Document |
|----|-------|----------|
| R1 | Window Controls | [SRS-R1](srs/SRS-R1-Window-Controls.md) |
| R2 | ELF File Dialog | [SRS-R2](srs/SRS-R2-ELF-Dialog.md) |
| R3 | Save A2L with Native Dialog | [SRS-R3](srs/SRS-R3-Save-As.md) |
| R4 | DWARF Type Parsing & Struct Expansion | [SRS-R4](srs/SRS-R4-DWARF-Types.md) |
| R5 | ELF File Watching & ECU Address Update | [SRS-R5](srs/SRS-R5-ELF-Watcher.md) |
| R7 | Binary E2E Tests | [SRS-R7](srs/SRS-R7-Binary-E2E.md) |
| R8 | ELF Import Workflow | [SRS-R8](srs/SRS-R8-ELF-Import-Workflow.md) |
| R9 | data-testid Convention | [SRS-R9](srs/SRS-R9-Data-TestID.md) |
| R10 | Recently Used Files | [SRS-R10](srs/SRS-R10-Recent-Files.md) |
