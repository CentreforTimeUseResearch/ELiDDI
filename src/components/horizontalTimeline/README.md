# Horizontal Timeline (`el-horizontal-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Entries for the currently-viewed Diary day as a horizontal row of SVG blocks on the x-axis — the `≥1024px` desktop counterpart to [Timeline](../timeline/README.md)'s vertical column, axis-swapped (`x`/`width` instead of `y`/`height`). Zoom-aware (Phase 10.5) and interactive (Phase 10.6): click-to-add, click-to-select, long-press to reveal resize handles, drag-to-resize — ported from [Timeline](../timeline/README.md) via `EntryResizeController`'s axis-generalized config. No "Primary activity mirror" shadow strip (not in the original design handoff, and may not even be needed once all six Dimensions are visible as full rows simultaneously). One instance is mounted per Dimension by [HorizontalTimelineStack](../horizontalTimelineStack/README.md), below a single shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md).

Like `Timeline`, this component has no details panel of its own: its `panelActions` are injected by [HorizontalTimelineStack](../horizontalTimelineStack/README.md), which owns the app's one shared panel (ADR 0005).

Terminology (Dimension, Timeline, Entry) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline index="…">`

| Attribute | Purpose                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this row instance belongs to. |

## Store interaction

Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` on first mount if none exists yet, and `ADD_ENTRY`/`UPDATE_ENTRY`/`DELETE_ENTRY` via `createEntry`/`updateEntry`/`deleteEntry`, inherited from [`BaseTimeline`](../timeline/baseTimeline.js) like everything else the two layouts share (see [ADR 0003](../../../docs/adr/0003-one-timeline-base-for-both-layouts.md)). Re-renders on every store update (not just a relevant one) and on a date change. Does **not** dispatch `SWITCH_DIMENSION`/`SHOW_PANEL` itself when an entry is opened — unlike `Timeline.onTimelineClick`, that's `HorizontalTimelineStack`'s job, reached via the injected `panelActions.openEntry`/`openNewEntry` (it needs to detect an actual dimension change first, to decide whether the shared panel needs a full rebuild).

## Behaviour notes

- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), same reasoning as [Timeline](../timeline/README.md): long labels can wrap via ordinary CSS, and the label's font-size can be set independently of the bar's geometry.
- **Zoom (Phase 10.5):** reads `horizontalZoomLevel` from the store on every update and recomputes its own `<svg>`'s `width`/`viewBox` plus every entry's `x`/`width` from `getEffectivePxPerMinute(zoomLevel)` (see [`horizontalTimelineAxis/zoomConstants.js`](../horizontalTimelineAxis/zoomConstants.js)) — keeping 1 viewBox unit = 1 CSS px at every zoom level, never relying on implicit viewBox-stretching. Entry label font-size stays a constant 14px regardless of zoom, satisfying the handoff note's "never below 14px" floor by simply never changing it.
- **Interactions (Phase 10.6):** long-press → reveal resize handles → drag → live-resize → commit/cancel via the same `EntryResizeController` (`src/components/timeline/entryResizeController.js`) `Timeline` uses, constructed here with its `X_AXIS` config (`x`/`width`/`cx` instead of `y`/`height`/`cy`) and a `getPxPerMinute` callback that reads the _current_ zoom level on every call (`Timeline`'s own is just a fixed constant, since the vertical timeline has no zoom). Coordinate conversion (`clientToSvgCoord`) and `calculateTheTimeSlotClicked` come from `BaseTimeline`, reading the axis from `X_AXIS` and the scale from this row's `getPxPerMinute()`, so both are zoom-aware.
- **Grid lines (#176):** a vertical line every 10 minutes down the row, in the template's `data-part="grid-lines"` layer between `gridline-zone` and `events`, drawn by `renderGridLines()` from [`horizontalTimelineAxis/gridLines.js`](../horizontalTimelineAxis/gridLines.js) (the axis uses the same helper for its ticks). The layer is `pointer-events="none"` so a click on a line still reaches `gridline-zone`, which is what starts a new Entry. `updateDimensions()` runs on every store update but redraws the lines only when the pixels-per-minute scale (the zoom) has changed.
- `getChildElementReferences()` (shared, extended here for the gridline zone) finds the SVG's parts by `data-part` (`events`, `gridline-zone`, `grid-lines`, `drag-handles`), not by `id`: six rows clone the same template, so an id would repeat once per row (#170). The `[id="…"]` attribute-selector workaround this used to need under jsdom is gone with them.
- Reuses `MINUTES_PER_DAY`/`SVGNS`/`XHTMLNS` from [`timeline/timelineConstants.js`](../timeline/timelineConstants.js) directly, unchanged — the same native scale (`2px`/minute → `2880px`/day at zoom 1) as the vertical timeline, just rotated to the x-axis and scaled by the current zoom level.
- Its `.event-label` and `.resize-handle-*`/`.dragging-handle` styling is shared with (and defined by) [`timeline/timeline.css`](../timeline/timeline.css), imported directly here rather than assumed to already be loaded.

---

[← Back to root README](../../../README.md)
