# Horizontal Timeline Stack (`el-horizontal-timeline-stack`)

[← Back to root README](../../../README.md)

---

## What it does

Mounts the shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md), one [HorizontalTimeline](../horizontalTimeline/README.md) per Dimension (six, in the current config), and a single shared [`<el-details-panel>`](../detailsPanel/README.md), under a single horizontally-scrolling region — the `≥1024px` desktop counterpart to [TimelineStack](../timelineStack/README.md)'s swipe-snapped mobile/tablet pages. [DynamicTimelineUI](../dynamicTimelineUI/README.md) mounts this instead of `<el-timeline-stack>` when `isDesktopLayout` is true (see its own README for the breakpoint-driven swap).

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline-stack>` — no attributes or props.

## Store interaction

- `SWITCH_DIMENSION`/`SHOW_PANEL`, dispatched from `activateRow()` whenever a row opens an entry (see below).
- Otherwise none directly — each mounted child ([HorizontalTimelineAxis](../horizontalTimelineAxis/README.md), [HorizontalTimeline](../horizontalTimeline/README.md)) already owns its own store wiring for its own concerns (zoom, entry CRUD).

## Behaviour notes (Phase 10.6: the shared panel)

`DetailsPanel` (`src/components/detailsPanel/detailsPanel.js`) hides itself unless its `dimensionindex` attribute matches the store's `currentDimensionIndex` — correct for the vertical swipe-between-dimensions model (only one `Timeline` is ever "current"), but all six horizontal rows are visible simultaneously, so mounting one panel per row (mirroring `Timeline`'s own pattern) would leave 5 of 6 permanently invisible when clicked. Its CSS is also explicitly commented "mobile only for now" — not viable with six rows stacked in a scrolling area. This component mounts **one shared panel** instead, and orchestrates it:

- Each row is injected (via `setProps`/`key`, same shape `Timeline` hands its own self-made panel) with `openEntry`/`openNewEntry`/`close`/`reportSaveConflict` callbacks that route through this component's `openEntryForRow(dimensionIndex, entry)` / `openNewEntryForRow(dimensionIndex, startOffsetMins)`.
- `activateRow(dimensionIndex)` tracks which row is "active" (`this.activeRow`, a direct element reference) and, **only on an actual dimension change**, updates the panel's `dimensionindex`/`heading`/`instruction` attributes and calls `panelElement.reset()` — `ActivityPicker` reads its own `dimensionindex` once at construction, not on a later attribute change, so switching rows needs a real rebuild, not just a new attribute value. It then dispatches `SWITCH_DIMENSION` (satisfying the panel's visibility gate above) and `SHOW_PANEL`.
- The panel's own registered actions (`saveEntry`/`deleteEntry`/`findNextEntryAfter`, captured via `registerPanelActions`) delegate to `this.activeRow` — the entry CRUD logic itself lives on [HorizontalTimeline](../horizontalTimeline/README.md) (ported from `Timeline`), not here.
- A click that opens a _different_ row's entry than before (e.g. clicking a "Location" entry right after a "Who" one) correctly swaps the panel to the new row's own Dimension's activities — this is specifically what `activateRow`'s `reset()` call guarantees, and what the Phase 10.6 verification checked for.
- The panel's CSS position (`horizontalTimelineStack.css`, `position: fixed; bottom: 0`) is a **Phase 10.6 placeholder** overriding `DetailsPanel`'s own `position: sticky; bottom: 0` (which would otherwise scroll away with the horizontally-scrolling timeline content, since it's nested inside this component's `overflow-x: auto` host). Phase 10.7 replaces this with the real docked design.

## Behaviour notes (layout)

- The axis and every row set their own `<svg>` `width`/`viewBox` (and, critically, their own _host element's_ CSS `width`) to match the current zoom level (Phase 10.5) — see [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md)'s README for why the host's own width matters, not just the svg's. `overflow-x: auto` on this component is the single scrollbar that pans the axis and all six rows together in lockstep.
- No scroll-to/highlight-the-matching-row behavior yet when a Dimension is picked from the sidebar - deferred until there's an actual visual design for an "active" row, since none exists anywhere in the app yet.

---

[← Back to root README](../../../README.md)
