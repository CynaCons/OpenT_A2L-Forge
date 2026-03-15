//! CLI sync project loading, saving, and build-system sync execution.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use a2lfile::A2lObjectName;

use crate::a2l_ops::{
    core_create_characteristics, core_delete_entities, core_export_a2l, core_load_a2l_from_path,
};
use crate::elf_parser::core_load_elf_symbols;
use crate::types::{
    CliSymbolMappingOverride, CliSyncMissingPolicy, CliSyncProject, CliSyncResult,
    DeleteEntityRequest, ElfSymbol, LoadedCliSyncProject, SymbolWithMapping, TrackedSelector,
};

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn project_parent_dir(project_path: &Path) -> Result<&Path, String> {
    project_path.parent().ok_or_else(|| {
        format!(
            "Project path '{}' has no parent directory",
            project_path.display()
        )
    })
}

fn resolve_project_path(base_dir: &Path, value: &str) -> PathBuf {
    let path = PathBuf::from(value);
    let joined = if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    };

    normalize_path(joined)
}

fn normalize_path(path: PathBuf) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

fn relative_project_path(base_dir: &Path, value: &str) -> String {
    let absolute = PathBuf::from(value);
    let normalized = if absolute.is_absolute() {
        absolute
    } else {
        base_dir.join(absolute)
    };
    let normalized = normalize_path(normalized);

    match pathdiff::diff_paths(&normalized, base_dir) {
        Some(diff) => path_to_string(&diff),
        None => path_to_string(&normalized),
    }
}

fn symbol_to_mapping(symbol: &ElfSymbol) -> SymbolWithMapping {
    SymbolWithMapping {
        name: symbol.name.clone(),
        address: symbol.address,
        a2l_type: symbol.suggested_a2l_type.clone(),
        lower_limit: symbol.suggested_limits.0,
        upper_limit: symbol.suggested_limits.1,
        conversion: Some("NO_COMPU_METHOD".to_string()),
        resolution: Some(1),
        accuracy: Some(0.0),
        array_dims: symbol.array_dims.clone(),
        enum_values: symbol.enum_values.clone(),
    }
}

fn apply_override(
    symbol: &ElfSymbol,
    mapping_override: Option<&CliSymbolMappingOverride>,
) -> SymbolWithMapping {
    let mut mapping = symbol_to_mapping(symbol);
    if let Some(mapping_override) = mapping_override {
        mapping.a2l_type = mapping_override.a2l_type.clone();
        mapping.lower_limit = mapping_override.lower_limit;
        mapping.upper_limit = mapping_override.upper_limit;
        mapping.conversion = mapping_override.conversion.clone();
        mapping.resolution = mapping_override.resolution;
        mapping.accuracy = mapping_override.accuracy;
        mapping.array_dims = mapping_override.array_dims.clone();
        mapping.enum_values = mapping_override.enum_values.clone();
    }
    mapping
}

fn generated_enum_delete_requests(name: &str) -> [DeleteEntityRequest; 3] {
    let sanitized = name.replace('.', "_");
    [
        DeleteEntityRequest {
            kind: "Characteristic".to_string(),
            name: name.to_string(),
        },
        DeleteEntityRequest {
            kind: "CompuMethod".to_string(),
            name: format!("__cm_{sanitized}"),
        },
        DeleteEntityRequest {
            kind: "CompuVtab".to_string(),
            name: format!("__vtab_{sanitized}"),
        },
    ]
}

fn target_module_mut<'a>(
    a2l: &'a mut a2lfile::A2lFile,
    module_name: Option<&str>,
) -> Result<&'a mut a2lfile::Module, String> {
    if let Some(name) = module_name {
        a2l.project
            .module
            .iter_mut()
            .find(|module| module.get_name() == name)
            .ok_or_else(|| format!("Module {} not found", name))
    } else {
        a2l.project
            .module
            .iter_mut()
            .next()
            .ok_or_else(|| "No modules in project".to_string())
    }
}

