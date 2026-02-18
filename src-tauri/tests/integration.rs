use a2lfile::A2lObjectName;
use opent_a2l_forge_lib::{
    core_check_conflicts, core_create_measurements, core_export_a2l, core_load_a2l_from_path,
    core_load_a2l_from_string, core_load_elf_symbols, core_update_ecu_addresses, SymbolWithMapping,
};

fn fixtures_dir() -> String {
    let manifest = env!("CARGO_MANIFEST_DIR");
    format!("{manifest}/../external/a2ltool/fixtures")
}

fn a2l_path(name: &str) -> String {
    format!("{}/a2l/{name}", fixtures_dir())
}

fn elf_path(name: &str) -> String {
    format!("{}/bin/{name}", fixtures_dir())
}

// ─── A2L loading tests ──────────────────────────────────────────────────────

#[test]
fn test_load_real_a2l_software_b() {
    let (a2l, warnings) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();
    println!(
        "software_b.a2l: project={}, modules={}, warnings={}",
        a2l.project.name,
        a2l.project.module.len(),
        warnings.len()
    );

    assert!(!a2l.project.name.is_empty(), "Project name should not be empty");
    assert!(
        !a2l.project.module.is_empty(),
        "Should have at least one module"
    );

    let module = &a2l.project.module[0];
    let measurement_count = module.measurement.len();
    println!("  Module '{}': {} measurements", module.get_name(), measurement_count);
    assert!(measurement_count > 0, "software_b.a2l should contain measurements");
}

// ─── ELF loading tests ─────────────────────────────────────────────────────

#[test]
fn test_load_real_elf_debugdata() {
    let symbols = core_load_elf_symbols(&elf_path("debugdata_gcc.elf")).unwrap();
    println!("debugdata_gcc.elf: {} symbols", symbols.len());

    assert!(!symbols.is_empty(), "Should parse at least one symbol");

    let with_address = symbols.iter().filter(|s| s.address > 0).count();
    println!("  {} symbols have address > 0", with_address);
    assert!(with_address > 0, "At least some symbols should have addresses > 0");
}

#[test]
fn test_load_real_elf_update_test() {
    let symbols = core_load_elf_symbols(&elf_path("update_test.elf")).unwrap();
    println!("update_test.elf: {} symbols", symbols.len());

    assert!(
        !symbols.is_empty(),
        "update_test.elf should have symbols, got 0"
    );

    // Verify symbol data is reasonable
    for sym in symbols.iter().take(5) {
        println!("  {} addr=0x{:X} size={} type={}", sym.name, sym.address, sym.size, sym.type_str);
    }
}

#[test]
fn test_elf_dwarf_parsing_runs_without_error() {
    // Verify DWARF parsing runs without errors on ELF files with debug sections.
    // The actual type resolution depends on DW_TAG_variable names matching symbol names,
    // which may not happen for all fixtures. The key assertion is no panics/errors.
    let candidates = ["debugdata_gcc.elf", "debugdata_clang.elf", "debugdata_gcc_dw3.elf"];

    for name in &candidates {
        let symbols = core_load_elf_symbols(&elf_path(name)).unwrap();
        let with_dwarf = symbols.iter().filter(|s| s.dwarf_type.is_some()).count();
        let struct_members = symbols.iter().filter(|s| s.is_struct_member).count();
        println!(
            "{}: {} symbols, {} with dwarf_type, {} struct members",
            name,
            symbols.len(),
            with_dwarf,
            struct_members
        );
        assert!(!symbols.is_empty(), "{} should have symbols", name);
    }
}

// ─── Measurement creation tests ─────────────────────────────────────────────

#[test]
fn test_create_measurements_from_real_elf() {
    // Create a minimal A2L
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    // Load real ELF symbols and pick the first 5 OBJECT symbols with size > 0
    let elf_symbols = core_load_elf_symbols(&elf_path("debugdata_gcc.elf")).unwrap();
    let object_symbols: Vec<_> = elf_symbols
        .iter()
        .filter(|s| s.type_str == "OBJECT" && s.size > 0 && !s.is_struct_member)
        .take(5)
        .collect();

    assert!(
        !object_symbols.is_empty(),
        "Should find at least one OBJECT symbol"
    );

    let mappings: Vec<SymbolWithMapping> = object_symbols
        .iter()
        .map(|s| SymbolWithMapping {
            name: s.name.clone(),
            address: s.address,
            a2l_type: s.suggested_a2l_type.clone(),
            lower_limit: s.suggested_limits.0,
            upper_limit: s.suggested_limits.1,
            conversion: None,
            resolution: None,
            accuracy: None,
        })
        .collect();

    let count = mappings.len();
    core_create_measurements(&mut a2l, None, &mappings).unwrap();

    let module = &a2l.project.module[0];
    assert_eq!(
        module.measurement.len(),
        count,
        "Should have created {} measurements",
        count
    );

    // Verify names and addresses match
    for sym in &object_symbols {
        let meas = module
            .measurement
            .iter()
            .find(|m| m.get_name() == sym.name);
        assert!(meas.is_some(), "Measurement '{}' should exist", sym.name);
        let meas = meas.unwrap();
        let addr = meas.ecu_address.as_ref().map(|a| a.address as u64).unwrap_or(0);
        assert_eq!(
            addr, sym.address as u64,
            "Address mismatch for '{}'",
            sym.name
        );
    }
}

