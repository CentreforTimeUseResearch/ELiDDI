# Keyboard Help (`el-keyboard-help`)

[← Back to root README](../../../README.md)

---

## What it does

The app's keyboard shortcuts as a list, in three groups: moving around a timeline, moving or resizing an entry, and switching Dimension and day. It is the content of the "Keyboard shortcuts" dialog that the [Navbar](../navbar/README.md)'s menu item opens (via [DynamicTimelineUI](../dynamicTimelineUI/README.md)'s `shortcuts-dialog`).

It is the app's own help, the same for every study. The _Instructions_ are the study's onboarding tour, written in the study's config, so shortcuts are not added there.

Terminology (Dimension, Entry) follows [CONTEXT.md](../../../CONTEXT.md).

## Custom element

`<el-keyboard-help>`: no attributes or props, and no store access. It renders static markup (nothing in it needs escaping): a `<dl>` per group, each key a `<kbd>`, alternatives joined with "or" and chords with "+".

## Behaviour notes

- It scrolls inside the dialog, so it has `tabindex="0"` and is a named `region`: a scrollable area with nothing focusable in it cannot be scrolled from the keyboard in every browser.
- The list is data (`GROUPS` in `keyboardHelp.js`) and has to be kept in step with what the Timelines do: [`TimelineKeyboard`](../timeline/timelineKeyboard.js) (arrows, Home/End, PageUp/PageDown, Enter, Space, grab mode) and the shortcut keys it passes to `BaseTimeline.onShortcut`.

---

[← Back to root README](../../../README.md)
