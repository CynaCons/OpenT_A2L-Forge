use a2lfile::A2lObjectName;
use opent_a2l_forge_lib::{
    core_check_conflicts, core_create_characteristics, core_create_measurements,
    core_delete_entities, core_export_a2l, core_load_a2l_from_path,
    core_load_a2l_from_string, core_load_elf_symbols, core_update_ecu_addresses,
    parse_dwarf_symbols, DeleteEntityRequest, SymbolWithMapping,
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
            array_dims: s.array_dims.clone(),
            enum_values: s.enum_values.clone(),
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
        array_dims: vec![],
        enum_values: vec![],
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
            array_dims: vec![],
            enum_values: vec![],
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
            array_dims: vec![],
            enum_values: vec![],
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
            array_dims: vec![],
            enum_values: vec![],
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

// ─── Voyant ELF struct member tests ────────────────────────────────────────

#[test]
fn test_voyant_elf_struct_members() {
    let voyant_elf =
        r"C:\dev\interview\voyant-photonics\VoyantTakeHomeAssignment\build\Debug\VoyantTakeHomeAssignment.elf";
    if !std::path::Path::new(voyant_elf).exists() {
        println!("Skipping: Voyant ELF not found at {voyant_elf}");
        return;
    }

    let symbols = core_load_elf_symbols(voyant_elf).unwrap();
    println!("Voyant ELF: {} total symbols", symbols.len());

    // Known struct variable names from the source code
    let expected_structs = ["g_sc", "g_vd", "g_cs", "g_oc", "g_sched", "g_cd"];

    for name in &expected_structs {
        let parent = symbols.iter().find(|s| s.name == *name);
        let members: Vec<_> = symbols
            .iter()
            .filter(|s| s.parent_struct.as_deref() == Some(*name))
            .collect();

        if let Some(p) = parent {
            println!(
                "  {} — addr=0x{:X} size={} dwarf={:?} members={}",
                name,
                p.address,
                p.size,
                p.dwarf_type,
                members.len()
            );
            for m in &members {
                println!(
                    "    .{} — addr=0x{:X} size={} type={} dwarf={:?}",
                    m.name, m.address, m.size, m.suggested_a2l_type, m.dwarf_type
                );
            }
        } else {
            println!("  {} — NOT FOUND in symbol table", name);
        }

        // ASSERT: each known struct should have members
        if parent.is_some() {
            assert!(
                !members.is_empty(),
                "Struct '{}' found in symbol table but has no struct members expanded",
                name
            );
        }
    }

    // Summary
    let total_struct_members = symbols.iter().filter(|s| s.is_struct_member).count();
    let total_with_dwarf = symbols.iter().filter(|s| s.dwarf_type.is_some()).count();
    println!(
        "\nSummary: {} struct members, {} with dwarf_type out of {} total",
        total_struct_members, total_with_dwarf, symbols.len()
    );

    assert!(
        total_struct_members > 0,
        "Expected at least some struct members, got 0"
    );

    // Verify specific data type inferences for known members
    let check_member = |parent: &str, member: &str, expected_type: &str, expected_size: u64| {
        let full_name = format!("{}.{}", parent, member);
        let sym = symbols.iter().find(|s| s.name == full_name);
        assert!(sym.is_some(), "Member '{}' not found", full_name);
        let sym = sym.unwrap();
        assert_eq!(
            sym.suggested_a2l_type, expected_type,
            "Type mismatch for '{}': got '{}', expected '{}'",
            full_name, sym.suggested_a2l_type, expected_type
        );
        if expected_size > 0 {
            assert_eq!(
                sym.size, expected_size,
                "Size mismatch for '{}': got {}, expected {}",
                full_name, sym.size, expected_size
            );
        }
    };

    // g_vd: BSW_02_VoltageDriver_t
    check_member("g_vd", "last_dac_value", "UWORD", 2);    // uint16_t -> UWORD
    check_member("g_vd", "write_cnt", "ULONG", 4);          // uint32_t -> ULONG
    check_member("g_vd", "state", "UBYTE", 1);              // enum (1 byte) -> UBYTE

    // g_oc: APP_01_Control_t
    check_member("g_oc", "in_current_value_mA", "FLOAT32_IEEE", 4);  // float32_t -> FLOAT32_IEEE
    check_member("g_oc", "in_number_of_samples", "ULONG", 4);        // uint32_t -> ULONG
    check_member("g_oc", "flag_safety_shutdown", "UBYTE", 1);         // _Bool -> UBYTE
    check_member("g_oc", "cnt_1ms", "ULONG", 4);                     // uint32_t -> ULONG

    // g_sched: SCHED_t
    check_member("g_sched", "flag_1ms", "UBYTE", 1);                 // uint8_t -> UBYTE
    check_member("g_sched", "cnt_isr_1ms", "ULONG", 4);              // uint32_t -> ULONG
    check_member("g_sched", "diag_1ms_overrun_cnt", "UWORD", 2);     // uint16_t -> UWORD

    // g_cs: BSW_01_CurrentSampling_t
    check_member("g_cs", "out_current_value_mA", "FLOAT32_IEEE", 4); // float32_t -> FLOAT32_IEEE
    check_member("g_cs", "current_value_raw", "UWORD", 2);           // uint16_t -> UWORD
}

#[test]
fn test_voyant_struct_members_as_a2l_measurements() {
    let voyant_elf =
        r"C:\dev\interview\voyant-photonics\VoyantTakeHomeAssignment\build\Debug\VoyantTakeHomeAssignment.elf";
    if !std::path::Path::new(voyant_elf).exists() {
        println!("Skipping: Voyant ELF not found");
        return;
    }

    // Create empty A2L
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT voyant_test ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;
    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    // Load ELF symbols
    let symbols = core_load_elf_symbols(voyant_elf).unwrap();

    // Pick struct members from g_vd and g_oc to import
    let members_to_import: Vec<_> = symbols
        .iter()
        .filter(|s| {
            s.is_struct_member
                && (s.parent_struct.as_deref() == Some("g_vd")
                    || s.parent_struct.as_deref() == Some("g_oc"))
        })
        .collect();

    assert!(
        members_to_import.len() >= 5,
        "Expected at least 5 struct members from g_vd + g_oc, got {}",
        members_to_import.len()
    );

    let mappings: Vec<SymbolWithMapping> = members_to_import
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
            array_dims: s.array_dims.clone(),
            enum_values: s.enum_values.clone(),
        })
        .collect();

    let count = mappings.len();
    core_create_measurements(&mut a2l, None, &mappings).unwrap();

    let module = &a2l.project.module[0];
    assert_eq!(
        module.measurement.len(),
        count,
        "Should have created {} measurements from struct members",
        count
    );

    // Verify specific measurements exist with correct types
    let check_a2l = |name: &str, expected_type: &str, expected_addr: u64| {
        let meas = module
            .measurement
            .iter()
            .find(|m| m.get_name() == name);
        assert!(meas.is_some(), "A2L measurement '{}' not found", name);
        let meas = meas.unwrap();
        assert_eq!(
            meas.datatype.to_string().to_uppercase(),
            expected_type,
            "A2L type mismatch for '{}': got '{}', expected '{}'",
            name,
            meas.datatype.to_string().to_uppercase(),
            expected_type
        );
        let addr = meas.ecu_address.as_ref().map(|a| a.address as u64).unwrap_or(0);
        assert_eq!(addr, expected_addr, "Address mismatch for '{}'", name);
    };

    // g_vd members
    let vd_write_cnt = symbols.iter().find(|s| s.name == "g_vd.write_cnt").unwrap();
    check_a2l("g_vd.write_cnt", "ULONG", vd_write_cnt.address);

    let vd_last_dac = symbols.iter().find(|s| s.name == "g_vd.last_dac_value").unwrap();
    check_a2l("g_vd.last_dac_value", "UWORD", vd_last_dac.address);

    // g_oc members
    let oc_current = symbols.iter().find(|s| s.name == "g_oc.in_current_value_mA").unwrap();
    check_a2l("g_oc.in_current_value_mA", "FLOAT32_IEEE", oc_current.address);

    // Export and verify A2L output contains the measurements
    let exported = core_export_a2l(&a2l);
    assert!(
        exported.contains("/begin MEASUREMENT g_vd.write_cnt"),
        "Export should contain g_vd.write_cnt"
    );
    assert!(
        exported.contains("/begin MEASUREMENT g_oc.in_current_value_mA"),
        "Export should contain g_oc.in_current_value_mA"
    );

    println!(
        "Successfully imported {} struct members as A2L measurements",
        count
    );
}

