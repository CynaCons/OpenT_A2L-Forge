# SRS-R12 — Array Handling with MATRIX_DIM

**Status:** Implemented
**Priority:** High
**Last Updated:** 2026-02-19

## Overview

ELF symbols that are arrays must be correctly identified from DWARF debug information and represented in A2L using the MATRIX_DIM attribute. The element type (not the total array type) determines the A2L data type, and the element count is derived from DWARF subrange information. Overflow protection is required when computing element counts from upper bound values.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R12.1 | **DWARF array parsing** — Detect `DW_TAG_array_type` DIEs and extract element count from their `DW_TAG_subrange_type` child's `DW_AT_upper_bound` or `DW_AT_count` attribute. | Done |
| R12.2 | **Element type resolution** — Use the array's element type (the type pointed to by `DW_TAG_array_type`) rather than the total array type for A2L data type inference. | Done |
| R12.3 | **MATRIX_DIM generation** — Set the `MatrixDim` attribute on the generated Measurement or Characteristic for array-typed symbols, encoding the array dimension(s). | Done |
| R12.4 | **Display** — Show array types in the DWARF type column using `element_type[N]` notation (e.g., `uint8_t[16]`, `float[4]`). | Done |
| R12.5 | **Overflow protection** — Use `checked_add` when computing element count as `DW_AT_upper_bound + 1` to prevent integer overflow on maximum bound values. | Done |

## Acceptance Criteria

- Array-typed ELF symbols produce A2L entries with MATRIX_DIM set to the correct element count.
- The A2L data type reflects the element type, not the aggregate array type.
- The DWARF type column displays array types as `element_type[N]`.
- No integer overflow occurs when `DW_AT_upper_bound` is at its maximum representable value.
- Multi-dimensional arrays are handled if multiple `DW_TAG_subrange_type` children are present.

## Test References

| Test | File | Description |
|------|------|-------------|
| `test_array_members_get_matrix_dim` | `src-tauri/tests/integration.rs` | Verifies that array-typed symbols produce measurements/characteristics with correct MATRIX_DIM values and element types. |

## Implementation Notes

- Element count is computed as `upper_bound.checked_add(1).unwrap_or(upper_bound)` to handle overflow safely.
- When resolving array types, the parser first resolves the element type through any typedef/qualifier chains before inferring the A2L data type.
- MATRIX_DIM is set using the `a2lfile` crate's `MatrixDim` struct on the generated Measurement or Characteristic object.
- Array display format is constructed as `"{element_type_name}[{count}]"` for the UI's DWARF type column.
- Implementation is in `src-tauri/src/lib.rs` alongside the struct member expansion logic.
