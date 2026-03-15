# CLI Sync Quickstart

OpenT A2L-Forge now supports a build-system CLI workflow for repeatable A2L updates from ELF data.

## What the CLI does

The CLI reads a versioned JSON sync-project file, parses the configured ELF, and updates managed `CHARACTERISTIC` entries in the target A2L. You can track:

- exact leaf symbols such as `val_u8`
- whole struct roots such as `struct_b`, which expand to current ELF leaves like `struct_b.s1.val_i32`

## Author the sync project in the GUI

1. Open the target A2L file in the desktop app.
2. Load the matching ELF file in the ELF inspector.
3. Select the symbols or struct roots you want the CLI to manage.
4. Click **Save Sync Project** in the ELF toolbar.
5. Commit the generated JSON file into your repo alongside the A2L or build scripts.

Loading the same JSON again through **Load Sync Project** restores the tracked selections and saved import overrides in the ELF workflow.

## Run the CLI

From source:

```bash
cargo run --manifest-path src-tauri/Cargo.toml --features cli --bin opent_a2l_forge_cli -- sync --project path\to\firmware.a2lsync.json --json
```

From a release build:

```bash
npm run cli:build
src-tauri\target\cli-release\release\opent_a2l_forge_cli.exe sync --project path\to\firmware.a2lsync.json --json
```

Useful options:

```bash
opent_a2l_forge_cli sync --project firmware.a2lsync.json
opent_a2l_forge_cli sync --project firmware.a2lsync.json --output generated\firmware.a2l
opent_a2l_forge_cli sync --project firmware.a2lsync.json --missing report --json
opent_a2l_forge_cli sync --project firmware.a2lsync.json --missing prune
```

## Missing-item policy

### `report`

- default mode
- detects stale or unresolved tracked items
- returns exit code `2`
- does **not** mutate the output A2L when stale or unresolved tracked items are present

### `prune`

- explicitly deletes stale managed `CHARACTERISTIC` entries
- also removes generated enum `COMPU_METHOD` / `COMPU_VTAB` objects for pruned symbols
- keeps shared `RECORD_LAYOUT` objects intact

## Exit codes

- `0` — sync succeeded with no stale or unresolved tracked items
- `1` — hard failure such as parse error, write error, or unsupported conflict
- `2` — `report` mode detected stale or unresolved tracked items

## Example sync-project JSON

```json
{
  "version": 1,
  "a2l_path": "../calibration/engine.a2l",
  "elf_path": "../build/engine.elf",
  "module_name": "fragment",
  "output_path": null,
  "selectors": [
    { "kind": "struct_root", "name": "struct_b" },
    { "kind": "symbol", "name": "val_u8" }
  ],
  "mapping_overrides": {
    "val_u8": {
      "a2l_type": "UBYTE",
      "lower_limit": 0.0,
      "upper_limit": 255.0,
      "conversion": "NO_COMPU_METHOD",
      "resolution": 1,
      "accuracy": 0.0,
      "array_dims": [],
      "enum_values": []
    }
  },
  "missing_policy": "report"
}
```

Paths are resolved relative to the project file location, so the JSON can move with your repo.

## Current scope

- CLI sync manages `CHARACTERISTIC` imports only
- tracked struct roots own the full `root.*` namespace
- manual same-prefix characteristics are treated as managed for stale-item reporting and pruning
