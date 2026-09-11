# Accordion (`el-accordion`)

[← Back to root README](../../../README.md)

---

## What it does

Renders a list of Categories as an expandable accordion, with a button for every Activity inside each Category. It's the list shown inside [ActivityPicker](../activityPicker/README.md)'s popover. Accordion has no search/filtering logic of its own — it renders whatever `content` (a filtered or unfiltered array of Categories) it's given, and reports clicks back up to its caller.

Terminology (Category, Activity) follows the project's domain glossary — see [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-accordion>`

## Attributes

| Attribute        | Purpose                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `dimensionindex` | Namespaces the generated `id`/`aria-controls` values so multiple Accordion instances on the page (one per open picker) don't collide. |

## Props

Passed via the [props registry](../README.md#propsregistryjs) (`setProps`/`key`), not HTML attributes:

| Prop                                   | Type         | Purpose                                                                                                                       |
| -------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `content`                              | `Category[]` | The Categories/Activities to render.                                                                                          |
| `multi`                                | `boolean`    | Multiple-choice Dimension mode: every Activity button renders as a toggle (`aria-pressed`) instead of a single-select action. |
| `selected`                             | `string[]`   | (multi mode only) Activity display names that should render as already-pressed.                                               |
| `activitySelect(activity)`             | function     | Called on click, single-choice mode.                                                                                          |
| `activityToggle(activity, isSelected)` | function     | Called on every toggle, multiple-choice mode.                                                                                 |

## Behaviour notes

- A click is classified by what was clicked: an element with a `data-activity` attribute is an Activity button (routes to `activitySelect` or the toggle handler); anything else is treated as a Category header click and toggles that section's `aria-expanded`/`hidden` state via the (non-standard but widely supported) `element.ariaControlsElements` property.
- Not connected to the app store — purely a function of its props, re-rendered by its parent whenever the result set changes.

---

[← Back to root README](../../../README.md)
