# SRS-R18 — Manual Entity Creation

**Status:** Implemented
**Priority:** High
**Last Updated:** 2026-02-27

## Overview

Users can manually create new A2L entities directly from the UI without importing from an ELF file. Six entity types are supported: Measurement, Characteristic, AxisPts, CompuMethod, CompuVtab, and RecordLayout. Each entity type has a dedicated creation form in the `CreateEntityDialog` with type-specific fields, validation, and sensible defaults. The backend provides `core_create_*` functions for each type, and the frontend uses a tabbed dialog with accent-colored section headers.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R18.1 | **Create Measurement** — `core_create_measurement_manual()` creates a new Measurement in the specified module with fields: name, long_identifier, datatype (enum), conversion, resolution, accuracy, lower_limit, upper_limit, and optional ecu_address (hex string parsed to u32). Duplicate names are rejected with an error. | Done |
| R18.2 | **Create Characteristic** — `core_create_characteristic_manual()` creates a new Characteristic with fields: name, long_identifier, characteristic_type (VALUE/CURVE/MAP/CUBOID/VAL_BLK/ASCII), address (hex), deposit (RecordLayout name), max_diff, conversion, lower_limit, upper_limit, and optional bit_mask (hex). Duplicate names are rejected. | Done |
| R18.3 | **Create AxisPts** — `core_create_axis_pts_manual()` creates a new AxisPts with fields: name, long_identifier, address (hex), input_quantity, deposit_record, max_diff, conversion, max_axis_points, lower_limit, upper_limit. Duplicate names are rejected. | Done |
| R18.4 | **Create CompuMethod** — `core_create_compu_method()` creates a new CompuMethod with fields: name, long_identifier, conversion_type (IDENTICAL/LINEAR/RAT_FUNC/TAB_INTP/TAB_NOINTP/TAB_VERB/FORM), format, unit, optional coeffs (6 floats for RAT_FUNC), and optional compu_tab_ref (for TAB_VERB). Duplicate names are rejected. | Done |
| R18.5 | **Create CompuVtab** — `core_create_compu_vtab()` creates a new CompuVtab with fields: name, long_identifier, value_pairs (list of (f64, String) tuples), and optional default_value. The number_value_pairs field is auto-set from the pairs count. Duplicate names are rejected. | Done |
| R18.6 | **Create RecordLayout** — `core_create_record_layout()` creates a new RecordLayout with fields: name and optional fnc_values_datatype. When a datatype is provided, FncValues is set with position 1, the specified datatype, IndexMode::IndexIncr, and AddressType::Direct. Duplicate names are rejected. | Done |
| R18.7 | **CreateEntityDialog UI** — A modal dialog with a dropdown to select entity type, a form with type-specific fields, accent-colored section headers per entity type, and Create/Cancel buttons. The dialog invokes the appropriate Tauri command and refreshes the entity list on success. | Done |
| R18.8 | **Duplicate name rejection** — All create functions check for existing entities of the same type with the same name and return an error string if a duplicate is found. | Done |

## Acceptance Criteria

- Each of the 6 entity types can be created from the UI dialog.
- Created entities appear immediately in the entity tree after creation.
- Attempting to create an entity with a duplicate name shows an error.
- Hex address fields (Characteristic, AxisPts, Measurement ECU address) accept `0x` prefix and are parsed correctly.
- CompuMethod creation with RAT_FUNC type includes coefficients.
- CompuVtab creation correctly sets `number_value_pairs` from the provided pairs.
- RecordLayout creation with a datatype sets FncValues correctly.
- All backend integration tests pass.

## Test References

| Test | File | Description |
|------|------|-------------|
| Manual creation integration tests | `src-tauri/tests/integration.rs` | 5 tests covering creation of Measurement, Characteristic, AxisPts, CompuMethod, CompuVtab, and RecordLayout with duplicate rejection. |

## Implementation Notes

### Backend (Rust)

- All 6 `core_create_*` functions are in `src-tauri/src/a2l_ops.rs`.
- Each function takes a mutable `&mut a2lfile::A2lFile` reference, a module name, and a type-specific data struct.
- Duplicate detection uses `iter().any(|e| e.get_name() == data.name)`.
- Hex parsing uses `u32::from_str_radix()` after stripping the `0x` prefix.
- Tauri command wrappers in `lib.rs`: `create_measurement`, `create_characteristic`, `create_axis_pts`, `create_compu_method`, `create_compu_vtab`, `create_record_layout`.

### Frontend (React/TypeScript)

- `src/components/dialogs/CreateEntityDialog.tsx` — Main dialog component.
- Entity type selector dropdown with 6 options, each with an accent color.
- Sub-editors for complex types:
  - `src/components/editors/CompuMethodEditor.tsx` — Coefficients input for RAT_FUNC, tab ref for TAB_VERB.
  - `src/components/editors/CompuVtabEditor.tsx` — Dynamic value pair list with add/remove.
  - `src/components/editors/RecordLayoutEditor.tsx` — Optional FncValues datatype selector.

### Data Types

```rust
pub struct CompuMethodData {
    pub name: String,
    pub long_identifier: String,
    pub conversion_type: String,
    pub format: String,
    pub unit: String,
    pub coeffs: Option<[f64; 6]>,
    pub compu_tab_ref: Option<String>,
}

pub struct CompuVtabData {
    pub name: String,
    pub long_identifier: String,
    pub value_pairs: Vec<(f64, String)>,
    pub default_value: Option<String>,
}

pub struct RecordLayoutData {
    pub name: String,
    pub fnc_values_datatype: Option<String>,
}
```

### Supported Data Types (Measurement/Characteristic)

`UBYTE`, `SBYTE`, `UWORD`, `SWORD`, `ULONG`, `SLONG`, `A_UINT64`, `A_INT64`, `FLOAT32_IEEE`, `FLOAT64_IEEE`

### Supported Characteristic Types

`VALUE`, `CURVE`, `MAP`, `CUBOID`, `VAL_BLK`, `ASCII`
