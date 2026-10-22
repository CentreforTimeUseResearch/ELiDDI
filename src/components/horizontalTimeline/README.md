# Horizontal Timeline (`el-horizontal-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Entries for the currently-viewed Diary day as a horizontal row of SVG blocks on the x-axis — the `≥1024px` desktop counterpart to [Timeline](../timeline/README.md)'s vertical column, axis-swapped (`x`/`width` instead of `y`/`height`). Zoom-aware (Phase 10.5) and interactive (Phase 10.6): click-to-add, click-to-select, long-press to reveal resize handles, drag-to-resize — ported from [Timeline](../timeline/README.md) via `EntryResizeController`'s axis-generalized config. No "Primary activity mirror" shadow strip (not in the original design handoff, and may not even be needed once all six Dimensions are visible as full rows simultaneously). One instance is mounted per Dimension by [HorizontalTimelineStack](../horizontalTimelineStack/README.md), below a single shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md).

Unlike `Timeline`, this component does not own/create its own `<el-details-panel>` — see [HorizontalTimelineStack](../horizontalTimelineStack/README.md) for why (a shared panel, not one per row) and how (`panelActions` arrives as injected props, not self-registered).

Terminology (Dimension, Timeline, Entry) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline index="…">`

| Attribute | Purpose                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this row instance belongs to. |

## Store interaction

Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` on first mount if none exists yet, and `ADD_ENTRY`/`UPDATE_ENTRY`/`DELETE_ENTRY` via `createEntry`/`updateEntry`/`deleteEntry` (ported from `Timeline`, unchanged). Re-renders on every store update (not just a relevant one) and on a date change. Does **not** dispatch `SWITCH_DIMENSION`/`SHOW_PANEL` itself when an entry is opened — unlike `Timeline.onTimelineClick`, that's `HorizontalTimelineStack`'s job, reached via the injected `panelActions.openEntry`/`openNewEntry` (it needs to detect an actual dimension change first, to decide whether the shared panel needs a full rebuild).

## Behaviour notes

- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), same reasoning as [Timeline](../timeline/README.md): long labels can wrap via ordinary CSS, and the label's font-size can be set independently of the bar's geometry.
- **Zoom (Phase 10.5):** reads `horizontalZoomLevel` from the store on every update and recomputes its own `<svg>`'s `width`/`viewBox` plus every entry's `x`/`width` from `getEffectivePxPerMinute(zoomLevel)` (see [`horizontalTimelineAxis/zoomConstants.js`](../horizontalTimelineAxis/zoomConstants.js)) — keeping 1 viewBox unit = 1 CSS px at every zoom level, never relying on implicit viewBox-stretching. Entry label font-size stays a constant 14px regardless of zoom, satisfying the handoff note's "never below 14px" floor by simply never changing it.
- **Interactions (Phase 10.6):** long-press → reveal resize handles → drag → live-resize → commit/cancel via the same `EntryResizeController` (`src/components/timeline/entryResizeController.js`) `Timeline` uses, constructed here with its `X_AXIS` config (`x`/`width`/`cx` instead of `y`/`height`/`cy`) and a `getPxPerMinute` callback that reads the _current_ zoom level on every call (`Timeline`'s own is just a fixed constant, since the vertical timeline has no zoom). `clientXToSvgX` mirrors `Timeline.clientYToSvgY`, reading `.x` instead of `.y` off the transformed point. `calculateTheTimeSlotClicked` is zoom-aware for the same reason `getPxPerMinute` is.
- `getChildElementReferences()` looks up `#events`/`#gridline_zone`/`#drag-handles` via **attribute selectors** (`'[id="events"]'`), not ID selectors (`'#events'`) — up to six rows are mounted simultaneously, each cloning the same template, so these ids are duplicated across the document. Real browsers correctly scope a `#id` selector to the calling element's own subtree regardless of document-wide duplicates; jsdom (this project's test environment) doesn't — confirmed empirically while writing this phase's tests. Attribute selectors sidestep it, with identical results in real browsers.
- Reuses `MINUTES_PER_DAY`/`SVGNS`/`XHTMLNS` from [`timeline/timelineConstants.js`](../timeline/timelineConstants.js) directly, unchanged — the same native scale (`2px`/minute → `2880px`/day at zoom 1) as the vertical timeline, just rotated to the x-axis and scaled by the current zoom level.
- Its `.event-label` and `.resize-handle-*`/`.dragging-handle` styling is shared with (and defined by) [`timeline/timeline.css`](../timeline/timeline.css), imported directly here rather than assumed to already be loaded.

---

[← Back to root README](../../../README.md)