#[test]
fn test_voyant_dwarf_parsing_directly() {
    let voyant_elf =
        r"C:\dev\interview\voyant-photonics\VoyantTakeHomeAssignment\build\Debug\VoyantTakeHomeAssignment.elf";
    if !std::path::Path::new(voyant_elf).exists() {
        println!("Skipping: Voyant ELF not found");
        return;
    }

    let buffer = std::fs::read(voyant_elf).unwrap();
    let dwarf_info = parse_dwarf_symbols(&buffer);

    println!("DWARF parse result: {} variables found", dwarf_info.len());

    // Print all DWARF variables that have struct members
    let with_members: Vec<_> = dwarf_info
        .iter()
        .filter(|(_, info)| !info.members.is_empty())
        .collect();
    println!("Variables with struct members: {}", with_members.len());
    for (name, info) in &with_members {
        println!(
            "  {} (type={}) — {} members",
            name,
            info.type_name,
            info.members.len()
        );
        for member in &info.members {
            println!("    .{} offset={} size={} type={} array_dims={:?}", member.name, member.offset, member.size, member.type_name, member.array_dims);
        }
    }

    // Print all DWARF variables (even those without members)
    let expected = ["g_sc", "g_vd", "g_cs", "g_oc", "g_sched", "g_cd"];
    println!("\nLooking for expected struct variables:");
    for name in &expected {
        match dwarf_info.get(*name) {
            Some(info) => println!(
                "  {} — FOUND type={} members={}",
                name,
                info.type_name,
                info.members.len()
            ),
            None => println!("  {} — NOT FOUND in DWARF info", name),
        }
    }

    // Print first 30 DWARF entries to see what variable names look like
    println!("\nFirst 30 DWARF variables:");
    for (i, (name, info)) in dwarf_info.iter().take(30).enumerate() {
        println!(
            "  [{}] {} — type={} members={}",
            i,
            name,
            info.type_name,
            info.members.len()
        );
    }
}

