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

See also: [Class Diagram](CLASS_DIAGRAM.md) — every class in `src/`, how they inherit from `TinyBase`, and how they're actually wired together (real object composition vs. rendered-as-a-custom-element dependency).

## `base.js`

Every custom element in this app extends `TinyBase`, a thin base class over `HTMLElement`:

```js
export class TinyBase extends HTMLElement {
  key;
  cleanupFns = [];

  registerCleanup(cleanupFn) { … }   // teardown for timers, subscriptions, listeners
  connectedCallback() { … }           // resolveProps(), then render()
  resolveProps() { … }                // reads `key`, resolves this.props (kept across a DOM move)
  getProps(key) { … }                 // looks up props stashed by a parent (see propsRegistry.js)
  getStore() { … }                    // returns the single app-wide store
  setProps(newProps, returnKey) { … } // stashes props for a not-yet-rendered child; this component owns the key
  releaseOwnedProps() { … }           // frees every key this component allocated
  disconnectedCallback() { … }        // releases owned props + runs registered cleanup fns
  render() { … }                      // overridden by every subclass; releases owned props first
}
```

It provides three things every component would otherwise reimplement:

1. **A `props` pattern for passing non-primitive data through HTML.** A parent building a template string can't embed an object, array, or function as an attribute value — only a string. `setProps(obj)` stashes the object in a module-level registry (`propsRegistry.js`) and returns a `key="…"` attribute string to embed in the template; the child looks itself up via `getProps(key)` once connected. See any component's `render()` method for the pattern in practice, e.g. [DetailsPanel](detailsPanel/README.md) passing callbacks to [ActivityPicker](activityPicker/README.md).
2. **Cleanup registration.** `registerCleanup(fn)` collects teardown functions (store unsubscribes, `clearInterval`, manually-added `document` listeners) that `disconnectedCallback` runs automatically, instead of every component hand-rolling its own `disconnectedCallback` override.
3. **Store access.** `getStore()` returns the single app-wide store singleton — see the [store README](../store/README.md).

`connectedCallback()`'s default implementation calls `resolveProps()` (read the `key` attribute, look `this.props` up in the registry) and then `render()`. A component with its own `connectedCallback` override should still call `super.connectedCallback()`, or at least `resolveProps()` (as `DialogWidget` does) — see almost any component in this folder for the pattern.

## `propsRegistry.js`

The module-level `Map` that `setProps`/`getProps`/`releaseAllOwnedBy` operate on. Each call to `setProps(owner, newProps, returnKey)`:

- Throws a `TypeError` unless `newProps` is a plain object (not an array or `null`).
- Stores a **copy** of `newProps` with every function value bound to `owner`, so a callback still has the right `this` no matter which component instance ends up invoking it (callbacks often get handed down two or three levels before they're called). The caller's object is never modified.
- Generates a key with `crypto.randomUUID()` and returns either the bare key (`returnKey: true`) or a ready-to-embed `key="…"` HTML attribute string (the default).

**Ownership.** The component that allocates a key owns it, and only the owner frees it:

| When                                          | What happens                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| the owner calls `render()` again              | everything it allocated is released first — the markup holding those keys is being replaced |
| the owner replaces markup outside `render()`  | it calls `this.releaseOwnedProps()` first (e.g. `ActivityPicker.renderAccordion()`)         |
| the owner disconnects                         | everything it allocated is released                                                         |
| a child disconnects                           | nothing — a child never deletes the key it was given                                        |
| a child is moved (disconnect, then reconnect) | it keeps the props it resolved on first connect                                             |

So markup built but never mounted is still freed, and a connected child keeps working after its key is released, because it holds its own reference to its props. `countProps()` reports the registry's size, for leak tests.

---

[← Back to root README](../../README.md)
