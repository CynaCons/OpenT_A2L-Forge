//! Shared types, traits, and serialization structures for the A2L-Forge backend.
//!
//! This module contains all data transfer objects (DTOs) used between the Rust backend
//! and the TypeScript frontend, as well as the `A2lDetailProvider` trait for generating
//! tree view details from A2L entities.

use serde::{Deserialize, Serialize};

// ─── Tree / metadata types ──────────────────────────────────────────────────

/// Summary metadata for the loaded A2L project, sent to the frontend on load.
#[derive(Serialize)]
pub struct A2lMetadata {
    pub project_name: String,
    pub project_long_identifier: String,
    pub module_names: Vec<String>,
    pub header_comment: Option<String>,
    pub asap2_version: Option<String>,
    pub warning_count: usize,
}

/// Lightweight representation of an A2L entity for list views.
#[derive(Serialize, Clone)]
pub struct CoreEntity {
    pub kind: String,
    pub name: String,
    pub long_identifier: Option<String>,
}

/// Combined response after an entity mutation: refreshed metadata and entity list.
#[derive(Serialize)]
pub struct EntityUpdateResult {
    pub metadata: A2lMetadata,
    pub entities: Vec<CoreEntity>,
}

/// A single label-value pair displayed in the tree detail panel.
#[derive(Serialize, Clone)]
pub struct A2lTreeDetail {
    pub label: String,
    pub value: String,
}

/// A single entity node in the tree view with its detail rows.
#[derive(Serialize)]
pub struct A2lTreeItem {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub description: Option<String>,
    pub details: Vec<A2lTreeDetail>,
}

/// A section grouping items of the same entity kind within a module.
#[derive(Serialize)]
pub struct A2lTreeSection {
    pub id: String,
    pub title: String,
    pub items: Vec<A2lTreeItem>,
}

/// A module node in the tree view containing its entity sections.
#[derive(Serialize)]
pub struct A2lTreeModule {
    pub id: String,
    pub name: String,
    pub long_identifier: String,
    pub sections: Vec<A2lTreeSection>,
}

/// The complete hierarchical tree structure of all A2L entities.
#[derive(Serialize)]
pub struct A2lTree {
    pub modules: Vec<A2lTreeModule>,
}

// ─── A2lDetailProvider trait + helpers ───────────────────────────────────────

/// Trait for A2L entities that can provide tree view details and descriptions.
pub trait A2lDetailProvider {
    fn description(&self) -> Option<String> {
        None
    }
    fn details(&self) -> Vec<A2lTreeDetail>;
}

/// Create a detail row from a label and any displayable value.
pub fn detail(label: &str, value: impl ToString) -> A2lTreeDetail {
    A2lTreeDetail {
        label: label.to_string(),
        value: value.to_string(),
    }
}

/// Create a detail row for an optional field, rendering `None` as "--".
pub fn opt_detail<T: std::fmt::Debug>(label: &str, value: &Option<T>) -> A2lTreeDetail {
    let rendered = value
        .as_ref()
        .map(|item| format!("{item:?}"))
        .unwrap_or_else(|| "—".to_string());
    detail(label, rendered)
}

/// Create a detail row showing a count of items.
pub fn count_detail(label: &str, count: usize) -> A2lTreeDetail {
    detail(label, count)
}

/// Create a detail row displaying a lower..upper limit range.
pub fn limits_detail(lower: f64, upper: f64) -> A2lTreeDetail {
    detail("Limits", format!("{lower} .. {upper}"))
}

/// Create a detail row for an optional ECU address, formatted as hex.
pub fn ecu_addr_detail(label: &str, addr: &Option<a2lfile::EcuAddress>) -> A2lTreeDetail {
    let rendered = addr
        .as_ref()
        .map(|a| format!("0x{:08X}", a.address))
        .unwrap_or_else(|| "—".to_string());
    detail(label, rendered)
}

// ─── A2lDetailProvider impls for a2lfile types ──────────────────────────────

