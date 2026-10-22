# Horizontal Timeline (`el-horizontal-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Entries for the currently-viewed Diary day as a horizontal row of SVG blocks on the x-axis — the `≥1024px` desktop counterpart to [Timeline](../timeline/README.md)'s vertical column, axis-swapped (`x`/`width` instead of `y`/`height`). Rendering only for now: no click-to-add/select, no drag-to-resize, no zoom, and no "Primary activity mirror" shadow strip (not in the original design handoff, and may not even be needed once all six Dimensions are visible as full rows simultaneously). One instance is mounted per Dimension by [HorizontalTimelineStack](../horizontalTimelineStack/README.md), below a single shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md).

Terminology (Dimension, Timeline, Entry) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline index="…">`

| Attribute | Purpose                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this row instance belongs to. |

## Store interaction

Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` on first mount if none exists yet. Re-renders on every store update (not just a relevant one) and on a date change, since there's no interaction loop of its own yet to otherwise trigger a re-render after an edit made elsewhere (e.g. the vertical [Timeline](../timeline/README.md) on a smaller breakpoint).

## Behaviour notes

- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), same reasoning as [Timeline](../timeline/README.md): long labels can wrap via ordinary CSS, and the label's font-size can be set independently of the bar's geometry — directly relevant to the handoff note that time-slot/entry labels must never render below 14px even once zoom (Phase 10.5) exists.
- Reuses `PX_PER_MINUTE`/`MINUTES_PER_DAY`/`SVGNS`/`XHTMLNS` from [`timeline/timelineConstants.js`](../timeline/timelineConstants.js) directly, unchanged — the same scale (`2px`/minute → `2880px`/day) as the vertical timeline, just rotated to the x-axis.
- Its `.event-label` styling is shared with (and defined by) [`timeline/timeline.css`](../timeline/timeline.css), imported directly here rather than assumed to already be loaded.

---

[← Back to root README](../../../README.md)
