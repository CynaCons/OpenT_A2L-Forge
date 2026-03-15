use std::env;
use std::process;

use opent_a2l_forge_lib::{core_sync_cli_project, CliSyncMissingPolicy, CliSyncResult};

fn print_help() {
    eprintln!(
        "Usage:\n  opent_a2l_forge_cli sync --project <file> [--output <a2l>] [--missing report|prune] [--json]"
    );
}

fn parse_missing_policy(value: &str) -> Result<CliSyncMissingPolicy, String> {
    match value {
        "report" => Ok(CliSyncMissingPolicy::Report),
        "prune" => Ok(CliSyncMissingPolicy::Prune),
        _ => Err(format!(
            "Unsupported missing policy '{}'. Expected 'report' or 'prune'.",
            value
        )),
    }
}

fn print_human_result(result: &CliSyncResult) {
    println!("Project: {}", result.project_path);
    println!("Output: {}", result.output_path);
    println!("Resolved: {}", result.resolved_names.len());
    println!("Imported: {}", result.imported_names.len());
    println!("Replaced: {}", result.replaced_names.len());
    println!("Stale: {}", result.stale_names.len());
    println!("Deleted: {}", result.deleted_names.len());
    println!("Conflicts: {}", result.conflicts.len());

    if !result.unresolved_selectors.is_empty() {
        println!("Unresolved selectors:");
        for selector in &result.unresolved_selectors {
            println!("  - {selector}");
        }
    }
    if !result.stale_names.is_empty() {
        println!("Stale tracked items:");
        for name in &result.stale_names {
            println!("  - {name}");
        }
    }
    if !result.conflicts.is_empty() {
        println!("Conflicts:");
        for name in &result.conflicts {
            println!("  - {name}");
        }
    }
}

fn main() {
    process::exit(run());
}

fn run() -> i32 {
    let mut args = env::args().skip(1);
    let Some(command) = args.next() else {
        print_help();
        return 1;
    };

    if command == "--help" || command == "-h" {
        print_help();
        return 0;
    }

    if command != "sync" {
        eprintln!("Unknown command '{}'.", command);
        print_help();
        return 1;
    }

    let mut project_path: Option<String> = None;
    let mut output_path: Option<String> = None;
    let mut missing_policy: Option<CliSyncMissingPolicy> = None;
    let mut json_output = false;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--project" => {
                project_path = args.next();
            }
            "--output" => {
                output_path = args.next();
            }
            "--missing" => {
                let Some(value) = args.next() else {
                    eprintln!("Missing value for --missing");
                    return 1;
                };
                match parse_missing_policy(&value) {
                    Ok(policy) => missing_policy = Some(policy),
                    Err(error) => {
                        eprintln!("{error}");
                        return 1;
                    }
                }
            }
            "--json" => {
                json_output = true;
            }
            "--help" | "-h" => {
                print_help();
                return 0;
            }
            other => {
                eprintln!("Unknown argument '{}'.", other);
                print_help();
                return 1;
            }
        }
    }

    let Some(project_path) = project_path else {
        eprintln!("Missing required --project argument.");
        print_help();
        return 1;
    };

    match core_sync_cli_project(
        &project_path,
        output_path.as_deref(),
        missing_policy.clone(),
    ) {
        Ok(result) => {
            if json_output {
                match serde_json::to_string_pretty(&result) {
                    Ok(json) => println!("{json}"),
                    Err(error) => {
                        eprintln!("Failed to serialize result: {error}");
                        return 1;
                    }
                }
            } else {
                print_human_result(&result);
            }

            if !result.conflicts.is_empty() {
                return 1;
            }

            if result.missing_policy == CliSyncMissingPolicy::Report
                && (!result.stale_names.is_empty() || !result.unresolved_selectors.is_empty())
            {
                return 2;
            }

            0
        }
        Err(error) => {
            if json_output {
                let payload = serde_json::json!({ "error": error });
                println!("{payload}");
            } else {
                eprintln!("CLI sync failed: {error}");
            }
            1
        }
    }
}
