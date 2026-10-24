# Timeline (`el-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Timeline for the currently-viewed Diary day as an SVG time axis, with a block per recorded Entry. It's the main interactive surface of the diary: clicking empty space creates a new Entry, clicking an existing block opens it for editing, and long-pressing (or holding the mouse down on) an Entry reveals drag handles for resizing its start/end time in place. One instance is mounted per Dimension by [TimelineStack](../timelineStack/README.md).

Terminology (Dimension, Timeline, Entry, Primary activity mirror) follows [CONTEXT.md](../../../CONTEXT.md).

## Files in this folder

| File                       | Role                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeline.js`              | The `el-timeline` element: the vertical layout, the Primary activity mirror ("shadow") strip, the future overlay, and its own `<el-details-panel>`.                                                                                                                                                                                |
| `baseTimeline.js`          | `BaseTimeline`, which both `Timeline` and [HorizontalTimeline](../horizontalTimeline/README.md) extend: reading Entries from the store, click routing (open/create), coordinate conversion, resize-controller wiring, and save/delete orchestration. See [ADR 0003](../../../docs/adr/0003-one-timeline-base-for-both-layouts.md). |
| `entryCommands.js`         | A plain `EntryCommands` class with no DOM: Entry CRUD against the store (`create`/`update`/`remove`), id allocation, and overlap validation (`findConflict`), tested without mounting an element.                                                                                                                                  |
| `entryBlocks.js`           | `renderEntryBlocks()`: draws one SVG block plus wrapping label per Entry, given a per-layout placement function.                                                                                                                                                                                                                   |
| `entryResizeController.js` | A plain (non-`HTMLElement`) `EntryResizeController` class that owns the long-press → reveal-handles → drag → live-resize → commit/cancel pipeline. Pulled out of `timeline.js` because it's almost entirely self-contained state (see below) and was, by line count, the single largest concern in the file.                       |
| `timelineConstants.js`     | Tiny shared constants (`SVGNS`, `XHTMLNS`, `PX_PER_MINUTE`, `MINUTES_PER_DAY`), kept in their own module to avoid circular imports.                                                                                                                                                                                                |

## Custom element

`<el-timeline index="…">`

| Attribute | Purpose                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this Timeline instance belongs to. |

## Store interaction

- Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` (first mount), `ADD_ENTRY`, `UPDATE_ENTRY`, and `DELETE_ENTRY`. Saving a brand-new Entry (not an edit) also immediately reveals its resize handles, as if it had just been long-pressed — see `BaseTimeline.saveEntry()`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` to open/close [DetailsPanel](../detailsPanel/README.md).
- Non-Primary-activity Timelines additionally read the Primary activity Dimension's own Entries to render the read-only "mirror" strip alongside their own — see `renderShadowDimension()` (internal name "shadow"; the domain-facing term is "Primary activity mirror" — see [CONTEXT.md](../../../CONTEXT.md)).

## Interaction pipeline (`entryResizeController.js`)

`EntryResizeController` is constructed by `BaseTimeline.createResizeController()` with a small set of injected dependencies (the SVG element, the entries/handles layers, and callbacks for reading entries, checking single- vs multiple-choice Mode, checking whether the details panel is open, coordinate conversion, and committing a resize back to the store) rather than reaching into `Timeline` directly. Since Phase 10.6, it's also used by [HorizontalTimeline](../horizontalTimeline/README.md), generalized via an injected `axis` config (`Y_AXIS`/`X_AXIS`, exported from this file — which SVG attributes carry "position along the timeline" vs "fixed cross-axis center": `y`/`height`/`cy` for vertical, `x`/`width`/`cx` for horizontal) and an injected `getPxPerMinute()` callback rather than a hardcoded constant (each subclass's `getPxPerMinute()`: `Timeline`'s is just `PX_PER_MINUTE`; `HorizontalTimeline`'s reads the current zoom level on every call, since only the horizontal view zooms). Everything else in the controller already operated purely in minutes, not pixels, so needed no changes at all for this. It owns:

- Long-press detection (hold ~500ms without moving far → reveal resize handles).
- Drag tracking and live visual feedback as a handle is dragged.
- Clamping a drag to: the 10-minute minimum duration, this Entry's immediate temporal neighbours (single-choice Dimensions only — multiple-choice Dimensions tolerate overlapping Entries), the Diary day's own bounds, and — only when editing the actual current Diary day — "now".
- Committing a completed drag as a single `UPDATE_ENTRY` dispatch (via a callback into `Timeline`), or reverting a cancelled one with no dispatch at all.

`BaseTimeline` keeps thin delegating methods (`onEntryPointerDown`, `onEntryPointerMove`, `commitDrag`, `cancelDrag`, `onGlobalKeyDown`, plus `activeDrag`/`activeHandleEntryId` getters) so this remains the single entry point external callers — and the test suite — use.

## Behaviour notes

- Click-to-create/click-to-open coordinate math goes through `BaseTimeline.clientToSvgCoord()` (`getScreenCTM()`/`SVGPoint.matrixTransform()`), not `event.offsetY` — `offsetY` assumes 1 CSS pixel equals 1 SVG viewBox unit, which breaks whenever the SVG renders narrower than its viewBox (e.g. under certain zoom/accessibility text-scaling conditions), silently shrinking the whole coordinate system including the time axis. This was a real Chrome-only bug found on a physical Android device; see `timeline.test.js`'s regression test for the exact scenario.
- Touch-drag scroll interference (the resize handles fighting the scrollable [TimelineStack](../timelineStack/README.md)) is defended against twice: `touch-action: none` (CSS + a class toggled for the drag's duration) as the primary defense, and a non-passive `touchstart`/`touchmove` `preventDefault()` as a belt-and-braces fallback for browsers whose `touch-action` support on freshly-inserted SVG shape elements is a frame stale.
- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), so long labels can wrap across multiple lines via ordinary CSS.

---

[← Back to root README](../../../README.md)
