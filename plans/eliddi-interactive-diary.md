# Plan: ELiDDI Interactive Timeline

> Source PRD: `prd/eliddi-interactive-diary.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Backend is optional, not required.** ELiDDI must remain fully functional as a 100% client-side/static-hosted app with no backend at all — this is the default and required baseline, not a fallback. In that mode, diary state is persisted only in the Respondent's `localStorage`, and final diary submission is always a POST (no-JS form POST, or its JS fetch/XHR equivalent) to the study's configured `general.primary_redirect_url` — never a server this repo hosts. A backend-enabled mode (server-side user accounts, so a Respondent's diary state syncs and survives a device switch/login — see [#111](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/111)) may be added later behind a config flag, but it must never be required for the no-backend path to keep working, and a one-click static deploy (e.g. GitHub Pages) must stay valid whenever that flag is off.
- **Entry schema**: an Entry is `{ id, startOffsetMins, endOffsetMins, activity }`. `activity` is a `string` for `single-choice` dimensions and a `string[]` for `multiple-choice` dimensions (introduced in Phase 3). Every later phase that reads or writes entries (coverage calculation, overlap validation, submission payload) is built against this shape.
- **State shape**: the `timelines` state slice moves from a flat per-dimension array to a date-keyed structure (`{ [dateKey]: { timelines: [...], status } }`) so each day's entries/status are independent (introduced in Phase 9). Full multi-day navigation/locking rules remain an open question per the PRD — only the data shape and basic day-switching are committed to here.
- **Component boundaries stay fixed.** `<dynamic-timeline>` remains the single root that replaces the no-JS form markup on connect, wrapping `<nav-bar>`, `<el-timeline-stack>`, `<el-dialog>`. All new behavior in this plan is added inside that existing tree — no new top-level custom elements.
- **No new runtime dependencies** (per CLAUDE.md). Validation, coverage calculation, color lookup, and submission logic are all hand-written vanilla JS/DOM.
- **Desktop vs. mobile layout is a mode switch**, not a separate implementation — same components, conditional rendering/CSS based on viewport.

---

## Phase 1: Color-coded activities everywhere

**User stories**: 3, 4, 5, 6

### What to build

Timeline entry rendering looks up the selected activity's configured `color` (walking category → activity → childItems in that dimension's config) and applies it as the SVG block's fill, replacing the current hardcoded gray fill. The activity picker already applies a color swatch and label for "coded"-flavor dimensions (Primary/Secondary activities, which have a `label` field), but is broken for "example"-flavor dimensions (Location/Who/Device/Enjoyment, which only have `name`) — fix it to use whichever field is actually present so every dimension shows a real label and a correct color swatch.

### Acceptance criteria

- [ ] Creating an entry in every one of the six dimensions renders a timeline block filled with that specific activity's configured color, not a single flat gray.
- [ ] The activity picker shows a real activity label (not "undefined") and a correct color swatch for every dimension, including Location/Who/Device/Enjoyment.
- [ ] Existing entries already in local storage still render correctly after this change (color is derived at render time, not stored, so no data migration is needed).

---

## Phase 2: Edit and delete entries

**User stories**: 9, 11, 12

### What to build

The entry details panel gains a Delete action alongside Save. Deleting removes the entry from its dimension's timeline, closes the panel, and re-renders the timeline. Confirm the existing edit path (tap an entry → prefilled details panel → Save) correctly round-trips all fields.

### Acceptance criteria

- [ ] Tapping an existing entry opens the details panel prefilled with its current start time, end time, and activity.
- [ ] Editing and saving updates the entry in place without creating a duplicate.
- [ ] Deleting an entry removes its block from the timeline and the entry from state; the panel closes afterward.
- [ ] Deleting an entry that no longer exists (e.g. double-tap) does not throw or corrupt state.

---

## Phase 3: Multiple-choice dimension support

**User stories**: 7, 8

### What to build

For dimensions configured as `multiple-choice` (Who, Device), the activity picker allows selecting more than one activity for the same entry instead of closing after the first tap. The Entry's `activity` field becomes a list of the selected activity names for these dimensions (per the schema decision above). The timeline renders one block per entry, with a combined, truncated label joining the selected activity names — not stacked sub-blocks.

### Acceptance criteria

- [ ] In a multiple-choice dimension, selecting more than one activity keeps the picker open until the respondent is done, and all selections are reflected in the saved entry.
- [ ] The timeline shows a single block per entry whose label lists the selected activities, with the full list available (e.g. via tooltip/expand) if it doesn't fit the block.
- [ ] Editing a multi-choice entry shows all previously selected activities as selected, not just one.
- [ ] Single-choice dimensions are unaffected — the picker still closes on first selection and `activity` stays a single string.

---

## Phase 4: Free-text activity entry

**User stories**: 15, 37

### What to build

For dimensions with `allow_free_text: true` in config, the picker's input accepts and saves typed text that doesn't match any listed activity, in addition to picking from the hierarchical list. Free-text entries still get a start/end time like any other entry; since they have no config-defined color, they render with a defined fallback color.

### Acceptance criteria

- [ ] In a dimension where `allow_free_text` is true, typing a value not present in the activity list and saving creates an entry with that free-text value.
- [ ] In a dimension where `allow_free_text` is false or absent, free text is not accepted as a valid save — the respondent must pick from the list.
- [ ] Free-text entries render on the timeline with a consistent fallback color and are editable/deletable like any other entry.

---

## Phase 5: Overlap validation for single-choice dimensions

**User stories**: 13, 14

### What to build

Before saving a new or edited entry in a single-choice dimension, its time span is checked against that dimension's other existing entries (excluding itself when editing). An overlap blocks the save and shows a descriptive error in the details panel instead of silently corrupting the timeline.

### Acceptance criteria

- [ ] Attempting to save an entry whose time span overlaps an existing entry in the same single-choice dimension is rejected with a visible, specific error message.
- [ ] Editing an entry's own time span (without introducing a new overlap) still saves successfully.
- [ ] Multiple-choice dimensions are unaffected by this check — overlapping entries remain allowed there.

---

## Phase 6: Coverage validation and submission gating

**User stories**: 20, 21, 30

### What to build

Per-dimension coverage is computed by summing entry durations for that dimension's current day and comparing it to the dimension's configured `min_coverage`. The respondent can see which dimensions (and roughly how much) are still short, and the final submit action is disabled/blocked until every dimension meets its threshold.

### Acceptance criteria

- [ ] Each dimension's current coverage status is visible to the respondent while filling in the diary.
- [ ] Attempting to submit while any dimension is under its `min_coverage` threshold is blocked, with a message identifying which dimension(s) are short.
- [ ] Once every dimension meets its threshold, submission is no longer blocked.
- [ ] A dimension with `min_coverage` of `0` (e.g. Enjoyment) never blocks submission regardless of how little is filled in.

---

## Phase 7: Real diary submission

**User stories**: 25, 32

### What to build

The no-JS form's `action` is generated from the study's `general.primary_redirect_url` instead of the current hardcoded `/`, so a plain form POST already works with JavaScript disabled. The JS layer intercepts the final submit action and performs the equivalent POST via fetch/XHR, showing inline success or failure feedback without a full page navigation. On failure, the respondent's data stays safely in local storage and the respondent can retry.

### Acceptance criteria

- [ ] With JavaScript disabled, completing the no-JS form and submitting POSTs to the study's configured `primary_redirect_url`.
- [ ] With JavaScript enabled, submitting the completed diary sends an equivalent POST via fetch/XHR and shows a success confirmation on a successful response.
- [ ] A failed submission (network error or non-2xx response) shows an error state and leaves the respondent's data intact in local storage, with a way to retry.
- [ ] Submission is only reachable once the Phase 6 coverage gate is satisfied.

---

## Phase 8: Reset with confirmation

**User stories**: 26, 27

### What to build

The navbar's Reset action, currently a no-op menu item, dispatches a full local reset (clearing all timelines, status, and day data across the whole diary) and re-triggers onboarding — but only after the respondent confirms via a dialog, since this is destructive and irreversible (all data is local-only).

### Acceptance criteria

- [ ] Selecting Reset shows a confirmation dialog before anything is cleared.
- [ ] Confirming the dialog clears all entries across every dimension and day, resets diary status, and re-shows onboarding.
- [ ] Dismissing/cancelling the confirmation dialog leaves all existing data untouched.

---

## Phase 9: Multi-day data model and navigation

**User stories**: 24

### What to build

The flat, single-day `timelines` state slice is replaced with the date-keyed structure defined above, so each day's entries and status are tracked independently. The navbar's existing "Change Date" entry point lets a respondent switch which day's diary they're currently viewing/editing. Full locking/assignment rules remain an open question per the PRD — this phase delivers the data shape and basic switching only.

### Acceptance criteria

- [ ] Entries created on one day do not appear on, or interfere with, another day's timeline.
- [ ] Switching days via the navbar loads that day's existing entries (if any) into the timeline view.
- [ ] Coverage validation (Phase 6) and submission (Phase 7) operate against the currently selected day's data.
- [ ] Existing single-day local storage data from before this change either migrates cleanly into the new date-keyed shape or is handled without crashing.

---

## Phase 10: Desktop horizontal layout

**User stories**: 17

### What to build

On wide viewports, all six dimensions' timelines render simultaneously as full-width horizontal rows instead of the current horizontal-scroll-snap single-dimension carousel. The existing vertical, one-dimension-at-a-time mobile layout is unchanged below the breakpoint.

### Acceptance criteria

- [ ] Above the desktop breakpoint, all six dimension timelines are visible at once without needing to switch between them.
- [ ] Below the breakpoint, the existing mobile behavior (one dimension at a time, swipe/snap to switch) is unaffected.
- [ ] Creating, editing, and deleting entries works identically in the desktop layout as in the mobile layout.
- [ ] Resizing the viewport across the breakpoint transitions between layouts without losing any in-progress entry data.
