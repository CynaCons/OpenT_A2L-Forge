//! OpenT A2L-Forge — Tauri v2 backend for editing ASAP2/A2L calibration files.
//!
//! This crate is organized into focused modules:
//! - [`types`] — Shared structs, enums, traits, and DTOs
//! - [`a2l_ops`] — A2L file CRUD operations and tree building
//! - [`elf_parser`] — ELF/DWARF parsing and type inference
//! - [`validator`] — A2L validation engine

pub mod a2l_ops;
pub mod cli_sync;
pub mod elf_parser;
pub mod types;
pub mod validator;

// Re-export public API for integration tests and external consumers
pub use a2l_ops::*;
pub use cli_sync::*;
pub use elf_parser::{
    core_load_elf_symbols, core_load_elf_symbols_from_buffer, parse_dwarf_symbols,
};
pub use types::*;
pub use validator::*;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use a2lfile::{A2lObjectName, A2lObjectNameSetter, Header};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use tauri::Emitter;

// ─── Application state ─────────────────────────────────────────────────────

/// Global application state shared across all Tauri commands via managed state.
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

// ─── Tauri command wrappers ─────────────────────────────────────────────────

/// Parse an A2L file from a raw string and store it in application state.
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

/// Load and parse an A2L file from a filesystem path.
#[tauri::command]
fn load_a2l_from_path(path: String, state: tauri::State<AppState>) -> Result<A2lMetadata, String> {
    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    load_a2l_from_string(contents, state)
}

/// Update the project name, long identifier, and header comment.
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

/// Serialize the current A2L file to its string representation.
#[tauri::command]
fn export_a2l(state: tauri::State<AppState>) -> Result<String, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(core_export_a2l(a2l))
}

/// Write the current A2L file to a filesystem path.
#[tauri::command]
fn save_a2l_to_path(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    let content = a2l.write_to_string();
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Save a CLI sync project file to disk.
#[tauri::command]
fn save_cli_sync_project(path: String, project: CliSyncProject) -> Result<(), String> {
    core_save_cli_sync_project(&path, &project)
}

/// Load a CLI sync project file and resolve its referenced paths.
#[tauri::command]
fn load_cli_sync_project(path: String) -> Result<LoadedCliSyncProject, String> {
    core_load_cli_sync_project(&path)
}

/// List all core entities (modules, measurements, characteristics, axis points).
#[tauri::command]
fn list_core_entities(state: tauri::State<AppState>) -> Result<Vec<CoreEntity>, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(collect_core_entities(a2l))
}

/// Build the full hierarchical tree view of all A2L entities.
#[tauri::command]
fn list_a2l_tree(state: tauri::State<AppState>) -> Result<A2lTree, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(build_tree(a2l))
}

/// Rename an entity (module, measurement, characteristic, or axis points).
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

/// Delete one or more entities by kind and name.
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

/// Update a module's long identifier (description).
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

/// Retrieve a single measurement's data by name.
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