pub fn core_save_cli_sync_project(path: &str, project: &CliSyncProject) -> Result<(), String> {
    let project_path = PathBuf::from(path);
    let base_dir = project_parent_dir(&project_path)?;

    let normalized = CliSyncProject {
        version: if project.version == 0 {
            1
        } else {
            project.version
        },
        a2l_path: relative_project_path(base_dir, &project.a2l_path),
        elf_path: relative_project_path(base_dir, &project.elf_path),
        module_name: project.module_name.clone(),
        output_path: project
            .output_path
            .as_ref()
            .map(|value| relative_project_path(base_dir, value)),
        selectors: project.selectors.clone(),
        mapping_overrides: project.mapping_overrides.clone(),
        missing_policy: project.missing_policy.clone(),
    };

    let contents = serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?;
    fs::write(project_path, contents).map_err(|error| error.to_string())
}

pub fn core_load_cli_sync_project(path: &str) -> Result<LoadedCliSyncProject, String> {
    let project_path = PathBuf::from(path);
    let base_dir = project_parent_dir(&project_path)?;
    let contents = fs::read_to_string(&project_path).map_err(|error| error.to_string())?;
    let mut project: CliSyncProject =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    if project.version == 0 {
        project.version = 1;
    }

    Ok(LoadedCliSyncProject {
        project_path: path_to_string(&project_path),
        resolved_a2l_path: path_to_string(&resolve_project_path(base_dir, &project.a2l_path)),
        resolved_elf_path: path_to_string(&resolve_project_path(base_dir, &project.elf_path)),
        resolved_output_path: project
            .output_path
            .as_ref()
            .map(|value| path_to_string(&resolve_project_path(base_dir, value))),
        project,
    })
}

