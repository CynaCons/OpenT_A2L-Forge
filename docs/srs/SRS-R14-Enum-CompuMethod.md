# SRS-R14 — Enum COMPU_METHOD Derivation from DWARF

**Status:** Implemented
**Priority:** Medium
**Last Updated:** 2026-02-19

## Overview

When an ELF symbol or struct member has an enum type (as determined by DWARF debug information), the system automatically creates A2L COMPU_VTAB and COMPU_METHOD objects that encode the enum's name/value mapping. This allows calibration tools to display human-readable enum labels instead of raw integer values. On ELF update, previously generated enum conversion objects are overwritten to reflect any changes in the enum definition.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R14.1 | **Parse enumerators** — Extract `DW_TAG_enumerator` children from `DW_TAG_enumeration_type` DIEs to obtain enum constant name/value pairs. | Done |
| R14.2 | **Resolve enum types** — Follow typedef chains to resolve variables and struct members to their underlying `DW_TAG_enumeration_type`, enabling enum detection even through multiple levels of typedef indirection. | Done |
| R14.3 | **Auto-create COMPU_VTAB** — Generate a `COMPU_VTAB` object containing all enum value/name pairs, using the `TAB_VERB` (verbal table) conversion type. | Done |
| R14.4 | **Auto-create COMPU_METHOD** — Generate a `COMPU_METHOD` object that references the auto-created `COMPU_VTAB` by name. | Done |
| R14.5 | **Set characteristic conversion** — Assign the auto-generated `COMPU_METHOD` name as the conversion method on the characteristic or measurement that uses the enum type. | Done |
| R14.6 | **Overwrite on ELF update** — When the ELF file is updated, replace existing `COMPU_VTAB` and `COMPU_METHOD` objects for enums whose definitions have changed. | Done |

## Acceptance Criteria

- Enum-typed variables and struct members have a COMPU_METHOD assigned that maps integer values to enum constant names.
- COMPU_VTAB contains the complete set of enumerator name/value pairs from the DWARF info.
- Typedef chains are resolved so that `typedef enum { ... } MyEnum_t;` style declarations are correctly identified as enum types.
- Re-importing an ELF with modified enum definitions updates the COMPU_VTAB and COMPU_METHOD accordingly.
- Non-enum types are not affected; their conversion method remains unchanged.

## Test References

| Test | File | Description |
|------|------|-------------|
| `test_enum_compu_method_creation` | `src-tauri/tests/integration.rs` | Verifies that enum-typed symbols produce COMPU_VTAB and COMPU_METHOD objects with correct value/name mappings, and that the characteristic references the generated COMPU_METHOD. |

## Implementation Notes

- COMPU_VTAB names are derived from the enum type name (e.g., `VTAB_{EnumTypeName}`).
- COMPU_METHOD names follow a corresponding convention (e.g., `CM_{EnumTypeName}`).
- The COMPU_METHOD uses `ConversionType::TabVerb` and references the COMPU_VTAB in its conversion table field.
- Enum value pairs are stored as `(f64, String)` tuples in the COMPU_VTAB's `ValuePairsInlTab` list.
- On re-import, existing COMPU_VTAB and COMPU_METHOD objects with matching names are removed via `Vec::retain()` before new ones are pushed.
- Implementation is in `src-tauri/src/lib.rs` alongside the DWARF type resolution logic.
