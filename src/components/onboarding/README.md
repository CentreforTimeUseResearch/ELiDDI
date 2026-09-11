# Onboarding (`el-onboarding`)

[← Back to root README](../../../README.md)

---

## What it does

Renders a guided-tour step, one at a time, from `GLOBALS.DATA.instructions` (see `config/config.json`). It's mounted inside an [`<el-dialog>`](../dialogWidget/README.md) by [DynamicTimelineUI](../dynamicTimelineUI/README.md), and can also spotlight a specific area of the screen or open a particular panel while a given step is showing.

## Custom element

`<el-onboarding>`

## Props

| Prop                        | Type     | Purpose                                                                                                      |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `moveSpotlight(x, y, size)` | function | Forwarded to the hosting DialogWidget's own `moveSpotlight` (see [DialogWidget](../dialogWidget/README.md)). |
| `moveModalTop(y)`           | function | Forwarded to the hosting DialogWidget's `moveModalTop`.                                                      |

## Store interaction

- Re-renders on every store change while `onboarding` is true (subscribes to the whole store, not a specific slice).
- Reads `onboardingStep` and `uipanel` to decide what to show and whether the step's config wants a particular panel open (`showPanel` in the instruction data) — dispatching `SHOW_PANEL`/`HIDE_PANEL` to match.
- Dispatches `NEXT_INSTRUCTION`/`PREVIOUS_INSTRUCTION` (Next/Back buttons) and `DISMISS_ONBOARDING` (Next on the final step).

## Behaviour notes

- Each instruction entry in the config can carry `title`, `text`, `spotlight` (an `[x, y, size]` triple), `modalTop`, and `showPanel` — see `config/config.json`'s `instructions` array (documented in `json_schema.md`).
- `onboardingStep` is clamped to `>= 0` on "back" but has no explicit upper clamp here — the last step's Next button dispatches `DISMISS_ONBOARDING` instead of `NEXT_INSTRUCTION`, so it never actually reads past the end of the array.

---

[← Back to root README](../../../README.md)