pub fn core_sync_cli_project(
    project_path: &str,
    output_override: Option<&str>,
    missing_policy_override: Option<CliSyncMissingPolicy>,
) -> Result<CliSyncResult, String> {
    let loaded_project = core_load_cli_sync_project(project_path)?;
    let mut a2l = core_load_a2l_from_path(&loaded_project.resolved_a2l_path)?.0;
    let elf_symbols = core_load_elf_symbols(&loaded_project.resolved_elf_path)?;
    let elf_map: BTreeMap<String, &ElfSymbol> = elf_symbols
        .iter()
        .map(|symbol| (symbol.name.clone(), symbol))
        .collect();

    let mut unresolved_selectors = BTreeSet::new();
    let mut stale_names = BTreeSet::new();
    let mut resolved_names = BTreeSet::new();
    let mut resolved_mappings = BTreeMap::<String, SymbolWithMapping>::new();
    let mut struct_roots = BTreeSet::new();

    for selector in &loaded_project.project.selectors {
        match selector {
            TrackedSelector::StructRoot { name } => {
                struct_roots.insert(name.clone());
                let mut matched = false;
                for symbol in &elf_symbols {
                    if symbol.is_struct_member
                        && symbol.parent_struct.as_deref() == Some(name.as_str())
                    {
                        matched = true;
                        resolved_names.insert(symbol.name.clone());
                        resolved_mappings.insert(
                            symbol.name.clone(),
                            apply_override(
                                symbol,
                                loaded_project.project.mapping_overrides.get(&symbol.name),
                            ),
                        );
                    }
                }
                if !matched {
                    unresolved_selectors.insert(format!("struct_root:{name}"));
                }
            }
            TrackedSelector::Symbol { name } => {
                if let Some(symbol) = elf_map.get(name) {
                    resolved_names.insert(name.clone());
                    resolved_mappings.insert(
                        name.clone(),
                        apply_override(symbol, loaded_project.project.mapping_overrides.get(name)),
                    );
                } else {
                    unresolved_selectors.insert(format!("symbol:{name}"));
                    stale_names.insert(name.clone());
                }
            }
        }
    }

    let module_name = loaded_project.project.module_name.as_deref();

    {
        let target_module = target_module_mut(&mut a2l, module_name)?;
        let characteristic_names: BTreeSet<String> = target_module
            .characteristic
            .iter()
            .map(|characteristic| characteristic.get_name().to_string())
            .collect();

        for root in &struct_roots {
            let prefix = format!("{root}.");
            for characteristic_name in &characteristic_names {
                if characteristic_name.starts_with(&prefix)
                    && !resolved_names.contains(characteristic_name)
                {
                    stale_names.insert(characteristic_name.clone());
                }
            }
        }
    }

    let output_path = output_override
        .map(ToString::to_string)
        .or_else(|| loaded_project.resolved_output_path.clone())
        .unwrap_or_else(|| loaded_project.resolved_a2l_path.clone());
    let missing_policy =
        missing_policy_override.unwrap_or_else(|| loaded_project.project.missing_policy.clone());

    let mut imported_names = Vec::new();
    let mut replaced_names = Vec::new();
    let mut conflicts = Vec::new();

    {
        let target_module = target_module_mut(&mut a2l, module_name)?;
        let characteristic_names: BTreeSet<String> = target_module
            .characteristic
            .iter()
            .map(|characteristic| characteristic.get_name().to_string())
            .collect();
        let measurement_names: BTreeSet<String> = target_module
            .measurement
            .iter()
            .map(|measurement| measurement.get_name().to_string())
            .collect();

        for name in resolved_mappings.keys() {
            if measurement_names.contains(name) {
                conflicts.push(name.clone());
            } else if characteristic_names.contains(name) {
                replaced_names.push(name.clone());
            } else {
                imported_names.push(name.clone());
            }
        }
    }

    if !conflicts.is_empty() {
        return Ok(CliSyncResult {
            project_path: loaded_project.project_path,
            output_path,
            missing_policy,
            resolved_names: resolved_names.into_iter().collect(),
            imported_names,
            replaced_names,
            stale_names: stale_names.into_iter().collect(),
            deleted_names: Vec::new(),
            conflicts,
            unresolved_selectors: unresolved_selectors.into_iter().collect(),
        });
    }

    if missing_policy == CliSyncMissingPolicy::Report
        && (!stale_names.is_empty() || !unresolved_selectors.is_empty())
    {
        return Ok(CliSyncResult {
            project_path: loaded_project.project_path,
            output_path,
            missing_policy,
            resolved_names: resolved_names.into_iter().collect(),
            imported_names,
            replaced_names,
            stale_names: stale_names.into_iter().collect(),
            deleted_names: Vec::new(),
            conflicts,
            unresolved_selectors: unresolved_selectors.into_iter().collect(),
        });
    }

    let resolved_list: Vec<SymbolWithMapping> = resolved_mappings.into_values().collect();
    if !resolved_list.is_empty() {
        core_create_characteristics(&mut a2l, module_name, &resolved_list)?;
    }

    let mut deleted_names = Vec::new();
    if missing_policy == CliSyncMissingPolicy::Prune && !stale_names.is_empty() {
        let mut requests = Vec::new();
        for name in &stale_names {
            requests.extend(generated_enum_delete_requests(name));
            deleted_names.push(name.clone());
        }
        core_delete_entities(&mut a2l, &requests);
    }

    let contents = core_export_a2l(&a2l);
    fs::write(&output_path, contents).map_err(|error| error.to_string())?;

    Ok(CliSyncResult {
        project_path: loaded_project.project_path,
        output_path,
        missing_policy,
        resolved_names: resolved_names.into_iter().collect(),
        imported_names,
        replaced_names,
        stale_names: stale_names.into_iter().collect(),
        deleted_names,
        conflicts,
        unresolved_selectors: unresolved_selectors.into_iter().collect(),
    })
}