impl A2lDetailProvider for a2lfile::Measurement {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Datatype", format!("{:?}", self.datatype)),
            detail("Conversion", self.conversion.clone()),
            detail("Resolution", self.resolution),
            detail("Accuracy", self.accuracy),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Address type", &self.address_type),
            ecu_addr_detail("ECU address", &self.ecu_address),
            opt_detail("ECU address ext", &self.ecu_address_extension),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Array size", &self.array_size),
            opt_detail("Bit mask", &self.bit_mask),
            opt_detail("Bit operation", &self.bit_operation),
            opt_detail("Display identifier", &self.display_identifier),
            opt_detail("Format", &self.format),
            opt_detail("Function list", &self.function_list),
            opt_detail("Layout", &self.layout),
            opt_detail("Matrix dim", &self.matrix_dim),
            opt_detail("Max refresh", &self.max_refresh),
            opt_detail("Model link", &self.model_link),
            opt_detail("Phys unit", &self.phys_unit),
            opt_detail("Read/Write", &self.read_write),
            opt_detail("Ref memory segment", &self.ref_memory_segment),
            opt_detail("Symbol link", &self.symbol_link),
            opt_detail("Virtual", &self.var_virtual),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Characteristic {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Type", format!("{:?}", self.characteristic_type)),
            detail("Address", format!("0x{:X}", self.address)),
            detail("Deposit", self.deposit.clone()),
            detail("Max diff", self.max_diff),
            detail("Conversion", self.conversion.clone()),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Bit mask", &self.bit_mask),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Calibration access", &self.calibration_access),
            opt_detail("Display identifier", &self.display_identifier),
            opt_detail("Encoding", &self.encoding),
            opt_detail("Extended limits", &self.extended_limits),
            opt_detail("Format", &self.format),
            opt_detail("Function list", &self.function_list),
            opt_detail("Guard rails", &self.guard_rails),
            opt_detail("Matrix dim", &self.matrix_dim),
            opt_detail("Max refresh", &self.max_refresh),
            opt_detail("Model link", &self.model_link),
            opt_detail("Phys unit", &self.phys_unit),
            opt_detail("Read only", &self.read_only),
            opt_detail("Ref memory segment", &self.ref_memory_segment),
            opt_detail("Step size", &self.step_size),
            opt_detail("Symbol link", &self.symbol_link),
            count_detail("Axis descriptors", self.axis_descr.len()),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::AxisPts {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Address", format!("0x{:X}", self.address)),
            detail("Input quantity", self.input_quantity.clone()),
            detail("Deposit record", self.deposit_record.clone()),
            detail("Max diff", self.max_diff),
            detail("Conversion", self.conversion.clone()),
            detail("Max axis points", self.max_axis_points),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Calibration access", &self.calibration_access),
            opt_detail("Deposit", &self.deposit),
            opt_detail("Display identifier", &self.display_identifier),
            opt_detail("Extended limits", &self.extended_limits),
            opt_detail("Format", &self.format),
            opt_detail("Function list", &self.function_list),
            opt_detail("Guard rails", &self.guard_rails),
            opt_detail("Max refresh", &self.max_refresh),
            opt_detail("Model link", &self.model_link),
            opt_detail("Monotony", &self.monotony),
            opt_detail("Phys unit", &self.phys_unit),
            opt_detail("Read only", &self.read_only),
            opt_detail("Ref memory segment", &self.ref_memory_segment),
            opt_detail("Step size", &self.step_size),
            opt_detail("Symbol link", &self.symbol_link),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::CompuMethod {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Conversion type", format!("{:?}", self.conversion_type)),
            detail("Format", self.format.clone()),
            detail("Unit", self.unit.clone()),
            opt_detail("Coeffs", &self.coeffs),
            opt_detail("Coeffs linear", &self.coeffs_linear),
            opt_detail("Compu tab ref", &self.compu_tab_ref),
            opt_detail("Formula", &self.formula),
            opt_detail("Ref unit", &self.ref_unit),
            opt_detail("Status string ref", &self.status_string_ref),
        ]
    }
}

