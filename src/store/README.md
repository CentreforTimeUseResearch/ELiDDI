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
| `appStore.js`      | The single app-wide store _instance_ (a singleton via module import), seeded from `localStorage` and re-persisted on every dispatch.                     |
| `eliddiReducer.js` | The actual domain reducer tree: onboarding state, current Dimension/date, and the nested Diaries → Timelines → Entries structure.                        |
| `actionTypes.js`   | Every action type string, as exported constants.                                                                                                         |
| `localStorage.js`  | Thin `localStorage` read/write helpers with error handling (quota exceeded, corrupt JSON).                                                               |

## `store.js`

```js
createStore(reducer, initialState); // -> { getState, dispatch, subscribe }
combineReducers(reducersObject); // -> a single reducer that delegates one state key per sub-reducer
```

A standard Redux-shaped store: `dispatch` runs the reducer and notifies every subscriber (no middleware, no memoized selectors — dispatch is a plain synchronous function call). `subscribe(listener)` returns an unsubscribe function, which is exactly the value every component passes to `TinyBase.registerCleanup()` (see the [components README](../components/README.md#basejs)) so store subscriptions get torn down when a component disconnects.

## `appStore.js`

```js
export const appStore = createStore(eliddiReducer, localStoreLoad());

appStore.subscribe(() => {
  localStoreSave({ ...appStore.getState(), uipanel: undefined, currentDimensionIndex: undefined });
});
```

Every component gets this same instance via `TinyBase.getStore()` — there is exactly one store for the whole app, created once at module load. On every dispatch, the entire state is re-persisted to `localStorage`, _except_ `uipanel` and `currentDimensionIndex` — both are transient UI state (which panel is open, which Dimension tab is active) that shouldn't survive a page reload as if it were diary data.

> The `console.log(appStore.getState())` inside the subscribe callback is a deliberate, currently-retained debug aid, not leftover cruft — leave it in unless you're already editing this file for another reason.

## `eliddiReducer.js`

Combines these top-level reducers:

| State key               | Shape                   | Handles                                                                                                                               |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding`            | `boolean`               | `RESET_ONBOARDING` (→ `true`), `DISMISS_ONBOARDING` (→ `false`)                                                                       |
| `onboardingStep`        | `number`                | `NEXT_INSTRUCTION`, `PREVIOUS_INSTRUCTION` (clamped at 0), `RESET_ONBOARDING`                                                         |
| `uipanel`               | `string \| undefined`   | `SHOW_PANEL` (→ `action.payload`, e.g. `'activity'` or `'date'`), `HIDE_PANEL` (→ `undefined`) — only one panel can be open at a time |
| `currentDimensionIndex` | `number`                | `SWITCH_DIMENSION`, `RESET_DIMENSION_INDEX`                                                                                           |
| `currentDate`           | `string` (`YYYY-MM-DD`) | `SWITCH_DATE` — defaults to `getCurrentDiaryDateKey()`, which only matters before anything has ever been persisted                    |
| `diaries`               | `{ [date]: Diary }`     | see below                                                                                                                             |

A `Diary` is `{ timelines: Timeline[], status }`, where `Timeline` is one Dimension's array of `{ startOffsetMins, endOffsetMins, id, activity }` Entry objects.

Nested reducers, innermost first:

- **`timeline`** — one Dimension's `Entry[]`: `ADD_ENTRY` appends, `UPDATE_ENTRY` replaces by array `index` (passed in the action payload, not looked up here), `DELETE_ENTRY` filters by `id`.
- **`dimensionTimelines`** — one Diary's array of six Timelines, indexed by `dimensionIndex`. Uses direct index assignment on a copied array rather than slice/splice, so results are correct regardless of which Dimension index is touched first.
- **`diary`** — combines `dimensionTimelines` with `diaryStatus` (`SET_STATUS`/`RESET_STATUS`/`SET_COMPLETE`).
- **`diaries`** — the full `{ [date]: Diary }` map, keyed by the `date` in the action payload.

`startOffsetMins`/`endOffsetMins` are always relative to the config's Day boundary, not midnight — see [ADR-0001](../../docs/adr/0001-day-boundary-not-midnight.md) and [CONTEXT.md](../../CONTEXT.md)'s "Day boundary" entry.

## `actionTypes.js`

Every action type is exported as a named string constant and imported at both the dispatch call site and the reducer's `case` branch, rather than hand-typing the string in two places — a typo or rename in one spot used to silently desync from the other with no error, just a state update that quietly never happened.

## `localStorage.js`

`localStoreSave(obj, key = 'state')` / `localStoreLoad(key = 'state')` — JSON-serialize/parse against `localStorage`, catching and logging (rather than throwing on) quota-exceeded and corrupt-JSON errors so a storage failure degrades gracefully instead of crashing the app.

---

[← Back to root README](../../README.md)
