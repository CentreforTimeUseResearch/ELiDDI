# Horizontal Timeline Axis (`el-horizontal-timeline-axis`)

[← Back to root README](../../../README.md)

---

## What it does

The shared, rendered-once time axis — grid tick marks, hour labels, and the time-of-day gradient bar — that sits above all six [HorizontalTimeline](../horizontalTimeline/README.md) rows at the `≥1024px` desktop breakpoint, so this chrome isn't repeated per row. One instance is mounted by [HorizontalTimelineStack](../horizontalTimelineStack/README.md).

## Custom element

`<el-horizontal-timeline-axis>` — no attributes or props; one instance per stack.

## Store interaction

Reads `currentDate` to drive the live future-overlay (see below); doesn't read or write any Entry data.

## Behaviour notes

- Grid lines/hour labels are static markup baked directly into the `#svg-horizontal-timeline-axis` `<template>` in `index.html` (no JS renders them) — mirroring the vertical [Timeline](../timeline/README.md)'s own `#grid-lines`/`#hour-labels`. Colors and spacing were ported verbatim from the original design handoff's `timeline-horizontal.svg`, deliberately left unchanged from that reference since they're functional data-viz encoding, not decorative chrome.
- The one piece that does update live is the future-overlay (greys out now→end-of-day), axis-swapped (`x`/`width` instead of `y`/`height`) from `Timeline.updateFutureOverlay()` — refreshed on a `setInterval` (cleaned up via `registerCleanup`) and re-checked on a date change, hidden entirely when the viewed Diary date isn't the actual current day.
- Uses its own `horizontalTimeGradient` gradient id, distinct from the vertical template's `timeGradient`, since both templates' clones can be live in the document at once (one per breakpoint).

---

[← Back to root README](../../../README.md)
