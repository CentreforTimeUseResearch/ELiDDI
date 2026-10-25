# Horizontal Timeline Stack (`el-horizontal-timeline-stack`)

[← Back to root README](../../../README.md)

---

## What it does

Mounts the shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md), one [HorizontalTimeline](../horizontalTimeline/README.md) per Dimension (six, in the current config), and a single shared [`<el-details-panel>`](../detailsPanel/README.md), under a single horizontally-scrolling region — the `≥1024px` desktop counterpart to [TimelineStack](../timelineStack/README.md)'s swipe-snapped mobile/tablet pages. [DynamicTimelineUI](../dynamicTimelineUI/README.md) mounts this instead of `<el-timeline-stack>` when `isDesktopLayout` is true (see its own README for the breakpoint-driven swap).

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline-stack>` — no attributes or props.

## Store interaction

- `SWITCH_DIMENSION`/`SHOW_PANEL`, dispatched by its `DetailsPanelCoordinator` whenever a row opens an entry, and follows `currentDimensionIndex`/`currentDate` through it (see below).
- Otherwise none directly — each mounted child ([HorizontalTimelineAxis](../horizontalTimelineAxis/README.md), [HorizontalTimeline](../horizontalTimeline/README.md)) already owns its own store wiring for its own concerns (zoom, entry CRUD).

## Behaviour notes (the details panel)

This component mounts the app's one details panel (ADR 0005) through a `DetailsPanelCoordinator` (`src/components/detailsPanel/detailsPanelCoordinator.js`), the same one [TimelineStack](../timelineStack/README.md) uses on mobile. See the [DetailsPanel README](../detailsPanel/README.md) for what it does: each row is injected with its `panelActions`, the panel is retargeted (new `dimensionindex`/`heading`/`instruction` plus a `reset()`, since `ActivityPicker` reads its Dimension once at construction) only on an actual Dimension change, and an unsaved draft is kept per Dimension. `openEntryForRow`/`openNewEntryForRow` and `saveEntry`/`deleteEntry`/`findNextEntryAfter` remain on this element, delegating to the coordinator.

The panel's CSS position (`horizontalTimelineStack.css`) is a **right-docked** overlay (Phase 10.7): `position: fixed`, full height below `<nav>`, off-screen by default (`right: -416px`) and sliding in to `right: 0` when `.active`, overlaying the row stack rather than reflowing its width. The override selector's specificity has to include `.active` to beat `detailsPanel.css`'s own `el-details-panel.active { height: 36rem }` rule — see the CSS comment for the full reasoning.

## Behaviour notes (layout)

- The axis and every row set their own `<svg>` `width`/`viewBox` (and, critically, their own _host element's_ CSS `width`) to match the current zoom level (Phase 10.5) — see [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md)'s README for why the host's own width matters, not just the svg's. `overflow-x: auto` on this component is the single scrollbar that pans the axis and all six rows together in lockstep.
- No scroll-to/highlight-the-matching-row behavior yet when a Dimension is picked from the sidebar - deferred until there's an actual visual design for an "active" row, since none exists anywhere in the app yet.

---

[← Back to root README](../../../README.md)
