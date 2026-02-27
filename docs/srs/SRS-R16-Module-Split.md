# SRS-R16 — Rust Backend Module Split

**Status:** Implemented
**Priority:** Medium
**Last Updated:** 2026-02-27

## Overview

The Rust backend was refactored from a single monolithic `lib.rs` file (~2,885 lines) into four focused modules plus a slimmed-down `lib.rs` (~620 lines). This separation of concerns improves maintainability, testability, and code navigation. Each module has a single responsibility, and `lib.rs` serves only as the Tauri command layer and module orchestrator.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R16.1 | **types.rs module** — All shared structs, enums, traits, and DTOs are extracted into `src-tauri/src/types.rs`. This includes tree/metadata types (`A2lMetadata`, `CoreEntity`, `A2lTree*`), the `A2lDetailProvider` trait with all its `impl` blocks, ELF symbol types (`ElfSymbol`, `SymbolWithMapping`, `ConflictReport`), entity data types (`MeasurementData`, `CharacteristicData`, `AxisPtsData`), manual creation types (`CompuMethodData`, `CompuVtabData`, `RecordLayoutData`), and DWARF info types (`DwarfSymbolInfo`, `DwarfMemberInfo`). | Done |
| R16.2 | **a2l_ops.rs module** — All A2L file operations are extracted into `src-tauri/src/a2l_ops.rs`. This includes loading/parsing (`core_load_a2l_from_string`, `core_load_a2l_from_path`), export (`core_export_a2l`), metadata/entity collection (`build_metadata`, `collect_core_entities`), tree building (`build_a2l_tree`), entity CRUD (get/update/delete/create for all 6 entity types), conflict checking (`core_check_conflicts`), ECU address updates (`core_update_ecu_addresses`), and ELF-to-A2L creation (`core_create_measurements`, `core_create_characteristics`). | Done |
| R16.3 | **elf_parser.rs module** — All ELF/DWARF parsing logic is extracted into `src-tauri/src/elf_parser.rs`. This includes ELF loading (`core_load_elf_symbols`, `core_load_elf_symbols_from_buffer`), DWARF debug info parsing (`parse_dwarf_symbols`), type inference, struct member expansion, array dimension extraction, and enum variant resolution. | Done |
| R16.4 | **validator.rs module** — The A2L validation engine is extracted into `src-tauri/src/validator.rs`. This includes `core_validate_a2l()` and the `ValidationResult`/`ValidationIssue`/`ValidationSeverity` types. | Done |
| R16.5 | **lib.rs as orchestrator** — `lib.rs` is reduced to module declarations, re-exports (`pub use`), application state (`AppState`), and thin Tauri command wrappers that delegate to core functions. No business logic resides in `lib.rs`. | Done |
| R16.6 | **Public API preserved** — All existing integration tests and Tauri commands continue to work without modification. Re-exports in `lib.rs` ensure backwards compatibility. | Done |

## Acceptance Criteria

- `lib.rs` contains only module declarations, re-exports, `AppState`, and Tauri command wrappers (~620 lines).
- `types.rs` contains all shared types, traits, and DTOs with no business logic.
- `a2l_ops.rs` contains all A2L CRUD operations and tree building, importing only from `types`.
- `elf_parser.rs` contains all ELF/DWARF parsing, importing only from `types`.
- `validator.rs` contains all validation logic, importing only standard library and `a2lfile`.
- All existing Rust integration tests pass without changes.
- All existing Playwright E2E tests pass without changes.
- `cargo build` and `cargo test` succeed cleanly.

## Test References

| Test | File | Description |
|------|------|-------------|
| All 34 integration tests | `src-tauri/tests/integration.rs` | Existing tests continue to pass unchanged, validating that the module split preserved all public APIs. |

## Implementation Notes

- The module split follows Rust convention: each file is declared as `pub mod` in `lib.rs` and re-exported with `pub use` for backwards compatibility.
- `lib.rs` re-exports: `pub use types::*`, `pub use a2l_ops::*`, `pub use elf_parser::{core_load_elf_symbols, core_load_elf_symbols_from_buffer, parse_dwarf_symbols}`, `pub use validator::*`.
- Cross-module dependencies are minimal: `a2l_ops` and `elf_parser` import from `crate::types`, `validator` is self-contained (depends only on `a2lfile` and `std`).
- The `AppState` struct remains in `lib.rs` because it is Tauri-specific (uses `Mutex` for managed state).

### Module Size After Split

| Module | Approximate Lines | Responsibility |
|--------|-------------------|----------------|
| `lib.rs` | ~620 | Tauri commands, state, re-exports |
| `types.rs` | ~835 | DTOs, traits, type impls |
| `a2l_ops.rs` | ~1,230 | A2L CRUD, tree, conflicts |
| `elf_parser.rs` | ~650 | ELF/DWARF parsing |
| `validator.rs` | ~405 | Validation engine |
