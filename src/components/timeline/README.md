# Timeline (`el-timeline`)

[← Back to root README](../../../README.md)

---

## What it does

Renders one Dimension's Timeline for the currently-viewed Diary day as an SVG time axis, with a block per recorded Entry. It's the main interactive surface of the diary: clicking empty space creates a new Entry, clicking an existing block opens it for editing, and long-pressing (or holding the mouse down on) an Entry reveals drag handles for resizing its start/end time in place. One instance is mounted per Dimension by [TimelineStack](../timelineStack/README.md).

Terminology (Dimension, Timeline, Entry, Primary activity mirror) follows [CONTEXT.md](../../../CONTEXT.md).

## Files in this folder

| File                       | Role                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timeline.js`              | The custom element itself: rendering Entries as SVG, click routing (open/create), the entries-vs-store CRUD (`createEntry`/`updateEntry`/`deleteEntry`/`saveEntry`), and the "Primary activity mirror" shadow layer.                                                                                         |
| `entryResizeController.js` | A plain (non-`HTMLElement`) `EntryResizeController` class that owns the long-press → reveal-handles → drag → live-resize → commit/cancel pipeline. Pulled out of `timeline.js` because it's almost entirely self-contained state (see below) and was, by line count, the single largest concern in the file. |
| `timelineConstants.js`     | Tiny shared constants (`SVGNS`, `XHTMLNS`, `PX_PER_MINUTE`, `MINUTES_PER_DAY`) used by both of the above, kept in their own module to avoid a circular import between them.                                                                                                                                  |

## Custom element

`<el-timeline index="…">`

| Attribute | Purpose                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `index`   | Which Dimension (`GLOBALS.DATA.timeline[index]`) this Timeline instance belongs to. |

## Store interaction

- Reads/writes this Dimension's Entry array for the current Diary date (`state.diaries[currentDate].timelines[dimensionIndex]`), dispatching `ADD_TIMELINE` (first mount), `ADD_ENTRY`, `UPDATE_ENTRY`, and `DELETE_ENTRY`.
- Dispatches `SHOW_PANEL`/`HIDE_PANEL` to open/close [DetailsPanel](../detailsPanel/README.md).
- Non-Primary-activity Timelines additionally read the Primary activity Dimension's own Entries to render the read-only "mirror" strip alongside their own — see `renderShadowDimension()` (internal name "shadow"; the domain-facing term is "Primary activity mirror" — see [CONTEXT.md](../../../CONTEXT.md)).

## Interaction pipeline (`entryResizeController.js`)

`EntryResizeController` is constructed by `Timeline.connectedCallback` with a small set of injected dependencies (the SVG element, the entries/handles layers, and callbacks for reading entries, checking single- vs multiple-choice Mode, checking whether the details panel is open, coordinate conversion, and committing a resize back to the store) rather than reaching into `Timeline` directly. It owns:

- Long-press detection (hold ~500ms without moving far → reveal resize handles).
- Drag tracking and live visual feedback as a handle is dragged.
- Clamping a drag to: the 10-minute minimum duration, this Entry's immediate temporal neighbours (single-choice Dimensions only — multiple-choice Dimensions tolerate overlapping Entries), the Diary day's own bounds, and — only when editing the actual current Diary day — "now".
- Committing a completed drag as a single `UPDATE_ENTRY` dispatch (via a callback into `Timeline`), or reverting a cancelled one with no dispatch at all.

`Timeline` keeps thin delegating methods (`onEntryPointerDown`, `onEntryPointerMove`, `commitDrag`, `cancelDrag`, `onGlobalKeyDown`, plus `activeDrag`/`activeHandleEntryId` getters) so this remains the single entry point external callers — and the test suite — use.

## Behaviour notes

- Click-to-create/click-to-open coordinate math goes through `clientYToSvgY()` (`getScreenCTM()`/`SVGPoint.matrixTransform()`), not `event.offsetY` — `offsetY` assumes 1 CSS pixel equals 1 SVG viewBox unit, which breaks whenever the SVG renders narrower than its viewBox (e.g. under certain zoom/accessibility text-scaling conditions), silently shrinking the whole coordinate system including the time axis. This was a real Chrome-only bug found on a physical Android device; see `timeline.test.js`'s regression test for the exact scenario.
- Touch-drag scroll interference (the resize handles fighting the scrollable [TimelineStack](../timelineStack/README.md)) is defended against twice: `touch-action: none` (CSS + a class toggled for the drag's duration) as the primary defense, and a non-passive `touchstart`/`touchmove` `preventDefault()` as a belt-and-braces fallback for browsers whose `touch-action` support on freshly-inserted SVG shape elements is a frame stale.
- Entry blocks are rendered as an SVG `<rect>` plus a `<foreignObject>` containing an HTML `<div>` label (not SVG `<text>`), so long labels can wrap across multiple lines via ordinary CSS.

---

[← Back to root README](../../../README.md)