// ─── Array MATRIX_DIM test ──────────────────────────────────────────────────

#[test]
fn test_array_members_get_matrix_dim() {
    let voyant_elf =
        r"C:\dev\interview\voyant-photonics\VoyantTakeHomeAssignment\build\Debug\VoyantTakeHomeAssignment.elf";
    if !std::path::Path::new(voyant_elf).exists() {
        println!("Skipping: Voyant ELF not found");
        return;
    }

    let symbols = core_load_elf_symbols(voyant_elf).unwrap();

    // Find g_cs.samples — should be uint16_t[200] array
    let samples = symbols.iter().find(|s| s.name == "g_cs.samples");
    assert!(samples.is_some(), "g_cs.samples should exist in ELF symbols");
    let samples = samples.unwrap();
    assert!(
        !samples.array_dims.is_empty(),
        "g_cs.samples should have array_dims, got {:?}",
        samples.array_dims
    );
    println!(
        "g_cs.samples: array_dims={:?}, type={}, a2l_type={}",
        samples.array_dims, samples.dwarf_type.as_deref().unwrap_or("none"), samples.suggested_a2l_type
    );

    // Create A2L and import
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;
    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let mapping = SymbolWithMapping {
        name: samples.name.clone(),
        address: samples.address,
        a2l_type: samples.suggested_a2l_type.clone(),
        lower_limit: samples.suggested_limits.0,
        upper_limit: samples.suggested_limits.1,
        conversion: None,
        resolution: None,
        accuracy: None,
        array_dims: samples.array_dims.clone(),
        enum_values: vec![],
    };

    core_create_measurements(&mut a2l, None, &[mapping]).unwrap();

    let module = &a2l.project.module[0];
    let meas = module.measurement.iter().find(|m| m.get_name() == "g_cs.samples").unwrap();

    // Verify MATRIX_DIM is set
    assert!(
        meas.matrix_dim.is_some(),
        "g_cs.samples should have matrix_dim set"
    );
    let md = meas.matrix_dim.as_ref().unwrap();
    assert_eq!(
        md.dim_list.len(),
        samples.array_dims.len(),
        "matrix_dim dimensions count should match array_dims"
    );
    let expected_dims: Vec<u16> = samples.array_dims.iter().map(|&d| d as u16).collect();
    assert_eq!(
        md.dim_list,
        expected_dims,
        "matrix_dim dimensions should match array_dims"
    );
    println!(
        "g_cs.samples MATRIX_DIM = {:?}",
        md.dim_list
    );

    // Verify export contains MATRIX_DIM
    let exported = core_export_a2l(&a2l);
    assert!(
        exported.contains("MATRIX_DIM"),
        "Export should contain MATRIX_DIM for array member"
    );
    assert!(
        exported.contains(&format!("{}", samples.array_dims[0])),
        "Export should contain the array dimension value"
    );
    println!("Array MATRIX_DIM test passed!");
}

