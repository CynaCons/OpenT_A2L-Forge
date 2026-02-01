# PRD — OpenT_A2L-Forge

## 1) Product summary
OpenT_A2L-Forge is a desktop A2L database viewer and editor built with a Tauri WebView frontend and a Rust backend. It is part of the OpenTools (OpenT) suite of open and free tools.

## 2) Vision & goals
- Provide a fast, reliable A2L viewer/editor for engineers working with calibration data.
- Enable creation, editing, and export of A2L databases.
- Allow rapid import of variables and structs from ELF binaries into A2L.

## 3) Non-goals (v1)
- ECU flashing, live calibration, or measurement/DAQ.
- Full autosar tooling beyond A2L editing.

## 4) Target users
- Calibration engineers
- Controls engineers
- Tooling developers managing A2L databases

## 5) Requirements
### 5.1 Functional
- Create a new A2L database from scratch or from a template.
- Open and view existing A2L databases.
- Edit all supported A2L entities (comprehensive editor coverage).
- Import ELF files (all common ELF variants) and map symbols to A2L entries.
- Rapidly generate A2L entries from imported variables and structs.
- Export modified A2L databases.
- Support A2L versions, at least the latest released version.

### 5.2 A2L entity coverage (v1)
- Core: PROJECT, MODULE, HEADER, MOD_PAR
- Data: MEASUREMENT, CHARACTERISTIC, AXIS_PTS, RECORD_LAYOUT
- Computation: COMPU_METHOD, COMPU_TAB, COMPU_VTAB, COMPU_VTAB_RANGE
- Axis/Conversion: AXIS_DESCR, FORMAT
- Metadata: UNIT, SYMBOL_LINK, BYTE_ORDER

### 5.3 Import scope (v1)
- ELF: define supported architectures and debug formats (e.g., ARM/x86 + DWARF)
- Symbol sources: globals, statics (when available), and struct layouts
- Mapping rules: name normalization, address resolution, conflict handling

### 5.4 Non-functional
- Desktop application using Tauri WebViews.
- Frontend: React + TypeScript.
- Visual framework: modern, actively maintained UI framework.
- Backend: 100% Rust.
- Data integrity: autosave, undo/redo, and safe export validation.

## 6) UX & workflow
- Welcome screen: create new A2L (empty or from template) or open existing A2L.
- Editor workspace with tree navigation, search, and property panels.
- ELF import wizard with symbol filtering, mapping, and preview.
- Export flow with validation and warnings.
- Batch edit tools and fast search/filter across entities.

## 7) Success metrics
- A2L parse: <2s for 10MB; <5s for 50MB.
- ELF import: <5s for 50MB; <15s for 200MB.
- <1% error rate in save/export validations.

## 8) MVP scope (v1)
Must
- Open/create/export A2L
- Edit core entities listed in 5.2
- ELF import with symbol mapping

Should
- Templates (baseline + powertrain)
- Batch edits and search
- Validation report before export

Could
- Custom template library
- Diff/compare view

## 9) Risks & open questions
- Which exact A2L version is “latest” for v1 scope?
- Finalize supported ELF architectures/toolchains.
- Confirm template set for v1.
- Define export formatting/compatibility rules.

## 10) Tech stack (proposed)
- Tauri WebViews
- React + TypeScript
- UI framework: to be selected (e.g., MUI, Mantine, or similar)
- Rust backend (parsing, validation, import/export)

## 11) Export compatibility
- Preserve ordering and formatting as much as possible.
- Validate references and constraints before writing.

## 12) Packaging & distribution
- Desktop: Windows, Linux, macOS.
- Auto-update strategy to be decided.

## 13) Telemetry & privacy
- Default: no telemetry. If added later, opt-in only.

## 14) Testing strategy
- Parser/import/export test suite with real-world samples.
- Fuzzing for A2L and ELF parsers.

## 15) References & test data
- A2L fixtures: https://github.com/DanielT/a2ltool/tree/master/fixtures/a2l
- ELF fixtures (DWARF variants): https://github.com/DanielT/a2ltool/tree/master/fixtures/bin
- ELF/DWARF corpus: https://github.com/eliben/pyelftools/tree/main/test
- ELF samples: https://github.com/serge1/ELFIO/tree/main/tests
