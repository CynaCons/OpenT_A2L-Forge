# SRS-R8: ELF Import Workflow

**Status:** Implemented
**Priority:** High
**Category:** ELF Integration / Symbol Import

## 1. Overview

The ELF Import Workflow enables users to load an ELF binary, browse its symbol table, apply filters and search, preview selected symbols with inferred A2L data types, resolve conflicts with existing measurements, and import symbols as A2L MEASUREMENT entities into a selected module. This is the primary workflow for creating measurements from embedded firmware binaries.

## 2. Requirements

### R8.1: Load ELF Binary via Native File Dialog

**Description:** The user can load an ELF binary file using the operating system's native file dialog. The dialog filters for common ELF extensions (.elf, .out, .axf, .o) and any file (*).

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.1.1 | Clicking "Load ELF" opens a native file dialog via Tauri's dialog plugin. |
| R8.1.2 | The dialog filters for ELF file extensions (.elf, .out, .axf, .o). |
| R8.1.3 | On successful selection, the ELF symbol table is parsed and loaded into state. |
| R8.1.4 | The ELF Inspector sidebar switches to display the loaded symbols. |
| R8.1.5 | Loading errors are reported to the user via the status bar. |

### R8.2: Symbol Table Display

**Description:** Symbols from the loaded ELF are displayed in a sortable, filterable table showing name, address, size, type, section, and bind columns.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.2.1 | The ELF table (`data-testid="elf-table"`) renders all parsed symbols as rows. |
| R8.2.2 | Columns displayed: checkbox, Name, Address (hex), Size (bytes), Type, Section, Bind. |
| R8.2.3 | Clicking a column header sorts the table by that column in ascending order; clicking again reverses to descending. |
| R8.2.4 | The sort indicator reflects the current sort column and direction. |

### R8.3: Symbol Search by Name

**Description:** A search input provides real-time filtering of ELF symbols by name substring match.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.3.1 | A text input (`data-testid="search-elf"`) is available above the ELF table. |
| R8.3.2 | Typing in the search field filters the displayed symbols in real time (case-insensitive substring match). |
| R8.3.3 | Clearing the search field restores the full symbol list. |

### R8.4: Filter by Type, Section, and Bind

**Description:** Dropdown filters allow restricting the symbol table by ELF type (FUNC, OBJECT, NOTYPE, etc.), section (.text, .data, .bss, .rodata, etc.), and bind (LOCAL, GLOBAL, WEAK).

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.4.1 | A Type filter (`data-testid="filter-type"`) provides options derived from the loaded symbols' types. |
| R8.4.2 | A Section filter (`data-testid="filter-section"`) provides options derived from the loaded symbols' sections. |
| R8.4.3 | A Bind filter (`data-testid="filter-bind"`) provides options derived from the loaded symbols' bindings. |
| R8.4.4 | Selecting a filter value restricts the table to matching symbols only. |
| R8.4.5 | Filters, search, and sorting compose together (all active constraints apply simultaneously). |

### R8.5: Smart Data Type Inference

**Description:** When creating A2L measurements from ELF symbols, the system infers the A2L data type from the symbol's byte size using a deterministic mapping.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.5.1 | 1-byte symbols map to UBYTE. |
| R8.5.2 | 2-byte symbols map to UWORD. |
| R8.5.3 | 4-byte symbols map to FLOAT32_IEEE. |
| R8.5.4 | 8-byte symbols map to FLOAT64_IEEE. |
| R8.5.5 | Symbols with other sizes default to UBYTE. |
| R8.5.6 | The inferred type is shown in the preview dialog and can be overridden by the user. |

### R8.6: Preview Dialog

**Description:** Before importing, a preview dialog shows the selected symbols with their inferred A2L type and limit values. The user can edit the A2L type and review the batch before confirming.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.6.1 | Clicking "Add to A2L" (`data-testid="btn-add-to-a2l"`) opens the preview dialog (`data-testid="dialog-preview"`). |
| R8.6.2 | The preview dialog lists all selected (checked) symbols. |
| R8.6.3 | Each row shows the symbol name, address, inferred A2L type, and default limits. |
| R8.6.4 | The A2L type column is editable (dropdown) to allow the user to override the inference. |
| R8.6.5 | Confirming the dialog triggers measurement creation for all listed symbols. |
| R8.6.6 | Cancelling the dialog returns to the ELF table without changes. |

### R8.7: Conflict Detection and Resolution

**Description:** When importing symbols whose names already exist as measurements in the A2L project, the system detects conflicts and presents a resolution dialog.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.7.1 | Before creating measurements, the system checks for name collisions with existing measurements. |
| R8.7.2 | If conflicts exist, a conflict dialog (`data-testid="dialog-conflict"`) is shown listing conflicting names. |
| R8.7.3 | The user can choose "Skip All" to import only non-conflicting symbols. |
| R8.7.4 | The user can choose "Replace All" to overwrite existing measurements with the new imports. |
| R8.7.5 | The user can cancel to abort the entire import. |
| R8.7.6 | "Replace All" correctly replaces existing measurements without creating duplicates. |

### R8.8: Module Selector

**Description:** For multi-module A2L projects, a module selector allows the user to choose which MODULE receives the imported measurements.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R8.8.1 | A module selector (`data-testid="select-module"`) is displayed when an A2L with multiple modules is loaded. |
| R8.8.2 | The selector lists all MODULE names from the loaded A2L project. |
| R8.8.3 | The selected module determines the target for new measurement creation. |
| R8.8.4 | The default selection is the first module. |

## 3. Technical Approach

- ELF parsing is performed in the Rust backend using the `goblin` crate.
- DWARF debug info is optionally parsed using the `gimli` crate to provide richer type names.
- The frontend communicates with the backend via Tauri IPC commands: `load_elf_symbols`, `create_measurements_with_mapping`, `check_measurement_conflicts`.
- Symbol filtering, sorting, and search are performed client-side in React state for responsiveness.
- Conflict detection is a separate backend call that returns a list of conflicting names before any mutations.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Backend commands | `src-tauri/src/lib.rs` |
| UI implementation | `src/App.tsx` (ELF Inspector panel) |
| E2E tests (mock) | `tests/e2e/elf-integration.spec.ts`, `tests/e2e/elf-filters.spec.ts`, `tests/e2e/conflict-resolution.spec.ts`, `tests/e2e/xcp-variable-workflow.spec.ts` |
| E2E tests (binary) | `tests/e2e/binary/real-elf-data.spec.ts`, `tests/e2e/binary/elf-load.spec.ts` |
| Rust integration tests | `src-tauri/tests/integration.rs` |
