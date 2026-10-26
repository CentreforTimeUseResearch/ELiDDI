# Timeline Stack (`el-timeline-stack`)

[← Back to root README](../../../README.md)

---

## What it does

Mounts one [`<el-timeline>`](../timeline/README.md) per Dimension (six, in the current config) inside a horizontally-scrolling, scroll-snapping strip (`.timeline-scroller`), with the app's one [details panel](../detailsPanel/README.md) below it, outside the strip (ADR 0005), and keeps "which Dimension is current" in sync in both directions: swiping the strip updates the store, and switching Dimension elsewhere (e.g. the [Timeline Picker](../timelinePicker/README.md)) scrolls the strip. The panel is routed to the current Dimension's Timeline by a `DetailsPanelCoordinator`, the same one [HorizontalTimelineStack](../horizontalTimelineStack/README.md) uses on desktop.

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-timeline-stack>` — no attributes or props.

## Store interaction

- Subscribes to `currentDimensionIndex` and scrolls the strip to the matching Timeline whenever it changes elsewhere; passes the same updates to its `DetailsPanelCoordinator`, which retargets the panel.
- Dispatches `SWITCH_DIMENSION` in response to the browser's native `scrollsnapchange` event on the strip, when the Respondent swipes it. In browsers without that event it falls back to the strip's `scroll` event: once scrolling has paused for 100ms, the Timeline the strip settled on (`scrollLeft` ÷ one Timeline's width, rounded) becomes the current Dimension.

## Behaviour notes

- `scrollsnapchange` is Chromium-only (per [caniuse](https://caniuse.com/?search=scrollsnapchange)), so the strip feature-detects it (`'onscrollsnapchange' in window`) and uses the debounced `scroll` fallback elsewhere. Both paths rely on CSS scroll-snap for the visual snapping, and both end in `switchDimension`, which ignores the current Dimension.
- Tested in `timelineStack.test.js`, and with the shared panel in `detailsPanel/oneDetailsPanel.test.js`.

---

[← Back to root README](../../../README.md)
