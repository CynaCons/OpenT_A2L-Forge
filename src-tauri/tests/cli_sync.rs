use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(feature = "cli")]
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use a2lfile::A2lObjectName;
use opent_a2l_forge_lib::{
    core_load_a2l_from_path, core_load_cli_sync_project, core_load_elf_symbols,
    core_save_cli_sync_project, core_sync_cli_project, CliSymbolMappingOverride,
    CliSyncMissingPolicy, CliSyncProject, TrackedSelector,
};

fn repo_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn fixtures_dir() -> PathBuf {
    repo_dir().join("external").join("a2ltool").join("fixtures")
}

fn elf_path(name: &str) -> PathBuf {
    fixtures_dir().join("bin").join(name)
}

fn test_fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn temp_dir(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("opent-a2l-forge-{label}-{unique}"));
    fs::create_dir_all(&path).unwrap();
    path
}

fn write_project(path: &Path, project: &CliSyncProject) {
    core_save_cli_sync_project(path.to_str().unwrap(), project).unwrap();
}

#[cfg(feature = "cli")]
fn empty_project_a2l(module_name: &str) -> String {
    format!(
        r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE {module_name} ""
  /end MODULE
/end PROJECT"#
    )
}

#[test]
fn test_cli_sync_project_resolves_relative_paths() {
    let fixture_path = test_fixture_path("cli_sync_nested_relative.json");
    let loaded = core_load_cli_sync_project(fixture_path.to_str().unwrap()).unwrap();

    assert_eq!(
        PathBuf::from(&loaded.resolved_a2l_path).canonicalize().unwrap(),
        fixtures_dir()
            .join("a2l")
            .join("from_source_structs.a2l")
            .canonicalize()
            .unwrap()
    );
    assert_eq!(
        PathBuf::from(&loaded.resolved_elf_path).canonicalize().unwrap(),
        elf_path("update_typedef_test.elf").canonicalize().unwrap()
    );
    assert_eq!(loaded.project.module_name.as_deref(), Some("fragment"));
    assert!(loaded
        .project
        .mapping_overrides
        .contains_key("struct_b.s1.val_i32"));
}

#[test]
fn test_core_sync_cli_project_replaces_existing_characteristic() {
    let temp = temp_dir("cli-sync-replace");
    let a2l_path = temp.join("replace_input.a2l");
    let output_path = temp.join("replace_output.a2l");
    let project_path = temp.join("replace_project.json");

    fs::write(
        &a2l_path,
        r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
    /begin RECORD_LAYOUT __val_UBYTE
      FNC_VALUES 1 UBYTE COLUMN_DIR DIRECT
    /end RECORD_LAYOUT
    /begin CHARACTERISTIC Characteristic_ValBlk "" VALUE 0x10 __val_UBYTE 0.0 NO_COMPU_METHOD 0.0 255.0
    /end CHARACTERISTIC
  /end MODULE
/end PROJECT"#,
    )
    .unwrap();

    let mut mapping_overrides = HashMap::new();
    mapping_overrides.insert(
        "Characteristic_ValBlk".to_string(),
        CliSymbolMappingOverride {
            a2l_type: "FLOAT32_IEEE".to_string(),
            lower_limit: -5.0,
            upper_limit: 5.0,
            conversion: Some("NO_COMPU_METHOD".to_string()),
            resolution: Some(1),
            accuracy: Some(0.0),
            array_dims: vec![5],
            enum_values: vec![],
        },
    );

    write_project(
        &project_path,
        &CliSyncProject {
            version: 1,
            a2l_path: a2l_path.to_string_lossy().to_string(),
            elf_path: elf_path("update_test.elf").to_string_lossy().to_string(),
            module_name: Some("test_mod".to_string()),
            output_path: Some(output_path.to_string_lossy().to_string()),
            selectors: vec![TrackedSelector::Symbol {
                name: "Characteristic_ValBlk".to_string(),
            }],
            mapping_overrides,
            missing_policy: CliSyncMissingPolicy::Report,
        },
    );

    let result = core_sync_cli_project(project_path.to_str().unwrap(), None, None).unwrap();
    assert_eq!(result.imported_names, Vec::<String>::new());
    assert_eq!(
        result.replaced_names,
        vec!["Characteristic_ValBlk".to_string()]
    );
    assert!(result.stale_names.is_empty());
    assert!(result.conflicts.is_empty());

    let (a2l, _) = core_load_a2l_from_path(output_path.to_str().unwrap()).unwrap();
    let module = &a2l.project.module[0];
    let characteristic = module
        .characteristic
        .iter()
        .find(|item| item.get_name() == "Characteristic_ValBlk")
        .expect("Characteristic_ValBlk should exist after sync");

    let elf_symbol = core_load_elf_symbols(elf_path("update_test.elf").to_str().unwrap())
        .unwrap()
        .into_iter()
        .find(|symbol| symbol.name == "Characteristic_ValBlk")
        .expect("Characteristic_ValBlk should exist in the ELF fixture");

    assert_eq!(characteristic.address as u64, elf_symbol.address);
    assert_eq!(characteristic.deposit, "__val_FLOAT32_IEEE");
    assert_eq!(
        characteristic
            .matrix_dim
            .as_ref()
            .map(|matrix| matrix.dim_list.clone()),
        Some(vec![5])
    );
}

