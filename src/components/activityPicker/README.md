# Activity Picker (`el-activity-picker`)

[← Back to root README](../../../README.md)

---

## What it does

The searchable Activity picker used inside [DetailsPanel](../detailsPanel/README.md) to choose the Activity (or Activities, for a multiple-choice Dimension) recorded on an Entry. It follows the [ARIA combobox/grid autocomplete pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): a text input opens a popover containing an [Accordion](../accordion/README.md) of Categories/Activities, filtered live as the Respondent types.

Terminology (Dimension, Category, Activity, Mode) follows [CONTEXT.md](../../../CONTEXT.md).

This folder contains two files:

- **`activityPicker.js`** — the custom element itself.
- **`keyboardGridNavigation.js`** — a plain (non-`HTMLElement`) `KeyboardGridNavigation` class that owns the arrow-key/Escape state machine for the grid, kept separate so it's testable without mounting a full custom element. It talks to its host only through a small callback interface (`updateResults`, `setActiveDescendant`, `clearInputDeferred`, `hideResults`) passed into its constructor.

## Custom element

`<el-activity-picker dimensionindex="…" heading="…" instruction="…">`

## Attributes

| Attribute        | Purpose                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dimensionindex` | Which Dimension (`GLOBALS.DATA.timeline[dimensionIndex]`) this picker's content, Mode, and free-text setting come from. Read once at construction, not reactive. |
| `heading`        | Label text shown above the input.                                                                                                                                |
| `instruction`    | Helper text shown alongside the input.                                                                                                                           |

## Props

| Prop                                         | Type     | Purpose                                                                           |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `onSetActivityOnSelectedEntry(activity)`     | function | Fired on single-choice selection.                                                 |
| `onSetActivitiesOnSelectedEntry(activities)` | function | Fired on every toggle in multiple-choice mode (popover stays open).               |
| `onFocusCallback()`                          | function | Fired when the input gains focus (DetailsPanel uses this to keep the panel open). |
| `onPopOverShowing(isPopoverShowing)`         | function | Currently a no-op hook, left in place for future styling needs.                   |

## Behaviour notes

- Uses the native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) (`popover="manual"`) rather than a custom overlay.
- If the Dimension's config sets `allow_free_text: true`, a "Use \"…\"" button appears above the results when the typed text doesn't match a known Activity, letting the Respondent record free text instead of picking from the list.
- In multiple-choice mode, a "Done" button closes the popover explicitly (there's no single click that both selects and closes, since selecting doesn't close the popover).
- `setSelectedActivities(activities)` is called by DetailsPanel when opening the panel for an existing multiple-choice Entry, so previously-selected Activities render as already-pressed.
- The keyboard grid-navigation state machine's row/column focus movement (`rowsCount`/`colsCount`/`focusCell`) is scaffolding for grid-cell keyboard focus that isn't wired up yet — see the comment at the top of `keyboardGridNavigation.js`. Arrow keys currently move internal state but don't yet move visible focus.

---

[← Back to root README](../../../README.md)