impl A2lDetailProvider for a2lfile::CompuTab {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Conversion type", format!("{:?}", self.conversion_type)),
            detail("Value pairs", self.number_value_pairs),
            count_detail("Entries", self.tab_entry.len()),
            opt_detail("Default value", &self.default_value),
            opt_detail("Default value numeric", &self.default_value_numeric),
        ]
    }
}

impl A2lDetailProvider for a2lfile::CompuVtab {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Conversion type", format!("{:?}", self.conversion_type)),
            detail("Value pairs", self.number_value_pairs),
            count_detail("Entries", self.value_pairs.len()),
            opt_detail("Default value", &self.default_value),
        ]
    }
}

impl A2lDetailProvider for a2lfile::CompuVtabRange {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Value triples", self.number_value_triples),
            count_detail("Entries", self.value_triples.len()),
            opt_detail("Default value", &self.default_value),
        ]
    }
}

impl A2lDetailProvider for a2lfile::RecordLayout {
    fn details(&self) -> Vec<A2lTreeDetail> {
        let mut present = 0;
        let flags = [
            self.alignment_byte.is_some(),
            self.alignment_float16_ieee.is_some(),
            self.alignment_float32_ieee.is_some(),
            self.alignment_float64_ieee.is_some(),
            self.alignment_int64.is_some(),
            self.alignment_long.is_some(),
            self.alignment_word.is_some(),
            self.axis_pts_x.is_some(),
            self.axis_pts_y.is_some(),
            self.axis_pts_z.is_some(),
            self.axis_pts_4.is_some(),
            self.axis_pts_5.is_some(),
            self.fnc_values.is_some(),
            self.identification.is_some(),
            self.static_record_layout.is_some(),
            self.static_address_offsets.is_some(),
        ];
        for flag in flags {
            if flag {
                present += 1;
            }
        }
        vec![
            detail("Fields set", present),
            count_detail("Reserved entries", self.reserved.len()),
            opt_detail("Static record layout", &self.static_record_layout),
            opt_detail("Static address offsets", &self.static_address_offsets),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Function {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            opt_detail("AR component", &self.ar_component),
            opt_detail("Def characteristic", &self.def_characteristic),
            opt_detail("Function version", &self.function_version),
            opt_detail("In measurement", &self.in_measurement),
            opt_detail("Loc measurement", &self.loc_measurement),
            opt_detail("Out measurement", &self.out_measurement),
            opt_detail("Ref characteristic", &self.ref_characteristic),
            opt_detail("Sub function", &self.sub_function),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Group {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            opt_detail("Function list", &self.function_list),
            opt_detail("Ref characteristic", &self.ref_characteristic),
            opt_detail("Ref measurement", &self.ref_measurement),
            opt_detail("Root", &self.root),
            opt_detail("Sub group", &self.sub_group),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Unit {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Display", self.display.clone()),
            detail("Unit type", format!("{:?}", self.unit_type)),
            opt_detail("Ref unit", &self.ref_unit),
            opt_detail("SI exponents", &self.si_exponents),
            opt_detail("Unit conversion", &self.unit_conversion),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Frame {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Scaling unit", self.scaling_unit),
            detail("Rate", self.rate),
            opt_detail("Frame measurement", &self.frame_measurement),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Blob {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Start address", format!("0x{:X}", self.start_address)),
            detail("Size", self.size),
            opt_detail("Address type", &self.address_type),
            opt_detail("Calibration access", &self.calibration_access),
            opt_detail("Display identifier", &self.display_identifier),
            opt_detail("ECU address ext", &self.ecu_address_extension),
            opt_detail("Max refresh", &self.max_refresh),
            opt_detail("Model link", &self.model_link),
            opt_detail("Symbol link", &self.symbol_link),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Instance {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Type ref", self.type_ref.clone()),
            detail("Start address", format!("0x{:X}", self.start_address)),
            opt_detail("Address type", &self.address_type),
            opt_detail("Calibration access", &self.calibration_access),
            opt_detail("Display identifier", &self.display_identifier),
            opt_detail("ECU address ext", &self.ecu_address_extension),
            opt_detail("Layout", &self.layout),
            opt_detail("Matrix dim", &self.matrix_dim),
            opt_detail("Max refresh", &self.max_refresh),
            opt_detail("Model link", &self.model_link),
            opt_detail("Read/Write", &self.read_write),
            opt_detail("Symbol link", &self.symbol_link),
            count_detail("Overwrite entries", self.overwrite.len()),
            count_detail("Annotations", self.annotation.len()),
            count_detail("IF_DATA blocks", self.if_data.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::Transformer {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Version", self.version.clone()),
            detail("DLL (32-bit)", self.dllname_32bit.clone()),
            detail("DLL (64-bit)", self.dllname_64bit.clone()),
            detail("Timeout", self.timeout),
            detail("Trigger", format!("{:?}", self.trigger)),
            detail("Inverse transformer", self.inverse_transformer.clone()),
            opt_detail("In objects", &self.transformer_in_objects),
            opt_detail("Out objects", &self.transformer_out_objects),
        ]
    }
}

impl A2lDetailProvider for a2lfile::TypedefAxis {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Input quantity", self.input_quantity.clone()),
            detail("Record layout", self.record_layout.clone()),
            detail("Max diff", self.max_diff),
            detail("Conversion", self.conversion.clone()),
            detail("Max axis points", self.max_axis_points),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Deposit", &self.deposit),
            opt_detail("Extended limits", &self.extended_limits),
            opt_detail("Format", &self.format),
            opt_detail("Monotony", &self.monotony),
            opt_detail("Phys unit", &self.phys_unit),
            opt_detail("Step size", &self.step_size),
        ]
    }
}

impl A2lDetailProvider for a2lfile::TypedefBlob {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Size", self.size),
            opt_detail("Address type", &self.address_type),
        ]
    }
}

impl A2lDetailProvider for a2lfile::TypedefCharacteristic {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Type", format!("{:?}", self.characteristic_type)),
            detail("Record layout", self.record_layout.clone()),
            detail("Max diff", self.max_diff),
            detail("Conversion", self.conversion.clone()),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Bit mask", &self.bit_mask),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Discrete", &self.discrete),
            opt_detail("Encoding", &self.encoding),
            opt_detail("Extended limits", &self.extended_limits),
            opt_detail("Format", &self.format),
            opt_detail("Matrix dim", &self.matrix_dim),
            opt_detail("Number", &self.number),
            opt_detail("Phys unit", &self.phys_unit),
            opt_detail("Step size", &self.step_size),
            count_detail("Axis descriptors", self.axis_descr.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::TypedefMeasurement {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Datatype", format!("{:?}", self.datatype)),
            detail("Conversion", self.conversion.clone()),
            detail("Resolution", self.resolution),
            detail("Accuracy", self.accuracy),
            limits_detail(self.lower_limit, self.upper_limit),
            opt_detail("Address type", &self.address_type),
            opt_detail("Bit mask", &self.bit_mask),
            opt_detail("Bit operation", &self.bit_operation),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Discrete", &self.discrete),
            opt_detail("Error mask", &self.error_mask),
            opt_detail("Format", &self.format),
            opt_detail("Layout", &self.layout),
            opt_detail("Matrix dim", &self.matrix_dim),
            opt_detail("Phys unit", &self.phys_unit),
        ]
    }
}

impl A2lDetailProvider for a2lfile::TypedefStructure {
    fn description(&self) -> Option<String> {
        (!self.long_identifier.is_empty()).then(|| self.long_identifier.clone())
    }

    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Long identifier", self.long_identifier.clone()),
            detail("Total size", self.total_size),
            opt_detail("Address type", &self.address_type),
            opt_detail("Consistent exchange", &self.consistent_exchange),
            opt_detail("Symbol type link", &self.symbol_type_link),
            count_detail("Structure components", self.structure_component.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::ModCommon {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Comment", self.comment.clone()),
            opt_detail("Byte order", &self.byte_order),
            opt_detail("Data size", &self.data_size),
            opt_detail("Deposit", &self.deposit),
            opt_detail("S-Rec layout", &self.s_rec_layout),
            opt_detail("Alignment byte", &self.alignment_byte),
            opt_detail("Alignment float16", &self.alignment_float16_ieee),
            opt_detail("Alignment float32", &self.alignment_float32_ieee),
            opt_detail("Alignment float64", &self.alignment_float64_ieee),
            opt_detail("Alignment int64", &self.alignment_int64),
            opt_detail("Alignment long", &self.alignment_long),
            opt_detail("Alignment word", &self.alignment_word),
        ]
    }
}

impl A2lDetailProvider for a2lfile::ModPar {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Comment", self.comment.clone()),
            opt_detail("CPU type", &self.cpu_type),
            opt_detail("Customer", &self.customer),
            opt_detail("Customer no", &self.customer_no),
            opt_detail("ECU", &self.ecu),
            opt_detail("EPK", &self.epk),
            opt_detail("No. of interfaces", &self.no_of_interfaces),
            opt_detail("Supplier", &self.supplier),
            opt_detail("User", &self.user),
            opt_detail("Version", &self.version),
            count_detail("Addr EPK", self.addr_epk.len()),
            count_detail("Calibration methods", self.calibration_method.len()),
            count_detail("Memory layouts", self.memory_layout.len()),
            count_detail("Memory segments", self.memory_segment.len()),
            count_detail("System constants", self.system_constant.len()),
        ]
    }
}

impl A2lDetailProvider for a2lfile::VariantCoding {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            count_detail("Var characteristic", self.var_characteristic.len()),
            count_detail("Var criterion", self.var_criterion.len()),
            count_detail("Var forbidden comb", self.var_forbidden_comb.len()),
            opt_detail("Var naming", &self.var_naming),
            opt_detail("Var separator", &self.var_separator),
        ]
    }
}