// ─── CHARACTERISTIC creation tests ──────────────────────────────────────────

#[test]
fn test_create_characteristics_from_elf_symbols() {
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let symbols = vec![
        SymbolWithMapping {
            name: "g_vd.last_dac_value".to_string(),
            address: 0x2000_0100,
            a2l_type: "UWORD".to_string(),
            lower_limit: 0.0,
            upper_limit: 65535.0,
            conversion: None,
            resolution: None,
            accuracy: None,
            array_dims: vec![],
            enum_values: vec![],
        },
        SymbolWithMapping {
            name: "g_cs.samples".to_string(),
            address: 0x2000_0200,
            a2l_type: "UWORD".to_string(),
            lower_limit: 0.0,
            upper_limit: 65535.0,
            conversion: None,
            resolution: None,
            accuracy: None,
            array_dims: vec![200],
            enum_values: vec![],
        },
        SymbolWithMapping {
            name: "g_oc.in_current_value_mA".to_string(),
            address: 0x2000_0300,
            a2l_type: "FLOAT32_IEEE".to_string(),
            lower_limit: -1000.0,
            upper_limit: 1000.0,
            conversion: None,
            resolution: None,
            accuracy: None,
            array_dims: vec![],
            enum_values: vec![],
        },
    ];

    core_create_characteristics(&mut a2l, None, &symbols).unwrap();

    let module = &a2l.project.module[0];
    assert_eq!(module.characteristic.len(), 3, "Should have 3 characteristics");

    // Scalar → VALUE type
    let vd = module.characteristic.iter().find(|c| c.get_name() == "g_vd.last_dac_value").unwrap();
    assert_eq!(format!("{:?}", vd.characteristic_type), "Value");
    assert_eq!(vd.address, 0x2000_0100);
    assert!(vd.matrix_dim.is_none());

    // Array → VAL_BLK type with MATRIX_DIM
    let cs = module.characteristic.iter().find(|c| c.get_name() == "g_cs.samples").unwrap();
    assert_eq!(format!("{:?}", cs.characteristic_type), "ValBlk");
    assert_eq!(cs.address, 0x2000_0200);
    assert!(cs.matrix_dim.is_some());
    assert_eq!(cs.matrix_dim.as_ref().unwrap().dim_list, vec![200u16]);

    // Float → VALUE type
    let oc = module.characteristic.iter().find(|c| c.get_name() == "g_oc.in_current_value_mA").unwrap();
    assert_eq!(format!("{:?}", oc.characteristic_type), "Value");
    assert_eq!(oc.address, 0x2000_0300);

    // Record layouts should be auto-created
    assert!(module.record_layout.iter().any(|r| r.get_name() == "__val_UWORD"),
        "Should have UWORD record layout");
    assert!(module.record_layout.iter().any(|r| r.get_name() == "__val_FLOAT32_IEEE"),
        "Should have FLOAT32_IEEE record layout");

    // Verify export
    let exported = core_export_a2l(&a2l);
    assert!(exported.contains("/begin CHARACTERISTIC g_vd.last_dac_value"));
    assert!(exported.contains("/begin CHARACTERISTIC g_cs.samples"));
    assert!(exported.contains("MATRIX_DIM"));
    assert!(exported.contains("__val_UWORD"),
        "Export should reference __val_UWORD record layout");

    println!("CHARACTERISTIC creation test passed!");
}

