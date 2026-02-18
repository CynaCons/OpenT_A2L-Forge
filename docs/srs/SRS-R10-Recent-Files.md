# SRS-R10: Recently Used Files

**Status:** Implemented
**Priority:** Low
**Category:** UX / File Management

## 1. Overview

The application tracks recently opened A2L and ELF files to provide quick access for returning users. Recent file lists are persisted in the browser's localStorage and displayed in the appropriate sidebar panels when no file is currently loaded or as a convenience alongside the ELF Inspector.

## 2. Requirements

### R10.1: Recent A2L Files Stored in localStorage

**Description:** The application maintains a list of recently opened A2L file paths in localStorage, capped at a maximum of 8 entries. The most recently opened file appears first.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R10.1.1 | When an A2L file is successfully loaded, its file path is added to the recent A2L list. |
| R10.1.2 | The list is stored in localStorage under a consistent key. |
| R10.1.3 | Duplicate paths are moved to the top rather than added twice. |
| R10.1.4 | The list is capped at 8 entries; the oldest entry is removed when the cap is exceeded. |
| R10.1.5 | The list persists across application restarts. |

### R10.2: Recent ELF Files Stored in localStorage

**Description:** The application maintains a list of recently opened ELF file paths in localStorage, capped at a maximum of 8 entries.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R10.2.1 | When an ELF file is successfully loaded, its file path is added to the recent ELF list. |
| R10.2.2 | The list is stored in localStorage under a consistent key. |
| R10.2.3 | Duplicate paths are moved to the top rather than added twice. |
| R10.2.4 | The list is capped at 8 entries; the oldest entry is removed when the cap is exceeded. |
| R10.2.5 | The list persists across application restarts. |

### R10.3: Recent A2L List in Explorer View

**Description:** When no A2L file is currently loaded, the Explorer sidebar panel displays the recent A2L file list, allowing the user to click a path to open it directly.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R10.3.1 | The recent A2L list (`data-testid="recent-a2l-list"`) is visible in the Explorer panel when no A2L file is loaded. |
| R10.3.2 | Each entry displays the file name (or abbreviated path). |
| R10.3.3 | Clicking a recent file entry triggers the A2L load workflow for that path. |
| R10.3.4 | The list is hidden once an A2L file is successfully loaded and the entity tree is displayed. |

### R10.4: Recent ELF List in ELF Inspector Sidebar

**Description:** The ELF Inspector sidebar displays the recent ELF file list, allowing the user to quickly reload a previously used ELF binary.

**Acceptance Criteria:**

| ID | Criterion |
|----|-----------|
| R10.4.1 | The recent ELF list (`data-testid="recent-elf-list"`) is visible in the ELF Inspector sidebar. |
| R10.4.2 | Each entry displays the file name (or abbreviated path). |
| R10.4.3 | Clicking a recent ELF entry triggers the ELF load workflow for that path. |
| R10.4.4 | The list updates immediately when a new ELF file is loaded. |

## 3. Technical Approach

- Recent file lists are stored as JSON arrays in `localStorage` with keys such as `recentA2lFiles` and `recentElfFiles`.
- On each file open, the path is prepended to the array; duplicates are filtered; the array is truncated to 8 entries.
- The React state reads from localStorage on mount and writes on every update.
- File names are extracted from the full path for display; the full path is used for loading.

## 4. Traceability

| Artifact | Path |
|----------|------|
| UI implementation | `src/App.tsx` (recent file lists in Explorer and ELF Inspector panels) |
| data-testid: recent A2L | `recent-a2l-list` |
| data-testid: recent ELF | `recent-elf-list` |
