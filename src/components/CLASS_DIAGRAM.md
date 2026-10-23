# Class Diagram

[← Back to root README](../../README.md) · [← Back to Components](README.md)

---

Every class in `src/`. All Web Components extend [`TinyBase`](README.md#basejs) (itself extending the platform's `HTMLElement`); two plain helper classes — [`KeyboardGridNavigation`](activityPicker/README.md) and [`EntryResizeController`](timeline/README.md) — are not custom elements, just state machines constructed and owned by the component that needs them. `src/store/` and `src/utils/` are deliberately function/module-based, not classes (see the [store README](../store/README.md)) — the hand-rolled Redux clone in `store.js` and the props-passing registry in `propsRegistry.js` are the main reasons `TinyBase` can stay so small.

```mermaid
classDiagram
    direction TB

    class HTMLElement {
        <<platform>>
    }

    class TinyBase {
        <<abstract base>>
        #key
        #cleanupFns
        +registerCleanup(fn)
        +connectedCallback()
        +disconnectedCallback()
        +getProps(key)
        +getStore()
        +setProps(newProps, returnKey)
        +render()
    }

    class Accordion {
        <<el-accordion>>
        +handleClick(e)
        +createAccordionEntry(entry, section)
    }

    class ActivityPicker {
        <<el-activity-picker>>
        -gridNavigation : KeyboardGridNavigation
        +onActivitySelect(activity)
        +onActivityToggle(activity, isSelected)
        +renderAccordion(results, searchString)
    }

    class ContextualHelp {
        <<el-contextual-help>>
        +stateUpdate()
    }

    class DatePicker {
        <<el-date-picker>>
        +switchDate(dateKey)
    }

    class DetailsPanel {
        <<el-details-panel>>
        +openEntry(entry)
        +openNewEntry(startOffsetMins)
        +onSaveButtonClick()
        +onDeleteButtonClick()
    }

    class DialogWidget {
        <<el-dialog>>
        +open()
        +close()
        +moveSpotlight(x, y, size)
        +moveModalTop(y)
    }

    class DurationInput {
        <<el-duration-input>>
        +validate()
        +handleChange()
    }

    class DynamicTimelineUI {
        <<el-dynamic-timeline>>
        +onStoreUpdate()
        +renderStack()
    }

    class Navbar {
        <<el-nav-bar>>
        +updateDateIndicator()
    }

    class Onboarding {
        <<el-onboarding>>
        +onNextClick()
        +onBackClick()
    }

    class Timeline {
        <<el-timeline>>
        -resizeController : EntryResizeController
        +saveEntry(entry)
        +createEntry(entry)
        +updateEntry(entry)
        +deleteEntry(id)
        +onTimelineClick(e)
    }

    class HorizontalTimeline {
        <<el-horizontal-timeline>>
        -resizeController : EntryResizeController
        +renderEntries()
        +renderEntriesInto(args)
        +updateDimensions()
        +onTimelineClick(e)
        +saveEntry(entry)
        +createEntry(entry)
        +updateEntry(entry)
        +deleteEntry(id)
    }

    class HorizontalTimelineAxis {
        <<el-horizontal-timeline-axis>>
        +renderAxis()
        +renderGrid(effectivePxPerMinute)
        +updateFutureOverlay()
        +changeZoom(delta)
        +computeMinZoom()
    }

    class HorizontalTimelineStack {
        <<el-horizontal-timeline-stack>>
        -activeRow : HorizontalTimeline
        +activateRow(dimensionIndex)
        +openEntryForRow(dimensionIndex, entry)
        +openNewEntryForRow(dimensionIndex, startOffsetMins)
        +saveEntry(entry)
        +deleteEntry(id)
        +findNextEntryAfter(offsetMins)
    }

    class TimelinePicker {
        <<el-timeline-picker>>
        +switchDimension(payload)
    }

    class TimelineStack {
        <<el-timeline-stack>>
        +switchDimension(index)
        +scrollToTimeline()
    }

    class TimePicker {
        <<el-time-picker>>
        +validate()
        +updateTimeConstraints()
    }

    class TimePickerPanel {
        <<el-time-picker-panel>>
        +onTimeInputChange(fieldId, valueInMinutes)
        +recalculateDuration(startMins, endMins)
        +recalculateEndTime(startMins, durationMins)
    }

    class KeyboardGridNavigation {
        +handleKeyUp(evt)
        +handleKeyDown(evt)
    }

    class EntryResizeController {
        +activeHandleEntryId
        +activeDrag
        +onEntryPointerDown(e)
        +onEntryPointerMove(e)
        +startHandleDrag(e, handleGroup)
        +commitDrag()
        +cancelDrag()
        +showHandles(entry)
        +hideHandles()
    }

    %% inheritance
    HTMLElement <|-- TinyBase
    TinyBase <|-- Accordion
    TinyBase <|-- ActivityPicker
    TinyBase <|-- ContextualHelp
    TinyBase <|-- DatePicker
    TinyBase <|-- DetailsPanel
    TinyBase <|-- DialogWidget
    TinyBase <|-- DurationInput
    TinyBase <|-- DynamicTimelineUI
    TinyBase <|-- Navbar
    TinyBase <|-- Onboarding
    TinyBase <|-- Timeline
    TinyBase <|-- HorizontalTimeline
    TinyBase <|-- HorizontalTimelineAxis
    TinyBase <|-- HorizontalTimelineStack
    TinyBase <|-- TimelinePicker
    TinyBase <|-- TimelineStack
    TinyBase <|-- TimePicker
    TinyBase <|-- TimePickerPanel

    %% composition: constructs and owns a real object instance
    ActivityPicker *-- KeyboardGridNavigation : constructs in constructor()
    Timeline *-- EntryResizeController : constructs in connectedCallback(), axis = Y_AXIS
    HorizontalTimeline *-- EntryResizeController : constructs in connectedCallback(), axis = X_AXIS
    TimelineStack "1" *-- "many" Timeline : new Timeline() per Dimension

    %% dependency: renders as a child custom element + props-registry handshake
    %% (no direct object reference - see TinyBase.setProps/getProps)
    DynamicTimelineUI ..> Navbar : renders
    DynamicTimelineUI ..> TimelineStack : renders into #stack-container, when not isDesktopLayout
    DynamicTimelineUI ..> HorizontalTimelineStack : renders into #stack-container, when isDesktopLayout
    DynamicTimelineUI ..> DialogWidget : renders x2
    DynamicTimelineUI ..> Onboarding : renders (inside a dialog)
    DynamicTimelineUI ..> DatePicker : renders (inside a dialog)
    HorizontalTimelineStack ..> HorizontalTimelineAxis : renders
    HorizontalTimelineStack ..> HorizontalTimeline : renders x6, injects panelActions props
    HorizontalTimelineStack ..> DetailsPanel : renders, panelActions contract (one shared instance, not one per row)
    Navbar ..> TimelinePicker : renders
    Navbar ..> ContextualHelp : renders
    Timeline ..> DetailsPanel : renders, panelActions contract
    DetailsPanel ..> ActivityPicker : renders
    DetailsPanel ..> TimePickerPanel : renders
    TimePickerPanel ..> TimePicker : renders x2
    TimePickerPanel ..> DurationInput : renders
    ActivityPicker ..> Accordion : renders, via setProps
```

## Reading this diagram

- **`<|--` (inheritance)** — every Web Component genuinely `extends TinyBase extends HTMLElement`. This is the only relationship type that's a real JS prototype chain.
- **`*--` (composition)** — the owning class builds the other with `new X(...)` and holds a direct reference to it (`this.gridNavigation`, `this.resizeController`, or the N `Timeline` instances `TimelineStack.render()` creates in a loop). A real object relationship, not just markup.
- **`..>` (dependency)** — one component's `render()` emits another's custom-element tag as a string (e.g. `<el-activity-picker>`), optionally handing it data/callbacks through the [props registry](README.md#propsregistryjs) (`setProps`/`key`/`getProps`). There's no direct class reference here — the two components are coupled only through the tag name and whatever contract they agree on through props (see [DetailsPanel's `panelActions` contract](detailsPanel/README.md#the-panelactions-contract) for the clearest example of this deliberately loose coupling).

## What's deliberately left out

- **Test-only harness classes** — several `*.test.js` files declare a small local `class TestHarness extends TinyBase {}` (or `RegisterCleanupHarness`) purely so a test can call `setProps` on a component's behalf (see the test-naming note in the root [CLAUDE.md](../../CLAUDE.md), and `base.test.js`, `detailsPanel.test.js`, `dialogWidget.test.js`, `onboarding.test.js`, `timePicker.test.js`, `timePickerPanel.test.js`). These are test infrastructure, not part of the production architecture, so they're omitted here.
- **`src/store/`, `src/utils/`, `scripts/generate_no_js.js`** — none of these define a class; they're plain functions/modules. See the [store README](../store/README.md) for how state is actually shaped.

---

[← Back to root README](../../README.md) · [← Back to Components](README.md)