impl A2lDetailProvider for a2lfile::A2ml {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![detail("A2ML text length", self.a2ml_text.len())]
    }
}

impl A2lDetailProvider for a2lfile::IfData {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("Valid", self.ifdata_valid),
            detail(
                "Items",
                self.ifdata_items
                    .as_ref()
                    .map(|_| "present")
                    .unwrap_or("none"),
            ),
        ]
    }
}

impl A2lDetailProvider for a2lfile::UserRights {
    fn details(&self) -> Vec<A2lTreeDetail> {
        vec![
            detail("User level", self.user_level_id.clone()),
            opt_detail("Read only", &self.read_only),
            count_detail("Ref groups", self.ref_group.len()),
        ]
    }
}

// ─── ELF symbol types ───────────────────────────────────────────────────────

/// A symbol extracted from an ELF binary with inferred A2L type information.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ElfSymbol {
    pub name: String,
    pub address: u64,
    pub size: u64,
    pub bind: String,
    pub type_str: String,
    pub section: String,
    pub suggested_a2l_type: String,
    pub suggested_limits: (f64, f64),
    pub address_warning: Option<String>,
    pub dwarf_type: Option<String>,
    pub is_struct_member: bool,
    pub parent_struct: Option<String>,
    /// For array/matrix: dimensions list. Empty means not an array.
    #[serde(default)]
    pub array_dims: Vec<u64>,
    /// For enum types: list of (enumerator_name, value) pairs.
    #[serde(default)]
    pub enum_values: Vec<(String, i64)>,
}

