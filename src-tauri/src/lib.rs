use std::sync::Mutex;
use std::fs;
use goblin::elf::Elf;

use serde::{Serialize, Deserialize};
use a2lfile::{A2lObjectName, A2lObjectNameSetter, Header, ItemList};

#[derive(Default)]
struct AppState {
    a2l: Mutex<Option<a2lfile::A2lFile>>,
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
            opt_detail("ECU address", &self.ecu_address),
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

#[tauri::command]
fn load_a2l_from_string(
    contents: String,
    state: tauri::State<AppState>,
) -> Result<A2lMetadata, String> {
    let (a2l, warnings) = a2lfile::load_from_string(&contents, None, false)
        .map_err(|error| error.to_string())?;

    let metadata = build_metadata(&a2l, warnings.len());
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
    Ok(a2l.write_to_string())
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
        // Fallback for any future types or if debug format differs
        _ => format!("{:?}", dt).to_uppercase(),
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

#[derive(Serialize, Deserialize, Clone)]
struct ElfSymbol {
    name: String,
    address: u64,
    size: u64,
    bind: String,
    type_str: String,
    section: String,
}

#[tauri::command]
fn load_elf_symbols(path: String) -> Result<Vec<ElfSymbol>, String> {
    let buffer = fs::read(&path).map_err(|e| e.to_string())?;
    let elf = Elf::parse(&buffer).map_err(|e| e.to_string())?;
    
    let mut symbols = Vec::new();
    for sym in elf.syms.iter() {
        if let Some(name) = elf.strtab.get_at(sym.st_name) {
            if !name.is_empty() {
                 let type_str = match goblin::elf::sym::type_to_str(sym.st_type()) {
                    Some(s) => s.to_string(),
                    None => format!("TYPE_{}", sym.st_type())
                 };
                 let bind = match goblin::elf::sym::bind_to_str(sym.st_bind()) {
                     Some(s) => s.to_string(),
                     None => format!("BIND_{}", sym.st_bind())
                 };

                 let section = if sym.st_shndx < elf.section_headers.len() {
                    let sh = &elf.section_headers[sym.st_shndx];
                     elf.shdr_strtab.get_at(sh.sh_name).unwrap_or("").to_string()
                 } else {
                    "".to_string()
                 };
                 
                 symbols.push(ElfSymbol {
                     name: name.to_string(),
                     address: sym.st_value,
                     size: sym.st_size,
                     bind,
                     type_str,
                     section,
                 });
            }
        }
    }
    symbols.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(symbols)
}

#[tauri::command]
fn create_measurements_from_elf(
    module_name: Option<String>,
    symbols: Vec<ElfSymbol>, 
    state: tauri::State<AppState>
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let target_module = if let Some(name) = module_name {
        a2l.project.module.iter_mut().find(|m| m.get_name() == name)
            .ok_or(format!("Module {} not found", name))?
    } else {
        a2l.project.module.first_mut().ok_or("No modules in project")?
    };

    for sym in symbols {
        let mut m = a2lfile::Measurement::new(sym.name, a2lfile::DataType::Ubyte);
        m.ecu_address = Some(a2lfile::EcuAddress::new(sym.address as u32));
        m.lower_limit = 0.0;
        m.upper_limit = 255.0; // Default UBYTE limits
        m.resolution = 1;
        m.accuracy = 0.0;
        m.conversion = "NO_COMPU_METHOD".to_string();
        target_module.measurement.push(m);
    }

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
            get_measurement,
            update_measurement,
            get_characteristic,
            update_characteristic,
            get_axis_pts,
            update_axis_pts,
            load_elf_symbols,
            create_measurements_from_elf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
