# Enhanced ELF-to-Measurement Feature Plan

**Status:** Planning Phase
**Target:** Iteration 4.5 (D2.5 - Enhanced Symbol Mapping)
**Updated:** 2026-02-16

---

## Executive Summary

The current ELF-to-Measurement feature provides basic symbol import but lacks critical production features. This plan outlines enhancements to make the feature production-ready with intelligent type mapping, conflict detection, filtering, and preview capabilities.

### Current State
- ✅ Basic symbol import working
- ✅ Multi-select UI implemented
- ✅ Hardcoded UBYTE type for all measurements
- ❌ No conflict detection
- ❌ No filtering/search
- ❌ No preview before adding
- ❌ No intelligent type mapping

### Target State
- ✅ Smart data type inference from symbol size
- ✅ Duplicate/conflict detection and resolution
- ✅ Symbol search and filtering by type/section/name
- ✅ Preview dialog with batch configuration
- ✅ Module selection for multi-module projects
- ✅ Address validation and overflow warnings

---

## Phase 1: Symbol Filtering & Search (High Priority)

### User Story
*"As a developer importing a large ELF (10,000+ symbols), I need to filter and search symbols so I can quickly find the variables I want to import without scrolling through the entire table."*

### UI/UX Design

#### 1.1 Search Bar
**Location:** Above symbol table, below "Load ELF Binary" button

```
┌─────────────────────────────────────────────┐
│ 🔍 Search symbols...                     [X]│
└─────────────────────────────────────────────┘
```

**Behavior:**
- Real-time filtering as user types
- Case-insensitive search by default
- Searches symbol name field
- Shows "N of M results" below search bar
- Clear button (X) to reset filter

#### 1.2 Filter Chips Row
**Location:** Below search bar

```
┌──────────────────────────────────────────────────────────┐
│ Filter by:                                               │
│ [Type ▼] [Section ▼] [Bind ▼] [Size ▼]  [Clear Filters] │
└──────────────────────────────────────────────────────────┘
```

**Filter Options:**

**Type Filter:**
- ☐ OBJECT (variables/data)
- ☐ FUNC (functions)
- ☐ NOTYPE
- ☐ Other

**Section Filter:**
- ☐ .data
- ☐ .bss
- ☐ .rodata
- ☐ .text
- ☐ Other

**Bind Filter:**
- ☐ GLOBAL
- ☐ LOCAL
- ☐ WEAK

**Size Filter:**
- ○ Any size
- ○ 1 byte
- ○ 2 bytes
- ○ 4 bytes
- ○ 8 bytes
- ○ Custom range: [___] to [___] bytes

**Behavior:**
- Dropdown menus with checkboxes (multi-select)
- Active filters shown as chips below filter bar
- Click chip to remove individual filter
- "Clear Filters" button resets all
- Filters combine with AND logic
- Search + filters work together

#### 1.3 Enhanced Table Header
**Location:** Symbol table header row

```
┌────┬─────────────┬──────────┬────────┬────────┬─────────┐
│ ☐  │ Name ↕      │ Address ↕│ Size ↕ │ Type ↕ │ Section │
├────┼─────────────┼──────────┼────────┼────────┼─────────┤
```

**Features:**
- Clickable column headers for sorting
- Up/down arrows indicate sort direction
- Default sort: Name ascending
- Shift+click for multi-column sort

#### 1.4 Results Summary
**Location:** Below filter chips, above table

```
Showing 47 of 3,241 symbols  •  12 selected
```

### Implementation Details