#[test]
fn test_struct_root_sync_imports_nested_members_from_fixture_project() {
    let project_path = test_fixture_path("cli_sync_nested_relative.json");
    let temp = temp_dir("cli-sync-struct-root");
    let output_path = temp.join("struct_root_output.a2l");

    let result = core_sync_cli_project(
        project_path.to_str().unwrap(),
        Some(output_path.to_str().unwrap()),
        None,
    )
    .unwrap();

    assert!(result.conflicts.is_empty());
    assert!(result.stale_names.is_empty());
    assert!(result
        .resolved_names
        .contains(&"struct_b.s1.val_i32".to_string()));
    assert!(result
        .resolved_names
        .contains(&"struct_b.s2.val_f32".to_string()));
    assert!(result
        .imported_names
        .contains(&"struct_b.s1.enumval".to_string()));

    let exported = fs::read_to_string(&output_path).unwrap();
    assert!(exported.contains("/begin CHARACTERISTIC struct_b.s1.val_i32"));
    assert!(exported.contains("/begin CHARACTERISTIC struct_b.s2.val_f32"));
}

#[test]
fn test_report_mode_detects_stale_items_without_mutating_output() {
    let temp = temp_dir("cli-sync-report");
    let a2l_path = temp.join("report_input.a2l");
    let project_path = temp.join("report_project.json");

    let original = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
    /begin RECORD_LAYOUT __val_UBYTE
      FNC_VALUES 1 UBYTE COLUMN_DIR DIRECT
    /end RECORD_LAYOUT
    /begin CHARACTERISTIC struct_b.s1.val_i32 "" VALUE 0x11 __val_UBYTE 0.0 NO_COMPU_METHOD 0.0 255.0
    /end CHARACTERISTIC
    /begin CHARACTERISTIC struct_b.old_member "" VALUE 0x22 __val_UBYTE 0.0 NO_COMPU_METHOD 0.0 255.0
    /end CHARACTERISTIC
    /begin CHARACTERISTIC MissingSymbol "" VALUE 0x33 __val_UBYTE 0.0 NO_COMPU_METHOD 0.0 255.0
    /end CHARACTERISTIC
  /end MODULE
/end PROJECT"#;
    fs::write(&a2l_path, original).unwrap();

    write_project(
        &project_path,
        &CliSyncProject {
            version: 1,
            a2l_path: a2l_path.to_string_lossy().to_string(),
            elf_path: elf_path("update_typedef_test.elf")
                .to_string_lossy()
                .to_string(),
            module_name: Some("test_mod".to_string()),
            output_path: Some(a2l_path.to_string_lossy().to_string()),
            selectors: vec![
                TrackedSelector::StructRoot {
                    name: "struct_b".to_string(),
                },
                TrackedSelector::Symbol {
                    name: "MissingSymbol".to_string(),
                },
            ],
            mapping_overrides: HashMap::new(),
            missing_policy: CliSyncMissingPolicy::Report,
        },
    );

    let result = core_sync_cli_project(project_path.to_str().unwrap(), None, None).unwrap();

    assert!(result.conflicts.is_empty());
    assert!(result.stale_names.contains(&"MissingSymbol".to_string()));
    assert!(result
        .stale_names
        .contains(&"struct_b.old_member".to_string()));
    assert_eq!(fs::read_to_string(&a2l_path).unwrap(), original);
}

