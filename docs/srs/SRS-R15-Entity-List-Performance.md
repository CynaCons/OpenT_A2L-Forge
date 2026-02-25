# SRS-R15 — Virtual Scrolling for Large Entity Lists

**Status:** Implemented
**Priority:** Medium
**Last Updated:** 2026-02-19

## Overview

Large A2L files can contain thousands of measurements and characteristics. To maintain UI responsiveness, the entity list uses a batched rendering approach with configurable batch sizes. When a search filter is active, all matching items are shown regardless of the batch limit to ensure users can find any entity. A "Load all" button is provided for cases where the user wants to see the complete unfiltered list.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| R15.1 | **Search bypasses rendering limit** — When a search/filter query is active, all matching items are rendered regardless of the current batch size limit, ensuring no search results are hidden. | Done |
| R15.2 | **Default batch size** — The default rendering batch size is increased to 500 (from the previous default of 200) to reduce the need for manual loading. | Done |
| R15.3 | **Load all button** — A "Load all" button is provided alongside the "Load more" button, allowing users to render the entire entity list at once. | Done |
| R15.4 | **Remaining count display** — The "Load more" button text includes the number of remaining items not yet rendered (e.g., "Load 500 more (1,234 remaining)"). | Done |

## Acceptance Criteria

- With a large A2L file (e.g., `software_a.a2l`), the initial entity list renders the first 500 items without lag.
- Typing a search query immediately shows all matching results, even if they would be beyond the 500-item batch limit.
- Clicking "Load 500 more" appends the next batch and updates the remaining count.
- Clicking "Load all" renders the entire list.
- The remaining count accurately reflects how many items are not yet displayed.
- UI remains responsive during incremental loading.

## Test References

| Test | File | Description |
|------|------|-------------|
| Manual verification | N/A | Tested manually with large A2L files (e.g., `software_a.a2l`) to verify performance, search bypass behavior, and button functionality. |

## Implementation Notes

- The entity list component maintains a `displayCount` state that starts at 500 and increases by 500 on each "Load more" click.
- When the search input is non-empty, `displayCount` is effectively set to `Infinity` (or the total filtered count) so all matches are shown.
- The "Load all" button sets `displayCount` to the total entity count.
- The remaining count is computed as `totalCount - displayCount` and displayed in the button label.
- Implementation is in the React entity list component in `src/App.tsx`.
