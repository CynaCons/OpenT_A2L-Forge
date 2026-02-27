# SRS-R17 — A2L Validation Engine

**Status:** Implemented
**Priority:** High
**Last Updated:** 2026-02-27

## Overview

The A2L validation engine performs cross-reference checks and constraint validation on A2L files. It detects broken references, duplicate names, inverted limits, empty names, and suspicious addresses. The engine returns a structured `ValidationResult` with categorized issues (Error, Warning, Info) that can be displayed in the UI or used programmatically.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R17.1 | **XREF_COMPU_METHOD rule** — Error if a Measurement, Characteristic, or AxisPts references a `conversion` that does not exist in the module's CompuMethod list. The special value `NO_COMPU_METHOD` is exempt. | Done |
| R17.2 | **XREF_RECORD_LAYOUT rule** — Error if a Characteristic's `deposit` or an AxisPts's `deposit_record` references a RecordLayout that does not exist in the module. | Done |
| R17.3 | **XREF_COMPU_TAB rule** — Error if a CompuMethod's `compu_tab_ref` references a name that exists in neither the CompuTab nor CompuVtab lists. | Done |
| R17.4 | **XREF_INPUT_QUANTITY rule** — Warning if an AxisDescr's `input_quantity` (on a Characteristic) or an AxisPts's `input_quantity` references a Measurement that does not exist. The special value `NO_INPUT_QUANTITY` is exempt. | Done |
| R17.5 | **DUP_NAME rule** — Error if duplicate entity names are found across Measurement, Characteristic, and AxisPts within a single module. | Done |
| R17.6 | **LIMIT_INVERSION rule** — Warning if `lower_limit > upper_limit` on any Measurement, Characteristic, or AxisPts. | Done |
| R17.7 | **EMPTY_NAME rule** — Error if any Measurement, Characteristic, or AxisPts has an empty string as its name. | Done |
| R17.8 | **ADDR_ZERO rule** — Warning if a Characteristic or AxisPts has address `0x0`, which often indicates an unresolved symbol. | Done |
| R17.9 | **ValidationResult structure** — The `core_validate_a2l()` function returns a `ValidationResult` containing a list of `ValidationIssue` objects and summary counts (`error_count`, `warning_count`, `info_count`). Each issue includes severity, entity kind, entity name, field, message, and rule ID. | Done |

## Acceptance Criteria

- `core_validate_a2l()` correctly identifies all 9 rule violations when present in an A2L file.
- Cross-reference checks build lookup sets (HashSet) for efficient O(1) lookups.
- Special sentinel values (`NO_COMPU_METHOD`, `NO_INPUT_QUANTITY`) are correctly excluded from cross-reference checks.
- Duplicate name detection spans Measurement, Characteristic, and AxisPts within each module.
- The `ValidationResult` accurately reports `error_count`, `warning_count`, and `info_count`.
- Each `ValidationIssue` contains enough context (entity kind, name, field, rule ID) to locate the problem.
- All validation integration tests pass.

## Test References

| Test | File | Description |
|------|------|-------------|
| Validation integration tests | `src-tauri/tests/integration.rs` | 8 tests covering all 9 validation rules: broken cross-references, duplicate names, limit inversions, empty names, zero addresses, and clean file validation. |

## Implementation Notes

- Implementation is in `src-tauri/src/validator.rs`.
- The function iterates all modules in the A2L file, building `HashSet<&str>` lookup tables for CompuMethod, RecordLayout, CompuTab, CompuVtab, and Measurement names.
- DUP_NAME detection uses a single `HashSet<String>` accumulator across Measurement, Characteristic, and AxisPts — the second insert of the same name triggers the error.
- The ADDR_OVERFLOW rule (address exceeds 32-bit range) is documented in the module header but not currently triggered since `a2lfile` types use `u32` for addresses.
- The Tauri command wrapper `validate_a2l` in `lib.rs` delegates directly to `core_validate_a2l()`.

### Validation Rule Summary

| Rule ID | Severity | Applies To | Check |
|---------|----------|------------|-------|
| `XREF_COMPU_METHOD` | Error | Measurement, Characteristic, AxisPts | Conversion exists in CompuMethod list |
| `XREF_RECORD_LAYOUT` | Error | Characteristic, AxisPts | Deposit/deposit_record exists in RecordLayout list |
| `XREF_COMPU_TAB` | Error | CompuMethod | compu_tab_ref exists in CompuTab or CompuVtab |
| `XREF_INPUT_QUANTITY` | Warning | Characteristic (AxisDescr), AxisPts | input_quantity exists in Measurement list |
| `DUP_NAME` | Error | Measurement, Characteristic, AxisPts | No duplicate names within module |
| `LIMIT_INVERSION` | Warning | Measurement, Characteristic, AxisPts | lower_limit <= upper_limit |
| `EMPTY_NAME` | Error | Measurement, Characteristic, AxisPts | Name is non-empty |
| `ADDR_ZERO` | Warning | Characteristic, AxisPts | Address is not 0x0 |
| `ADDR_OVERFLOW` | Warning | Characteristic, AxisPts | Address within 32-bit range |

### Data Types

```rust
pub struct ValidationResult {
    pub issues: Vec<ValidationIssue>,
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
}

pub struct ValidationIssue {
    pub severity: ValidationSeverity,
    pub entity_kind: String,
    pub entity_name: String,
    pub field: String,
    pub message: String,
    pub rule: String,
}

pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}
```
