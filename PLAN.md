# PLAN — OpenT_A2L-Forge

## Iteration 0 — Foundations
- [x] Repo scaffolding, build, and CI basics
  - [x] Tauri + React + TypeScript app skeleton builds locally
  - [x] Rust backend command wiring established
  - [x] Product owner demo: “Hello A2L-Forge” window opens
  - [x] E2E: smoke test launches app and closes cleanly

## Iteration 1 — Core A2L I/O (Series A)
- [x] A0: Test resources & demo flow
  - [x] A2L fixtures source: external/a2ltool/fixtures/a2l
  - [x] Copy curated samples into tests/fixtures/a2l (small + medium)
  - [x] Define demo script timings (UI holds):
    - [x] Show app landing for ~2s
    - [x] Show file picker + selected file name for ~2s
    - [x] Show metadata panel populated for ~3s
    - [x] Show export completed toast for ~2s
  - [x] E2E run mode: headed Playwright, slowMo ~250ms, trace on
  - [x] Product owner demo: narrated flow using same fixtures
- [x] A1: Open & parse A2L
  - [x] Open existing A2L file from disk
  - [x] Parse and show basic metadata (PROJECT/MODULE/HEADER)
  - [x] Product owner demo: open sample A2L and view metadata
  - [x] E2E: open sample A2L, assert metadata visible
- [x] A2: Save/export A2L
  - [x] Export A2L with validation warnings
  - [x] Preserve ordering/format where possible
  - [x] Product owner demo: edit metadata and export
  - [x] E2E: open → edit → export → re-open
  - [x] E2E demo progress: keep UI visible through each step above

## Iteration 2 — Editor Core (Series B)
- [x] B0: Iteration kickoff (in progress)
  - [x] Define core entity list for browser (MODULE, MEASUREMENT, CHARACTERISTIC, AXIS_PTS)
  - [x] Decide data shape for tree nodes and selection state
  - [x] UI skeleton for entity list + details panel
- [x] B1: Entity browser & selection
  - [x] Tree navigation for core entities
  - [x] Search/filter across entities
  - [x] Product owner demo: locate entities quickly
  - [x] E2E: search entity → open details panel
- [ ] B2: Entity editing (Core set)
  - [x] Rename selected Module/Measurement/Characteristic/AxisPts
  - [x] Edit PROJECT/HEADER metadata (name, long id, header comment)
  - [x] Edit MODULE long identifier
  - [x] Edit MEASUREMENT (Full editor)
  - [x] Edit CHARACTERISTIC (Full editor)
  - [x] Edit AXIS_PTS (Full editor)
  - [x] Product owner demo: edit core entities and save
  - [ ] E2E: modify entity → save → reload
- [ ] B3: Computation & conversion
  - [ ] Edit COMPU_METHOD/COMPU_TAB/COMPU_VTAB
  - [ ] Validate references
  - [ ] Product owner demo: update conversion & export
  - [ ] E2E: edit conversion → validate → export

## Iteration 3 — Templates & Creation (Series C)
- [ ] C1: New A2L creation
  - [ ] Create empty database
  - [ ] Initialize minimal PROJECT/MODULE
  - [ ] Product owner demo: create new empty A2L
  - [ ] E2E: new → save → re-open
- [ ] C2: Template-based creation
  - [ ] Include baseline + powertrain templates
  - [ ] Template picker in new flow
  - [ ] Product owner demo: create from template
  - [ ] E2E: new from template → validate

## Iteration 4 — ELF Import (Series D)
- [ ] D1: ELF ingestion
  - [ ] Import ELF (initial architecture set)
  - [ ] Display symbol table and types
  - [ ] Product owner demo: import ELF and browse symbols
  - [ ] E2E: import ELF → list symbols
- [ ] D2: Symbol-to-A2L mapping
  - [ ] Map variables to MEASUREMENT/CHARACTERISTIC
  - [ ] Address resolution and name normalization
  - [ ] Product owner demo: map symbols to A2L
  - [ ] E2E: import ELF → map → save
- [ ] D3: Struct-based generation
  - [ ] Generate entries from struct layouts
  - [ ] Conflict handling UI
  - [ ] Product owner demo: generate from structs
  - [ ] E2E: import structs → generate → export

## Iteration 5 — Validation & Integrity (Series E)
- [ ] E1: Validation engine
  - [ ] Cross-reference checks and constraints
  - [ ] Pre-export validation report
  - [ ] Product owner demo: validation report on errors
  - [ ] E2E: invalid edit → validation errors
- [ ] E2: Undo/redo & autosave
  - [ ] Undo/redo for key edits
  - [ ] Autosave with recovery
  - [ ] Product owner demo: recover after crash
  - [ ] E2E: edit → crash sim → recover

## Iteration 6 — Performance & UX (Series F)
- [ ] F1: Large file performance
  - [ ] A2L 10–50MB load targets met
  - [ ] ELF 50–200MB import targets met
  - [ ] Product owner demo: large sample loads
  - [ ] E2E: load large fixtures and measure time
- [ ] F2: Bulk tooling
  - [ ] Batch edit operations
  - [ ] Advanced search filters
  - [ ] Product owner demo: bulk edit flow
  - [ ] E2E: batch edit → validate → export

## Iteration 7 — Packaging & Release (Series G)
- [ ] G1: Cross-platform packaging
  - [ ] Windows/Linux/macOS build pipeline
  - [ ] Signed artifacts (where applicable)
  - [ ] Product owner demo: install packages
  - [ ] E2E: install → launch → open sample
- [ ] G2: Docs & onboarding
  - [ ] Quickstart and sample datasets
  - [ ] In-app help
  - [ ] Product owner demo: guided onboarding
  - [ ] E2E: follow quickstart flow

## Iteration 8 — Design demos (Series H)
- [ ] H1: Visual design pass
  - [ ] UI framework final selection
  - [x] Theming and layout pass
  - [ ] Product owner demo: design review
  - [ ] E2E: basic navigation flow
- [ ] H2: UX refinement
  - [ ] Interaction polish
  - [ ] Accessibility review
  - [ ] Product owner demo: UX sign-off
  - [ ] E2E: navigation + keyboard flow
