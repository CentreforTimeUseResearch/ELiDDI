# Duration Input (`el-duration-input`)

[← Back to root README](../../../README.md)

---

## What it does

An accessible hours + minutes duration field, used inside [TimePickerPanel](../timePickerPanel/README.md) to let a Respondent set an Entry's length directly instead of typing an end time.

## Custom element

`<el-duration-input input-id="…" label="…" value="…">`

Attribute names are shared constants imported from `src/utils/validatedFormField.js` (`INPUT_ID_ATTR`, `LABEL_ATTR`, `VALUE_ATTR`) — the same helper module [TimePicker](../timePicker/README.md) uses, so both fields validate and render errors consistently.

| Attribute  | Purpose                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `input-id` | Prefix for the two inner input ids (`{id}-hours`, `{id}-minutes`) and the error/hint region ids. |
| `label`    | Fieldset legend text.                                                                            |
| `value`    | Total duration in minutes; split into hours/minutes for display.                                 |

## Props

| Prop                   | Type     | Purpose                                                                   |
| ---------------------- | -------- | ------------------------------------------------------------------------- |
| `change(totalMinutes)` | function | Called on a valid change, with hours/minutes combined into total minutes. |

## Behaviour notes

- Uses two `type="text" inputmode="numeric"` fields rather than native `type="number"` — the GOV.UK Design System pattern, chosen because native number-input spinner buttons and validation UI are inconsistently announced by screen readers.
- Digit-only entry is enforced twice: `keypress` blocks non-digit keys outright, and an `input` listener strips anything that still gets through (e.g. paste).
- Validates hours ≤ 23 and minutes ≤ 59 on `change`, showing an inline error via the shared `showFieldError`/`clearFieldError` helpers otherwise.

---

[← Back to root README](../../../README.md)
