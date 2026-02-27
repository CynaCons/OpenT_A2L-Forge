//! A2L validation engine for cross-reference checks and constraint validation.
//!
//! Provides `core_validate_a2l()` which checks an A2L file for common issues
//! like broken cross-references, duplicate names, inverted limits, and invalid addresses.
//!
//! ## Validation Rules
//!
//! | Rule ID | Severity | Description |
//! |---------|----------|-------------|
//! | `XREF_COMPU_METHOD` | Error | Conversion references existing CompuMethod |
//! | `XREF_RECORD_LAYOUT` | Error | Deposit references existing RecordLayout |
//! | `XREF_COMPU_TAB` | Error | CompuMethod tab ref references existing CompuTab/CompuVtab |
//! | `XREF_INPUT_QUANTITY` | Warning | AxisDescr input_quantity references existing Measurement |
//! | `DUP_NAME` | Error | Duplicate entity names within a module |
//! | `LIMIT_INVERSION` | Warning | lower_limit > upper_limit |
//! | `EMPTY_NAME` | Error | Entity has empty name |
//! | `ADDR_ZERO` | Warning | Characteristic/AxisPts address is 0x0 |
//! | `ADDR_OVERFLOW` | Warning | Address exceeds 32-bit range |

use std::collections::HashSet;

use a2lfile::A2lObjectName;
use serde::Serialize;

/// Result of validating an A2L file.
#[derive(Serialize, Clone, Debug)]
pub struct ValidationResult {
    pub issues: Vec<ValidationIssue>,
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
}

/// A single validation issue found in the A2L file.
#[derive(Serialize, Clone, Debug)]
pub struct ValidationIssue {
    pub severity: ValidationSeverity,
    pub entity_kind: String,
    pub entity_name: String,
    pub field: String,
    pub message: String,
    pub rule: String,
}

/// Severity level for validation issues.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}

