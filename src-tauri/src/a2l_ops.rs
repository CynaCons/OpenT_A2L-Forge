//! A2L file operations: loading, saving, tree building, entity CRUD, and conflict checking.
//!
//! This module contains all core functions for manipulating A2L files, including
//! creating/deleting entities, building the tree view data structure, checking
//! for symbol conflicts, and updating ECU addresses from ELF data.

use std::collections::HashMap;
use std::fs;

use a2lfile::{A2lObjectName, ItemList};

use crate::types::*;

// ─── A2L loading / export ───────────────────────────────────────────────────

/// Load and parse an A2L file from a string.
pub fn core_load_a2l_from_string(
    contents: &str,
) -> Result<(a2lfile::A2lFile, Vec<String>), String> {
    let (a2l, warnings) =
        a2lfile::load_from_string(contents, None, false).map_err(|error| error.to_string())?;
    let warning_strings: Vec<String> = warnings.iter().map(|w| w.to_string()).collect();
    Ok((a2l, warning_strings))
}

/// Load and parse an A2L file from a file path.
pub fn core_load_a2l_from_path(path: &str) -> Result<(a2lfile::A2lFile, Vec<String>), String> {
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    core_load_a2l_from_string(&contents)
}

/// Export an A2L file to its string representation.
pub fn core_export_a2l(a2l: &a2lfile::A2lFile) -> String {
    a2l.write_to_string()
}

// ─── Metadata / entity collection ───────────────────────────────────────────

/// Build metadata summary from an A2L file.
pub fn build_metadata(a2l: &a2lfile::A2lFile, warning_count: usize) -> A2lMetadata {
    let header_comment = a2l
        .project
        .header
        .as_ref()
        .map(|header| header.comment.trim())
        .filter(|comment| !comment.is_empty())
        .map(|comment| comment.to_string());

    let asap2_version = a2l
        .asap2_version
        .as_ref()
        .map(|version| format!("{}.{}", version.version_no, version.upgrade_no));

    A2lMetadata {
        project_name: a2l.project.name.clone(),
        project_long_identifier: a2l.project.long_identifier.clone(),
        module_names: a2l
            .project
            .module
            .iter()
            .map(|module| module.get_name().to_string())
            .collect(),
        header_comment,
        asap2_version,
        warning_count,
    }
}

/// Collect all core entities (Module, Measurement, Characteristic, AxisPts) from an A2L file.
pub fn collect_core_entities(a2l: &a2lfile::A2lFile) -> Vec<CoreEntity> {
    let mut items = Vec::new();
    for module in a2l.project.module.iter() {
        items.push(CoreEntity {
            kind: "Module".to_string(),
            name: module.get_name().to_string(),
            long_identifier: Some(module.long_identifier.clone()),
        });
        for measurement in module.measurement.iter() {
            items.push(CoreEntity {
                kind: "Measurement".to_string(),
                name: measurement.get_name().to_string(),
                long_identifier: None,
            });
        }
        for characteristic in module.characteristic.iter() {
            items.push(CoreEntity {
                kind: "Characteristic".to_string(),
                name: characteristic.get_name().to_string(),
                long_identifier: None,
            });
        }
        for axis_pts in module.axis_pts.iter() {
            items.push(CoreEntity {
                kind: "AxisPts".to_string(),
                name: axis_pts.get_name().to_string(),
                long_identifier: None,
            });
        }
    }
    items
}

// ─── Tree building ──────────────────────────────────────────────────────────

/// Build a tree section from a named item list (e.g., measurements, characteristics).
pub fn build_section_from_list<T: A2lObjectName + std::fmt::Debug + A2lDetailProvider>(
    module_name: &str,
    title: &str,
    kind: &str,
    items: &ItemList<T>,
) -> Option<A2lTreeSection> {
    if items.is_empty() {
        return None;
    }

    let entries = items
        .iter()
        .map(|item| A2lTreeItem {
            id: format!("{module_name}::{kind}::{}", item.get_name()),
            name: item.get_name().to_string(),
            kind: kind.to_string(),
            description: item.description(),
            details: item.details(),
        })
        .collect();

    Some(A2lTreeSection {
        id: format!("{module_name}::{kind}"),
        title: title.to_string(),
        items: entries,
    })
}

