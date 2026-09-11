# Time Picker (`el-time-picker`)

[← Back to root README](../../../README.md)

---

## What it does

A single accessible 24-hour time field (native `<input type="time">`, with a graceful text-input fallback for browsers that downgrade it), used twice inside [TimePickerPanel](../timePickerPanel/README.md) — once for an Entry's start time, once for its end time.

## Custom element

`<el-time-picker input-id="…" label="…" value="…" constrained required read-only>`

Attribute names are shared constants from `src/utils/validatedFormField.js` (`INPUT_ID_ATTR`, `LABEL_ATTR`, `VALUE_ATTR`) — the same helper module [DurationInput](../durationInput/README.md) uses.

| Attribute     | Purpose                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `input-id`    | Id/name for the inner `<input>`, and prefix for its hint/error ids.                  |
| `label`       | Field label text.                                                                    |
| `value`       | Current value, `HH:MM`.                                                              |
| `constrained` | When present, the field enforces a "can't be in the future" upper bound (see below). |
| `required`    | Marks the field as required, both natively and for the custom validation message.    |
| `read-only`   | Marks the native input readonly.                                                     |

## Props

| Prop                       | Type     | Purpose                                                                                                                                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `change(timeInHHMMFormat)` | function | Called on a valid change.                                                                                                                                                            |
| `getMaxTime()`             | function | Returns the current latest-allowed `HH:MM`, or `undefined` if no future-time constraint applies right now (e.g. editing a past diary day). Only consulted when `constrained` is set. |

## Behaviour notes

- Feature-detects whether the browser actually implements `type="time"` (some legacy browsers silently downgrade it to `type="text"`); if so, it adds a placeholder, `maxLength`, and keypress filtering to keep behaviour reasonable without native time-input UI.
- When `constrained`, re-checks `getMaxTime()` every 30 seconds (via `setInterval`, cleaned up through `TinyBase.registerCleanup`) so a field that was valid a minute ago doesn't stay silently valid once "now" catches up to it — relevant when editing the current diary day.
- Validation messages and error display go through the shared `showFieldError`/`clearFieldError` helpers in `src/utils/validatedFormField.js`.

---

[← Back to root README](../../../README.md)