**Frontend (App.tsx):**
```typescript
// New state
const [symbolFilter, setSymbolFilter] = useState({
  search: '',
  types: new Set<string>(),
  sections: new Set<string>(),
  binds: new Set<string>(),
  sizeMin: null as number | null,
  sizeMax: null as number | null
});
const [symbolSort, setSymbolSort] = useState({
  column: 'name',
  direction: 'asc'
});

// Computed filtered symbols
const filteredSymbols = useMemo(() => {
  let result = elfSymbols;

  // Apply search
  if (symbolFilter.search) {
    const search = symbolFilter.search.toLowerCase();
    result = result.filter(s => s.name.toLowerCase().includes(search));
  }

  // Apply type filter
  if (symbolFilter.types.size > 0) {
    result = result.filter(s => symbolFilter.types.has(s.type_str));
  }

  // Apply section filter
  if (symbolFilter.sections.size > 0) {
    result = result.filter(s => symbolFilter.sections.has(s.section));
  }

  // Apply bind filter
  if (symbolFilter.binds.size > 0) {
    result = result.filter(s => symbolFilter.binds.has(s.bind));
  }

  // Apply size filter
  if (symbolFilter.sizeMin !== null) {
    result = result.filter(s => s.size >= symbolFilter.sizeMin!);
  }
  if (symbolFilter.sizeMax !== null) {
    result = result.filter(s => s.size <= symbolFilter.sizeMax!);
  }

  // Apply sorting
  result.sort((a, b) => {
    let comparison = 0;
    switch (symbolSort.column) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'address':
        comparison = a.address - b.address;
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'type':
        comparison = a.type_str.localeCompare(b.type_str);
        break;
    }
    return symbolSort.direction === 'asc' ? comparison : -comparison;
  });

  return result;
}, [elfSymbols, symbolFilter, symbolSort]);
```

**Components:**
- `SymbolFilterBar.tsx` - Filter controls
- `SymbolSearchField.tsx` - Search input with debounce
- `FilterChip.tsx` - Active filter chips

### Test Cases

**E2E Test: `symbol-filtering.spec.ts`**
```typescript
test("Filter symbols by type OBJECT", async ({ page }) => {
  // Load ELF with mixed symbols
  // Open Type filter dropdown
  // Check "OBJECT" checkbox
  // Verify table shows only OBJECT type symbols
  // Verify FUNC symbols are hidden
});

test("Search symbols by name", async ({ page }) => {
  // Load ELF
  // Type "sensor" in search box
  // Verify only symbols containing "sensor" are shown
  // Verify result count updates
});

test("Combine search and filters", async ({ page }) => {
  // Load ELF
  // Search "temp"
  // Filter by section .data
  // Verify only .data symbols with "temp" in name shown
});
```

---

## Phase 2: Smart Data Type Mapping (High Priority)

### User Story
*"As a calibration engineer, I need the tool to automatically detect the correct A2L data type based on ELF symbol size so I don't have to manually configure each variable."*

### Type Mapping Rules

**Size-based Inference:**

| Symbol Size | A2L Data Type | Lower Limit | Upper Limit | Notes |
|-------------|---------------|-------------|-------------|-------|
| 1 byte      | UBYTE         | 0           | 255         | Unsigned 8-bit |
| 1 byte      | SBYTE         | -128        | 127         | Signed (if name hints) |
| 2 bytes     | UWORD         | 0           | 65535       | Unsigned 16-bit |
| 2 bytes     | SWORD         | -32768      | 32767       | Signed (if name hints) |
| 4 bytes     | ULONG         | 0           | 4294967295  | Unsigned 32-bit |
| 4 bytes     | SLONG         | -2147483648 | 2147483647  | Signed (if name hints) |
| 4 bytes     | FLOAT32_IEEE  | -3.4e38     | 3.4e38      | If name contains "float" |
| 8 bytes     | A_UINT64      | 0           | 2^64-1      | Unsigned 64-bit |
| 8 bytes     | A_INT64       | -2^63       | 2^63-1      | Signed (if name hints) |
| 8 bytes     | FLOAT64_IEEE  | -1.7e308    | 1.7e308     | If name contains "double" |

**Name-based Heuristics (for signed vs unsigned):**
- Contains "unsigned", "uint", "u8", "u16", "u32", "u64" → Unsigned
- Contains "signed", "int", "i8", "i16", "i32", "i64" → Signed
- Contains "float", "flt" → FLOAT32_IEEE
- Contains "double", "dbl" → FLOAT64_IEEE
- Default: Unsigned for integer types

### UI/UX Design

#### 2.1 Type Mapping Configuration Dialog
**Trigger:** Settings icon in ELF panel header

```
┌────────────────────────────────────────────────┐
│ ⚙️  Symbol Import Configuration               │
├────────────────────────────────────────────────┤
│                                                │
│ Default Type Mapping:                          │
│ ○ Smart (infer from size and name)            │
│ ○ Conservative (always unsigned)              │
│ ○ Custom (choose per symbol)                  │
│                                                │
│ Name Heuristics:                               │
│ ☑ Detect signed/unsigned from name            │
│ ☑ Detect float/double from name               │
│                                                │
│ Conversion Method:                             │
│ [NO_COMPU_METHOD ▼]                           │
│                                                │
│           [Cancel]  [Apply]                    │
└────────────────────────────────────────────────┘
```

