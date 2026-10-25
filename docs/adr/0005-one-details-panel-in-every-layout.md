# One details panel in every layout

**Status:** Accepted, 2026-10-25 (#151).

The app has one `<el-details-panel>`, in the mobile and desktop layouts alike. The stack that owns the Timelines retargets it to whichever Dimension is current. Before this, mobile mounted one panel per Dimension: each `Timeline` created its own inside its scrolling column, and each panel hid itself unless its Dimension was current. Desktop already had one, retargeted by `HorizontalTimelineStack.activateRow()`.

## Why

- **Duplicate ids go away by construction.** Six copies of every form id meant labels and `aria-*` references on mobile pointed at the first panel's fields (#151).
- **It's lighter.** In the spike (below), the panels' DOM went from **618 elements to 171** on mobile, with one set of store subscriptions and listeners instead of six.
- **There's one orchestration model.** Every Timeline has its `panelActions` injected by its stack, as `HorizontalTimeline` already does, instead of mobile Timelines creating and owning a panel.

## Decisions

1. **An unsaved draft is kept per Dimension, in both layouts.** Switching Dimension parks the draft (start, end, activity, and the Entry being edited, if any). Returning to that Dimension restores it. A draft ends when it's saved or deleted, or when the Diary date changes; collapsing the panel keeps it. Opening an Entry, or empty time, on a Dimension replaces that Dimension's parked draft. This keeps today's mobile behaviour, where each Dimension's own panel held its draft. Desktop changes: it used to discard the draft on a row change (`activateRow()` → `reset()`).
2. **A swipe with the panel open follows the swipe and stays open.** The panel switches to the new Dimension and shows that Dimension's draft, or an empty form. This is what mobile does today.
3. **The panel lives outside the scrolling Timelines,** as a sibling of the stack, and is styled to match the Timeline column it's acting on. Its heading names the current Dimension, so it's always clear which one the form is for.

## The spike

A throwaway prototype gave the mobile layout one shared panel, with the swipe policy switchable between `keep`, `discard` and `close`. It was deleted once the decision was implemented (PR #168). Measured in desktop Chrome with a real scroll-snap swipe:

|                                   | Today: 6 panels                      | `keep`   | `discard` | `close`             |
| --------------------------------- | ------------------------------------ | -------- | --------- | ------------------- |
| draft after swiping away and back | kept                                 | **kept** | lost      | lost (panel closed) |
| panel open after a swipe          | yes, the next Dimension's empty form | yes      | yes       | no                  |
| panel DOM elements                | 618                                  | 171      | 171       | 171                 |

**Retargeting** the panel (new Dimension attributes plus `reset()`, which rebuilds its `ActivityPicker`) took a median of **2.3 ms** and a maximum of 4.6 ms over 30 swaps. That was on a desktop machine without CPU throttling; it hasn't been measured on a low-end phone. If it proves noticeable there, `ActivityPicker` can re-read its Dimension when the attribute changes instead of being rebuilt.

**The prototype's layout is not the final one.** Placed after the scroller, the panel stretched across the full page width below the Timelines, so the real change needs its own CSS (decision 3).

## Consequences

- `Timeline` no longer renders a panel; both stacks inject `panelActions` and own the one panel, along with the parked drafts. The draft-keeping logic belongs in one place shared by both stacks, not two copies.
- `DetailsPanel` stops hiding itself by Dimension (the `isMyDimension` check in `onStoreUpdate`).
- `detailsPanel.css` moves from "sticky inside each column, mobile only" to working outside the scroller in both layouts.
- #151's remaining work is then the dangling references that exist in every layout: `TimePicker`'s label and `aria-describedby`, and `ActivityPicker`'s `aria-controls="ex1-grid"`. Its acceptance tests run against one panel serving all six Dimensions on both layouts.