/// An ELF symbol with user-specified A2L type mapping for import.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SymbolWithMapping {
    pub name: String,
    pub address: u64,
    pub a2l_type: String,
    pub lower_limit: f64,
    pub upper_limit: f64,
    pub conversion: Option<String>,
    pub resolution: Option<u16>,
    pub accuracy: Option<f64>,
    #[serde(default)]
    pub array_dims: Vec<u64>,
    #[serde(default)]
    pub enum_values: Vec<(String, i64)>,
}

/// Describes a name conflict between an ELF symbol and an existing A2L entity.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SymbolConflict {
    pub symbol_name: String,
    pub existing_address: String,
    pub existing_type: String,
    pub new_address: String,
    pub new_type: String,
}

/// Result of checking ELF symbols against existing A2L entities for conflicts.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConflictReport {
    pub conflicts: Vec<SymbolConflict>,
    pub non_conflicts: Vec<String>,
}

/// Result of updating ECU addresses from ELF symbols.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateEcuAddressesResult {
    pub updated_count: usize,
    pub matched_names: Vec<String>,
}

// ─── Entity data types (for get/update commands) ────────────────────────────

/// DTO for reading/writing measurement entity fields.
#[derive(Serialize, Deserialize)]
pub struct MeasurementData {
    pub name: String,
    pub long_identifier: String,
    pub datatype: String,
    pub conversion: String,
    pub resolution: f64,
    pub accuracy: f64,
    pub lower_limit: f64,
    pub upper_limit: f64,
    pub ecu_address: Option<String>,
}