/// Update a measurement's fields by name.
#[tauri::command]
fn update_measurement(
    name: String,
    data: MeasurementData,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let new_datatype = string_to_datatype(&data.datatype)
        .ok_or_else(|| format!("Invalid data type: {}", data.datatype))?;

    let new_address = match data.ecu_address {
        Some(s) if !s.trim().is_empty() => {
            let clean = s.trim().trim_start_matches("0x").trim_start_matches("0X");
            let addr_val = u32::from_str_radix(clean, 16).map_err(|_| "Invalid hex address")?;
            Some(a2lfile::EcuAddress::new(addr_val))
        }
        _ => None,
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

/// Retrieve a single characteristic's data by name.
#[tauri::command]
fn get_characteristic(
    name: String,
    state: tauri::State<AppState>,
) -> Result<CharacteristicData, String> {
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

/// Update a characteristic's fields by name.
#[tauri::command]
fn update_characteristic(
    name: String,
    data: CharacteristicData,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let new_type = string_to_characteristic_type(&data.characteristic_type)
        .ok_or_else(|| format!("Invalid characteristic type: {}", data.characteristic_type))?;

    let clean_addr = data
        .address
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    let new_addr_val = u32::from_str_radix(clean_addr, 16).map_err(|_| "Invalid hex address")?;

    let new_bit_mask = match data.bit_mask {
        Some(s) if !s.trim().is_empty() => {
            let clean = s.trim().trim_start_matches("0x").trim_start_matches("0X");
            let mask_val = u64::from_str_radix(clean, 16).map_err(|_| "Invalid hex bit mask")?;
            Some(a2lfile::BitMask::new(mask_val))
        }
        _ => None,
    };

    for module in a2l.project.module.iter_mut() {
        if let Some(c) = module
            .characteristic
            .iter_mut()
            .find(|c| c.get_name() == name)
        {
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

/// Retrieve a single axis points entity's data by name.
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

/// Update an axis points entity's fields by name.
#[tauri::command]
fn update_axis_pts(
    name: String,
    data: AxisPtsData,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    let clean_addr = data
        .address
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X");
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

/// Load ELF symbols from a file path, cache them, and start a file watcher.
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
        if watcher
            .watch(&PathBuf::from(&watch_path), RecursiveMode::NonRecursive)
            .is_err()
        {
            return;
        }

        loop {
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

/// Update ECU addresses in A2L entities using cached ELF symbols.
#[tauri::command]
fn update_ecu_addresses(
    module_name: Option<String>,
    state: tauri::State<AppState>,
) -> Result<UpdateEcuAddressesResult, String> {
    let elf_symbols = state
        .elf_symbols_cache
        .lock()
        .map_err(|_| "Lock poisoned")?;
    if elf_symbols.is_empty() {
        return Err("No ELF symbols loaded".to_string());
    }

    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_update_ecu_addresses(a2l, module_name.as_deref(), &elf_symbols)
}

/// Legacy command: create measurements from ELF symbols without custom mapping.
#[tauri::command]
fn create_measurements_from_elf(
    module_name: Option<String>,
    symbols: Vec<ElfSymbol>,
    state: tauri::State<AppState>,
) -> Result<EntityUpdateResult, String> {
    let mapped_symbols: Vec<SymbolWithMapping> = symbols
        .iter()
        .map(|s| SymbolWithMapping {
            name: s.name.clone(),
            address: s.address,
            a2l_type: s.suggested_a2l_type.clone(),
            lower_limit: s.suggested_limits.0,
            upper_limit: s.suggested_limits.1,
            conversion: Some("NO_COMPU_METHOD".to_string()),
            resolution: Some(1),
            accuracy: Some(0.0),
            array_dims: s.array_dims.clone(),
            enum_values: s.enum_values.clone(),
        })
        .collect();

    create_measurements_with_mapping(module_name, mapped_symbols, state)
}

/// Check for name conflicts between ELF symbols and existing A2L entities.
#[tauri::command]
fn check_symbol_conflicts(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>,
) -> Result<ConflictReport, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    core_check_conflicts(a2l, module_name.as_deref(), &symbols)
}

/// Create measurements from ELF symbols with user-specified type mappings.
#[tauri::command]
fn create_measurements_with_mapping(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>,
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_create_measurements(a2l, module_name.as_deref(), &symbols)?;

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

/// Create characteristics from ELF symbols with user-specified type mappings.
#[tauri::command]
fn create_characteristics_from_elf(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: tauri::State<AppState>,
) -> Result<EntityUpdateResult, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;

    core_create_characteristics(a2l, module_name.as_deref(), &symbols)?;

    Ok(EntityUpdateResult {
        metadata: build_metadata(a2l, 0),
        entities: collect_core_entities(a2l),
    })
}

/// Run validation checks on the loaded A2L file.
#[tauri::command]
fn validate_a2l(state: tauri::State<AppState>) -> Result<ValidationResult, String> {
    let guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_ref().ok_or("No A2L loaded")?;
    Ok(core_validate_a2l(a2l))
}

/// Create a new measurement manually from user-provided data.
#[tauri::command]
fn create_measurement(
    module_name: Option<String>,
    data: MeasurementData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_measurement_manual(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

/// Create a new characteristic manually from user-provided data.
#[tauri::command]
fn create_characteristic(
    module_name: Option<String>,
    data: CharacteristicData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_characteristic_manual(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

/// Create a new axis points entity manually from user-provided data.
#[tauri::command]
fn create_axis_pts(
    module_name: Option<String>,
    data: AxisPtsData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_axis_pts_manual(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

/// Create a new computation method manually.
#[tauri::command]
fn create_compu_method(
    module_name: Option<String>,
    data: CompuMethodData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_compu_method(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

/// Create a new computation value table manually.
#[tauri::command]
fn create_compu_vtab(
    module_name: Option<String>,
    data: CompuVtabData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_compu_vtab(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

/// Create a new record layout manually.
#[tauri::command]
fn create_record_layout(
    module_name: Option<String>,
    data: RecordLayoutData,
    state: tauri::State<AppState>,
) -> Result<A2lTree, String> {
    let mut guard = state.a2l.lock().map_err(|_| "State lock poisoned")?;
    let a2l = guard.as_mut().ok_or("No A2L loaded")?;
    core_create_record_layout(a2l, module_name.as_deref(), &data)?;
    Ok(build_tree(a2l))
}

// ─── Tauri app entry point ──────────────────────────────────────────────────

/// Initialize and run the Tauri application with all command handlers registered.
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
            save_cli_sync_project,
            load_cli_sync_project,
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
            update_ecu_addresses,
            validate_a2l,
            create_measurement,
            create_characteristic,
            create_axis_pts,
            create_compu_method,
            create_compu_vtab,
            create_record_layout
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
