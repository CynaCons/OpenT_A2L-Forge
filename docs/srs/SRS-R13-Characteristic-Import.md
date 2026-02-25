# SRS-R13 — CHARACTERISTIC Creation from ELF

**Status:** Implemented
**Priority:** High
**Last Updated:** 2026-02-19

## Overview

When importing ELF symbols into an A2L file, the system creates CHARACTERISTIC objects (rather than MEASUREMENT objects) to represent read/write calibration variables. Scalar variables use the VALUE characteristic type, while arrays use VAL_BLK with MATRIX_DIM. Each characteristic requires an auto-generated RECORD_LAYOUT. Re-importing from an updated ELF replaces existing characteristics, and conflict detection checks both measurements and characteristics to prevent duplicates.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R13.1 | **Create CHARACTERISTIC** — ELF symbol imports produce CHARACTERISTIC objects (not MEASUREMENT) to represent read/write calibration variables. | Done |
| R13.2 | **VALUE vs VAL_BLK** — Scalar symbols use the VALUE characteristic type; array symbols use VAL_BLK with MATRIX_DIM set to the array dimensions. | Done |
| R13.3 | **Auto-create RECORD_LAYOUT** — Automatically generate a `RECORD_LAYOUT` named `__val_TYPE` (e.g., `__val_FLOAT32_IEEE`) with `FncValues` matching the data type. Create the layout only if it does not already exist. | Done |
| R13.4 | **Replace on re-import** — When re-importing from an updated ELF, replace existing characteristics that match by name using a retain/push pattern (remove old, add new). | Done |
| R13.5 | **Conflict detection** — Conflict detection checks both the MEASUREMENT and CHARACTERISTIC namespaces when determining if a symbol name already exists in the A2L file. | Done |

## Acceptance Criteria

- Imported ELF symbols appear as CHARACTERISTIC objects in the A2L output.
- Scalar characteristics have type VALUE; array characteristics have type VAL_BLK with correct MATRIX_DIM.
- RECORD_LAYOUT objects are auto-created with names following the `__val_TYPE` convention.
- Duplicate RECORD_LAYOUTs are not created if one with the same name already exists.
- Re-importing an ELF replaces previously imported characteristics without creating duplicates.
- Conflict detection flags symbols that exist as either a MEASUREMENT or CHARACTERISTIC.

## Test References

| Test | File | Description |
|------|------|-------------|
| `test_create_characteristics_from_elf_symbols` | `src-tauri/tests/integration.rs` | Verifies that ELF symbols are imported as CHARACTERISTIC objects with correct type (VALUE/VAL_BLK), RECORD_LAYOUT, and attributes. |
| `test_create_characteristics_replaces_existing` | `src-tauri/tests/integration.rs` | Confirms that re-importing replaces existing characteristics by name and does not produce duplicates. |

## Implementation Notes

- RECORD_LAYOUT names follow the pattern `__val_{DataType}` where DataType is the A2L type name (e.g., `FLOAT32_IEEE`, `ULONG`, `UBYTE`).
- The `FncValues` field in the RECORD_LAYOUT specifies the data type and position for the characteristic's value.
- The retain/push pattern first removes any existing characteristic with the same name using `Vec::retain()`, then pushes the new characteristic.
- Conflict detection iterates both `a2l.project.module[0].measurement` and `a2l.project.module[0].characteristic` to find name collisions.
- Implementation is in `src-tauri/src/lib.rs` in the ELF import command handler.
