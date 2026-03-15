# SRS-R20 — CLI A2L Sync Support

**Status:** Implemented  
**Priority:** High  
**Last Updated:** 2026-03-14

## Overview

OpenT A2L-Forge provides a separate CLI binary for build-system integration. The CLI loads a versioned JSON sync-project file, parses the configured ELF, and updates managed `CHARACTERISTIC` entries in the target A2L. Sync projects can be authored from the desktop ELF workflow and later executed headlessly in CI or local build steps.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R20.1 | **Separate CLI binary** — Provide `opent_a2l_forge_cli` as a dedicated Rust binary so build systems can call sync without launching the GUI. | Done |
| R20.2 | **Versioned JSON sync project** — Persist `a2l_path`, `elf_path`, `module_name`, selectors, mapping overrides, and missing-item policy in a versioned JSON file. | Done |
| R20.3 | **Relative path support** — Resolve sync-project paths relative to the project file location so configs remain portable in source trees and build jobs. | Done |
| R20.4 | **Exact symbol + struct-root tracking** — Support exact leaf selectors and tracked struct roots. Struct roots expand to current ELF leaves using `parent_struct`. | Done |
| R20.5 | **Deterministic characteristic recreation** — Reuse the existing `CHARACTERISTIC` import path so same-name characteristics are replaced deterministically and new struct-root leaves are imported automatically. | Done |
| R20.6 | **Safe missing-item handling** — In `report` mode, detect unresolved or stale tracked items and return exit code `2` without mutating the output A2L. | Done |
| R20.7 | **Explicit prune mode** — In `prune` mode, delete stale managed characteristics and generated enum `COMPU_METHOD` / `COMPU_VTAB` objects, while leaving shared `RECORD_LAYOUT`s intact. | Done |
| R20.8 | **GUI project-file authoring** — Allow the desktop ELF workflow to save and load sync-project JSON files, restoring tracked struct roots, tracked exact leaves, and saved mapping overrides. | Done |

## Acceptance Criteria

- `cargo run --manifest-path src-tauri/Cargo.toml --bin opent_a2l_forge_cli -- sync --project <file>` executes a sync run without starting Tauri.
- `--output`, `--missing report|prune`, and `--json` are supported CLI options.
- Exact symbol selectors that no longer exist in the ELF are reported as stale.
- Tracked struct roots import new nested leaves automatically when the ELF adds members under that root.
- Stale `root.*` characteristics are reported in `report` mode and removed only in `prune` mode.
- Same-name existing `MEASUREMENT`s block sync as conflicts; same-name existing `CHARACTERISTIC`s are treated as managed replacements.
- Saving a sync project from the GUI captures the currently loaded A2L path, ELF path, module selection, tracked selectors, and preview-edited mapping overrides.
- Loading a sync project in the GUI reloads the referenced A2L and ELF and restores the tracked selections in the ELF inspector.

## Project File Shape

```json
{
  "version": 1,
  "a2l_path": "../path/to/project.a2l",
  "elf_path": "../path/to/firmware.elf",
  "module_name": "fragment",
  "output_path": null,
  "selectors": [
    { "kind": "struct_root", "name": "struct_b" },
    { "kind": "symbol", "name": "val_u8" }
  ],
  "mapping_overrides": {
    "val_u8": {
      "a2l_type": "UBYTE",
      "lower_limit": 0.0,
      "upper_limit": 255.0,
      "conversion": "NO_COMPU_METHOD",
      "resolution": 1,
      "accuracy": 0.0,
      "array_dims": [],
      "enum_values": []
    }
  },
  "missing_policy": "report"
}
```

## Test References

| Test | File | Description |
|------|------|-------------|
| `test_cli_sync_project_resolves_relative_paths` | `src-tauri/tests/cli_sync.rs` | Verifies checked-in JSON project fixtures resolve relative A2L and ELF paths correctly. |
| `test_core_sync_cli_project_replaces_existing_characteristic` | `src-tauri/tests/cli_sync.rs` | Confirms exact tracked symbol sync replaces an existing characteristic with current ELF metadata. |
| `test_struct_root_sync_imports_nested_members_from_fixture_project` | `src-tauri/tests/cli_sync.rs` | Confirms tracked struct roots import nested leaves from the existing nested ELF fixture. |
| `test_report_mode_detects_stale_items_without_mutating_output` | `src-tauri/tests/cli_sync.rs` | Verifies safe report mode returns stale items and leaves the A2L file unchanged. |
| `test_prune_mode_deletes_stale_characteristics_and_generated_enum_support` | `src-tauri/tests/cli_sync.rs` | Verifies prune mode removes stale managed characteristics plus generated enum support objects. |
| `test_cli_binary_sync_runs_against_real_binary` | `src-tauri/tests/cli_sync.rs` | Invokes the real CLI binary target and verifies machine-readable output plus written A2L output. |
| `tests/e2e/cli-sync-project.spec.ts` | `tests/e2e/cli-sync-project.spec.ts` | Uses the real desktop binary to save and reload a sync project from the ELF workflow. |