/// Build a tree section from a single optional item (e.g., ModCommon, ModPar).
pub fn build_section_from_optional<T: std::fmt::Debug + A2lDetailProvider>(
    module_name: &str,
    title: &str,
    kind: &str,
    item: Option<&T>,
) -> Option<A2lTreeSection> {
    item.map(|value| A2lTreeSection {
        id: format!("{module_name}::{kind}"),
        title: title.to_string(),
        items: vec![A2lTreeItem {
            id: format!("{module_name}::{kind}::0"),
            name: title.to_string(),
            kind: kind.to_string(),
            description: value.description(),
            details: value.details(),
        }],
    })
}

/// Build a tree section from a Vec of unnamed items (e.g., IF_DATA, UserRights).
pub fn build_section_from_vec<T: std::fmt::Debug + A2lDetailProvider>(
    module_name: &str,
    title: &str,
    kind: &str,
    items: &[T],
) -> Option<A2lTreeSection> {
    if items.is_empty() {
        return None;
    }
    Some(A2lTreeSection {
        id: format!("{module_name}::{kind}"),
        title: title.to_string(),
        items: items
            .iter()
            .enumerate()
            .map(|(index, item)| A2lTreeItem {
                id: format!("{module_name}::{kind}::{index}"),
                name: format!("{title} {index}"),
                kind: kind.to_string(),
                description: item.description(),
                details: item.details(),
            })
            .collect(),
    })
}

