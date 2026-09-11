# Timeline (`el-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Timeline for the currently-viewed Diary day as an SVG time axis, with a block per recorded Entry. It's the main interactive surface of the diary: clicking empty space creates a new Entry, clicking an existing block opens it for editing, and long-pressing (or holding the mouse down on) an Entry reveals drag handles for resizing its start/end time in place. One instance is mounted per Dimension by [TimelineStack](../timelineStack/README.md).

Terminology (Dimension, Timeline, Entry, Primary activity mirror) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-timeline index="…">`

| Attribute | Purpose                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this Timeline instance belongs to. |

## Store interaction

- Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` (first mount), `ADD_ENTRY`, `UPDATE_ENTRY`, and `DELETE_ENTRY`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` to open/close [DetailsPanel](../detailsPanel/README.md).
- Non-Primary-activity Timelines additionally read the Primary activity Dimension's own Entries to render the read-only "mirror" strip alongside their own — see `renderShadowDimension()` (internal name "shadow"; the domain-facing term is "Primary activity mirror" — see [CONTEXT.md](../../../CONTEXT.md)).

## The long-press / drag-resize pipeline

This is the largest single piece of behaviour in the file — long-press detection, drag tracking and live visual feedback, clamping, and commit/cancel all currently live directly on the `Timeline` class (`onEntryPointerDown`, `startHandleDrag`, `updateDragToSvgY`, `commitDrag`/`cancelDrag`, `renderHandles`/`createHandle`, and related state fields like `activeDrag`/`activeHandleEntryId`).

> **In progress:** a branch exists (`refactor/timeline-class-refactor`) that pulls this whole pipeline out into its own `EntryResizeController` class, since by line count it's the single biggest concern mixed into `Timeline`. It hadn't landed on `main` as of this writing — check whether it has before assuming this section is still accurate, and update this README once it does.

Behaviour, regardless of which file it ends up living in:

- Long-press detection (hold ~500ms without moving far → reveal resize handles).
- Drag tracking and live visual feedback as a handle is dragged.
- Clamping a drag to: the 10-minute minimum duration, this Entry's immediate temporal neighbours (single-choice Dimensions only — multiple-choice Dimensions tolerate overlapping Entries), the Diary day's own bounds, and — only when editing the actual current Diary day — "now".
- Committing a completed drag as a single `UPDATE_ENTRY` dispatch, or reverting a cancelled one with no dispatch at all.

## Behaviour notes

- Click-to-create/click-to-open coordinate math goes through `clientYToSvgY()` (`getScreenCTM()`/`SVGPoint.matrixTransform()`), not `event.offsetY` — `offsetY` assumes 1 CSS pixel equals 1 SVG viewBox unit, which breaks whenever the SVG renders narrower than its viewBox (e.g. under certain zoom/accessibility text-scaling conditions), silently shrinking the whole coordinate system including the time axis. This was a real Chrome-only bug found on a physical Android device; see `timeline.test.js`'s regression test for the exact scenario.
- Touch-drag scroll interference (the resize handles fighting the scrollable [TimelineStack](../timelineStack/README.md)) is defended against twice: `touch-action: none` (CSS + a class toggled for the drag's duration) as the primary defense, and a non-passive `touchstart`/`touchmove` `preventDefault()` as a belt-and-braces fallback for browsers whose `touch-action` support on freshly-inserted SVG shape elements is a frame stale.
- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), so long labels can wrap across multiple lines via ordinary CSS.

---

[← Back to root README](../../../README.md)