#[test]
fn test_prune_mode_deletes_stale_characteristics_and_generated_enum_support() {
    let temp = temp_dir("cli-sync-prune");
    let a2l_path = temp.join("prune_input.a2l");
    let output_path = temp.join("prune_output.a2l");
    let project_path = temp.join("prune_project.json");

    fs::write(
        &a2l_path,
        r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
    /begin RECORD_LAYOUT __val_UBYTE
      FNC_VALUES 1 UBYTE COLUMN_DIR DIRECT
    /end RECORD_LAYOUT
    /begin CHARACTERISTIC struct_b.legacy_enum "" VALUE 0x44 __val_UBYTE 0.0 __cm_struct_b_legacy_enum 0.0 255.0
    /end CHARACTERISTIC
    /begin COMPU_VTAB __vtab_struct_b_legacy_enum "" TAB_VERB 1
      0 "LEGACY"
    /end COMPU_VTAB
    /begin COMPU_METHOD __cm_struct_b_legacy_enum "" TAB_VERB "%d" ""
      COMPU_TAB_REF __vtab_struct_b_legacy_enum
    /end COMPU_METHOD
  /end MODULE
/end PROJECT"#,
    )
    .unwrap();

    write_project(
        &project_path,
        &CliSyncProject {
            version: 1,
            a2l_path: a2l_path.to_string_lossy().to_string(),
            elf_path: elf_path("update_typedef_test.elf")
                .to_string_lossy()
                .to_string(),
            module_name: Some("test_mod".to_string()),
            output_path: Some(output_path.to_string_lossy().to_string()),
            selectors: vec![TrackedSelector::StructRoot {
                name: "struct_b".to_string(),
            }],
            mapping_overrides: HashMap::new(),
            missing_policy: CliSyncMissingPolicy::Prune,
        },
    );

    let result = core_sync_cli_project(project_path.to_str().unwrap(), None, None).unwrap();
    assert!(result.conflicts.is_empty());
    assert!(result
        .deleted_names
        .contains(&"struct_b.legacy_enum".to_string()));

    let exported = fs::read_to_string(output_path).unwrap();
    assert!(!exported.contains("struct_b.legacy_enum"));
    assert!(!exported.contains("__cm_struct_b_legacy_enum"));
    assert!(!exported.contains("__vtab_struct_b_legacy_enum"));
    assert!(exported.contains("__val_UBYTE"));
}

#[cfg(feature = "cli")]
#[test]
fn test_cli_binary_sync_runs_against_real_binary() {
    let project_path = test_fixture_path("cli_sync_exact_relative.json");
    let temp = temp_dir("cli-sync-bin");
    let output_path = temp.join("binary_output.a2l");

    let output = Command::new(env!("CARGO_BIN_EXE_opent_a2l_forge_cli"))
        .args([
            "sync",
            "--project",
            project_path.to_str().unwrap(),
            "--output",
            output_path.to_str().unwrap(),
            "--json",
        ])
        .output()
        .expect("CLI binary should run");

    assert!(
        output.status.success(),
        "CLI should exit successfully, stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("\"resolved_names\""));
    assert!(stdout.contains("Characteristic_ValBlk"));

    let (a2l, _) = core_load_a2l_from_path(output_path.to_str().unwrap()).unwrap();
    assert!(a2l.project.module[0]
        .characteristic
        .iter()
        .any(|characteristic| characteristic.get_name() == "Characteristic_ValBlk"));
}

#[cfg(feature = "cli")]
#[test]
fn test_cli_binary_reports_stale_items_with_exit_code_two() {
    let temp = temp_dir("cli-sync-bin-report");
    let a2l_path = temp.join("report_exit_input.a2l");
    let project_path = temp.join("report_exit_project.json");

    fs::write(&a2l_path, empty_project_a2l("test_mod")).unwrap();

    write_project(
        &project_path,
        &CliSyncProject {
            version: 1,
            a2l_path: a2l_path.to_string_lossy().to_string(),
            elf_path: elf_path("update_typedef_test.elf")
                .to_string_lossy()
                .to_string(),
            module_name: Some("test_mod".to_string()),
            output_path: Some(a2l_path.to_string_lossy().to_string()),
            selectors: vec![TrackedSelector::Symbol {
                name: "MissingSymbol".to_string(),
            }],
            mapping_overrides: HashMap::new(),
            missing_policy: CliSyncMissingPolicy::Report,
        },
    );

    let output = Command::new(env!("CARGO_BIN_EXE_opent_a2l_forge_cli"))
        .args([
            "sync",
            "--project",
            project_path.to_str().unwrap(),
            "--json",
        ])
        .output()
        .expect("CLI binary should run");

    assert_eq!(output.status.code(), Some(2));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("MissingSymbol"));
}
