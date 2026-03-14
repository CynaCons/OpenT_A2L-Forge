# SRS-R11 — Recursive Struct Member Expansion from DWARF

**Status:** Implemented
**Priority:** High
**Last Updated:** 2026-03-14

## Overview

When importing ELF symbols, struct-typed variables must be expanded into their individual member fields using DWARF debug information. Named nested structs must be flattened recursively into leaf paths such as `parent.child.member`, with each leaf becoming a separate A2L measurement/characteristic using the top-level base address plus the accumulated nested offset. This requires full DWARF5 parsing support, typedef/qualifier chain resolution, and correct handling of nested types including enums and unions.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R11.1 | **DWARF5 support** — Parse all DWARF sections via `gimli::DwarfSections::load()` to support DWARF version 5 debug info in addition to earlier versions. | Done |
| R11.2 | **Struct member expansion** — Identify `DW_TAG_structure_type` DIEs and iterate their `DW_TAG_member` children to extract member name, type, and offset within the struct. | Done |
| R11.3 | **Typedef/qualifier chain resolution** — Follow chains of `DW_TAG_typedef`, `DW_TAG_const_type`, `DW_TAG_volatile_type`, and `DW_TAG_restrict_type` to resolve the underlying concrete type for each member. | Done |
| R11.4 | **Member type inference** — Infer the appropriate A2L data type (UBYTE, UWORD, ULONG, FLOAT32_IEEE, etc.) from the DWARF type name and byte size of each resolved member type. | Done |
| R11.5 | **Member address calculation** — Compute each member's ECU address as the parent symbol address plus the member's `DW_AT_data_member_location` offset. | Done |
| R11.6 | **Enum/union tracking** — Track byte sizes for `DW_TAG_enumeration_type` and `DW_TAG_union_type` so they can be correctly sized when used as struct member types. | Done |
| R11.7 | **Recursive nested flattening** — If a member resolves to another named struct, recursively flatten its named leaf members into dot-notated paths such as `outer.inner.value`, preserving the top-level parent grouping. | Done |
| R11.8 | **Leaf-only import list** — Do not emit intermediate nested struct nodes such as `outer.inner`; only importable scalar or scalar-array leaves appear in the symbol list. | Done |

## Acceptance Criteria

- Struct-typed ELF symbols are expanded into individual member entries in the A2L output.
- First-level members use `parent.member` dot notation.
- Nested named members use recursive leaf paths such as `parent.child.member`.
- Intermediate nested struct nodes are not emitted as importable ELF symbols.
- Each member's ECU address equals the parent symbol address plus its offset within the struct.
- Typedef chains (including const/volatile/restrict qualifiers) are fully resolved to the concrete type.
- A2L data types are correctly inferred from DWARF type names and byte sizes.
- Enum and union types used as struct members are assigned correct byte sizes.
- DWARF5 ELF files are parsed without errors.

## Test References

| Test | File | Description |
|------|------|-------------|
| `test_voyant_elf_struct_members` | `src-tauri/tests/integration.rs` | Verifies struct members are correctly extracted from a real ELF file with proper names, offsets, and types. |
| `test_voyant_dwarf_parsing_directly` | `src-tauri/tests/integration.rs` | Validates low-level DWARF parsing produces correct type information and member lists. |
| `test_voyant_struct_members_as_a2l_measurements` | `src-tauri/tests/integration.rs` | Confirms struct members are correctly converted into A2L measurement entries with proper addresses and data types. |
| `test_nested_struct_members_flatten_recursively` | `src-tauri/tests/integration.rs` | Verifies nested DWARF structs are flattened into leaf paths such as `struct_b.s1.enumval` with correct offsets, types, and enum metadata. |
| `test_nested_struct_members_import_as_measurements` | `src-tauri/tests/integration.rs` | Confirms nested struct leaves import as regular A2L measurements with correct dotted names and addresses. |
| `test_nested_struct_members_import_as_characteristics` | `src-tauri/tests/integration.rs` | Confirms nested struct leaves import as characteristics with correct record layouts and auto-generated enum conversion objects. |

## Implementation Notes

- DWARF parsing is implemented using the `gimli` crate with `DwarfSections::load()` for DWARF5 compatibility.
- Type resolution follows chains iteratively (not recursively) to avoid stack overflow on deeply nested typedefs.
- Member offset is read from `DW_AT_data_member_location` attribute on each `DW_TAG_member` DIE.
- A parser-private raw member graph retains DWARF type offsets so named nested struct members can be flattened recursively into leaf entries without changing the public `ElfSymbol` contract.
- The type inference mapping uses both the DWARF type name (e.g., `float`, `double`, `uint8_t`) and byte size to determine the A2L `DataType`.
- Arrays of structs remain out of scope for flat measurement/characteristic import and are intentionally not emitted as leaf rows.
- Core logic resides in `src-tauri/src/elf_parser.rs` in the ELF/DWARF parsing functions.
