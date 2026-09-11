# Timeline Stack (`el-timeline-stack`)

[← Back to root README](../../../README.md)

---

## What it does

Mounts one [`<el-timeline>`](../timeline/README.md) per Dimension (six, in the current config) inside a horizontally-scrolling, scroll-snapping container, and keeps "which Dimension is current" in sync in both directions: scrolling the stack updates the store, and switching Dimension elsewhere (e.g. the [Timeline Picker](../timelinePicker/README.md)) scrolls the stack.

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-timeline-stack>` — no attributes or props.

## Store interaction

- Subscribes to `currentDimensionIndex` and scrolls itself to the matching child whenever it changes elsewhere.
- Dispatches `SWITCH_DIMENSION` in response to the browser's native `scrollsnapchange` event, when the Respondent scrolls the stack directly.

## Behaviour notes

- Relies on the (currently Chromium-only, per [caniuse](https://caniuse.com/?search=scrollsnapchange)) `scrollsnapchange` event and CSS scroll-snap for the scroll-driven Dimension switch — worth checking cross-browser support here before relying on this behaviour in a study.
- Test file naming: `timelineStack.te-st.js`, not currently run by Vitest (see the root README's note on `.te-st.js` vs `.test.js`).

---

[← Back to root README](../../../README.md)
