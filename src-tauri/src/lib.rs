use std::sync::Mutex;
use std::fs;
use std::collections::HashMap;
use std::path::PathBuf;
use goblin::elf::Elf;
use notify::{Watcher, RecursiveMode, Event, EventKind};

use serde::{Serialize, Deserialize};
use tauri::Emitter;
use a2lfile::{A2lObjectName, A2lObjectNameSetter, Header, ItemList};

struct AppState {
    a2l: Mutex<Option<a2lfile::A2lFile>>,
    elf_path: Mutex<Option<String>>,
    elf_symbols_cache: Mutex<Vec<ElfSymbol>>,
    watcher_shutdown: Mutex<Option<std::sync::mpsc::Sender<()>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            a2l: Mutex::new(None),
            elf_path: Mutex::new(None),
            elf_symbols_cache: Mutex::new(Vec::new()),
            watcher_shutdown: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
struct A2lMetadata {
    project_name: String,
    project_long_identifier: String,
    module_names: Vec<String>,
    header_comment: Option<String>,
    asap2_version: Option<String>,
    warning_count: usize,
}

#[derive(Serialize, Clone)]
struct CoreEntity {
    kind: String,
    name: String,
    long_identifier: Option<String>,
}

#[derive(Serialize)]
struct EntityUpdateResult {
    metadata: A2lMetadata,
    entities: Vec<CoreEntity>,
}

#[derive(Serialize, Clone)]
struct A2lTreeDetail {
    label: String,
    value: String,
}

#[derive(Serialize)]
struct A2lTreeItem {
    id: String,
    name: String,
    kind: String,
    description: Option<String>,
    details: Vec<A2lTreeDetail>,
}

#[derive(Serialize)]
struct A2lTreeSection {
    id: String,
    title: String,
    items: Vec<A2lTreeItem>,
}

#[derive(Serialize)]
struct A2lTreeModule {
    id: String,
    name: String,
    long_identifier: String,
    sections: Vec<A2lTreeSection>,
}

#[derive(Serialize)]
struct A2lTree {
    modules: Vec<A2lTreeModule>,
}

trait A2lDetailProvider {
    fn description(&self) -> Option<String> {
        None
    }
    fn details(&self) -> Vec<A2lTreeDetail>;
}

fn detail(label: &str, value: impl ToString) -> A2lTreeDetail {
    A2lTreeDetail {
        label: label.to_string(),
        value: value.to_string(),
    }
}

fn opt_detail<T: std::fmt::Debug>(label: &str, value: &Option<T>) -> A2lTreeDetail {
    let rendered = value
        .as_ref()
        .map(|item| format!("{item:?}"))
        .unwrap_or_else(|| "—".to_string());
    detail(label, rendered)
}

fn count_detail(label: &str, count: usize) -> A2lTreeDetail {
    detail(label, count)
}

fn limits_detail(lower: f64, upper: f64) -> A2lTreeDetail {
    detail("Limits", format!("{lower} .. {upper}"))
}

fn ecu_addr_detail(label: &str, addr: &Option<a2lfile::EcuAddress>) -> A2lTreeDetail {
    let rendered = addr
        .as_ref()
        .map(|a| format!("0x{:08X}", a.address))
        .unwrap_or_else(|| "—".to_string());
    detail(label, rendered)
}

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

fn build_metadata(a2l: &a2lfile::A2lFile, warning_count: usize) -> A2lMetadata {
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

fn collect_core_entities(a2l: &a2lfile::A2lFile) -> Vec<CoreEntity> {
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

fn build_section_from_list<T: A2lObjectName + std::fmt::Debug + A2lDetailProvider>(
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

fn build_section_from_optional<T: std::fmt::Debug + A2lDetailProvider>(
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

fn build_section_from_vec<T: std::fmt::Debug + A2lDetailProvider>(
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

fn build_tree(a2l: &a2lfile::A2lFile) -> A2lTree {
    let modules = a2l
        .project
        .module
        .iter()
        .map(|module| {
            let module_name = module.get_name();
            let mut sections = Vec::new();

            if let Some(section) = build_section_from_list(module_name, "Measurements", "Measurement", &module.measurement) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Characteristics", "Characteristic", &module.characteristic) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Axis Points", "AxisPts", &module.axis_pts) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Compu Methods", "CompuMethod", &module.compu_method) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Compu Tables", "CompuTab", &module.compu_tab) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Compu VTabs", "CompuVtab", &module.compu_vtab) {
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
            if let Some(section) = build_section_from_list(module_name, "Record Layouts", "RecordLayout", &module.record_layout) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Functions", "Function", &module.function) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Groups", "Group", &module.group) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Units", "Unit", &module.unit) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Frames", "Frame", &module.frame) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Blobs", "Blob", &module.blob) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Instances", "Instance", &module.instance) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Transformers", "Transformer", &module.transformer) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Typedef Axis", "TypedefAxis", &module.typedef_axis) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_list(module_name, "Typedef Blob", "TypedefBlob", &module.typedef_blob) {
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
            if let Some(section) = build_section_from_optional(module_name, "Mod Common", "ModCommon", module.mod_common.as_ref()) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_optional(module_name, "Mod Par", "ModPar", module.mod_par.as_ref()) {
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
            if let Some(section) = build_section_from_optional(module_name, "A2ML", "A2ML", module.a2ml.as_ref()) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_vec(module_name, "IF_DATA", "IfData", &module.if_data) {
                sections.push(section);
            }
            if let Some(section) = build_section_from_vec(module_name, "User Rights", "UserRights", &module.user_rights) {
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

// ─── Core functions (no Tauri dependency) ────────────────────────────────────

pub fn core_load_a2l_from_string(contents: &str) -> Result<(a2lfile::A2lFile, Vec<String>), String> {
    let (a2l, warnings) = a2lfile::load_from_string(contents, None, false)
        .map_err(|error| error.to_string())?;
    let warning_strings: Vec<String> = warnings.iter().map(|w| w.to_string()).collect();
    Ok((a2l, warning_strings))
}

pub fn core_load_a2l_from_path(path: &str) -> Result<(a2lfile::A2lFile, Vec<String>), String> {
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    core_load_a2l_from_string(&contents)
}

pub fn core_load_elf_symbols(path: &str) -> Result<Vec<ElfSymbol>, String> {
    let buffer = fs::read(path).map_err(|e| e.to_string())?;
    core_load_elf_symbols_from_buffer(&buffer)
}

pub fn core_load_elf_symbols_from_buffer(buffer: &[u8]) -> Result<Vec<ElfSymbol>, String> {
    let elf = Elf::parse(buffer).map_err(|e| format!("ELF parse error: {}", e))?;
    let dwarf_info = parse_dwarf_symbols(buffer);

    // Collect symbols from BOTH .symtab and .dynsym for maximum coverage
    // Each entry is (sym, use_dynstrtab)
    let mut all_syms: Vec<(goblin::elf::Sym, bool)> = Vec::new();
    for sym in elf.syms.iter() {
        all_syms.push((sym, false));
    }
    // Also add .dynsym symbols (deduplicated by name later)
    for sym in elf.dynsyms.iter() {
        all_syms.push((sym, true));
    }

    if all_syms.is_empty() {
        return Ok(Vec::new());
    }

    let mut symbols = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    for (sym, is_dyn) in &all_syms {
        let name_opt = if *is_dyn {
            elf.dynstrtab.get_at(sym.st_name)
        } else {
            elf.strtab.get_at(sym.st_name)
        };
        if let Some(name) = name_opt {
            if !name.is_empty() && seen_names.insert(name.to_string()) {
                let type_str = goblin::elf::sym::type_to_str(sym.st_type()).to_string();
                let bind = goblin::elf::sym::bind_to_str(sym.st_bind()).to_string();

                let section = if sym.st_shndx < elf.section_headers.len() {
                    let sh = &elf.section_headers[sym.st_shndx];
                    elf.shdr_strtab.get_at(sh.sh_name).unwrap_or("").to_string()
                } else {
                    "".to_string()
                };

                let (suggested_type, min_limit, max_limit) = infer_a2l_type(name, sym.st_size);
                let addr_warning = validate_address(sym.st_value);
                let dwarf_type = dwarf_info.get(name).map(|info| info.type_name.clone());

                let var_enum_vals = dwarf_info.get(name)
                    .map(|info| info.enum_variants.clone())
                    .unwrap_or_default();

                symbols.push(ElfSymbol {
                    name: name.to_string(),
                    address: sym.st_value,
                    size: sym.st_size,
                    bind: bind.clone(),
                    type_str: type_str.clone(),
                    section: section.clone(),
                    suggested_a2l_type: suggested_type,
                    suggested_limits: (min_limit, max_limit),
                    address_warning: addr_warning,
                    dwarf_type,
                    is_struct_member: false,
                    parent_struct: None,
                    array_dim: 0,
                    enum_values: var_enum_vals,
                });

                if let Some(info) = dwarf_info.get(name) {
                    if !info.members.is_empty() {
                        for member in &info.members {
                            let full_name = format!("{}.{}", name, member.name);
                            let member_addr = sym.st_value + member.offset;

                            // For arrays: use element type/size for A2L type inference
                            let (infer_type, infer_size) = if member.array_dim > 0 {
                                let etype = member.element_type_name.as_deref().unwrap_or(&member.type_name);
                                (etype, member.element_size)
                            } else {
                                (member.type_name.as_str(), member.size)
                            };
                            let (member_a2l_type, member_min, member_max) = infer_a2l_type_from_member(infer_type, infer_size);
                            let member_addr_warning = validate_address(member_addr);

                            // Display type: for arrays, show "element_type[N]"
                            let display_type = if member.array_dim > 0 {
                                let elem = member.element_type_name.as_deref().unwrap_or("unknown");
                                format!("{}[{}]", elem, member.array_dim)
                            } else {
                                member.type_name.clone()
                            };

                            symbols.push(ElfSymbol {
                                name: full_name,
                                address: member_addr,
                                size: member.size,
                                bind: bind.clone(),
                                type_str: type_str.clone(),
                                section: section.clone(),
                                suggested_a2l_type: member_a2l_type,
                                suggested_limits: (member_min, member_max),
                                address_warning: member_addr_warning,
                                dwarf_type: Some(display_type),
                                is_struct_member: true,
                                parent_struct: Some(name.to_string()),
                                array_dim: member.array_dim,
                                enum_values: member.enum_variants.clone(),
                            });
                        }
                    }
                }
            }
        }
    }
    symbols.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(symbols)
}

pub fn core_create_measurements(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<(), String> {
    let target_module = if let Some(name) = module_name {
        a2l.project.module.iter_mut().find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project.module.iter_mut().next().ok_or("No modules in project")?
    };

    for sym in symbols {
        let data_type = parse_data_type(&sym.a2l_type);
        let mut m = a2lfile::Measurement::new(
            sym.name.clone(),
            String::new(),
            data_type,
            sym.conversion.clone().unwrap_or_else(|| "NO_COMPU_METHOD".to_string()),
            sym.resolution.unwrap_or(1),
            sym.accuracy.unwrap_or(0.0),
            sym.lower_limit,
            sym.upper_limit,
        );
        m.ecu_address = Some(a2lfile::EcuAddress::new(sym.address as u32));
        if sym.array_dim > 0 {
            let mut md = a2lfile::MatrixDim::new();
            md.dim_list = vec![sym.array_dim as u16];
            m.matrix_dim = Some(md);
        }
        target_module.measurement.retain(|existing| existing.get_name() != sym.name);
        target_module.measurement.push(m);
    }
    Ok(())
}

fn record_layout_name_for_type(a2l_type: &str) -> String {
    format!("__val_{}", a2l_type)
}

fn ensure_record_layout(module: &mut a2lfile::Module, a2l_type: &str) {
    let rl_name = record_layout_name_for_type(a2l_type);
    if module.record_layout.iter().any(|r| r.get_name() == rl_name) {
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

pub fn core_create_characteristics(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<(), String> {
    let target_module = if let Some(name) = module_name {
        a2l.project.module.iter_mut().find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project.module.iter_mut().next().ok_or("No modules in project")?
    };

    for sym in symbols {
        ensure_record_layout(target_module, &sym.a2l_type);
        let deposit = record_layout_name_for_type(&sym.a2l_type);
        let char_type = if sym.array_dim > 0 {
            a2lfile::CharacteristicType::ValBlk
        } else {
            a2lfile::CharacteristicType::Value
        };

        // Create COMPU_METHOD + COMPU_VTAB for enum types
        let conversion = if !sym.enum_values.is_empty() {
            let vtab_name = format!("__vtab_{}", sym.name.replace('.', "_"));
            let cm_name = format!("__cm_{}", sym.name.replace('.', "_"));

            // Create COMPU_VTAB (remove old one first)
            target_module.compu_vtab.retain(|v| v.get_name() != vtab_name);
            let mut vtab = a2lfile::CompuVtab::new(
                vtab_name.clone(),
                format!("Enum for {}", sym.name),
                a2lfile::ConversionType::TabVerb,
                sym.enum_values.len() as u16,
            );
            for (ename, eval) in &sym.enum_values {
                vtab.value_pairs.push(a2lfile::ValuePairsStruct::new(
                    *eval as f64,
                    ename.clone(),
                ));
            }
            target_module.compu_vtab.push(vtab);

            // Create COMPU_METHOD referencing the COMPU_VTAB
            target_module.compu_method.retain(|m| m.get_name() != cm_name);
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
            sym.conversion.clone().unwrap_or_else(|| "NO_COMPU_METHOD".to_string())
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
        if sym.array_dim > 0 {
            let mut md = a2lfile::MatrixDim::new();
            md.dim_list = vec![sym.array_dim as u16];
            c.matrix_dim = Some(md);
        }
        target_module.characteristic.retain(|existing| existing.get_name() != sym.name);
        target_module.characteristic.push(c);
    }
    Ok(())
}

pub fn core_check_conflicts(
    a2l: &a2lfile::A2lFile,
    module_name: Option<&str>,
    symbols: &[SymbolWithMapping],
) -> Result<ConflictReport, String> {
    let target_module = if let Some(name) = module_name {
        a2l.project.module.iter().find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project.module.first().ok_or("No modules in project")?
    };

    let mut conflicts = Vec::new();
    let mut non_conflicts = Vec::new();

    for sym in symbols {
        if let Some(existing) = target_module.measurement.iter().find(|m| m.get_name() == sym.name) {
            conflicts.push(SymbolConflict {
                symbol_name: sym.name.clone(),
                existing_address: format!("0x{:X}",
                    existing.ecu_address.as_ref().map(|a| a.address).unwrap_or(0)),
                existing_type: format!("{:?}", existing.datatype),
                new_address: format!("0x{:X}", sym.address as u32),
                new_type: sym.a2l_type.clone(),
            });
        } else if let Some(existing) = target_module.characteristic.iter().find(|c| c.get_name() == sym.name) {
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

    Ok(ConflictReport { conflicts, non_conflicts })
}

pub fn core_update_ecu_addresses(
    a2l: &mut a2lfile::A2lFile,
    module_name: Option<&str>,
    elf_symbols: &[ElfSymbol],
) -> Result<UpdateEcuAddressesResult, String> {
    let sym_map: HashMap<&str, &ElfSymbol> = elf_symbols.iter()
        .map(|s| (s.name.as_str(), s))
        .collect();

    let target_module = if let Some(name) = module_name {
        a2l.project.module.iter_mut().find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project.module.iter_mut().next().ok_or("No modules in project")?
    };

    let mut updated_count = 0usize;
    let mut matched_names = Vec::new();

    // Update measurements
    for measurement in target_module.measurement.iter_mut() {
        let meas_name = measurement.get_name().to_string();
        if let Some(sym) = sym_map.get(meas_name.as_str()) {
            measurement.ecu_address = Some(a2lfile::EcuAddress::new(sym.address as u32));
            // Update MATRIX_DIM if array size changed
            if sym.array_dim > 0 {
                let mut md = a2lfile::MatrixDim::new();
                md.dim_list = vec![sym.array_dim as u16];
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
            // Update array dims
            if sym.array_dim > 0 {
                characteristic.characteristic_type = a2lfile::CharacteristicType::ValBlk;
                let mut md = a2lfile::MatrixDim::new();
                md.dim_list = vec![sym.array_dim as u16];
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

        // Only update if the characteristic exists
        let char_exists = target_module.characteristic.iter().any(|c| c.get_name() == sym.name);
        if !char_exists {
            continue;
        }

        // Update COMPU_VTAB
        target_module.compu_vtab.retain(|v| v.get_name() != vtab_name);
        let mut vtab = a2lfile::CompuVtab::new(
            vtab_name.clone(),
            format!("Enum for {}", sym.name),
            a2lfile::ConversionType::TabVerb,
            sym.enum_values.len() as u16,
        );
        for (ename, eval) in &sym.enum_values {
            vtab.value_pairs.push(a2lfile::ValuePairsStruct::new(*eval as f64, ename.clone()));
        }
        target_module.compu_vtab.push(vtab);

        // Update COMPU_METHOD
        target_module.compu_method.retain(|m| m.get_name() != cm_name);
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
        if let Some(c) = target_module.characteristic.iter_mut().find(|c| c.get_name() == sym.name) {
            c.conversion = cm_name;
        }
    }

    Ok(UpdateEcuAddressesResult { updated_count, matched_names })
}

pub fn core_export_a2l(a2l: &a2lfile::A2lFile) -> String {
    a2l.write_to_string()
}

// ─── Tauri command wrappers ──────────────────────────────────────────────────

#[tauri::command]
fn load_a2l_from_string(
    contents: String,
    state: tauri::State<AppState>,
) -> Result<A2lMetadata, String> {
    let (a2l, warnings) = core_load_a2l_from_string(&contents)?;
    let warning_count = warnings.len();
    let metadata = build_metadata(&a2l, warning_count);
    *state.a2l.lock().map_err(|_| "State lock poisoned")? = Some(a2l);

    Ok(metadata)
}

#[tauri::command]
fn load_a2l_from_path(path: String, state: tauri::State<AppState>) -> Result<A2lMetadata, String> {
    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    load_a2l_from_string(contents, state)
}

#[tauri::command]
fn update_project_metadata(
    name: String,
    long_identifier: String,
    header_comment: Option<String>,
    state: tauri::State<AppState>,
) -> Result<A2lMetadata, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    a2l.project.name = name;
    a2l.project.long_identifier = long_identifier;
    match header_comment.map(|comment| comment.trim().to_string()) {
        Some(comment) if !comment.is_empty() => {
            if let Some(header) = &mut a2l.project.header {
                header.comment = comment;
            } else {
                a2l.project.header = Some(Header::new(comment));
            }
        }
        _ => {
            a2l.project.header = None;
        }
    }

    Ok(build_metadata(a2l, 0))
}

#[tauri::command]
fn export_a2l(state: tauri::State<AppState>) -> Result<String, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(core_export_a2l(a2l))
}

#[tauri::command]
fn save_a2l_to_path(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    let content = a2l.write_to_string();
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_core_entities(state: tauri::State<AppState>) -> Result<Vec<CoreEntity>, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(collect_core_entities(a2l))
}

#[tauri::command]
fn list_a2l_tree(state: tauri::State<AppState>) -> Result<A2lTree, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(build_tree(a2l))
}

#[tauri::command]
fn update_entity_name(
    kind: String,
    name: String,
    new_name: String,
    state: tauri::State<AppState>,
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    for module in a2l.project.module.iter_mut() {
        if kind == "Module" && module.get_name() == name {
            module.set_name(new_name.clone());
        }
        if kind == "Measurement" {
            for measurement in module.measurement.iter_mut() {
                if measurement.get_name() == name {
                    measurement.set_name(new_name.clone());
                }
            }
        }
        if kind == "Characteristic" {
            for characteristic in module.characteristic.iter_mut() {
                if characteristic.get_name() == name {
                    characteristic.set_name(new_name.clone());
                }
            }
        }
        if kind == "AxisPts" {
            for axis_pts in module.axis_pts.iter_mut() {
                if axis_pts.get_name() == name {
                    axis_pts.set_name(new_name.clone());
                }
            }
        }
    }

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

#[derive(Deserialize)]
pub struct DeleteEntityRequest {
    pub kind: String,
    pub name: String,
}

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
                    module.measurement.retain(|m| m.get_name() != req.name);
                    deleted += before - module.measurement.len();
                }
                "Characteristic" => {
                    before = module.characteristic.len();
                    module.characteristic.retain(|c| c.get_name() != req.name);
                    deleted += before - module.characteristic.len();
                }
                "AxisPts" => {
                    before = module.axis_pts.len();
                    module.axis_pts.retain(|a| a.get_name() != req.name);
                    deleted += before - module.axis_pts.len();
                }
                "CompuMethod" => {
                    before = module.compu_method.len();
                    module.compu_method.retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_method.len();
                }
                "CompuTab" => {
                    before = module.compu_tab.len();
                    module.compu_tab.retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_tab.len();
                }
                "CompuVtab" => {
                    before = module.compu_vtab.len();
                    module.compu_vtab.retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_vtab.len();
                }
                "CompuVtabRange" => {
                    before = module.compu_vtab_range.len();
                    module.compu_vtab_range.retain(|c| c.get_name() != req.name);
                    deleted += before - module.compu_vtab_range.len();
                }
                "RecordLayout" => {
                    before = module.record_layout.len();
                    module.record_layout.retain(|r| r.get_name() != req.name);
                    deleted += before - module.record_layout.len();
                }
                "Function" => {
                    before = module.function.len();
                    module.function.retain(|f| f.get_name() != req.name);
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
                    module.instance.retain(|i| i.get_name() != req.name);
                    deleted += before - module.instance.len();
                }
                "Transformer" => {
                    before = module.transformer.len();
                    module.transformer.retain(|t| t.get_name() != req.name);
                    deleted += before - module.transformer.len();
                }
                "TypedefAxis" => {
                    before = module.typedef_axis.len();
                    module.typedef_axis.retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_axis.len();
                }
                "TypedefBlob" => {
                    before = module.typedef_blob.len();
                    module.typedef_blob.retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_blob.len();
                }
                "TypedefCharacteristic" => {
                    before = module.typedef_characteristic.len();
                    module.typedef_characteristic.retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_characteristic.len();
                }
                "TypedefMeasurement" => {
                    before = module.typedef_measurement.len();
                    module.typedef_measurement.retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_measurement.len();
                }
                "TypedefStructure" => {
                    before = module.typedef_structure.len();
                    module.typedef_structure.retain(|t| t.get_name() != req.name);
                    deleted += before - module.typedef_structure.len();
                }
                _ => {}
            }
        }
    }
    deleted
}

#[tauri::command]
fn delete_entities(
    entities: Vec<DeleteEntityRequest>,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_delete_entities(a2l, &entities);
    Ok(build_tree(a2l))
}

#[tauri::command]
fn update_module_long_identifier(
    name: String,
    long_identifier: String,
    state: tauri::State<AppState>,
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    for module in a2l.project.module.iter_mut() {
        if module.get_name() == name {
            module.long_identifier = long_identifier.clone();
        }
    }

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

fn datatype_to_string(dt: &a2lfile::DataType) -> String {
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

fn string_to_datatype(s: &str) -> Option<a2lfile::DataType> {
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

fn characteristic_type_to_string(ct: &a2lfile::CharacteristicType) -> String {
    match ct {
        a2lfile::CharacteristicType::Ascii => "ASCII",
        a2lfile::CharacteristicType::Curve => "CURVE",
        a2lfile::CharacteristicType::Map => "MAP",
        a2lfile::CharacteristicType::Cuboid => "CUBOID",
        a2lfile::CharacteristicType::Cube4 => "CUBE_4",
        a2lfile::CharacteristicType::Cube5 => "CUBE_5",
        a2lfile::CharacteristicType::ValBlk => "VAL_BLK",
        a2lfile::CharacteristicType::Value => "VALUE",
    }.to_string()
}

fn string_to_characteristic_type(s: &str) -> Option<a2lfile::CharacteristicType> {
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

#[derive(Serialize, Deserialize)]
struct MeasurementData {
    name: String,
    long_identifier: String,
    datatype: String,
    conversion: String,
    resolution: f64,
    accuracy: f64,
    lower_limit: f64,
    upper_limit: f64,
    ecu_address: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CharacteristicData {
    name: String,
    long_identifier: String,
    characteristic_type: String,
    address: String,
    deposit: String,
    max_diff: f64,
    conversion: String,
    lower_limit: f64,
    upper_limit: f64,
    bit_mask: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct AxisPtsData {
    name: String,
    long_identifier: String,
    address: String,
    input_quantity: String,
    deposit_record: String,
    max_diff: f64,
    conversion: String,
    max_axis_points: u16,
    lower_limit: f64,
    upper_limit: f64,
}

#[tauri::command]
fn get_measurement(name: String, state: tauri::State<AppState>) -> Result<MeasurementData, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;

    for module in a2l.project.module.iter() {
        if let Some(m) = module.measurement.iter().find(|m| m.get_name() == name) {
            return Ok(MeasurementData {
                name: m.get_name().to_string(),
                long_identifier: m.long_identifier.clone(),
                datatype: datatype_to_string(&m.datatype),
                conversion: m.conversion.clone(),
                resolution: m.resolution as f64,
                accuracy: m.accuracy,
                lower_limit: m.lower_limit,
                upper_limit: m.upper_limit,
                ecu_address: m.ecu_address.as_ref().map(|a| format!("0x{:X}", a.address)),
            });
        }
    }
    Err(format!("Measurement '{}' not found in any module", name))
}

#[tauri::command]
fn update_measurement(name: String, data: MeasurementData, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let new_datatype = string_to_datatype(&data.datatype)
        .ok_or_else(|| format!("Invalid data type: {}", data.datatype))?;

    let new_address = match data.ecu_address {
        Some(s) if !s.trim().is_empty() => {
             let clean = s.trim().trim_start_matches("0x").trim_start_matches("0X");
             let addr_val = u32::from_str_radix(clean, 16).map_err(|_| "Invalid hex address")?;
             Some(a2lfile::EcuAddress::new(addr_val))
        },
        _ => None
    };

    for module in a2l.project.module.iter_mut() {
        if let Some(m) = module.measurement.iter_mut().find(|m| m.get_name() == name) {
            m.set_name(data.name);
            m.long_identifier = data.long_identifier;
            m.datatype = new_datatype;
            m.conversion = data.conversion;
            m.resolution = data.resolution as u16;
            m.accuracy = data.accuracy;
            m.lower_limit = data.lower_limit;
            m.upper_limit = data.upper_limit;
            m.ecu_address = new_address;
            return Ok(());
        }
    }
    Err(format!("Measurement '{}' not found", name))
}

#[tauri::command]
fn get_characteristic(name: String, state: tauri::State<AppState>) -> Result<CharacteristicData, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;

    for module in a2l.project.module.iter() {
        if let Some(c) = module.characteristic.iter().find(|c| c.get_name() == name) {
            return Ok(CharacteristicData {
                name: c.get_name().to_string(),
                long_identifier: c.long_identifier.clone(),
                characteristic_type: characteristic_type_to_string(&c.characteristic_type),
                address: format!("0x{:X}", c.address),
                deposit: c.deposit.clone(),
                max_diff: c.max_diff,
                conversion: c.conversion.clone(),
                lower_limit: c.lower_limit,
                upper_limit: c.upper_limit,
                bit_mask: c.bit_mask.as_ref().map(|b| format!("0x{:X}", b.mask)),
            });
        }
    }
    Err(format!("Characteristic '{}' not found in any module", name))
}

#[tauri::command]
fn update_characteristic(name: String, data: CharacteristicData, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let new_type = string_to_characteristic_type(&data.characteristic_type)
        .ok_or_else(|| format!("Invalid characteristic type: {}", data.characteristic_type))?;

    let clean_addr = data.address.trim().trim_start_matches("0x").trim_start_matches("0X");
    let new_addr_val = u32::from_str_radix(clean_addr, 16).map_err(|_| "Invalid hex address")?;

    let new_bit_mask = match data.bit_mask {
        Some(s) if !s.trim().is_empty() => {
             let clean = s.trim().trim_start_matches("0x").trim_start_matches("0X");
             let mask_val = u64::from_str_radix(clean, 16).map_err(|_| "Invalid hex bit mask")?;
             Some(a2lfile::BitMask::new(mask_val))
        },
        _ => None
    };

    for module in a2l.project.module.iter_mut() {
        if let Some(c) = module.characteristic.iter_mut().find(|c| c.get_name() == name) {
           c.set_name(data.name);
           c.long_identifier = data.long_identifier;
           c.characteristic_type = new_type;
           c.address = new_addr_val;
           c.deposit = data.deposit;
           c.max_diff = data.max_diff;
           c.conversion = data.conversion;
           c.lower_limit = data.lower_limit;
           c.upper_limit = data.upper_limit;
           c.bit_mask = new_bit_mask;
           return Ok(());
        }
    }
    Err(format!("Characteristic '{}' not found", name))
}

#[tauri::command]
fn get_axis_pts(name: String, state: tauri::State<AppState>) -> Result<AxisPtsData, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;

    for module in a2l.project.module.iter() {
        if let Some(a) = module.axis_pts.iter().find(|a| a.get_name() == name) {
            return Ok(AxisPtsData {
                name: a.get_name().to_string(),
                long_identifier: a.long_identifier.clone(),
                address: format!("0x{:X}", a.address),
                input_quantity: a.input_quantity.clone(),
                deposit_record: a.deposit_record.clone(),
                max_diff: a.max_diff,
                conversion: a.conversion.clone(),
                max_axis_points: a.max_axis_points,
                lower_limit: a.lower_limit,
                upper_limit: a.upper_limit,
            });
        }
    }
    Err(format!("AxisPts '{}' not found in any module", name))
}

#[tauri::command]
fn update_axis_pts(name: String, data: AxisPtsData, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let clean_addr = data.address.trim().trim_start_matches("0x").trim_start_matches("0X");
    let new_addr_val = u32::from_str_radix(clean_addr, 16).map_err(|_| "Invalid hex address")?;

    for module in a2l.project.module.iter_mut() {
        if let Some(a) = module.axis_pts.iter_mut().find(|a| a.get_name() == name) {
            a.set_name(data.name);
            a.long_identifier = data.long_identifier;
            a.address = new_addr_val;
            a.input_quantity = data.input_quantity;
            a.deposit_record = data.deposit_record;
            a.max_diff = data.max_diff;
            a.conversion = data.conversion;
            a.max_axis_points = data.max_axis_points;
            a.lower_limit = data.lower_limit;
            a.upper_limit = data.upper_limit;
            return Ok(());
        }
    }
    Err(format!("AxisPts '{}' not found", name))
}

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
    /// For array members: number of elements. 0 means not an array.
    pub array_dim: u64,
    /// For enum types: list of (enumerator_name, value) pairs.
    #[serde(default)]
    pub enum_values: Vec<(String, i64)>,
}

// Type inference based on symbol size and name heuristics
fn infer_a2l_type(symbol_name: &str, symbol_size: u64) -> (String, f64, f64) {
    let name_lower = symbol_name.to_lowercase();

    match symbol_size {
        1 => {
            // 1 byte: SBYTE or UBYTE
            if name_lower.contains("signed") || name_lower.contains("int8") || name_lower.contains("sbyte") {
                ("SBYTE".to_string(), -128.0, 127.0)
            } else {
                ("UBYTE".to_string(), 0.0, 255.0)
            }
        },
        2 => {
            // 2 bytes: SWORD or UWORD
            if name_lower.contains("signed") || name_lower.contains("int16") || name_lower.contains("sword") {
                ("SWORD".to_string(), -32768.0, 32767.0)
            } else {
                ("UWORD".to_string(), 0.0, 65535.0)
            }
        },
        4 => {
            // 4 bytes: FLOAT32, SLONG, or ULONG
            if name_lower.contains("float") || name_lower.contains("flt") || name_lower.contains("f32") {
                ("FLOAT32_IEEE".to_string(), -3.4e38, 3.4e38)
            } else if name_lower.contains("signed") || name_lower.contains("int32") || name_lower.contains("slong")
                      || name_lower.contains("i32") {
                ("SLONG".to_string(), -2147483648.0, 2147483647.0)
            } else {
                ("ULONG".to_string(), 0.0, 4294967295.0)
            }
        },
        8 => {
            // 8 bytes: FLOAT64, A_INT64, or A_UINT64
            if name_lower.contains("double") || name_lower.contains("dbl") || name_lower.contains("f64") {
                ("FLOAT64_IEEE".to_string(), -1.7e308, 1.7e308)
            } else if name_lower.contains("signed") || name_lower.contains("int64") || name_lower.contains("i64") {
                ("A_INT64".to_string(), -9223372036854775808.0, 9223372036854775807.0)
            } else {
                ("A_UINT64".to_string(), 0.0, 18446744073709551615.0)
            }
        },
        _ => {
            // Fallback for unusual sizes
            ("UBYTE".to_string(), 0.0, 255.0)
        }
    }
}

// Type inference for struct members using DWARF type name + byte size
fn infer_a2l_type_from_member(dwarf_type: &str, size: u64) -> (String, f64, f64) {
    let t = dwarf_type.to_lowercase();

    // Float types
    if t == "float" || t.contains("float32") || (t.contains("float") && size == 4) {
        return ("FLOAT32_IEEE".to_string(), -3.4e38, 3.4e38);
    }
    if t == "double" || t.contains("float64") || (t.contains("double") && size == 8) {
        return ("FLOAT64_IEEE".to_string(), -1.7e308, 1.7e308);
    }

    // Signed integer types (no leading 'u' or 'unsigned' prefix)
    let is_signed = !t.starts_with('u') && !t.contains("unsigned") && !t.contains("uint");
    if is_signed
        && (t == "int"
            || t == "short"
            || t == "long"
            || t.contains("char")
            || t.starts_with("int")
            || t.contains("int8")
            || t.contains("int16")
            || t.contains("int32")
            || t.contains("int64"))
    {
        return match size {
            1 => ("SBYTE".to_string(), -128.0, 127.0),
            2 => ("SWORD".to_string(), -32768.0, 32767.0),
            4 => ("SLONG".to_string(), -2147483648.0, 2147483647.0),
            8 => ("A_INT64".to_string(), -9223372036854775808.0, 9223372036854775807.0),
            _ => infer_a2l_type("", size),
        };
    }

    // Fall back to size-based inference (treats as unsigned)
    infer_a2l_type("", size)
}

// Validate address range (u64 to u32 conversion)
fn validate_address(address: u64) -> Option<String> {
    if address > 0xFFFFFFFF {
        Some(format!(
            "Address 0x{:X} exceeds 32-bit range, will be truncated to 0x{:X}",
            address,
            address as u32
        ))
    } else {
        None
    }
}

/// Information extracted from DWARF debug info for a symbol
#[derive(Clone, Debug)]
pub struct DwarfSymbolInfo {
    pub type_name: String,
    /// For struct members
    pub members: Vec<DwarfMemberInfo>,
    /// If this variable's type resolves to an enum, the (name, value) pairs
    pub enum_variants: Vec<(String, i64)>,
}

#[derive(Clone, Debug)]
pub struct DwarfMemberInfo {
    pub name: String,
    pub offset: u64,
    pub size: u64,
    pub type_name: String,
    /// If this member is an array, number of elements. 0 = not an array.
    pub array_dim: u64,
    /// For arrays: the element type name (e.g. "uint16_t")
    pub element_type_name: Option<String>,
    /// For arrays: the element byte size
    pub element_size: u64,
    /// If this member's type resolves to an enum, the (name, value) pairs
    pub enum_variants: Vec<(String, i64)>,
}

/// Parse DWARF debug info from an ELF buffer to extract type information.
/// Returns a map of symbol name -> DwarfSymbolInfo.
pub fn parse_dwarf_symbols(buffer: &[u8]) -> HashMap<String, DwarfSymbolInfo> {
    let mut result = HashMap::new();

    // Try to load DWARF sections from the ELF
    let elf = match goblin::elf::Elf::parse(buffer) {
        Ok(elf) => elf,
        Err(_) => return result,
    };

    // Build a section-name-to-data lookup for all DWARF sections.
    // Using DwarfSections::load ensures DWARF5 sections (debug_str_offsets,
    // debug_addr, debug_line_str, etc.) are loaded correctly.
    let section_data = |name: &str| -> &[u8] {
        for sh in &elf.section_headers {
            if let Some(section_name) = elf.shdr_strtab.get_at(sh.sh_name) {
                if section_name == name {
                    let start = sh.sh_offset as usize;
                    let end = start + sh.sh_size as usize;
                    if end <= buffer.len() {
                        return &buffer[start..end];
                    }
                }
            }
        }
        &[]
    };

    // Detect endianness from ELF header
    let is_big_endian = buffer.get(5) == Some(&2);

    let load_section = |id: gimli::SectionId| -> Result<gimli::EndianSlice<'_, gimli::RunTimeEndian>, gimli::Error> {
        let data = section_data(id.name());
        let endian = if is_big_endian { gimli::RunTimeEndian::Big } else { gimli::RunTimeEndian::Little };
        Ok(gimli::EndianSlice::new(data, endian))
    };

    let dwarf_sections = match gimli::DwarfSections::load(load_section) {
        Ok(sections) => sections,
        Err(_) => return result,
    };
    let dwarf = dwarf_sections.borrow(|section| section.clone());

    // Build a type offset -> type name map
    let mut type_map: HashMap<gimli::DebugInfoOffset, String> = HashMap::new();
    // Build a type offset -> byte size map (for resolving member sizes)
    let mut type_size_map: HashMap<gimli::DebugInfoOffset, u64> = HashMap::new();
    // Build a typedef/qualifier offset -> underlying type offset map
    let mut type_indirection: HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset> = HashMap::new();
    // Build a struct type offset -> members map
    let mut struct_members: HashMap<gimli::DebugInfoOffset, Vec<DwarfMemberInfo>> = HashMap::new();
    // Array info: array type offset -> (element_type_offset, element_count)
    let mut array_info: HashMap<gimli::DebugInfoOffset, (Option<gimli::DebugInfoOffset>, Option<u64>)> = HashMap::new();
    // Enum values: enum type offset -> Vec<(enumerator_name, const_value)>
    let mut enum_values: HashMap<gimli::DebugInfoOffset, Vec<(String, i64)>> = HashMap::new();
    let mut current_enum_offset: Option<gimli::DebugInfoOffset> = None;

    // First pass: collect type names, sizes, and typedef/qualifier chains
    let mut units = dwarf.units();
    while let Ok(Some(header)) = units.next() {
        let unit = match dwarf.unit(header) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let mut entries = unit.entries();
        let mut current_array_offset: Option<gimli::DebugInfoOffset> = None;
        while let Ok(Some((_, entry))) = entries.next_dfs() {
            let offset = entry.offset().to_debug_info_offset(&unit.header).unwrap_or(gimli::DebugInfoOffset(0));

            match entry.tag() {
                gimli::DW_TAG_base_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_typedef => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    // Track chain: typedef_offset -> underlying type offset
                    if let Some(underlying) = resolve_type_to_offset(&unit, entry) {
                        type_indirection.insert(offset, underlying);
                    }
                }
                gimli::DW_TAG_structure_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, format!("struct {}", name));
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_enumeration_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, name);
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                    current_enum_offset = Some(offset);
                    enum_values.insert(offset, Vec::new());
                }
                gimli::DW_TAG_enumerator => {
                    if let Some(enum_off) = current_enum_offset {
                        if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                            let val = get_attr_sdata(entry, gimli::DW_AT_const_value).unwrap_or(0);
                            if let Some(vals) = enum_values.get_mut(&enum_off) {
                                vals.push((name, val));
                            }
                        }
                    }
                }
                gimli::DW_TAG_union_type => {
                    if let Some(name) = get_die_name(&dwarf, &unit, entry) {
                        type_map.insert(offset, format!("union {}", name));
                    }
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                }
                gimli::DW_TAG_pointer_type => {
                    type_map.insert(offset, "pointer".to_string());
                    // pointer size from unit address size
                    type_size_map.insert(offset, unit.encoding().address_size as u64);
                }
                gimli::DW_TAG_array_type => {
                    type_map.insert(offset, "array".to_string());
                    if let Some(size) = get_byte_size(entry) {
                        type_size_map.insert(offset, size);
                    }
                    let elem_type_off = resolve_type_to_offset(&unit, entry);
                    array_info.insert(offset, (elem_type_off, None));
                    current_array_offset = Some(offset);
                }
                gimli::DW_TAG_subrange_type => {
                    // Child of DW_TAG_array_type — extract element count
                    // DW_AT_upper_bound = count - 1, or DW_AT_count = count
                    if let Some(arr_off) = current_array_offset {
                        let count = get_attr_udata(entry, gimli::DW_AT_count)
                            .or_else(|| get_attr_udata(entry, gimli::DW_AT_upper_bound).and_then(|ub| ub.checked_add(1)));
                        if let Some(count) = count {
                            if let Some(info) = array_info.get_mut(&arr_off) {
                                info.1 = Some(count);
                            }
                        }
                    }
                }
                // Qualifiers: const, volatile, restrict — track for typedef chaining
                gimli::DW_TAG_const_type
                | gimli::DW_TAG_volatile_type
                | gimli::DW_TAG_restrict_type => {
                    if let Some(underlying) = resolve_type_to_offset(&unit, entry) {
                        type_indirection.insert(offset, underlying);
                    }
                }
                _ => {
                    current_array_offset = None;
                    current_enum_offset = None;
                }
            }
        }
    }

    // Second pass: resolve struct members and variable types
    let mut units2 = dwarf.units();
    while let Ok(Some(header)) = units2.next() {
        let unit = match dwarf.unit(header) {
            Ok(u) => u,
            Err(_) => continue,
        };

        let mut entries = unit.entries();
        let mut current_struct_offset: Option<gimli::DebugInfoOffset> = None;
        let mut depth: isize = 0;
        let mut struct_depth: isize = 0;

        while let Ok(Some((delta, entry))) = entries.next_dfs() {
            depth += delta;

            match entry.tag() {
                gimli::DW_TAG_structure_type => {
                    let offset = entry.offset().to_debug_info_offset(&unit.header).unwrap_or(gimli::DebugInfoOffset(0));
                    current_struct_offset = Some(offset);
                    struct_depth = depth;
                    if !struct_members.contains_key(&offset) {
                        struct_members.insert(offset, Vec::new());
                    }
                }
                gimli::DW_TAG_member if current_struct_offset.is_some() && depth == struct_depth + 1 => {
                    if let Some(struct_off) = current_struct_offset {
                        if let Some(member_name) = get_die_name(&dwarf, &unit, entry) {
                            let member_offset = get_member_location(entry);
                            let member_type_off = resolve_type_to_offset(&unit, entry);
                            let member_type = member_type_off
                                .and_then(|off| type_map.get(&off))
                                .cloned()
                                .unwrap_or_else(|| "unknown".to_string());
                            // Resolve member size by chasing through type indirection
                            let member_size = member_type_off
                                .and_then(|off| resolve_size_through_chain(off, &type_size_map, &type_indirection))
                                .unwrap_or(0);

                            // Check if this member is an array type
                            let resolved_type_off = member_type_off.and_then(|off| {
                                // Chase through typedef/qualifier chain to find the actual type
                                let mut current = off;
                                for _ in 0..16 {
                                    if array_info.contains_key(&current) {
                                        return Some(current);
                                    }
                                    match type_indirection.get(&current) {
                                        Some(&next) => current = next,
                                        None => return None,
                                    }
                                }
                                None
                            });

                            let (arr_dim, elem_type_name, elem_size) = if let Some(arr_off) = resolved_type_off {
                                if let Some((elem_off, count)) = array_info.get(&arr_off) {
                                    let dim = count.unwrap_or(0);
                                    let elem_name = elem_off
                                        .and_then(|eoff| {
                                            // Chase through typedef chain for the element type name
                                            let mut cur = eoff;
                                            for _ in 0..16 {
                                                if let Some(name) = type_map.get(&cur) {
                                                    return Some(name.clone());
                                                }
                                                match type_indirection.get(&cur) {
                                                    Some(&next) => cur = next,
                                                    None => return None,
                                                }
                                            }
                                            None
                                        });
                                    let esize = elem_off
                                        .and_then(|eoff| resolve_size_through_chain(eoff, &type_size_map, &type_indirection))
                                        .unwrap_or(0);
                                    (dim, elem_name, esize)
                                } else {
                                    (0, None, 0)
                                }
                            } else {
                                (0, None, 0)
                            };

                            // Check if the member type resolves to an enum
                            let member_enum_vals = if let Some(roff) = resolved_type_off {
                                resolve_enum_through_chain(roff, &type_indirection, &enum_values)
                            } else {
                                Vec::new()
                            };

                            struct_members.entry(struct_off).or_default().push(
                                DwarfMemberInfo {
                                    name: member_name,
                                    offset: member_offset,
                                    size: member_size,
                                    type_name: member_type,
                                    array_dim: arr_dim,
                                    element_type_name: elem_type_name,
                                    element_size: elem_size,
                                    enum_variants: member_enum_vals,
                                }
                            );
                        }
                    }
                }
                gimli::DW_TAG_variable => {
                    if let Some(var_name) = get_die_name(&dwarf, &unit, entry) {
                        if let Some(direct_off) = resolve_type_to_offset(&unit, entry) {
                            // Try to find a struct by chasing through typedef/qualifier chain
                            let struct_off = resolve_struct_through_chain(
                                direct_off, &type_indirection, &struct_members
                            );
                            let type_name = type_map.get(&direct_off).cloned()
                                .unwrap_or_else(|| "unknown".to_string());

                            // Resolve enum variants for this variable
                            let var_enum_vals = resolve_enum_through_chain(
                                direct_off, &type_indirection, &enum_values
                            );

                            if let Some(soff) = struct_off {
                                if let Some(members) = struct_members.get(&soff) {
                                    let base_type = type_map.get(&soff).cloned()
                                        .or_else(|| type_map.get(&direct_off).cloned())
                                        .unwrap_or_default();
                                    result.insert(var_name.clone(), DwarfSymbolInfo {
                                        type_name: base_type,
                                        members: members.clone(),
                                        enum_variants: var_enum_vals.clone(),
                                    });
                                }
                            }

                            result.entry(var_name).or_insert(DwarfSymbolInfo {
                                type_name,
                                members: Vec::new(),
                                enum_variants: var_enum_vals,
                            });
                        } else {
                            result.entry(var_name).or_insert(DwarfSymbolInfo {
                                type_name: "unknown".to_string(),
                                members: Vec::new(),
                                enum_variants: Vec::new(),
                            });
                        }
                    }
                }
                _ => {
                    if depth <= struct_depth && current_struct_offset.is_some() {
                        current_struct_offset = None;
                    }
                }
            }
        }
    }

    result
}

/// Chase through typedef/const/volatile/restrict indirection until we find a struct type.
/// Returns the struct type offset if found, otherwise None.
fn resolve_struct_through_chain(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    struct_members: &HashMap<gimli::DebugInfoOffset, Vec<DwarfMemberInfo>>,
) -> Option<gimli::DebugInfoOffset> {
    let mut current = start;
    for _ in 0..16 {
        if struct_members.contains_key(&current) {
            return Some(current);
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

/// Chase through typedef chain to find enum values if the type resolves to an enum.
fn resolve_enum_through_chain(
    start: gimli::DebugInfoOffset,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
    enum_values: &HashMap<gimli::DebugInfoOffset, Vec<(String, i64)>>,
) -> Vec<(String, i64)> {
    let mut current = start;
    for _ in 0..16 {
        if let Some(vals) = enum_values.get(&current) {
            if !vals.is_empty() {
                return vals.clone();
            }
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return Vec::new(),
        }
    }
    Vec::new()
}

/// Resolve byte size through typedef/qualifier chain.
fn resolve_size_through_chain(
    start: gimli::DebugInfoOffset,
    type_size_map: &HashMap<gimli::DebugInfoOffset, u64>,
    type_indirection: &HashMap<gimli::DebugInfoOffset, gimli::DebugInfoOffset>,
) -> Option<u64> {
    let mut current = start;
    for _ in 0..16 {
        if let Some(&size) = type_size_map.get(&current) {
            return Some(size);
        }
        match type_indirection.get(&current) {
            Some(&next) => current = next,
            None => return None,
        }
    }
    None
}

fn get_die_name(
    dwarf: &gimli::Dwarf<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    unit: &gimli::Unit<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<String> {
    entry.attr_value(gimli::DW_AT_name).ok().flatten().and_then(|val| {
        dwarf.attr_string(unit, val).ok().map(|s| {
            s.to_string_lossy().into_owned()
        })
    })
}

fn resolve_type_to_offset(
    unit: &gimli::Unit<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<gimli::DebugInfoOffset> {
    let val = entry.attr_value(gimli::DW_AT_type).ok().flatten()?;
    match val {
        gimli::AttributeValue::UnitRef(offset) => {
            offset.to_debug_info_offset(&unit.header)
        }
        gimli::AttributeValue::DebugInfoRef(offset) => Some(offset),
        _ => None,
    }
}

fn get_member_location(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> u64 {
    entry.attr_value(gimli::DW_AT_data_member_location).ok().flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            _ => None,
        })
        .unwrap_or(0)
}

fn get_byte_size(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
) -> Option<u64> {
    entry.attr_value(gimli::DW_AT_byte_size).ok().flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            _ => None,
        })
}

fn get_attr_udata(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    attr: gimli::DwAt,
) -> Option<u64> {
    entry.attr_value(attr).ok().flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Udata(v) => Some(v),
            gimli::AttributeValue::Sdata(v) => Some(v as u64),
            gimli::AttributeValue::Data1(v) => Some(v as u64),
            gimli::AttributeValue::Data2(v) => Some(v as u64),
            gimli::AttributeValue::Data4(v) => Some(v as u64),
            gimli::AttributeValue::Data8(v) => Some(v),
            _ => None,
        })
}

fn get_attr_sdata(
    entry: &gimli::DebuggingInformationEntry<gimli::EndianSlice<'_, gimli::RunTimeEndian>>,
    attr: gimli::DwAt,
) -> Option<i64> {
    entry.attr_value(attr).ok().flatten()
        .and_then(|val| match val {
            gimli::AttributeValue::Sdata(v) => Some(v),
            gimli::AttributeValue::Udata(v) => Some(v as i64),
            gimli::AttributeValue::Data1(v) => Some(v as i64),
            gimli::AttributeValue::Data2(v) => Some(v as i64),
            gimli::AttributeValue::Data4(v) => Some(v as i64),
            gimli::AttributeValue::Data8(v) => Some(v as i64),
            _ => None,
        })
}

#[tauri::command]
fn load_elf_symbols(
    path: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Vec<ElfSymbol>, String> {
    // Stop any existing file watcher
    if let Ok(mut shutdown) = state.watcher_shutdown.lock() {
        if let Some(tx) = shutdown.take() {
            let _ = tx.send(());
        }
    }

    // Store the ELF path
    if let Ok(mut elf_path) = state.elf_path.lock() {
        *elf_path = Some(path.clone());
    }

    let symbols = core_load_elf_symbols(&path)?;

    // Cache symbols
    if let Ok(mut cache) = state.elf_symbols_cache.lock() {
        *cache = symbols.clone();
    }

    // Spawn file watcher
    let watch_path = path.clone();
    let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel::<()>();
    if let Ok(mut shutdown) = state.watcher_shutdown.lock() {
        *shutdown = Some(shutdown_tx);
    }

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(_) => return,
        };
        if watcher.watch(&PathBuf::from(&watch_path), RecursiveMode::NonRecursive).is_err() {
            return;
        }

        loop {
            // Check for shutdown signal
            if shutdown_rx.try_recv().is_ok() {
                break;
            }

            match rx.recv_timeout(std::time::Duration::from_millis(500)) {
                Ok(Ok(event)) => {
                    if matches!(event.kind, EventKind::Modify(_)) {
                        let _ = app_handle.emit("elf-changed", &watch_path);
                    }
                }
                Ok(Err(_)) => break,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            }
        }
    });

    Ok(symbols)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateEcuAddressesResult {
    pub updated_count: usize,
    pub matched_names: Vec<String>,
}

#[tauri::command]
fn update_ecu_addresses(
    module_name: Option<String>,
    state: tauri::State<AppState>,
) -> Result<UpdateEcuAddressesResult, String> {
    let elf_symbols = state.elf_symbols_cache.lock().map_err(|_| "Lock poisoned")?;
    if elf_symbols.is_empty() {
        return Err("No ELF symbols loaded".to_string());
    }

    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_update_ecu_addresses(a2l, module_name.as_deref(), &elf_symbols)
}

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
    pub array_dim: u64,
    #[serde(default)]
    pub enum_values: Vec<(String, i64)>,
}

// Helper to parse A2L data type from string
fn parse_data_type(type_str: &str) -> a2lfile::DataType {
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

// Legacy command for backward compatibility
#[tauri::command]
fn create_measurements_from_elf(
    module_name: Option<String>,
    symbols: Vec<ElfSymbol>,
    state: tauri::State<AppState>
) -> Result<EntityUpdateResult, String> {
    // Convert to SymbolWithMapping with default values
    let mapped_symbols: Vec<SymbolWithMapping> = symbols.iter().map(|s| {
        SymbolWithMapping {
            name: s.name.clone(),
            address: s.address,
            a2l_type: s.suggested_a2l_type.clone(),
            lower_limit: s.suggested_limits.0,
            upper_limit: s.suggested_limits.1,
            conversion: Some("NO_COMPU_METHOD".to_string()),
            resolution: Some(1),
            accuracy: Some(0.0),
            array_dim: s.array_dim,
            enum_values: s.enum_values.clone(),
        }
    }).collect();

    create_measurements_with_mapping(module_name, mapped_symbols, state)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SymbolConflict {
    pub symbol_name: String,
    pub existing_address: String,
    pub existing_type: String,
    pub new_address: String,
    pub new_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConflictReport {
    pub conflicts: Vec<SymbolConflict>,
    pub non_conflicts: Vec<String>,
}

// Check for symbol conflicts before importing
#[tauri::command]
fn check_symbol_conflicts(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>
) -> Result<ConflictReport, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    core_check_conflicts(a2l, module_name.as_deref(), &symbols)
}

// Enhanced command with custom type mapping
#[tauri::command]
fn create_measurements_with_mapping(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_create_measurements(a2l, module_name.as_deref(), &symbols)?;

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

// Create characteristics from ELF symbols
#[tauri::command]
fn create_characteristics_from_elf(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_create_characteristics(a2l, module_name.as_deref(), &symbols)?;

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_a2l_from_string,
            load_a2l_from_path,
            update_project_metadata,
            export_a2l,
            save_a2l_to_path,
            list_core_entities,
            list_a2l_tree,
            update_entity_name,
            update_module_long_identifier,
            delete_entities,
            get_measurement,
            update_measurement,
            get_characteristic,
            update_characteristic,
            get_axis_pts,
            update_axis_pts,
            load_elf_symbols,
            create_measurements_from_elf,
            create_measurements_with_mapping,
            create_characteristics_from_elf,
            check_symbol_conflicts,
            update_ecu_addresses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