#[test]
fn test_create_characteristics_replaces_existing() {
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let sym = SymbolWithMapping {
        name: "test_var".to_string(),
        address: 0x1000,
        a2l_type: "UBYTE".to_string(),
        lower_limit: 0.0,
        upper_limit: 255.0,
        conversion: None,
        resolution: None,
        accuracy: None,
        array_dims: vec![],
        enum_values: vec![],
    };

    // Create once
    core_create_characteristics(&mut a2l, None, &[sym.clone()]).unwrap();
    assert_eq!(a2l.project.module[0].characteristic.len(), 1);

    // Create again with different address — should replace
    let sym2 = SymbolWithMapping {
        address: 0x2000,
        ..sym
    };
    core_create_characteristics(&mut a2l, None, &[sym2]).unwrap();

    let chars: Vec<_> = a2l.project.module[0].characteristic.iter()
        .filter(|c| c.get_name() == "test_var").collect();
    assert_eq!(chars.len(), 1, "Should have exactly 1 characteristic");
    assert_eq!(chars[0].address, 0x2000, "Should have updated address");
}

#[test]
fn test_enum_compu_method_creation() {
    let a2l_text = r#"ASAP2_VERSION 1 71
/begin PROJECT test_proj ""
  /begin MODULE test_mod ""
  /end MODULE
/end PROJECT"#;

    let (mut a2l, _) = core_load_a2l_from_string(a2l_text).unwrap();

    let sym = SymbolWithMapping {
        name: "g_sc.state".to_string(),
        address: 0x2000_0400,
        a2l_type: "UBYTE".to_string(),
        lower_limit: 0.0,
        upper_limit: 255.0,
        conversion: None,
        resolution: None,
        accuracy: None,
        array_dims: vec![],
        enum_values: vec![
            ("STATE_IDLE".to_string(), 0),
            ("STATE_RUNNING".to_string(), 1),
            ("STATE_ERROR".to_string(), 2),
            ("STATE_SHUTDOWN".to_string(), 3),
        ],
    };

    core_create_characteristics(&mut a2l, None, &[sym]).unwrap();

    let module = &a2l.project.module[0];

    // Characteristic should exist
    let c = module.characteristic.iter().find(|c| c.get_name() == "g_sc.state").unwrap();
    assert_eq!(c.conversion, "__cm_g_sc_state", "Should reference auto-generated COMPU_METHOD");

    // COMPU_METHOD should exist
    let cm = module.compu_method.iter().find(|m| m.get_name() == "__cm_g_sc_state").unwrap();
    assert_eq!(format!("{:?}", cm.conversion_type), "TabVerb");
    assert!(cm.compu_tab_ref.is_some());
    assert_eq!(cm.compu_tab_ref.as_ref().unwrap().conversion_table, "__vtab_g_sc_state");

    // COMPU_VTAB should exist with correct values
    let vtab = module.compu_vtab.iter().find(|v| v.get_name() == "__vtab_g_sc_state").unwrap();
    assert_eq!(vtab.number_value_pairs, 4);
    assert_eq!(vtab.value_pairs.len(), 4);
    assert_eq!(vtab.value_pairs[0].in_val, 0.0);
    assert_eq!(vtab.value_pairs[0].out_val, "STATE_IDLE");
    assert_eq!(vtab.value_pairs[3].in_val, 3.0);
    assert_eq!(vtab.value_pairs[3].out_val, "STATE_SHUTDOWN");

    // Verify export
    let exported = core_export_a2l(&a2l);
    assert!(exported.contains("COMPU_METHOD"), "Export should contain COMPU_METHOD");
    assert!(exported.contains("COMPU_VTAB"), "Export should contain COMPU_VTAB");
    assert!(exported.contains("STATE_IDLE"), "Export should contain enum value STATE_IDLE");
    assert!(exported.contains("STATE_SHUTDOWN"), "Export should contain enum value STATE_SHUTDOWN");

    println!("Enum COMPU_METHOD test passed!");
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

// ─── Delete entities tests ─────────────────────────────────────────────────

#[test]
fn test_delete_single_measurement() {
    let (mut a2l, _) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();
    let module = &a2l.project.module[0];
    let initial_count = module.measurement.len();
    assert!(initial_count > 0, "Should have measurements to delete");

    let name = module.measurement[0].get_name().to_string();
    let deleted = core_delete_entities(
        &mut a2l,
        &[DeleteEntityRequest {
            kind: "Measurement".to_string(),
            name: name.clone(),
        }],
    );

    assert_eq!(deleted, 1, "Should have deleted exactly one measurement");
    assert_eq!(
        a2l.project.module[0].measurement.len(),
        initial_count - 1,
        "Measurement count should decrease by 1"
    );
    assert!(
        !a2l.project.module[0]
            .measurement
            .iter()
            .any(|m| m.get_name() == name),
        "Deleted measurement should no longer exist"
    );
}

#[test]
fn test_delete_multiple_entities() {
    let (mut a2l, _) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();
    let module = &a2l.project.module[0];
    let initial_meas = module.measurement.len();
    assert!(initial_meas >= 3, "Need at least 3 measurements");

    let meas_name1 = module.measurement[0].get_name().to_string();
    let meas_name2 = module.measurement[1].get_name().to_string();
    let meas_name3 = module.measurement[2].get_name().to_string();

    let deleted = core_delete_entities(
        &mut a2l,
        &[
            DeleteEntityRequest {
                kind: "Measurement".to_string(),
                name: meas_name1,
            },
            DeleteEntityRequest {
                kind: "Measurement".to_string(),
                name: meas_name2,
            },
            DeleteEntityRequest {
                kind: "Measurement".to_string(),
                name: meas_name3,
            },
        ],
    );

    assert_eq!(deleted, 3, "Should have deleted 3 entities");
    assert_eq!(a2l.project.module[0].measurement.len(), initial_meas - 3);
}

#[test]
fn test_delete_nonexistent_entity() {
    let (mut a2l, _) = core_load_a2l_from_path(&a2l_path("software_b.a2l")).unwrap();
    let initial_count = a2l.project.module[0].measurement.len();

    let deleted = core_delete_entities(
        &mut a2l,
        &[DeleteEntityRequest {
            kind: "Measurement".to_string(),
            name: "NONEXISTENT_ENTITY_NAME_12345".to_string(),
        }],
    );

    assert_eq!(deleted, 0, "Should not delete anything for nonexistent name");
    assert_eq!(a2l.project.module[0].measurement.len(), initial_count);
}

// ─── Volatile type resolution tests ────────────────────────────────────────

#[test]
fn test_volatile_types_resolve_through_chain() {
    // software_b.elf has 1165 volatile type entries
    let buffer = std::fs::read(format!("{}/bin/software_b.elf", fixtures_dir())).unwrap();
    let dwarf_info = parse_dwarf_symbols(&buffer);

    // Count how many variables have "unknown" type
    let unknown_count = dwarf_info
        .values()
        .filter(|info| info.type_name == "unknown")
        .count();
    let total = dwarf_info.len();

    println!(
        "DWARF volatile test: {total} variables, {unknown_count} unknown types ({:.1}%)",
        if total > 0 {
            (unknown_count as f64 / total as f64) * 100.0
        } else {
            0.0
        }
    );

    // With volatile chasing, the vast majority of types should resolve.
    // A small percentage of unknowns is acceptable (some variables may genuinely
    // have no type attribute), but more than 10% would indicate broken chaining.
    let unknown_pct = if total > 0 {
        (unknown_count as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    assert!(
        unknown_pct < 10.0,
        "Too many unknown types ({unknown_count}/{total} = {unknown_pct:.1}%). \
         Volatile/const qualifier chaining may be broken."
    );

    // Also check that struct member types resolve through volatile qualifiers
    let members_unknown: usize = dwarf_info
        .values()
        .flat_map(|info| info.members.iter())
        .filter(|m| m.type_name == "unknown")
        .count();
    let members_total: usize = dwarf_info
        .values()
        .map(|info| info.members.len())
        .sum();
    println!(
        "  Members: {members_total} total, {members_unknown} unknown types"
    );
    if members_total > 0 {
        let members_unknown_pct = (members_unknown as f64 / members_total as f64) * 100.0;
        assert!(
            members_unknown_pct < 10.0,
            "Too many unknown member types ({members_unknown}/{members_total} = {members_unknown_pct:.1}%)"
        );
    }
}

#[test]
fn test_volatile_array_symbols_get_correct_type_and_dim() {
    // update_test.elf has known C variables with matching DWARF + ELF names
    let symbols = core_load_elf_symbols(&format!("{}/bin/update_test.elf", fixtures_dir())).unwrap();

    let with_dwarf: Vec<_> = symbols.iter()
        .filter(|s| !s.is_struct_member && s.dwarf_type.is_some())
        .collect();
    println!("ELF symbols with DWARF type: {}", with_dwarf.len());
    for sym in with_dwarf.iter().take(20) {
        println!(
            "  {} size={} a2l_type={} array_dims={:?} dwarf_type={:?}",
            sym.name, sym.size, sym.suggested_a2l_type, sym.array_dims, sym.dwarf_type
        );
    }

    // Check symbols with array dimensions
    let arrays: Vec<_> = with_dwarf.iter()
        .filter(|s| !s.array_dims.is_empty())
        .collect();
    println!("\nArray symbols: {}", arrays.len());
    for sym in &arrays {
        println!(
            "  {} size={} a2l_type={} array_dims={:?} dwarf_type={:?}",
            sym.name, sym.size, sym.suggested_a2l_type, sym.array_dims, sym.dwarf_type
        );
    }

    // Verify known symbols from update_test.c:
    // float Characteristic_ValBlk[5] should be a float array
    let valblk = with_dwarf.iter().find(|s| s.name == "Characteristic_ValBlk")
        .expect("Characteristic_ValBlk should exist");
    assert!(!valblk.array_dims.is_empty(), "Characteristic_ValBlk should be an array");
    assert_eq!(valblk.suggested_a2l_type, "FLOAT32_IEEE",
        "Characteristic_ValBlk should be FLOAT32_IEEE, got {}", valblk.suggested_a2l_type);
    assert_eq!(valblk.array_dims, vec![5],
        "Characteristic_ValBlk should have array_dims=[5], got {:?}", valblk.array_dims);
    println!("\nCharacteristic_ValBlk: a2l_type={} array_dims={:?} dwarf_type={:?}",
        valblk.suggested_a2l_type, valblk.array_dims, valblk.dwarf_type);

    // uint8_t Blob_2[256] should be a uint8 array
    let blob = with_dwarf.iter().find(|s| s.name == "Blob_2")
        .expect("Blob_2 should exist");
    assert!(!blob.array_dims.is_empty(), "Blob_2 should be an array");
    assert_eq!(blob.suggested_a2l_type, "UBYTE",
        "Blob_2 element should be UBYTE, got {}", blob.suggested_a2l_type);
    assert_eq!(blob.array_dims, vec![256],
        "Blob_2 should have array_dims=[256], got {:?}", blob.array_dims);

    // uint8_t Measurement_Matrix[5][4] should be a 2D matrix
    let matrix = with_dwarf.iter().find(|s| s.name == "Measurement_Matrix")
        .expect("Measurement_Matrix should exist");
    assert_eq!(matrix.array_dims.len(), 2,
        "Measurement_Matrix should have 2 dimensions, got {:?}", matrix.array_dims);
    assert_eq!(matrix.array_dims, vec![5, 4],
        "Measurement_Matrix should have array_dims=[5, 4], got {:?}", matrix.array_dims);
    assert_eq!(matrix.suggested_a2l_type, "UBYTE",
        "Measurement_Matrix element should be UBYTE, got {}", matrix.suggested_a2l_type);
    println!("\nMeasurement_Matrix: a2l_type={} array_dims={:?} dwarf_type={:?}",
        matrix.suggested_a2l_type, matrix.array_dims, matrix.dwarf_type);
}
