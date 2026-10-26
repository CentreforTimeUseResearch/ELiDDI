# Store

[← Back to root README](../../README.md)

---

## Overview

ELiDDI's app-wide state lives in a single hand-rolled Redux-style store — see [CLAUDE.md](../../CLAUDE.md)'s "no runtime JS dependencies" rule: `dependencies` in `package.json` stays empty, so this is implemented directly rather than pulling in Redux (or any other library).

The shape mirrors the diary domain described in [CONTEXT.md](../../CONTEXT.md) — Diaries (keyed by date) each containing per-Dimension Timelines of Entries — plus a handful of transient UI-only slices for onboarding and panel visibility.

## Files in this folder

| File               | Role                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store.js`         | The generic, domain-agnostic `createStore`/`combineReducers` implementation — ELiDDI's own minimal stand-in for Redux's `createStore`/`combineReducers`. |
| `appStore.js`      | The single app-wide store _instance_ (a singleton via module import), seeded from and saved back to `localStorage` via `persistence.js`.                 |
| `eliddiReducer.js` | The actual domain reducer tree: onboarding state, current Dimension/date, and the nested Diaries → Timelines → Entries structure.                        |
| `actionTypes.js`   | Every action type string, as exported constants.                                                                                                         |
| `diaryStatus.js`   | `DIARY_STATUS` — the two Diary status values (`IN_PROGRESS: 0`, `COMPLETE: 100`).                                                                        |
| `persistence.js`   | How state is saved to and restored from `localStorage`: the saved format and its version, validation and migration on load, and when writes happen.      |

## `store.js`

```js
createStore(reducer, initialState); // -> { getState, dispatch, subscribe }
combineReducers(reducersObject); // -> a single reducer that delegates one state key per sub-reducer
```

A standard Redux-shaped store: `dispatch` runs the reducer and notifies every subscriber (no middleware, no memoized selectors — dispatch is a plain synchronous function call). `subscribe(listener)` returns an unsubscribe function, which is exactly the value every component passes to `TinyBase.registerCleanup()` (see the [components README](../components/README.md#basejs)) so store subscriptions get torn down when a component disconnects.

Notification rules, each relied on by components that tear each other down mid-dispatch (e.g. `DynamicTimelineUI.renderStack()` replacing every Timeline):

- A listener **unsubscribed during a dispatch** is not called for the rest of it.
- A listener **subscribed during a dispatch** is first called on the next one.
- A listener that **throws** is logged; the rest are still notified, and `dispatch` itself doesn't throw.
- `subscribe(nonFunction)` **throws** a `TypeError` at the call site.
- Each `subscribe` call is its own subscription, even for the same function; its unsubscribe removes only that one, and calling it twice is harmless.

## `appStore.js`

```js
const storage = getBrowserStorage();
export const appStore = createStore(eliddiReducer, storage && loadPersistedState(storage));
if (storage) persistStore(appStore, storage);
```

Every component gets this same instance via `TinyBase.getStore()` — there is exactly one store for the whole app, created once at module load. Without usable `localStorage` (blocked by browser settings, or under vitest, where Node's own method-less `localStorage` shadows jsdom's) the diary still works, but nothing survives a reload.

## `eliddiReducer.js`

Combines these top-level reducers:

| State key               | Shape                   | Handles                                                                                                                              |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding`            | `boolean`               | `RESET_ONBOARDING` (→ `true`), `DISMISS_ONBOARDING` (→ `false`)                                                                      |
| `onboardingStep`        | `number`                | `NEXT_INSTRUCTION`, `PREVIOUS_INSTRUCTION` (clamped at 0), `RESET_ONBOARDING`                                                        |
| `uipanel`               | `string \| undefined`   | `SHOW_PANEL` (→ `action.payload`, e.g. `'details'` or `'date'`), `HIDE_PANEL` (→ `undefined`) — only one panel can be open at a time |
| `currentDimensionIndex` | `number`                | `SWITCH_DIMENSION`, `RESET_DIMENSION_INDEX`                                                                                          |
| `currentDate`           | `string` (`YYYY-MM-DD`) | `SWITCH_DATE` — defaults to `getCurrentDiaryDateKey()`, which only matters before anything has ever been persisted                   |
| `diaries`               | `{ [date]: Diary }`     | see below                                                                                                                            |

A `Diary` is `{ timelines: Timeline[], status }`, where `Timeline` is one Dimension's array of `{ startOffsetMins, endOffsetMins, id, activity }` Entry objects, and `status` is a `DIARY_STATUS` value (`diaryStatus.js`) — always a number.

Entry `id`s are unique only within one date's Timeline (every date has an entry `0`), so anything holding an id must not carry it across a date switch — see `Timeline.dropSelectionFromPreviousDate`.

Nested reducers, innermost first:

- **`timeline`** — one Dimension's `Entry[]`, always addressed by `id`: `ADD_ENTRY` appends, `UPDATE_ENTRY` replaces the entry with the payload's `id` in place (and is a no-op if no entry has it), `DELETE_ENTRY` filters it out.
- **`dimensionTimelines`** — one Diary's array of six Timelines, indexed by `dimensionIndex`. Uses direct index assignment on a copied array rather than slice/splice, so results are correct regardless of which Dimension index is touched first.
- **`diary`** — combines `dimensionTimelines` with `diaryStatus` (`SET_COMPLETE` → `COMPLETE`, `RESET_STATUS` → `IN_PROGRESS`). `CLEAR_DIARY` empties every Timeline of one date's Diary and sets it in progress.
- **`diaries`** — the full `{ [date]: Diary }` map, keyed by the `date` in the action payload.

`startOffsetMins`/`endOffsetMins` are always relative to the config's Day boundary, not midnight — see [ADR-0001](../../docs/adr/0001-day-boundary-not-midnight.md) and [CONTEXT.md](../../CONTEXT.md)'s "Day boundary" entry.

## `actionTypes.js`

Every action type is exported as a named string constant and imported at both the dispatch call site and the reducer's `case` branch, rather than hand-typing the string in two places — a typo or rename in one spot used to silently desync from the other with no error, just a state update that quietly never happened.

## `persistence.js`

Saved under `localStorage['state']` as `{ version: STATE_VERSION, state }`, where `state` holds only the **allowlisted** `PERSISTED_KEYS`: `onboarding`, `onboardingStep`, `currentDate`, `diaries`. Every other slice is transient UI state; a newly added slice stays transient unless it's added to the list.

**Saving** (`persistStore`): writes once at startup, then after any dispatch that changed a persisted slice — UI-only dispatches never write. A burst of dispatches is coalesced into one write on the next microtask. A failed write (quota exceeded) is logged and retried on the next change.

**Loading** (`loadPersistedState`):

| Saved value                                  | Result                                                            |
| -------------------------------------------- | ----------------------------------------------------------------- |
| current version                              | restored                                                          |
| no `version` (written before #142)           | migrated: allowlisted keys restored                               |
| a key failing validation                     | that key dropped (its reducer default applies), the rest restored |
| corrupt JSON, unknown version, not an object | defaults                                                          |

Whenever anything is dropped, the raw saved value is first copied to `state.backup.<timestamp>` and a warning is logged — nothing a Respondent saved is ever silently destroyed. Validation checks what would crash the app (e.g. a Diary must have a `timelines` array, since every Timeline reads `diaries[date]?.timelines[i]`), not every oddity.

**Changing what's saved:** bump `STATE_VERSION` and teach `restoreBlob()` to migrate the previous version. There is no server copy of a Respondent's diary.

---

[← Back to root README](../../README.md)