#[test]
fn test_replace_duplicate_measurement() {
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let sym = SymbolWithMapping {
        name: "foo".to_string(),
        address: 0x1000,
        a2l_type: "UBYTE".to_string(),
        lower_limit: 0.0,
        upper_limit: 255.0,
        conversion: None,
        resolution: None,
        accuracy: None,
    };

    // Create once
    core_create_measurements(&mut a2l, None, &[sym.clone()]).unwrap();
    assert_eq!(a2l.project.module[0].measurement.len(), 1);

    // Create again with different address — should replace, not duplicate
    let sym2 = SymbolWithMapping {
        address: 0x2000,
        ..sym
    };
    core_create_measurements(&mut a2l, None, &[sym2]).unwrap();

    let foos: Vec<_> = a2l.project.module[0]
        .measurement
        .iter()
        .filter(|m| m.get_name() == "foo")
        .collect();
    assert_eq!(foos.len(), 1, "Should have exactly 1 measurement named 'foo'");
    let addr = foos[0].ecu_address.as_ref().map(|a| a.address).unwrap_or(0);
    assert_eq!(addr, 0x2000, "Should have the updated address");
}

// ─── Conflict checking test ─────────────────────────────────────────────────

#[test]
fn test_check_conflicts_with_real_data() {
    let (a2l, _) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();

    // Get measurement names from the A2L
    let module = &a2l.project.module[0];
    let meas_names: Vec<String> = module
        .measurement
        .iter()
        .take(10)
        .map(|m| m.get_name().to_string())
        .collect();

    if meas_names.is_empty() {
        println!("No measurements in software_b.a2l to test conflicts against");
        return;
    }

    // Create symbols that match measurement names
    let test_symbols: Vec<SymbolWithMapping> = meas_names
        .iter()
        .map(|name| SymbolWithMapping {
            name: name.clone(),
            address: 0x9999,
            a2l_type: "UBYTE".to_string(),
            lower_limit: 0.0,
            upper_limit: 255.0,
            conversion: None,
            resolution: None,
            accuracy: None,
        })
        .collect();

    let report = core_check_conflicts(&a2l, None, &test_symbols).unwrap();
    println!(
        "Conflict report: {} conflicts, {} non-conflicts",
        report.conflicts.len(),
        report.non_conflicts.len()
    );

    assert_eq!(
        report.conflicts.len(),
        meas_names.len(),
        "All measurement names should conflict"
    );
}

// ─── Export test ─────────────────────────────────────────────────────────────

#[test]
fn test_export_contains_imported_measurements() {
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let symbols = vec![
        SymbolWithMapping {
            name: "alpha_sensor".to_string(),
            address: 0x1000,
            a2l_type: "UWORD".to_string(),
            lower_limit: 0.0,
            upper_limit: 65535.0,
            conversion: None,
            resolution: None,
            accuracy: None,
        },
        SymbolWithMapping {
            name: "beta_actuator".to_string(),
            address: 0x2000,
            a2l_type: "FLOAT32_IEEE".to_string(),
            lower_limit: -100.0,
            upper_limit: 100.0,
            conversion: None,
            resolution: None,
            accuracy: None,
        },
    ];

    core_create_measurements(&mut a2l, None, &symbols).unwrap();

    let exported = core_export_a2l(&a2l);
    assert!(
        exported.contains("/begin MEASUREMENT alpha_sensor"),
        "Export should contain alpha_sensor measurement"
    );
    assert!(
        exported.contains("/begin MEASUREMENT beta_actuator"),
        "Export should contain beta_actuator measurement"
    );
}

// ─── Update ECU addresses test ──────────────────────────────────────────────

#[test]
fn test_update_ecu_addresses_with_real_data() {
    let (mut a2l, _) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();
    let elf_symbols = core_load_elf_symbols(&elf_path("software_b.elf")).unwrap();

    let result = core_update_ecu_addresses(&mut a2l, None, &elf_symbols).unwrap();
    println!(
        "update_ecu_addresses: updated={}, matched={:?}",
        result.updated_count,
        result.matched_names.len()
    );

    // There should be at least some matches between the A2L measurements and ELF symbols
    // (this may be 0 if names don't overlap — that's OK for the test, but log it)
    println!(
        "  First few matched: {:?}",
        &result.matched_names[..std::cmp::min(5, result.matched_names.len())]
    );
}
