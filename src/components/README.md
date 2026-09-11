# Components

[← Back to root README](../../README.md)

---

This folder holds every custom element in the app, one per subfolder, plus two shared files at this root level: `base.js` and `propsRegistry.js`, documented below.

Each component subfolder has its own `README.md`:

| Component                                        | Custom element           | Description                                                |
| ------------------------------------------------ | ------------------------ | ---------------------------------------------------------- |
| [accordion](accordion/README.md)                 | `<el-accordion>`         | Category/Activity list rendered inside a picker's popover. |
| [activityPicker](activityPicker/README.md)       | `<el-activity-picker>`   | Searchable Activity picker (ARIA combobox + grid).         |
| [contextualHelp](contextualHelp/README.md)       | `<el-contextual-help>`   | Help button (work in progress).                            |
| [datePicker](datePicker/README.md)               | `<el-date-picker>`       | Switches the currently-viewed Diary date.                  |
| [detailsPanel](detailsPanel/README.md)           | `<el-details-panel>`     | Create/edit panel for one Entry.                           |
| [dialogWidget](dialogWidget/README.md)           | `<el-dialog>`            | Generic native-`<dialog>` modal wrapper.                   |
| [durationInput](durationInput/README.md)         | `<el-duration-input>`    | Accessible hours + minutes duration field.                 |
| [dynamicTimelineUI](dynamicTimelineUI/README.md) | `<el-dynamic-timeline>`  | JS-layer root component.                                   |
| [navbar](navbar/README.md)                       | `<el-nav-bar>`           | Top navigation bar.                                        |
| [onboarding](onboarding/README.md)               | `<el-onboarding>`        | Guided-tour walkthrough steps.                             |
| [timeline](timeline/README.md)                   | `<el-timeline>`          | The SVG time axis, one per Dimension.                      |
| [timelinePicker](timelinePicker/README.md)       | `<el-timeline-picker>`   | Dropdown to switch the current Dimension.                  |
| [timelineStack](timelineStack/README.md)         | `<el-timeline-stack>`    | Horizontally-scrolling stack of all Timelines.             |
| [timePicker](timePicker/README.md)               | `<el-time-picker>`       | Single 24-hour time field.                                 |
| [timePickerPanel](timePickerPanel/README.md)     | `<el-time-picker-panel>` | Start/end/duration group for one Entry.                    |

## `base.js`

Every custom element in this app extends `TinyBase`, a thin base class over `HTMLElement`:

```js
export class TinyBase extends HTMLElement {
  key;
  cleanupFns = [];

  registerCleanup(cleanupFn) { … }   // teardown for timers, subscriptions, listeners
  connectedCallback() { … }           // reads `key`, resolves props, calls render()
  getProps(key) { … }                 // looks up props stashed by a parent (see propsRegistry.js)
  getStore() { … }                    // returns the single app-wide store
  setProps(newProps, returnKey) { … } // stashes props for a not-yet-rendered child
  disconnectedCallback() { … }        // cleans up props + registered cleanup fns
  render() { … }                      // overridden by every subclass
}
```

It provides three things every component would otherwise reimplement:

1. **A `props` pattern for passing non-primitive data through HTML.** A parent building a template string can't embed an object, array, or function as an attribute value — only a string. `setProps(obj)` stashes the object in a module-level registry (`propsRegistry.js`) and returns a `key = "…"` attribute string to embed in the template; the child looks itself up via `getProps(key)` once connected. See any component's `render()` method for the pattern in practice, e.g. [DetailsPanel](detailsPanel/README.md) passing callbacks to [ActivityPicker](activityPicker/README.md).
2. **Cleanup registration.** `registerCleanup(fn)` collects teardown functions (store unsubscribes, `clearInterval`, manually-added `document` listeners) that `disconnectedCallback` runs automatically, instead of every component hand-rolling its own `disconnectedCallback` override.
3. **Store access.** `getStore()` returns the single app-wide store singleton — see the [store README](../store/README.md).

`connectedCallback()`'s default implementation reads the element's `key` attribute, resolves `this.props` from the registry, and calls `render()`. A component with its own `connectedCallback` override should still call `super.connectedCallback()` (or replicate this sequence) to get props resolution — see almost any component in this folder for the pattern.

## `propsRegistry.js`

The module-level store `setProps`/`getProps`/`deleteProps` operate on. Each call to `setProps(owner, newProps, returnKey)`:

- Validates `newProps` is a plain object (not an array).
- Auto-binds any function values in it to `owner`, so a callback still has the right `this` no matter which component instance ends up invoking it (relevant since callbacks often get handed down through two or three more levels of component before they're called).
- Generates a UUID-ish key (`Date.now()` plus random base-36 characters), stores `newProps` under it, and returns either the bare key (`returnKey: true`, for a parent that wants to track the key itself) or a ready-to-embed `` `key = "…"` `` HTML attribute string (the default).

`TinyBase.disconnectedCallback()` calls `deleteProps(this.key)` automatically, so registry entries don't accumulate for elements that have been removed.

---

[← Back to root README](../../README.md)