#### 2.2 Preview Table with Type Inference
**Location:** Updated symbol table to show inferred type

```
┌────┬──────────────┬──────────┬────────┬─────────────┬─────────┐
│ ☐  │ Name         │ Address  │ Size   │ ELF Type    │ A2L Type│
├────┼──────────────┼──────────┼────────┼─────────────┼─────────┤
│ ☐  │ uint16_temp  │ 0x1000   │ 0x2    │ OBJECT      │ UWORD   │
│ ☑  │ int32_speed  │ 0x1004   │ 0x4    │ OBJECT      │ SLONG   │
│ ☐  │ float_ratio  │ 0x1008   │ 0x4    │ OBJECT      │ FLOAT32 │
└────┴──────────────┴──────────┴────────┴─────────────┴─────────┘
```

**Features:**
- New column "A2L Type" shows inferred type
- Hover tooltip explains why type was chosen
- Click cell to override type (dropdown selector)

### Implementation Details

**Backend (lib.rs):**
```rust
// Enhanced symbol structure with type hint
#[derive(Serialize, Deserialize, Clone)]
struct ElfSymbolWithType {
    name: String,
    address: u64,
    size: u64,
    bind: String,
    type_str: String,
    section: String,
    suggested_a2l_type: String,  // NEW
    suggested_limits: (f64, f64), // NEW
}

fn infer_a2l_type(symbol: &ElfSymbol) -> (String, f64, f64) {
    let name_lower = symbol.name.to_lowercase();

    match symbol.size {
        1 => {
            if name_lower.contains("signed") || name_lower.contains("int8") {
                ("SBYTE".to_string(), -128.0, 127.0)
            } else {
                ("UBYTE".to_string(), 0.0, 255.0)
            }
        },
        2 => {
            if name_lower.contains("signed") || name_lower.contains("int16") {
                ("SWORD".to_string(), -32768.0, 32767.0)
            } else {
                ("UWORD".to_string(), 0.0, 65535.0)
            }
        },
        4 => {
            if name_lower.contains("float") || name_lower.contains("flt") {
                ("FLOAT32_IEEE".to_string(), -3.4e38, 3.4e38)
            } else if name_lower.contains("signed") || name_lower.contains("int32") {
                ("SLONG".to_string(), -2147483648.0, 2147483647.0)
            } else {
                ("ULONG".to_string(), 0.0, 4294967295.0)
            }
        },
        8 => {
            if name_lower.contains("double") || name_lower.contains("dbl") {
                ("FLOAT64_IEEE".to_string(), -1.7e308, 1.7e308)
            } else if name_lower.contains("signed") || name_lower.contains("int64") {
                ("A_INT64".to_string(), -(2_i64.pow(63) as f64), (2_i64.pow(63) - 1) as f64)
            } else {
                ("A_UINT64".to_string(), 0.0, (2_u64.pow(64) - 1) as f64)
            }
        },
        _ => ("UBYTE".to_string(), 0.0, 255.0) // Fallback for odd sizes
    }
}

// Updated command
#[derive(Serialize, Deserialize)]
struct SymbolWithMapping {
    name: String,
    address: u64,
    a2l_type: String,        // User can override
    lower_limit: f64,
    upper_limit: f64,
}

#[tauri::command]
fn create_measurements_from_elf_v2(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: State<AppState>
) -> Result<EntityUpdateResult, String> {
    // Use provided type mapping instead of hardcoded UBYTE
    // ...
}
```

**Frontend (App.tsx):**
```typescript
type ElfSymbolWithMapping = {
  name: string;
  address: number;
  size: number;
  bind: string;
  type_str: string;
  section: string;
  suggested_a2l_type: string;
  suggested_limits: [number, number];
  // User overrides
  a2l_type?: string;
  lower_limit?: number;
  upper_limit?: number;
};

// When adding symbols, include type mapping
async function handleAddSymbols() {
  const toAdd = filteredSymbols
    .filter(s => selectedElfSymbols.has(s.name))
    .map(s => ({
      name: s.name,
      address: s.address,
      a2l_type: s.a2l_type || s.suggested_a2l_type,
      lower_limit: s.lower_limit || s.suggested_limits[0],
      upper_limit: s.upper_limit || s.suggested_limits[1],
    }));

  await invoke("create_measurements_from_elf_v2", {
    moduleName: selectedModule,
    symbols: toAdd
  });
}
```

