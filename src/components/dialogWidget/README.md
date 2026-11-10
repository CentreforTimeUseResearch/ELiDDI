# Dialog Widget (`el-dialog`)

[← Back to root README](../../../README.md)

---

## What it does

A generic, reusable modal wrapper around the native [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) element (`showModal()`/`close()`). It's content-agnostic — a parent supplies arbitrary HTML via a prop — and is currently used for both the onboarding walkthrough and the date-picker modal (see [DynamicTimelineUI](../dynamicTimelineUI/README.md)).

## Custom element

`<el-dialog id="…">`

## Attributes

| Attribute | Purpose                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | Element id (also `text`/`position`/`backdrop` are declared as observed attributes but not currently read anywhere in the render logic). |

## Props

| Prop                             | Type        | Purpose                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`                        | HTML string | Rendered inside the dialog body.                                                                                                                                                                                                                                                                                                                        |
| `closeLabel`                     | string      | Text for the close button (defaults to `"close"`).                                                                                                                                                                                                                                                                                                      |
| `dismissible`                    | boolean     | `false` makes a dialog the Respondent must act on rather than skip (the [login](../login/README.md)): no close button, and Escape does nothing. Defaults to dismissible.                                                                                                                                                                                |
| `onRequestClose()`               | function    | Called instead of `close()` when the close button is clicked, if provided — lets a parent intercept the close (e.g. to dispatch a store action) rather than the dialog just closing itself.                                                                                                                                                             |
| `registerDialogActions(actions)` | function    | Called once, synchronously, during `connectedCallback` (before the dialog's own `render()`), handing the parent `{ open, close, moveSpotlight, moveModalTop }` so it can drive the dialog externally. Registered before rendering specifically so nested content (e.g. Onboarding) can call `moveSpotlight`/`moveModalTop` during its own first render. |

## Behaviour notes

- `moveSpotlight(x, y, size)` and `moveModalTop(y)` set CSS custom properties (`--spotlight1-x`, `--spotlight1-y`, `--spotlight-size`, `--modal-y-pos`) rather than touching layout directly — see `dialogWidget.css` for how [Onboarding](../onboarding/README.md)'s spotlight effect consumes them.
- **Focus goes back** to what had it when the dialog opened, once it closes (by its button, Escape, or its owner), e.g. the date button after the date dialog. Browsers do this for a native `<dialog>` themselves, but not all, and not when the opener was a button pressed with the mouse in Safari. The store tells a dialog to open on every update, so only the first `open()` of a run records the opener, and only a `close()` of a dialog that was open returns focus (once). Nothing is done if the opener has gone, or nothing had focus.
- `content` is trusted markup: it is injected as a raw HTML string (`this.props.content`) and DialogWidget does not escape or sanitize it. Sanitizing here would strip the deliberate HTML in [Onboarding](../onboarding/README.md)'s study-config step text (e.g. `<strong>`). Today's callers pass static markup or that config text. A caller building `content` from any dynamic or Respondent-entered data must run it through `escapeHtml` from `src/utils/html.js` first.

---

[← Back to root README](../../../README.md)