/// Build the full tree view data structure from an A2L file.
pub fn build_tree(a2l: &a2lfile::A2lFile) -> A2lTree {
    let modules = a2l
        .project
        .module
        .iter()
        .map(|module| {
            let module_name = module.get_name();
            let mut sections = Vec::new();

            if let Some(section) = build_section_from_list(
                module_name,
                "Measurements",
                "Measurement",
                &module.measurement,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Characteristics",
                "Characteristic",
                &module.characteristic,
            ) {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Axis Points", "AxisPts", &module.axis_pts)
            {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Compu Methods",
                "CompuMethod",
                &module.compu_method,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Compu Tables",
                "CompuTab",
                &module.compu_tab,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Compu VTabs",
                "CompuVtab",
                &module.compu_vtab,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Compu VTab Ranges",
                "CompuVtabRange",
                &module.compu_vtab_range,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Record Layouts",
                "RecordLayout",
                &module.record_layout,
            ) {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Functions", "Function", &module.function)
            {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Groups", "Group", &module.group)
            {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Units", "Unit", &module.unit)
            {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Frames", "Frame", &module.frame)
            {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Blobs", "Blob", &module.blob)
            {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_list(module_name, "Instances", "Instance", &module.instance)
            {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Transformers",
                "Transformer",
                &module.transformer,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Typedef Axis",
                "TypedefAxis",
                &module.typedef_axis,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Typedef Blob",
                "TypedefBlob",
                &module.typedef_blob,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Typedef Characteristic",
                "TypedefCharacteristic",
                &module.typedef_characteristic,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Typedef Measurement",
                "TypedefMeasurement",
                &module.typedef_measurement,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(
                module_name,
                "Typedef Structure",
                "TypedefStructure",
                &module.typedef_structure,
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_optional(
                module_name,
                "Mod Common",
                "ModCommon",
                module.mod_common.as_ref(),
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_optional(
                module_name,
                "Mod Par",
                "ModPar",
                module.mod_par.as_ref(),
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_optional(
                module_name,
                "Variant Coding",
                "VariantCoding",
                module.variant_coding.as_ref(),
            ) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_optional(
                module_name,
                "A2ML",
                "A2ML",
                module.a2ml.as_ref(),
            ) {
                sections.push(section);
            }
            if let Some(section) =
                build_section_from_vec(module_name, "IF_DATA", "IfData", &module.if_data)
            {
                sections.push(section);
            }
            if let Some(section) = build_section_from_vec(
                module_name,
                "User Rights",
                "UserRights",
                &module.user_rights,
            ) {
                sections.push(section);
            }

            A2lTreeModule {
                id: module_name.to_string(),
                name: module_name.to_string(),
                long_identifier: module.long_identifier.clone(),
                sections,
            }
        })
        .collect();

    A2lTree { modules }
}

// ─── Data type conversion helpers ───────────────────────────────────────────

/// Parse an A2L data type string into the enum value.
pub fn parse_data_type(type_str: &str) -> a2lfile::DataType {
    match type_str {
        "UBYTE" => a2lfile::DataType::Ubyte,
        "SBYTE" => a2lfile::DataType::Sbyte,
        "UWORD" => a2lfile::DataType::Uword,
        "SWORD" => a2lfile::DataType::Sword,
        "ULONG" => a2lfile::DataType::Ulong,
        "SLONG" => a2lfile::DataType::Slong,
        "A_UINT64" => a2lfile::DataType::AUint64,
        "A_INT64" => a2lfile::DataType::AInt64,
        "FLOAT32_IEEE" => a2lfile::DataType::Float32Ieee,
        "FLOAT64_IEEE" => a2lfile::DataType::Float64Ieee,
        _ => a2lfile::DataType::Ubyte, // Fallback
    }
}

/// Convert an A2L `DataType` enum to its ASAP2 string representation.
pub fn datatype_to_string(dt: &a2lfile::DataType) -> String {
    match dt {
        a2lfile::DataType::Ubyte => "UBYTE".to_string(),
        a2lfile::DataType::Sbyte => "SBYTE".to_string(),
        a2lfile::DataType::Uword => "UWORD".to_string(),
        a2lfile::DataType::Sword => "SWORD".to_string(),
        a2lfile::DataType::Ulong => "ULONG".to_string(),
        a2lfile::DataType::Slong => "SLONG".to_string(),
        a2lfile::DataType::AUint64 => "A_UINT64".to_string(),
        a2lfile::DataType::AInt64 => "A_INT64".to_string(),
        a2lfile::DataType::Float16Ieee => "FLOAT16_IEEE".to_string(),
        a2lfile::DataType::Float32Ieee => "FLOAT32_IEEE".to_string(),
        a2lfile::DataType::Float64Ieee => "FLOAT64_IEEE".to_string(),
    }
}

/// Parse an ASAP2 data type string into its enum value, case-insensitive.
pub fn string_to_datatype(s: &str) -> Option<a2lfile::DataType> {
    match s.to_uppercase().as_str() {
        "UBYTE" => Some(a2lfile::DataType::Ubyte),
        "SBYTE" => Some(a2lfile::DataType::Sbyte),
        "UWORD" => Some(a2lfile::DataType::Uword),
        "SWORD" => Some(a2lfile::DataType::Sword),
        "ULONG" => Some(a2lfile::DataType::Ulong),
        "SLONG" => Some(a2lfile::DataType::Slong),
        "A_UINT64" | "AUINT64" => Some(a2lfile::DataType::AUint64),
        "A_INT64" | "AINT64" => Some(a2lfile::DataType::AInt64),
        "FLOAT16_IEEE" => Some(a2lfile::DataType::Float16Ieee),
        "FLOAT32_IEEE" => Some(a2lfile::DataType::Float32Ieee),
        "FLOAT64_IEEE" => Some(a2lfile::DataType::Float64Ieee),
        _ => None,
    }
}

/// Convert a `CharacteristicType` enum to its ASAP2 string representation.
pub fn characteristic_type_to_string(ct: &a2lfile::CharacteristicType) -> String {
    match ct {
        a2lfile::CharacteristicType::Ascii => "ASCII",
        a2lfile::CharacteristicType::Curve => "CURVE",
        a2lfile::CharacteristicType::Map => "MAP",
        a2lfile::CharacteristicType::Cuboid => "CUBOID",
        a2lfile::CharacteristicType::Cube4 => "CUBE_4",
        a2lfile::CharacteristicType::Cube5 => "CUBE_5",
        a2lfile::CharacteristicType::ValBlk => "VAL_BLK",
        a2lfile::CharacteristicType::Value => "VALUE",
    }
    .to_string()
}

/// Parse an ASAP2 characteristic type string into its enum value, case-insensitive.
pub fn string_to_characteristic_type(s: &str) -> Option<a2lfile::CharacteristicType> {
    match s.to_uppercase().as_str() {
        "ASCII" => Some(a2lfile::CharacteristicType::Ascii),
        "CURVE" => Some(a2lfile::CharacteristicType::Curve),
        "MAP" => Some(a2lfile::CharacteristicType::Map),
        "CUBOID" => Some(a2lfile::CharacteristicType::Cuboid),
        "CUBE_4" | "CUBE4" => Some(a2lfile::CharacteristicType::Cube4),
        "CUBE_5" | "CUBE5" => Some(a2lfile::CharacteristicType::Cube5),
        "VAL_BLK" | "VALBLK" => Some(a2lfile::CharacteristicType::ValBlk),
        "VALUE" => Some(a2lfile::CharacteristicType::Value),
        _ => None,
    }
}

// ─── Measurement CRUD ───────────────────────────────────────────────────────

/// Create measurements from ELF symbol mappings (bulk import).
pub fn core_create_measurements(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<(), String> {
    let target_module = if let Some(name) = module_name {
        a2l.project
            .module
            .iter_mut()
            .find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project
            .module
            .iter_mut()
            .next()
            .ok_or("No modules in project")?
    };

    for sym in symbols {
        let data_type = parse_data_type(&sym.a2l_type);
        let mut m = a2lfile::Measurement::new(
            sym.name.clone(),
            String::new(),
            data_type,
            sym.conversion
                .clone()
                .unwrap_or_else(|| "NO_COMPU_METHOD".to_string()),
            sym.resolution.unwrap_or(1),
            sym.accuracy.unwrap_or(0.0),
            sym.lower_limit,
            sym.upper_limit,
        );
        m.ecu_address = Some(a2lfile::EcuAddress::new(sym.address as u32));
        if !sym.array_dims.is_empty() {
            let mut md = a2lfile::MatrixDim::new();
            md.dim_list = sym.array_dims.iter().map(|&d| d as u16).collect();
            m.matrix_dim = Some(md);
        }
        target_module
            .measurement
            .retain(|existing| existing.get_name() != sym.name);
        target_module.measurement.push(m);
    }
    Ok(())
}

// ─── Characteristic CRUD ────────────────────────────────────────────────────

fn record_layout_name_for_type(a2l_type: &str) -> String {
    format!("__val_{}", a2l_type)
}

/// Ensure a record layout exists for the given A2L type; create if missing.
pub fn ensure_record_layout(module: &mut a2lfile::Module, a2l_type: &str) {
    let rl_name = record_layout_name_for_type(a2l_type);
    if module
        .record_layout
        .iter()
        .any(|r| r.get_name() == rl_name)
    {
        return;
    }
    let data_type = parse_data_type(a2l_type);
    let mut rl = a2lfile::RecordLayout::new(rl_name);
    rl.fnc_values = Some(a2lfile::FncValues::new(
        1,
        data_type,
        a2lfile::IndexMode::ColumnDir,
        a2lfile::AddrType::Direct,
    ));
    module.record_layout.push(rl);
}

/// Create characteristics from ELF symbol mappings (bulk import).
pub fn core_create_characteristics(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<(), String> {
    let target_module = if let Some(name) = module_name {
        a2l.project
            .module
            .iter_mut()
            .find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project
            .module
            .iter_mut()
            .next()
            .ok_or("No modules in project")?
    };

    for sym in symbols {
        ensure_record_layout(target_module, &sym.a2l_type);
        let deposit = record_layout_name_for_type(&sym.a2l_type);
        let char_type = if !sym.array_dims.is_empty() {
            a2lfile::CharacteristicType::ValBlk
        } else {
            a2lfile::CharacteristicType::Value
        };

        // Create COMPU_METHOD + COMPU_VTAB for enum types
        let conversion = if !sym.enum_values.is_empty() {
            let vtab_name = format!("__vtab_{}", sym.name.replace('.', "_"));
            let cm_name = format!("__cm_{}", sym.name.replace('.', "_"));

            // Create COMPU_VTAB (remove old one first)
            target_module
                .compu_vtab
                .retain(|v| v.get_name() != vtab_name);
            let mut vtab = a2lfile::CompuVtab::new(
                vtab_name.clone(),
                format!("Enum for {}", sym.name),
                a2lfile::ConversionType::TabVerb,
                sym.enum_values.len() as u16,
            );
            for (ename, eval) in &sym.enum_values {
                vtab.value_pairs
                    .push(a2lfile::ValuePairsStruct::new(*eval as f64, ename.clone()));
            }
            target_module.compu_vtab.push(vtab);

            // Create COMPU_METHOD referencing the COMPU_VTAB
            target_module
                .compu_method
                .retain(|m| m.get_name() != cm_name);
            let mut cm = a2lfile::CompuMethod::new(
                cm_name.clone(),
                format!("Enum conversion for {}", sym.name),
                a2lfile::ConversionType::TabVerb,
                "%d".to_string(),
                String::new(),
            );
            cm.compu_tab_ref = Some(a2lfile::CompuTabRef::new(vtab_name));
            target_module.compu_method.push(cm);

            cm_name
        } else {
            sym.conversion
                .clone()
                .unwrap_or_else(|| "NO_COMPU_METHOD".to_string())
        };

        let mut c = a2lfile::Characteristic::new(
            sym.name.clone(),
            String::new(),
            char_type,
            sym.address as u32,
            deposit,
            0.0,
            conversion,
            sym.lower_limit,
            sym.upper_limit,
        );
        if !sym.array_dims.is_empty() {
            let mut md = a2lfile::MatrixDim::new();
            md.dim_list = sym.array_dims.iter().map(|&d| d as u16).collect();
            c.matrix_dim = Some(md);
        }
        target_module
            .characteristic
            .retain(|existing| existing.get_name() != sym.name);
        target_module.characteristic.push(c);
    }
    Ok(())
}

// ─── Conflict checking ──────────────────────────────────────────────────────

/// Check for name conflicts between symbols and existing A2L entities.
pub fn core_check_conflicts(
    a2l: &a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<ConflictReport, String> {
    let target_module = if let Some(name) = module_name {
        a2l.project
            .module
            .iter()
            .find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project
            .module
            .first()
            .ok_or("No modules in project")?
    };

    let mut conflicts = Vec::new();
    let mut non_conflicts = Vec::new();

    for sym in symbols {
        if let Some(existing) = target_module
            .measurement
            .iter()
            .find(|m| m.get_name() == sym.name)
        {
            conflicts.push(SymbolConflict {
                symbol_name: sym.name.clone(),
                existing_address: format!(
                    "0x{:X}",
                    existing
                        .ecu_address
                        .as_ref()
                        .map(|a| a.address)
                        .unwrap_or(0)
                ),
                existing_type: format!("{:?}", existing.datatype),
                new_address: format!("0x{:X}", sym.address as u32),
                new_type: sym.a2l_type.clone(),
            });
        } else if let Some(existing) = target_module
            .characteristic
            .iter()
            .find(|c| c.get_name() == sym.name)
        {
            conflicts.push(SymbolConflict {
                symbol_name: sym.name.clone(),
                existing_address: format!("0x{:X}", existing.address),
                existing_type: format!("{:?}", existing.characteristic_type),
                new_address: format!("0x{:X}", sym.address as u32),
                new_type: sym.a2l_type.clone(),
            });
        } else {
            non_conflicts.push(sym.name.clone());
        }
    }

    Ok(ConflictReport {
        conflicts,
        non_conflicts,
    })
}

// ─── ECU address update ─────────────────────────────────────────────────────

/// Update ECU addresses in A2L entities from ELF symbol data.
pub fn core_update_ecu_addresses(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    elf_symbols: &[ElfSymbol],
) -> Result<UpdateEcuAddressesResult, String> {
    let sym_map: HashMap<&str, &ElfSymbol> =
        elf_symbols.iter().map(|s| (s.name.as_str(), s)).collect();

    let target_module = if let Some(name) = module_name {
        a2l.project
            .module
            .iter_mut()
            .find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project
            .module
            .iter_mut()
            .next()
            .ok_or("No modules in project")?
    };

    let mut updated_count = 0usize;
    let mut matched_names = Vec::new();

    // Update measurements
    for measurement in target_module.measurement.iter_mut() {
        let meas_name = measurement.get_name().to_string();
        if let Some(sym) = sym_map.get(meas_name.as_str()) {
            measurement.ecu_address = Some(a2lfile::EcuAddress::new(sym.address as u32));
            if !sym.array_dims.is_empty() {
                let mut md = a2lfile::MatrixDim::new();
                md.dim_list = sym.array_dims.iter().map(|&d| d as u16).collect();
                measurement.matrix_dim = Some(md);
            }
            updated_count += 1;
            matched_names.push(meas_name);
        }
    }

    // Update characteristics
    for characteristic in target_module.characteristic.iter_mut() {
        let char_name = characteristic.get_name().to_string();
        if let Some(sym) = sym_map.get(char_name.as_str()) {
            characteristic.address = sym.address as u32;
            if !sym.array_dims.is_empty() {
                characteristic.characteristic_type = a2lfile::CharacteristicType::ValBlk;
                let mut md = a2lfile::MatrixDim::new();
                md.dim_list = sym.array_dims.iter().map(|&d| d as u16).collect();
                characteristic.matrix_dim = Some(md);
            }
            updated_count += 1;
            matched_names.push(char_name.clone());
        }
    }

    // Update enum COMPU_METHODs and COMPU_VTABs for characteristics with enum values
    for sym in elf_symbols {
        if sym.enum_values.is_empty() {
            continue;
        }
        let vtab_name = format!("__vtab_{}", sym.name.replace('.', "_"));
        let cm_name = format!("__cm_{}", sym.name.replace('.', "_"));

        let char_exists = target_module
            .characteristic
            .iter()
            .any(|c| c.get_name() == sym.name);
        if !char_exists {
            continue;
        }

        // Update COMPU_VTAB
        target_module
            .compu_vtab
            .retain(|v| v.get_name() != vtab_name);
        let mut vtab = a2lfile::CompuVtab::new(
            vtab_name.clone(),
            format!("Enum for {}", sym.name),
            a2lfile::ConversionType::TabVerb,
            sym.enum_values.len() as u16,
        );
        for (ename, eval) in &sym.enum_values {
            vtab.value_pairs
                .push(a2lfile::ValuePairsStruct::new(*eval as f64, ename.clone()));
        }
        target_module.compu_vtab.push(vtab);

        // Update COMPU_METHOD
        target_module
            .compu_method
            .retain(|m| m.get_name() != cm_name);
        let mut cm = a2lfile::CompuMethod::new(
            cm_name.clone(),
            format!("Enum conversion for {}", sym.name),
            a2lfile::ConversionType::TabVerb,
            "%d".to_string(),
            String::new(),
        );
        cm.compu_tab_ref = Some(a2lfile::CompuTabRef::new(vtab_name));
        target_module.compu_method.push(cm);

        // Update characteristic conversion reference
        if let Some(c) = target_module
            .characteristic
            .iter_mut()
            .find(|c| c.get_name() == sym.name)
        {
            c.conversion = cm_name;
        }
    }

    Ok(UpdateEcuAddressesResult {
        updated_count,
        matched_names,
    })
}

// ─── Entity deletion ────────────────────────────────────────────────────────

/// Delete entities from the A2L file. Returns the number of entities deleted.
pub fn core_delete_entities(
    a2l: &mut a2lfile::A2lFile,
    entities: &[DeleteEntityRequest],
) -> usize {
    let mut deleted = 0usize;
    for module in a2l.project.module.iter_mut() {
        for req in entities {
            let before: usize;
            match req.kind.as_str() {
                "Measurement" => {
                    before = module.measurement.len();
                    module
                        .measurement
                        .retain(|m| m.get_name() != req.name);
                    deleted += before - module.measurement.len();
                }
                "Characteristic" => {
                    before = module.characteristic.len();
                    module
                        .characteristic
                        .retain(|c| c.get_name() != req.name);
                    deleted += before - module.characteristic.len();
                }
                "AxisPts" => {
                    before = module.axis_pts.len();
                    module
                        .axis_pts
                        .retain(|a| a.get_name() != req.name);
                    deleted += before - module.axis_pts.len();
                }
                "CompuMethod" => {
                    before = module.compu_method.len();
                    module
                        .compu_method
                        .retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_method.len();
                }
                "CompuTab" => {
                    before = module.compu_tab.len();
                    module
                        .compu_tab
                        .retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_tab.len();
                }
                "CompuVtab" => {
                    before = module.compu_vtab.len();
                    module
                        .compu_vtab
                        .retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_vtab.len();
                }
                "CompuVtabRange" => {
                    before = module.compu_vtab_range.len();
                    module
                        .compu_vtab_range
                        .retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_vtab_range.len();
                }
                "RecordLayout" => {
                    before = module.record_layout.len();
                    module
                        .record_layout
                        .retain(|r| r.get_name() != req.name);
                    deleted += before - module.record_layout.len();
                }
                "Function" => {
                    before = module.function.len();
                    module
                        .function
                        .retain(|f| f.get_name() != req.name);
                    deleted += before - module.function.len();
                }
                "Group" => {
                    before = module.group.len();
                    module.group.retain(|g| g.get_name() != req.name);
                    deleted += before - module.group.len();
                }
                "Unit" => {
                    before = module.unit.len();
                    module.unit.retain(|u| u.get_name() != req.name);
                    deleted += before - module.unit.len();
                }
                "Frame" => {
                    before = module.frame.len();
                    module.frame.retain(|f| f.get_name() != req.name);
                    deleted += before - module.frame.len();
                }
                "Blob" => {
                    before = module.blob.len();
                    module.blob.retain(|b| b.get_name() != req.name);
                    deleted += before - module.blob.len();
                }
                "Instance" => {
                    before = module.instance.len();
                    module
                        .instance
                        .retain(|i| i.get_name() != req.name);
                    deleted += before - module.instance.len();
                }
                "Transformer" => {
                    before = module.transformer.len();
                    module
                        .transformer
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.transformer.len();
                }
                "TypedefAxis" => {
                    before = module.typedef_axis.len();
                    module
                        .typedef_axis
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_axis.len();
                }
                "TypedefBlob" => {
                    before = module.typedef_blob.len();
                    module
                        .typedef_blob
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_blob.len();
                }
                "TypedefCharacteristic" => {
                    before = module.typedef_characteristic.len();
                    module
                        .typedef_characteristic
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_characteristic.len();
                }
                "TypedefMeasurement" => {
                    before = module.typedef_measurement.len();
                    module
                        .typedef_measurement
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_measurement.len();
                }
                "TypedefStructure" => {
                    before = module.typedef_structure.len();
                    module
                        .typedef_structure
                        .retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_structure.len();
                }
                _ => {}
            }
        }
    }
    deleted
}

// ─── Manual entity creation ─────────────────────────────────────────────────

/// Helper to find a module by name (or first module if None).
fn find_module_mut<'a>(
    a2l: &'a mut a2lfile::A2lFile,
    module_name: Option<&str>,
) -> Result<&'a mut a2lfile::Module, String> {
    if let Some(name) = module_name {
        a2l.project
            .module
            .iter_mut()
            .find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))
    } else {
        a2l.project
            .module
            .iter_mut()
            .next()
            .ok_or("No modules in project".to_string())
    }
}

/// Create a measurement manually from user-provided data.
pub fn core_create_measurement_manual(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &MeasurementData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    // Reject duplicate names
    if target_module.measurement.iter().any(|m| m.get_name() == data.name)
        || target_module.characteristic.iter().any(|c| c.get_name() == data.name)
        || target_module.axis_pts.iter().any(|a| a.get_name() == data.name)
    {
        return Err(format!("Entity '{}' already exists in module", data.name));
    }

    let data_type = string_to_datatype(&data.datatype)
        .ok_or_else(|| format!("Invalid data type: {}", data.datatype))?;

    let mut m = a2lfile::Measurement::new(
        data.name.clone(),
        data.long_identifier.clone(),
        data_type,
        data.conversion.clone(),
        data.resolution as u16,
        data.accuracy,
        data.lower_limit,
        data.upper_limit,
    );

    if let Some(ref addr_str) = data.ecu_address {
        if !addr_str.trim().is_empty() {
            let clean = addr_str.trim().trim_start_matches("0x").trim_start_matches("0X");
            let addr_val = u32::from_str_radix(clean, 16).map_err(|_| "Invalid hex address")?;
            m.ecu_address = Some(a2lfile::EcuAddress::new(addr_val));
        }
    }

    target_module.measurement.push(m);
    Ok(())
}

/// Create a characteristic manually from user-provided data.
pub fn core_create_characteristic_manual(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &CharacteristicData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    // Reject duplicate names
    if target_module.measurement.iter().any(|m| m.get_name() == data.name)
        || target_module.characteristic.iter().any(|c| c.get_name() == data.name)
        || target_module.axis_pts.iter().any(|a| a.get_name() == data.name)
    {
        return Err(format!("Entity '{}' already exists in module", data.name));
    }

    let char_type = string_to_characteristic_type(&data.characteristic_type)
        .ok_or_else(|| format!("Invalid characteristic type: {}", data.characteristic_type))?;

    let clean_addr = data.address.trim().trim_start_matches("0x").trim_start_matches("0X");
    let addr_val = u32::from_str_radix(clean_addr, 16).map_err(|_| "Invalid hex address")?;

    let new_bit_mask = match &data.bit_mask {
        Some(s) if !s.trim().is_empty() => {
            let clean = s.trim().trim_start_matches("0x").trim_start_matches("0X");
            let mask_val = u64::from_str_radix(clean, 16).map_err(|_| "Invalid hex bit mask")?;
            Some(a2lfile::BitMask::new(mask_val))
        }
        _ => None,
    };

    let mut c = a2lfile::Characteristic::new(
        data.name.clone(),
        data.long_identifier.clone(),
        char_type,
        addr_val,
        data.deposit.clone(),
        data.max_diff,
        data.conversion.clone(),
        data.lower_limit,
        data.upper_limit,
    );
    c.bit_mask = new_bit_mask;

    target_module.characteristic.push(c);
    Ok(())
}

/// Create an axis_pts entity manually from user-provided data.
pub fn core_create_axis_pts_manual(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &AxisPtsData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    // Reject duplicate names
    if target_module.measurement.iter().any(|m| m.get_name() == data.name)
        || target_module.characteristic.iter().any(|c| c.get_name() == data.name)
        || target_module.axis_pts.iter().any(|a| a.get_name() == data.name)
    {
        return Err(format!("Entity '{}' already exists in module", data.name));
    }

    let clean_addr = data.address.trim().trim_start_matches("0x").trim_start_matches("0X");
    let addr_val = u32::from_str_radix(clean_addr, 16).map_err(|_| "Invalid hex address")?;

    let a = a2lfile::AxisPts::new(
        data.name.clone(),
        data.long_identifier.clone(),
        addr_val,
        data.input_quantity.clone(),
        data.deposit_record.clone(),
        data.max_diff,
        data.conversion.clone(),
        data.max_axis_points,
        data.lower_limit,
        data.upper_limit,
    );

    target_module.axis_pts.push(a);
    Ok(())
}

/// Create a CompuMethod manually.
pub fn core_create_compu_method(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &CompuMethodData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    if target_module.compu_method.iter().any(|cm| cm.get_name() == data.name) {
        return Err(format!("CompuMethod '{}' already exists", data.name));
    }

    let conv_type = match data.conversion_type.to_uppercase().as_str() {
        "IDENTICAL" => a2lfile::ConversionType::Identical,
        "LINEAR" => a2lfile::ConversionType::Linear,
        "RAT_FUNC" => a2lfile::ConversionType::RatFunc,
        "TAB_INTP" => a2lfile::ConversionType::TabIntp,
        "TAB_NOINTP" => a2lfile::ConversionType::TabNointp,
        "TAB_VERB" => a2lfile::ConversionType::TabVerb,
        "FORM" => a2lfile::ConversionType::Form,
        _ => return Err(format!("Invalid conversion type: {}", data.conversion_type)),
    };

    let mut cm = a2lfile::CompuMethod::new(
        data.name.clone(),
        data.long_identifier.clone(),
        conv_type,
        data.format.clone(),
        data.unit.clone(),
    );

    if let Some(coeffs) = &data.coeffs {
        cm.coeffs = Some(a2lfile::Coeffs::new(
            coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4], coeffs[5],
        ));
    }

    if let Some(ref tab_ref) = data.compu_tab_ref {
        cm.compu_tab_ref = Some(a2lfile::CompuTabRef::new(tab_ref.clone()));
    }

    target_module.compu_method.push(cm);
    Ok(())
}

/// Create a CompuVtab manually.
pub fn core_create_compu_vtab(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &CompuVtabData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    if target_module.compu_vtab.iter().any(|cv| cv.get_name() == data.name) {
        return Err(format!("CompuVtab '{}' already exists", data.name));
    }

    let mut vtab = a2lfile::CompuVtab::new(
        data.name.clone(),
        data.long_identifier.clone(),
        a2lfile::ConversionType::TabVerb,
        data.value_pairs.len() as u16,
    );

    for (val, label) in &data.value_pairs {
        vtab.value_pairs.push(a2lfile::ValuePairsStruct::new(*val, label.clone()));
    }

    if let Some(ref default) = data.default_value {
        vtab.default_value = Some(a2lfile::DefaultValue::new(default.clone()));
    }

    target_module.compu_vtab.push(vtab);
    Ok(())
}

/// Create a RecordLayout manually.
pub fn core_create_record_layout(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    data: &RecordLayoutData,
) -> Result<(), String> {
    let target_module = find_module_mut(a2l, module_name)?;

    if target_module.record_layout.iter().any(|rl| rl.get_name() == data.name) {
        return Err(format!("RecordLayout '{}' already exists", data.name));
    }

    let mut rl = a2lfile::RecordLayout::new(data.name.clone());

    if let Some(ref dt_str) = data.fnc_values_datatype {
        let data_type = parse_data_type(dt_str);
        rl.fnc_values = Some(a2lfile::FncValues::new(
            1,
            data_type,
            a2lfile::IndexMode::ColumnDir,
            a2lfile::AddrType::Direct,
        ));
    }

    target_module.record_layout.push(rl);
    Ok(())
}
