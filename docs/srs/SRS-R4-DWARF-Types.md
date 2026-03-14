# SRS-R4: DWARF Type Parsing & Struct Expansion

**Status:** Implemented
**Priority:** Medium
**Category:** ELF / Debug Info
**Last Updated:** 2026-03-14

## 1. Requirement

When loading an ELF binary with DWARF debug information, the application shall parse type information and expand struct variables into their individual importable leaves. Named nested structs shall be flattened recursively into dotted leaf paths such as `outer.inner.value`.

## 2. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| R4.1 | ELF symbols display a "DWARF Type" column showing the resolved type name when DWARF info is present. |
| R4.2 | Struct-type variables are expanded into individual member symbols (`StructName.MemberName`). |
| R4.3 | Named nested struct members are flattened recursively into dotted leaf symbols (`StructName.InnerStruct.MemberName`). |
| R4.4 | Struct members display their computed address (base + accumulated nested offset). |
| R4.5 | Struct members are tagged with `is_struct_member: true` and reference their top-level `parent_struct`. |
| R4.6 | Intermediate nested struct nodes are not emitted as importable ELF symbols. |
| R4.7 | When DWARF info is absent, the system falls back to `infer_a2l_type()` without error. |
| R4.8 | The "DWARF Type" column shows "—" when no DWARF type info is available. |

## 3. Technical Approach

- Added `gimli = "0.31"` crate for DWARF parsing.
- `parse_dwarf_symbols()` function reads `.debug_info`, `.debug_abbrev`, `.debug_str` sections.
- Two-pass parsing: first pass collects type names, second pass resolves variables and struct members.
- A raw member graph is flattened recursively into leaf members before symbol rows are emitted.
- `ElfSymbol` struct extended with `dwarf_type`, `is_struct_member`, `parent_struct` fields.

## 4. Traceability

| Artifact | Path |
|----------|------|
| Rust DWARF parser | `src-tauri/src/elf_parser.rs:parse_dwarf_symbols()` |
| TypeScript type | `src/types.ts:ElfSymbol` |
| UI column | `src/components/panels/ElfMainPanel.tsx` |
