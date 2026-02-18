# SRS-R9: data-testid Convention

**Status:** Implemented
**Priority:** Medium
**Category:** Testing / UI Standards

## 1. Overview

All interactive and semantically significant UI elements in OpenT A2L-Forge use `data-testid` attributes to enable reliable, selector-stable end-to-end testing. This convention decouples tests from visual presentation, text content, and CSS class names.

## 2. Requirements

### R9.1: All Interactive UI Elements Have data-testid Attributes

**Description:** Every button, input field, dialog, table, navigation element, and significant container in the application shall have a `data-testid` attribute.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R9.1.1 | All buttons, icon buttons, and clickable actions have a `data-testid` attribute. |
| R9.1.2 | All text inputs and search fields have a `data-testid` attribute. |
| R9.1.3 | All select/dropdown elements have a `data-testid` attribute. |
| R9.1.4 | All dialogs have a `data-testid` attribute on their root element. |
| R9.1.5 | Key layout regions (sidebar tabs, panels, trees, tables) have a `data-testid` attribute. |

### R9.2: Naming Convention

**Description:** `data-testid` values follow a kebab-case naming convention with a prefix indicating the element type.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R9.2.1 | All `data-testid` values use kebab-case (lowercase with hyphens). |
| R9.2.2 | Buttons and icon buttons use the `btn-` prefix (e.g., `btn-open-a2l`). |
| R9.2.3 | Search inputs use the `search-` prefix (e.g., `search-elf`). |
| R9.2.4 | Filter dropdowns use the `filter-` prefix (e.g., `filter-type`). |
| R9.2.5 | Sort-enabled column headers use the `sort-` prefix (e.g., `sort-name`). |
| R9.2.6 | Dialogs use the `dialog-` prefix (e.g., `dialog-preview`). |
| R9.2.7 | Editors use the `editor-` prefix (e.g., `editor-measurement`). |
| R9.2.8 | Sidebar tabs use the `sidebar-` prefix (e.g., `sidebar-explorer`). |
| R9.2.9 | Headings use the `heading-` prefix (e.g., `heading-explorer`). |
| R9.2.10 | Select controls use the `select-` prefix (e.g., `select-module`). |
| R9.2.11 | Checkboxes use the `checkbox-` prefix (e.g., `checkbox-select-all`). |
| R9.2.12 | Banners and alerts use the `banner-` prefix (e.g., `banner-elf-changed`). |

### R9.3: E2E Tests Use getByTestId()

**Description:** All Playwright end-to-end tests use `page.getByTestId()` as the primary locator strategy instead of text-based or CSS-based selectors.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R9.3.1 | E2E tests locate elements using `page.getByTestId('...')` for all interactions. |
| R9.3.2 | Text-based selectors (`page.getByText()`, `page.locator('text=...')`) are avoided for interactive elements. |
| R9.3.3 | CSS class-based selectors are not used for element identification in tests. |

## 3. data-testid Reference Table

The following table lists all `data-testid` values currently in use.

### Layout and Navigation

| data-testid | Element | Location |
|-------------|---------|----------|
| `sidebar-explorer` | Explorer tab in sidebar | App.tsx |
| `sidebar-elf` | ELF Inspector tab in sidebar | App.tsx |
| `heading-explorer` | Explorer section heading | App.tsx |
| `heading-elf-inspector` | ELF Inspector section heading | App.tsx |
| `entity-tree` | Entity tree container | App.tsx |
| `entity-detail` | Entity detail panel | App.tsx |
| `status-message` | Status bar message text | App.tsx |

### Buttons

| data-testid | Element | Location |
|-------------|---------|----------|
| `btn-new-a2l` | Create new A2L | App.tsx |
| `btn-open-a2l` | Open A2L file | App.tsx |
| `btn-save-a2l` | Save A2L file | App.tsx |
| `btn-load-elf` | Load ELF binary | App.tsx |
| `btn-add-to-a2l` | Add selected symbols to A2L | App.tsx |
| `btn-update-ecu` | Update ECU addresses | App.tsx |
| `btn-edit` | Edit selected entity | App.tsx |
| `btn-minimize` | Minimize window | App.tsx |
| `btn-maximize` | Maximize/restore window | App.tsx |
| `btn-close` | Close window | App.tsx |