### Test Cases

**Unit Tests (Rust):**
```rust
#[test]
fn test_infer_type_unsigned_byte() {
    let sym = ElfSymbol { size: 1, name: "uint8_var".to_string(), ... };
    let (dtype, min, max) = infer_a2l_type(&sym);
    assert_eq!(dtype, "UBYTE");
    assert_eq!(min, 0.0);
    assert_eq!(max, 255.0);
}

#[test]
fn test_infer_type_float32() {
    let sym = ElfSymbol { size: 4, name: "float_ratio".to_string(), ... };
    let (dtype, min, max) = infer_a2l_type(&sym);
    assert_eq!(dtype, "FLOAT32_IEEE");
}
```

**E2E Tests:**
```typescript
test("Smart type inference from symbol size", async ({ page }) => {
  // Load ELF with symbols of various sizes
  // Verify 1-byte → UBYTE
  // Verify 2-byte → UWORD
  // Verify 4-byte → ULONG
  // Verify 8-byte → A_UINT64
});

test("Override suggested type", async ({ page }) => {
  // Select symbol with suggested ULONG
  // Click A2L Type cell
  // Select SLONG from dropdown
  // Add to project
  // Verify measurement created with SLONG type
});
```

---

## Phase 3: Conflict Detection & Resolution (High Priority)

### User Story
*"As a user importing symbols, I need to be warned if a symbol name already exists in my project so I can avoid creating duplicates or choose how to resolve conflicts."*

### UI/UX Design

#### 3.1 Pre-Import Validation
**Trigger:** Click "Add to Project" button

**Flow:**
1. Backend checks selected symbols against existing measurements
2. If conflicts found, show resolution dialog
3. If no conflicts, proceed directly to add