/// DTO for reading/writing characteristic entity fields.
#[derive(Serialize, Deserialize)]
pub struct CharacteristicData {
    pub name: String,
    pub long_identifier: String,
    pub characteristic_type: String,
    pub address: String,
    pub deposit: String,
    pub max_diff: f64,
    pub conversion: String,
    pub lower_limit: f64,
    pub upper_limit: f64,
    pub bit_mask: Option<String>,
}

/// DTO for reading/writing axis points entity fields.
#[derive(Serialize, Deserialize)]
pub struct AxisPtsData {
    pub name: String,
    pub long_identifier: String,
    pub address: String,
    pub input_quantity: String,
    pub deposit_record: String,
    pub max_diff: f64,
    pub conversion: String,
    pub max_axis_points: u16,
    pub lower_limit: f64,
    pub upper_limit: f64,
}

/// Request to delete an entity, identified by kind and name.
#[derive(Deserialize)]
pub struct DeleteEntityRequest {
    pub kind: String,
    pub name: String,
}

// ─── Manual entity creation types ───────────────────────────────────────────

/// Data for creating a CompuMethod manually.
#[derive(Serialize, Deserialize)]
pub struct CompuMethodData {
    pub name: String,
    pub long_identifier: String,
    pub conversion_type: String,
    pub format: String,
    pub unit: String,
    pub coeffs: Option<[f64; 6]>,
    pub compu_tab_ref: Option<String>,
}

/// Data for creating a CompuVtab manually.
#[derive(Serialize, Deserialize)]
pub struct CompuVtabData {
    pub name: String,
    pub long_identifier: String,
    pub value_pairs: Vec<(f64, String)>,
    pub default_value: Option<String>,
}

/// Data for creating a RecordLayout manually.
#[derive(Serialize, Deserialize)]
pub struct RecordLayoutData {
    pub name: String,
    pub fnc_values_datatype: Option<String>,
}

// ─── DWARF info types ───────────────────────────────────────────────────────

/// Type and structure information extracted from DWARF debug info for a symbol.
#[derive(Clone, Debug)]
pub struct DwarfSymbolInfo {
    pub type_name: String,
    /// For struct members
    pub members: Vec<DwarfMemberInfo>,
    /// If this variable's type resolves to an enum, the (name, value) pairs
    pub enum_variants: Vec<(String, i64)>,
    /// If the variable is an array/matrix, the dimensions. Empty = not an array.
    pub array_dims: Vec<u64>,
    /// For arrays: the element type name (e.g. "float")
    pub element_type_name: Option<String>,
    /// For arrays: the element byte size
    pub element_size: u64,
}

/// Information about a single struct member from DWARF debug info.
#[derive(Clone, Debug)]
pub struct DwarfMemberInfo {
    pub name: String,
    pub offset: u64,
    pub size: u64,
    pub type_name: String,
    /// If this member is an array/matrix, the dimensions. Empty = not an array.
    pub array_dims: Vec<u64>,
    /// For arrays: the element type name (e.g. "uint16_t")
    pub element_type_name: Option<String>,
    /// For arrays: the element byte size
    pub element_size: u64,
    /// If this member's type resolves to an enum, the (name, value) pairs
    pub enum_variants: Vec<(String, i64)>,
}