### Search and Filter Controls

| data-testid | Element | Location |
|-------------|---------|----------|
| `search-entities` | Entity search input | App.tsx |
| `search-elf` | ELF symbol search input | App.tsx |
| `filter-type` | ELF type filter dropdown | App.tsx |
| `filter-section` | ELF section filter dropdown | App.tsx |
| `filter-bind` | ELF bind filter dropdown | App.tsx |

### Table and Sort Controls

| data-testid | Element | Location |
|-------------|---------|----------|
| `elf-table` | ELF symbol table container | App.tsx |
| `sort-name` | Name column header (sortable) | App.tsx |
| `sort-address` | Address column header (sortable) | App.tsx |
| `sort-size` | Size column header (sortable) | App.tsx |
| `sort-type` | Type column header (sortable) | App.tsx |
| `checkbox-select-all` | Select all symbols checkbox | App.tsx |
| `select-module` | Module selector dropdown | App.tsx |

### Dialogs

| data-testid | Element | Location |
|-------------|---------|----------|
| `dialog-conflict` | Conflict resolution dialog | App.tsx |
| `dialog-preview` | Import preview dialog | App.tsx |

### Recent Files

| data-testid | Element | Location |
|-------------|---------|----------|
| `recent-a2l-list` | Recent A2L files list | App.tsx |
| `recent-elf-list` | Recent ELF files list | App.tsx |

### Entity Editors

| data-testid | Element | Location |
|-------------|---------|----------|
| `editor-measurement` | Measurement editor container | MeasurementEditor.tsx |
| `editor-measurement-name` | Measurement name field | MeasurementEditor.tsx |
| `editor-measurement-datatype` | Measurement data type field | MeasurementEditor.tsx |
| `editor-measurement-long-id` | Measurement long identifier field | MeasurementEditor.tsx |
| `editor-measurement-lower-limit` | Measurement lower limit field | MeasurementEditor.tsx |
| `editor-measurement-upper-limit` | Measurement upper limit field | MeasurementEditor.tsx |
| `editor-measurement-resolution` | Measurement resolution field | MeasurementEditor.tsx |
| `editor-measurement-accuracy` | Measurement accuracy field | MeasurementEditor.tsx |
| `editor-measurement-conversion` | Measurement conversion field | MeasurementEditor.tsx |
| `editor-measurement-ecu-address` | Measurement ECU address field | MeasurementEditor.tsx |
| `editor-measurement-save` | Measurement save button | MeasurementEditor.tsx |
| `editor-measurement-cancel` | Measurement cancel button | MeasurementEditor.tsx |
| `editor-characteristic` | Characteristic editor container | CharacteristicEditor.tsx |
| `editor-characteristic-name` | Characteristic name field | CharacteristicEditor.tsx |
| `editor-characteristic-type` | Characteristic type field | CharacteristicEditor.tsx |
| `editor-characteristic-save` | Characteristic save button | CharacteristicEditor.tsx |
| `editor-characteristic-cancel` | Characteristic cancel button | CharacteristicEditor.tsx |
| `editor-axis-pts` | Axis points editor container | AxisPtsEditor.tsx |
| `editor-axis-pts-name` | Axis points name field | AxisPtsEditor.tsx |
| `editor-axis-pts-save` | Axis points save button | AxisPtsEditor.tsx |
| `editor-axis-pts-cancel` | Axis points cancel button | AxisPtsEditor.tsx |

### Banners

| data-testid | Element | Location |
|-------------|---------|----------|
| `banner-elf-changed` | ELF file changed notification | App.tsx |

## 4. Traceability

| Artifact | Path |
|----------|------|
| UI implementation | `src/App.tsx` |
| Measurement editor | `src/components/editors/MeasurementEditor.tsx` |
| Characteristic editor | `src/components/editors/CharacteristicEditor.tsx` |
| Axis points editor | `src/components/editors/AxisPtsEditor.tsx` |
| E2E tests (all) | `tests/e2e/*.spec.ts` |