#### 3.2 Conflict Resolution Dialog

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️  Symbol Import Conflicts                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 3 of 12 symbols already exist in the project:           │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Symbol Name      │ Existing    │ New         │Action│ │
│ ├──────────────────┼─────────────┼─────────────┼──────┤ │
│ │ engine_speed     │ 0x2000 UWORD│ 0x3000 ULONG│[Skip]│ │
│ │ sensor_temp      │ 0x2010 UBYTE│ 0x3010 UBYTE│[Skip]│ │
│ │ control_flag     │ 0x2020 UBYTE│ 0x3020 UBYTE│[Skip]│ │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Bulk Actions:                                            │
│ [Skip All Conflicts]  [Rename All (append _new)]         │
│ [Replace All]         [Update Addresses Only]            │
│                                                          │
│                      [Cancel]  [Continue Import]         │
└──────────────────────────────────────────────────────────┘
```

**Per-Symbol Actions:**
- **Skip** - Don't import this symbol
- **Rename** - Import as "symbol_name_2" (auto-increment)
- **Replace** - Overwrite existing measurement (warning shown)
- **Update Address** - Keep existing, update address only

**Bulk Actions:**
- **Skip All Conflicts** - Only import non-conflicting symbols
- **Rename All** - Append "_new" or "_2" to all conflicts
- **Replace All** - Overwrite all existing measurements (danger)
- **Update Addresses Only** - Sync addresses without changing types/limits

### Implementation Details

**Backend Command:**
```rust
#[derive(Serialize, Deserialize)]
struct ConflictReport {
    conflicts: Vec<SymbolConflict>,
    non_conflicts: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct SymbolConflict {
    symbol_name: String,
    existing_address: String,
    existing_type: String,
    new_address: String,
    new_type: String,
}

#[tauri::command]
fn check_symbol_conflicts(
    module_name: Option<String>,
    symbols: Vec<SymbolWithMapping>,
    state: State<AppState>
) -> Result<ConflictReport, String> {
    let a2l = state.a2l.lock().unwrap();
    let module = find_target_module(&a2l, module_name)?;

    let mut conflicts = Vec::new();
    let mut non_conflicts = Vec::new();

    for sym in symbols {
        if let Some(existing) = module.measurement.iter().find(|m| m.name == sym.name) {
            conflicts.push(SymbolConflict {
                symbol_name: sym.name.clone(),
                existing_address: format!("0x{:X}", existing.ecu_address.as_ref().map(|a| a.address).unwrap_or(0)),
                existing_type: existing.datatype.clone(),
                new_address: format!("0x{:X}", sym.address as u32),
                new_type: sym.a2l_type.clone(),
            });
        } else {
            non_conflicts.push(sym.name.clone());
        }
    }

    Ok(ConflictReport { conflicts, non_conflicts })
}
```

**Frontend Flow:**
```typescript
async function handleAddSymbols() {
  setIsBusy(true);

  // Step 1: Prepare symbols with mappings
  const symbolsToAdd = prepareSymbolMappings();

  // Step 2: Check for conflicts
  const conflictReport = await invoke<ConflictReport>(
    "check_symbol_conflicts",
    { moduleName: selectedModule, symbols: symbolsToAdd }
  );

  // Step 3: If conflicts, show resolution dialog
  if (conflictReport.conflicts.length > 0) {
    const resolution = await showConflictDialog(conflictReport);
    if (!resolution) {
      setIsBusy(false);
      return; // User cancelled
    }
    // Apply resolution (skip, rename, replace, etc.)
    symbolsToAdd = applyConflictResolution(symbolsToAdd, resolution);
  }

  // Step 4: Import with resolved conflicts
  await invoke("create_measurements_from_elf_v2", {
    moduleName: selectedModule,
    symbols: symbolsToAdd
  });

  setIsBusy(false);
}
```

### Test Cases

```typescript
test("Detect duplicate symbol names", async ({ page }) => {
  // Load A2L with existing measurement "engine_speed"
  // Load ELF with symbol "engine_speed"
  // Select symbol and click Add to Project
  // Verify conflict dialog appears
  // Verify existing and new addresses shown
});

test("Skip conflicting symbol", async ({ page }) => {
  // Trigger conflict dialog
  // Choose "Skip" for conflicting symbol
  // Continue import
  // Verify only non-conflicting symbols added
});

test("Rename conflicting symbol", async ({ page }) => {
  // Trigger conflict dialog
  // Choose "Rename" for conflicting symbol
  // Continue import
  // Verify measurement created with "_2" suffix
});
```

---

## Phase 4: Preview & Batch Configuration (Medium Priority)

### User Story
*"As a user about to import 50 symbols, I want to preview what measurements will be created and adjust settings in bulk before committing to the import."*

### UI/UX Design

#### 4.1 Preview Dialog
**Trigger:** Click "Add to Project" (after conflict resolution)

```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Import Preview - 12 symbols selected                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Target Module: [Module1 ▼]                                  │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │Name          │Address │Type    │Lower  │Upper       │    │
│ ├──────────────┼────────┼────────┼───────┼────────────┤    │
│ │engine_rpm    │0x1000  │UWORD ▼ │0      │65535    [✏]│    │
│ │throttle_pos  │0x1004  │UBYTE ▼ │0      │100      [✏]│    │
│ │fuel_temp     │0x1008  │SWORD ▼ │-40    │150      [✏]│    │
│ │...           │        │        │       │            │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ Bulk Edit:                                                   │
│ ☑ Apply conversion: [NO_COMPU_METHOD ▼]                    │
│ ☑ Set resolution: [1]                                       │
│ ☑ Set accuracy: [0]                                         │
│                                                              │
│                 [Cancel]  [< Back]  [Import All]             │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Editable table (inline editing)
- Click [✏] to edit limits for individual symbol
- Type dropdown per row
- Bulk edit checkboxes apply to all rows
- Module selection dropdown
- Back button returns to symbol selection

#### 4.2 Individual Symbol Editor
**Trigger:** Click [✏] icon on preview row

```
┌────────────────────────────────────────┐
│ Edit: engine_rpm                       │
├────────────────────────────────────────┤
│                                        │
│ Name:          [engine_rpm________]    │
│ ECU Address:   [0x1000___________]     │
│ Data Type:     [UWORD ▼]              │
│ Lower Limit:   [0________________]     │
│ Upper Limit:   [8000_____________]     │
│ Conversion:    [RPM_CONVERSION ▼]     │
│ Resolution:    [1________________]     │
│ Accuracy:      [0.5______________]     │
│                                        │
│          [Cancel]  [Apply]             │
└────────────────────────────────────────┘
```

### Implementation Details

**Frontend State:**
```typescript
type PreviewMeasurement = {
  name: string;
  address: string;
  a2l_type: string;
  lower_limit: number;
  upper_limit: number;
  conversion: string;
  resolution: number;
  accuracy: number;
};

const [previewData, setPreviewData] = useState<PreviewMeasurement[]>([]);
const [showPreview, setShowPreview] = useState(false);

function openPreviewDialog(symbols: ElfSymbolWithMapping[]) {
  const preview = symbols.map(s => ({
    name: s.name,
    address: `0x${s.address.toString(16).toUpperCase()}`,
    a2l_type: s.a2l_type || s.suggested_a2l_type,
    lower_limit: s.lower_limit || s.suggested_limits[0],
    upper_limit: s.upper_limit || s.suggested_limits[1],
    conversion: "NO_COMPU_METHOD",
    resolution: 1,
    accuracy: 0,
  }));
  setPreviewData(preview);
  setShowPreview(true);
}
```

### Test Cases

```typescript
test("Preview measurements before import", async ({ page }) => {
  // Select multiple symbols
  // Click Add to Project
  // Verify preview dialog shows
  // Verify all selected symbols in table
  // Verify types match inference
});

test("Edit individual measurement in preview", async ({ page }) => {
  // Open preview
  // Click edit icon for first row
  // Change upper limit from 65535 to 8000
  // Apply
  // Verify preview table updated
  // Import
  // Verify measurement has custom limit
});

test("Bulk edit conversion method", async ({ page }) => {
  // Open preview with 10 symbols
  // Check "Apply conversion" checkbox
  // Select conversion method from dropdown
  // Import
  // Verify all measurements have same conversion
});
```

---

## Phase 5: Module Selection (Medium Priority)

### User Story
*"As a user working with a multi-module A2L project, I need to choose which module to add the imported symbols to instead of always using the first module."*

### UI/UX Design

#### 5.1 Module Selector in ELF Panel
**Location:** ELF Inspector panel, above symbol table

```
┌────────────────────────────────────────┐
│ Target Module: [Module1 ▼]            │
└────────────────────────────────────────┘
```

**Behavior:**
- Dropdown populated from loaded A2L metadata
- Shows all module names from project
- Default: First module
- Persists selection in local storage
- Disabled if no A2L loaded

### Implementation Details

**Frontend:**
```typescript
const [selectedModule, setSelectedModule] = useState<string | null>(null);

// Initialize from metadata
useEffect(() => {
  if (metadata && metadata.module_names.length > 0) {
    const stored = localStorage.getItem('elf_target_module');
    const defaultModule = stored || metadata.module_names[0];
    setSelectedModule(defaultModule);
  }
}, [metadata]);

// Save selection
function handleModuleChange(moduleName: string) {
  setSelectedModule(moduleName);
  localStorage.setItem('elf_target_module', moduleName);
}
```

### Test Cases

```typescript
test("Select target module for import", async ({ page }) => {
  // Load A2L with modules ["Module1", "Module2"]
  // Switch to ELF view
  // Select Module2 from dropdown
  // Import symbols
  // Verify measurements added to Module2, not Module1
});
```

---

## Phase 6: Address Validation (Medium Priority)

### User Story
*"As a user importing 64-bit ELF symbols, I need to be warned when addresses exceed 32-bit range so I can identify potential issues before importing."*

### UI/UX Design

#### 6.1 Warning Banner for Overflow
**Location:** Above symbol table, appears when overflow detected

```
┌────────────────────────────────────────────────────────┐
│ ⚠️  Warning: 3 symbols have addresses >0xFFFFFFFF     │
│    These will be truncated to 32-bit for A2L.         │
│    [Show Affected Symbols]                             │
└────────────────────────────────────────────────────────┘
```

**Click "Show Affected Symbols":**
- Automatically applies filter: "Address > 0xFFFFFFFF"
- Highlights affected rows in yellow

#### 6.2 Visual Indicators in Table
**Enhanced address column:**

```
│ Address       │  (instead of just "Address")
├───────────────┤
│ 0x1000        │  (normal)
│ 0xFFFFFFFF    │  (normal, max 32-bit)
│ 0x100000000 ⚠ │  (warning icon for overflow)
```

### Implementation Details

**Backend - Add validation:**
```rust
fn validate_address_range(address: u64) -> Option<String> {
    if address > 0xFFFFFFFF {
        Some(format!(
            "Address 0x{:X} exceeds 32-bit range, will be truncated to 0x{:X}",
            address,
            address as u32
        ))
    } else {
        None
    }
}

// In load_elf_symbols, add warning field
#[derive(Serialize, Deserialize, Clone)]
struct ElfSymbol {
    // ... existing fields
    address_warning: Option<String>,
}
```

**Frontend - Show warnings:**
```typescript
const overflowSymbols = elfSymbols.filter(s => s.address > 0xFFFFFFFF);

{overflowSymbols.length > 0 && (
  <Alert severity="warning">
    ⚠️ {overflowSymbols.length} symbols have addresses exceeding 32-bit range
    <Button onClick={() => filterOverflowSymbols()}>
      Show Affected Symbols
    </Button>
  </Alert>
)}
```

### Test Cases

```typescript
test("Warn on 64-bit address overflow", async ({ page }) => {
  // Load ELF with symbol at address 0x100000000
  // Verify warning banner appears
  // Verify affected symbol has warning icon
  // Click "Show Affected Symbols"
  // Verify filter applied
});
```

---

## Implementation Roadmap

### Sprint 1: Foundation (1 week)
- [ ] Symbol search bar
- [ ] Basic type/section/bind filters
- [ ] Column sorting
- [ ] Results counter

### Sprint 2: Smart Mapping (1 week)
- [ ] Size-based type inference (backend)
- [ ] Name heuristics for signed/unsigned
- [ ] Update create_measurements command
- [ ] Display suggested types in UI

### Sprint 3: Conflict Detection (1 week)
- [ ] Conflict checking command
- [ ] Conflict resolution dialog
- [ ] Skip/rename/replace actions
- [ ] Bulk conflict actions

### Sprint 4: Preview & Batch (1 week)
- [ ] Preview dialog
- [ ] Inline editing in preview
- [ ] Bulk edit controls
- [ ] Individual measurement editor

### Sprint 5: Polish & Validation (3 days)
- [ ] Module selector
- [ ] Address overflow warnings
- [ ] Configuration persistence
- [ ] Error handling improvements

### Sprint 6: Testing & Documentation (3 days)
- [ ] E2E test suite
- [ ] Unit tests for type inference
- [ ] User documentation
- [ ] Demo video/walkthrough

---

## Success Metrics

### Functional
- ✅ Can filter 10,000 symbols to <100 in <1 second
- ✅ Type inference accuracy >95% for standard naming conventions
- ✅ Zero duplicate measurements created by default
- ✅ 100% of address overflows detected and warned

### UX
- ✅ Preview step reduces import errors by >80%
- ✅ Filtering reduces time to find symbols by >70%
- ✅ Conflict resolution prevents data loss in 100% of cases

### Performance
- ✅ Search filters table in <100ms
- ✅ Preview generation for 1000 symbols in <500ms
- ✅ Conflict check for 1000 symbols in <1 second

---

## Future Enhancements (Post-MVP)

- **DWARF Debug Info Parsing**: Extract actual C struct/type definitions
- **Struct-based Generation**: Auto-create characteristics for struct members
- **Workspace Templates**: Save/load symbol filter presets
- **Export Mapping Report**: CSV export of symbol→measurement mapping
- **Incremental Sync**: Re-import ELF and update only changed symbols
- **Symbol Grouping**: Group by section or struct for batch operations

---

## Appendix: Current Implementation Gaps

Based on investigation agent report, these are the **critical gaps** this plan addresses:

1. ✅ No data type mapping → **Phase 2 (Smart Mapping)**
2. ✅ No conflict detection → **Phase 3 (Conflict Resolution)**
3. ✅ No symbol filtering → **Phase 1 (Search & Filters)**
4. ✅ No preview → **Phase 4 (Preview Dialog)**
5. ✅ No module selection → **Phase 5 (Module Selector)**
6. ✅ Address overflow risk → **Phase 6 (Validation)**
7. ⏳ Size validation → Deferred to struct-based generation
8. ⏳ Batch rename/edit → Covered by preview dialog bulk edit
9. ⏳ DWARF parsing → Future enhancement

---

**END OF PLAN**
