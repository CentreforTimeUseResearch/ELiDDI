# ELiDDI UI design spec

Behavioural reference for the diary UI. Respondents already know Google Calendar (web), so ELiDDI borrows its **interaction behaviour** where that helps. This spec describes behaviour only. It does not copy Google's visual design, branding, assets or code. Visual tokens live in [`docs/agents/DESIGN.md`](../agents/DESIGN.md).

Use the terms in [`CONTEXT.md`](../../CONTEXT.md): Diary, Dimension, Timeline, Entry, Respondent.

**Read the relevant flow before any UI change** (also stated in `CLAUDE.md`).

## Flows

| Flow                                                  | Covers                                      |
| ----------------------------------------------------- | ------------------------------------------- |
| [Create entry](flows/create-entry.md)                 | Click or drag on empty time to add an Entry |
| [Edit entry](flows/edit-entry.md)                     | Open, change, save, delete an Entry         |
| [Move and resize](flows/move-resize.md)               | Drag a whole Entry or one edge              |
| [Navigate](flows/navigate.md)                         | Days, Dimensions, zoom                      |
| [Keyboard interaction](flows/keyboard-interaction.md) | Everything above without a pointer          |

Screenshots go in `screens/<flow>/`; each flow links placeholder images there.

## Layouts

Unchanged by this spec: on narrow screens each Dimension is a **vertical** Timeline (swipe or picker between them); from 1024px wide, all Dimensions are **horizontal** rows on one shared time axis. Every flow describes the gesture along "the time axis", whichever way it runs. One shared details panel is used in both layouts ([ADR 0005](../adr/0005-one-details-panel-in-every-layout.md)).

## Design principles

1. **Familiar first.** If Calendar does it one way and nothing in the diary forbids it, do it that way.
2. **Progressive enhancement.** Every flow works as a plain server-rendered form ([ADR 0004](../adr/0004-no-js-form-submission-format.md)). JavaScript adds gestures, never capabilities the form lacks.
3. **Human cognitive limits over raw efficiency.** Fewer choices on screen, immediate visible feedback, forgiving undo (Escape, cancel).
4. **Pointer, touch and keyboard are equals.** Each action has a path for each.
5. **Never lose a Respondent's data.** Cancelled or failed gestures leave the Diary unchanged.
6. **Snap to 10 minutes.** Pointer gestures snap to the 10-minute slot; the details panel allows exact entry in the same 10-minute steps.

## Where ELiDDI must DIVERGE from Google Calendar

| Calendar                                | ELiDDI                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedules the future                    | Records the **past**. Nothing can start or end after "now" on the current day; future dates cannot be opened.                                                   |
| Events float, gaps are normal           | The Primary timeline must be **contiguous** for the whole day by submission (`no-gaps-in-primary`). Gaps are allowed while editing but are shown as incomplete. |
| Events may overlap (side by side)       | **Single-choice** Dimensions never overlap. Only multiple-choice Dimensions (Who, Device) may overlap.                                                          |
| Resizing an event overlaps neighbours   | Resizing an edge **moves the neighbour's adjoining boundary**; a neighbour is never shrunk below 10 minutes or deleted.                                         |
| Moving onto another event overlaps it   | Moving a block **adjusts or is stopped by** neighbours; no overlap on single-choice Dimensions.                                                                 |
| Free minute-level times                 | Fixed 10-minute slots, minimum Entry of 10 minutes.                                                                                                             |
| Day runs midnight to midnight           | A Diary day runs from the **04:00 day boundary** ([ADR 0001](../adr/0001-day-boundary-not-midnight.md)).                                                        |
| Many calendars, colours chosen by user  | Fixed **Dimensions** from the study config; colours come from the Activity.                                                                                     |
| Title and free description              | An Entry is an **Activity** chosen from the study hierarchy (some Dimensions allow free text).                                                                  |
| Week, month, agenda views               | **One day at a time.** No multi-day views.                                                                                                                      |
| Recurrence, invites, reminders, sharing | None.                                                                                                                                                           |
| Needs JavaScript                        | Must work **without** JavaScript as a plain form.                                                                                                               |
| Delete/undo toasts                      | Submission status resets to in-progress on any change; completed Diaries are sent via the submission flow, not saved per edit.                                  |

## Decisions

- **Multi-entry changes use a batched dispatch, not a new action.** A move or resize that adjusts a neighbour dispatches the existing one-Entry `UPDATE_ENTRY` once per affected Entry, inside a single batch. The reducers and action set stay unchanged.
  - **Fold, then commit.** `batch` runs each action through the reducer in turn to build one next state, then assigns that state and notifies subscribers once. If any action throws, nothing is committed, so the store is never left half-applied and subscribers (UI, `localStorage` persistence, sync) never see an intermediate state with an overlap.
  - `src/store/store.js` has no batching today, so this needs a small, generic `batch` helper there. Nothing else about the store changes.
  - Before implementing, check how `src/sync/` and `src/store/persistence.js` consume the store: if sync reads individual actions rather than state snapshots, `batch` must hand it the whole batch.
- **Plain click creates a 30-minute block** (clamped to free space).
- **Conformance target is WCAG 2.2 AA.**

## Open questions for implementation

- None currently.
