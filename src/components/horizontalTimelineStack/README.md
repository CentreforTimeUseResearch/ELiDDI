# Horizontal Timeline Stack (`el-horizontal-timeline-stack`)

[← Back to root README](../../../README.md)

---

## What it does

Mounts the shared [HorizontalTimelineAxis](../horizontalTimelineAxis/README.md) followed by one [HorizontalTimeline](../horizontalTimeline/README.md) per Dimension (six, in the current config), under a single horizontally-scrolling region — the `≥1024px` desktop counterpart to [TimelineStack](../timelineStack/README.md)'s swipe-snapped mobile/tablet pages. [DynamicTimelineUI](../dynamicTimelineUI/README.md) mounts this instead of `<el-timeline-stack>` when `isDesktopLayout` is true (see its own README for the breakpoint-driven swap).

Terminology (Dimension, Timeline) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-horizontal-timeline-stack>` — no attributes or props.

## Store interaction

None directly — each mounted child ([HorizontalTimelineAxis](../horizontalTimelineAxis/README.md), [HorizontalTimeline](../horizontalTimeline/README.md)) already owns its own store wiring.

## Behaviour notes

- The axis and every row render their SVG at a fixed, native pixel width (`2880px` — `MINUTES_PER_DAY * PX_PER_MINUTE`) rather than auto-scaling to fit the container; `overflow-x: auto` on the host is the single scrollbar that pans the axis and all six rows together in lockstep, keeping them time-aligned. This stays fixed-scale until Phase 10.5 (zoom) exists to manage scale deliberately.
- No scroll-to/highlight-the-matching-row behavior yet when a Dimension is picked from the sidebar — deferred until there's an actual visual design for an "active" row, since none exists anywhere in the app yet.

---

[← Back to root README](../../../README.md)
