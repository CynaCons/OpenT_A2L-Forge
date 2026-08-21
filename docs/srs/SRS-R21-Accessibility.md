# SRS-R21 — Accessibility

**Status:** Implemented
**Iteration:** PLAN v6.0.2
**Related:** SRS-R9 (data-testid), docs/prototypes/visual-upgrade.html (Variant A)

## Overview

The app must be operable by keyboard alone and meet WCAG 2.1 AA contrast requirements on its primary views. An automated axe-core audit runs against the real release binary and gates on critical violations.

## Requirements

### R21.1 — Contrast (WCAG 2.1 AA ≥ 4.5:1)

- Muted text uses token `textMuted` (#9d9daa) instead of #666/#777/#888 literals.
- Inactive activity-bar icons use `textMuted` (~4.8:1 on surface) instead of 40% white (~2.9:1).
- Status bar background uses dedicated token `statusBarBg` (#1f6feb); white text on it is ≥ 4.5:1. Error state keeps #9a3324 (7.3:1).
- Contained buttons use the darker accent shade (#1f6feb) so white labels meet AA; hover shade #1b5fd0.
- Tooltips use explicit #101010 background / #d6d6dd text (~13.9:1).
- Tree section count spans use ≥ 0.85 opacity of `text.secondary`.

### R21.2 — Keyboard operability

- Sortable ELF table headers use MUI `TableSortLabel` (ButtonBase): focusable, Enter/Space operable, `aria-sort` communicated via `sortDirection` on the cell.
- Struct expand/collapse is a real `IconButton` inside the parent row with `aria-expanded` and an `aria-label` ("Expand/Collapse struct X (N members)"). The row itself remains mouse-clickable but carries no button role (avoids nested-interactive).
- Scrollable regions (entity tree, entity detail body, ELF symbol table) have `tabIndex={0}` plus an accessible name (`scrollable-region-focusable`).
- Status bar error dismissal is a real `IconButton` (`data-testid="btn-dismiss-error"`, aria-label "Dismiss error").
- Global `:focus-visible` ring (2px accent) defined in `index.css`.

### R21.3 — Labels & structure

- All ELF table checkboxes expose `inputProps["aria-label"]` (select-all, struct-root, per-symbol).
- Explorer search input has `aria-label="Search entities"`.
- Recent-file lists wrap `ListItemButton` in `<li>` so `ul.MuiList-root` contains only list items (axe `list` rule).

### R21.4 — Automated audit gate

- `tests/e2e/axe-audit.spec.ts` scans three views (explorer, elf-inspector with real fixtures loaded, entity-detail) with axe-core against the real release binary via CDP (NO MOCKS compliant).
- Report written to `docs/srs/axe-audit-results.json`.
- Gate: zero critical violations. Current state: **zero violations of any impact** across all scanned views.
- Known exclusion: `.MuiTooltip-tooltip` is excluded from scanning due to an axe color-contrast false positive on tooltips mid-transform animation (computed colors verified at ~13.9:1).

## Verification

- `npx playwright test tests/e2e/axe-audit.spec.ts` — passes, report shows 0 violations.
- Full E2E suite green against rebuilt release binary.