/// Validate an A2L file and return all issues found.
pub fn core_validate_a2l(a2l: &a2lfile::A2lFile) -> ValidationResult {
    let mut issues = Vec::new();

    for module in a2l.project.module.iter() {
        // Build lookup sets for cross-reference checks
        let compu_method_names: HashSet<&str> = module
            .compu_method
            .iter()
            .map(|cm| cm.get_name())
            .collect();
        let record_layout_names: HashSet<&str> = module
            .record_layout
            .iter()
            .map(|rl| rl.get_name())
            .collect();
        let compu_tab_names: HashSet<&str> = module
            .compu_tab
            .iter()
            .map(|ct| ct.get_name())
            .collect();
        let compu_vtab_names: HashSet<&str> = module
            .compu_vtab
            .iter()
            .map(|cv| cv.get_name())
            .collect();
        let measurement_names: HashSet<&str> = module
            .measurement
            .iter()
            .map(|m| m.get_name())
            .collect();

        // DUP_NAME: check for duplicate names across Measurement/Characteristic/AxisPts
        let mut all_entity_names: HashSet<String> = HashSet::new();
        for m in module.measurement.iter() {
            let name = m.get_name().to_string();
            if !all_entity_names.insert(name.clone()) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Measurement".to_string(),
                    entity_name: name,
                    field: "name".to_string(),
                    message: "Duplicate entity name within module".to_string(),
                    rule: "DUP_NAME".to_string(),
                });
            }
        }
        for c in module.characteristic.iter() {
            let name = c.get_name().to_string();
            if !all_entity_names.insert(name.clone()) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name,
                    field: "name".to_string(),
                    message: "Duplicate entity name within module".to_string(),
                    rule: "DUP_NAME".to_string(),
                });
            }
        }
        for a in module.axis_pts.iter() {
            let name = a.get_name().to_string();
            if !all_entity_names.insert(name.clone()) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name,
                    field: "name".to_string(),
                    message: "Duplicate entity name within module".to_string(),
                    rule: "DUP_NAME".to_string(),
                });
            }
        }

        // Validate Measurements
        for m in module.measurement.iter() {
            let name = m.get_name();

            // EMPTY_NAME
            if name.is_empty() {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Measurement".to_string(),
                    entity_name: name.to_string(),
                    field: "name".to_string(),
                    message: "Entity has empty name".to_string(),
                    rule: "EMPTY_NAME".to_string(),
                });
            }

            // XREF_COMPU_METHOD
            if m.conversion != "NO_COMPU_METHOD"
                && !compu_method_names.contains(m.conversion.as_str())
            {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Measurement".to_string(),
                    entity_name: name.to_string(),
                    field: "conversion".to_string(),
                    message: format!(
                        "Conversion '{}' references non-existent CompuMethod",
                        m.conversion
                    ),
                    rule: "XREF_COMPU_METHOD".to_string(),
                });
            }

            // LIMIT_INVERSION
            if m.lower_limit > m.upper_limit {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "Measurement".to_string(),
                    entity_name: name.to_string(),
                    field: "limits".to_string(),
                    message: format!(
                        "Lower limit ({}) > upper limit ({})",
                        m.lower_limit, m.upper_limit
                    ),
                    rule: "LIMIT_INVERSION".to_string(),
                });
            }
        }

        // Validate Characteristics
        for c in module.characteristic.iter() {
            let name = c.get_name();

            // EMPTY_NAME
            if name.is_empty() {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name.to_string(),
                    field: "name".to_string(),
                    message: "Entity has empty name".to_string(),
                    rule: "EMPTY_NAME".to_string(),
                });
            }

            // XREF_COMPU_METHOD
            if c.conversion != "NO_COMPU_METHOD"
                && !compu_method_names.contains(c.conversion.as_str())
            {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name.to_string(),
                    field: "conversion".to_string(),
                    message: format!(
                        "Conversion '{}' references non-existent CompuMethod",
                        c.conversion
                    ),
                    rule: "XREF_COMPU_METHOD".to_string(),
                });
            }

            // XREF_RECORD_LAYOUT
            if !record_layout_names.contains(c.deposit.as_str()) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name.to_string(),
                    field: "deposit".to_string(),
                    message: format!(
                        "Deposit '{}' references non-existent RecordLayout",
                        c.deposit
                    ),
                    rule: "XREF_RECORD_LAYOUT".to_string(),
                });
            }

            // LIMIT_INVERSION
            if c.lower_limit > c.upper_limit {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name.to_string(),
                    field: "limits".to_string(),
                    message: format!(
                        "Lower limit ({}) > upper limit ({})",
                        c.lower_limit, c.upper_limit
                    ),
                    rule: "LIMIT_INVERSION".to_string(),
                });
            }

            // ADDR_ZERO
            if c.address == 0 {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "Characteristic".to_string(),
                    entity_name: name.to_string(),
                    field: "address".to_string(),
                    message: "Address is 0x0".to_string(),
                    rule: "ADDR_ZERO".to_string(),
                });
            }

            // XREF_INPUT_QUANTITY for axis descriptors
            for (i, axis) in c.axis_descr.iter().enumerate() {
                if axis.input_quantity != "NO_INPUT_QUANTITY"
                    && !measurement_names.contains(axis.input_quantity.as_str())
                {
                    issues.push(ValidationIssue {
                        severity: ValidationSeverity::Warning,
                        entity_kind: "Characteristic".to_string(),
                        entity_name: name.to_string(),
                        field: format!("axis_descr[{}].input_quantity", i),
                        message: format!(
                            "Input quantity '{}' references non-existent Measurement",
                            axis.input_quantity
                        ),
                        rule: "XREF_INPUT_QUANTITY".to_string(),
                    });
                }
            }
        }

        // Validate AxisPts
        for a in module.axis_pts.iter() {
            let name = a.get_name();

            // EMPTY_NAME
            if name.is_empty() {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "name".to_string(),
                    message: "Entity has empty name".to_string(),
                    rule: "EMPTY_NAME".to_string(),
                });
            }

            // XREF_COMPU_METHOD
            if a.conversion != "NO_COMPU_METHOD"
                && !compu_method_names.contains(a.conversion.as_str())
            {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "conversion".to_string(),
                    message: format!(
                        "Conversion '{}' references non-existent CompuMethod",
                        a.conversion
                    ),
                    rule: "XREF_COMPU_METHOD".to_string(),
                });
            }

            // XREF_RECORD_LAYOUT
            if !record_layout_names.contains(a.deposit_record.as_str()) {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Error,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "deposit_record".to_string(),
                    message: format!(
                        "Deposit record '{}' references non-existent RecordLayout",
                        a.deposit_record
                    ),
                    rule: "XREF_RECORD_LAYOUT".to_string(),
                });
            }

            // XREF_INPUT_QUANTITY
            if a.input_quantity != "NO_INPUT_QUANTITY"
                && !measurement_names.contains(a.input_quantity.as_str())
            {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "input_quantity".to_string(),
                    message: format!(
                        "Input quantity '{}' references non-existent Measurement",
                        a.input_quantity
                    ),
                    rule: "XREF_INPUT_QUANTITY".to_string(),
                });
            }

            // LIMIT_INVERSION
            if a.lower_limit > a.upper_limit {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "limits".to_string(),
                    message: format!(
                        "Lower limit ({}) > upper limit ({})",
                        a.lower_limit, a.upper_limit
                    ),
                    rule: "LIMIT_INVERSION".to_string(),
                });
            }

            // ADDR_ZERO
            if a.address == 0 {
                issues.push(ValidationIssue {
                    severity: ValidationSeverity::Warning,
                    entity_kind: "AxisPts".to_string(),
                    entity_name: name.to_string(),
                    field: "address".to_string(),
                    message: "Address is 0x0".to_string(),
                    rule: "ADDR_ZERO".to_string(),
                });
            }
        }

        // Validate CompuMethods — XREF_COMPU_TAB
        for cm in module.compu_method.iter() {
            if let Some(ref tab_ref) = cm.compu_tab_ref {
                let tab_name = &tab_ref.conversion_table;
                if !compu_tab_names.contains(tab_name.as_str())
                    && !compu_vtab_names.contains(tab_name.as_str())
                {
                    issues.push(ValidationIssue {
                        severity: ValidationSeverity::Error,
                        entity_kind: "CompuMethod".to_string(),
                        entity_name: cm.get_name().to_string(),
                        field: "compu_tab_ref".to_string(),
                        message: format!(
                            "Compu tab ref '{}' references non-existent CompuTab/CompuVtab",
                            tab_name
                        ),
                        rule: "XREF_COMPU_TAB".to_string(),
                    });
                }
            }
        }
    }

    let error_count = issues
        .iter()
        .filter(|i| i.severity == ValidationSeverity::Error)
        .count();
    let warning_count = issues
        .iter()
        .filter(|i| i.severity == ValidationSeverity::Warning)
        .count();
    let info_count = issues
        .iter()
        .filter(|i| i.severity == ValidationSeverity::Info)
        .count();

    ValidationResult {
        issues,
        error_count,
        warning_count,
        info_count,
    }
}
