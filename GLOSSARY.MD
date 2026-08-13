# Glossary

The ubiquitous language for ELiDDI's diary domain. Use these terms consistently in code, commit messages, issues, and conversation — if a concept here doesn't match what the code calls it, that's a naming issue worth fixing rather than a discrepancy to write around.

---

### Activity

A single thing a Respondent can record against a Dimension for a span of time (e.g. "sleeping", "washing, dressing"). Defined in `config/activities.json` under a Category, with a `name` and `color`, and optionally further broken down into Child items. An Activity is a *choice*, not a record of it happening — the record is an Entry.

### Category

A named grouping of Activities within one Dimension (e.g. "Personal" grouping "sleeping", "resting", "washing, dressing"). Purely organisational — it groups choices in the picker UI, it isn't itself selectable or recorded.

### Child item

A sub-Activity nested inside an Activity (`activity.childItems`), for cases where an Activity needs finer-grained options (e.g. an "Other" activity with childItems for the specific "other" cases). Selecting a child item is still selecting an Activity — the parent/child relationship exists to organise the picker, not to create a separate domain concept.

### Day boundary

The clock time (e.g. `04:00`) at which a diary day is considered to start and end, from `config/activities.json`'s `general.day_boundary`. A diary day doesn't run midnight-to-midnight — it runs day-boundary-to-day-boundary — so every Start time / End time / Duration is computed as an offset from this boundary, not from midnight.

### Diary

A Respondent's complete record for one day: every Timeline (one per Dimension) together with its Diary status. The unit of work a Respondent completes in one sitting.

### Diary status

Whether a Diary is still in progress or has been completed. Tracked in application state (`status`), reset per diary and marked complete once the Respondent finishes.

### Dimension *(the raw config field is still literally named `timeline` — see note below)*

One of the fixed axes a Respondent records for every span of time in the day — Primary activity, Secondary activity, Location, Who, Device, Enjoyment, in that order. Defined in `config/activities.json`'s `timeline` array; each Dimension has a `name`, a Mode, and its own Category → Activity hierarchy.

Deliberately *not* called "Column": the mobile view currently renders each Dimension as a vertical column, but planned desktop work will lay them out horizontally instead — "Column" would describe today's layout, not the concept, and would go stale the moment a horizontal desktop view ships. "Dimension" describes what it *is* (an axis you classify a span of time along) independent of how it's drawn.

> ✅ **Naming clash resolved in code.** This entry used to flag a real clash — "timeline" meant both this concept and the per-Respondent record below. All in-code identifiers now consistently say "Dimension" for this sense: `currentDimensionIndex`, the `SWITCH_DIMENSION`/`RESET_DIMENSION_INDEX` actions, the `dimensionIndex` payload field on `ADD_ENTRY`/`UPDATE_ENTRY`, and the `dimensionindex` HTML attribute threaded through `<details-panel>`/`<el-accordion>`. "Timeline" (`state.timelines`, the `timelines`/`timeline` reducers, `<el-timeline>`, `<el-timeline-stack>`) is reserved exclusively for the per-Respondent record sense — see **Timeline** below.
>
> One deliberate exception remains: `config/activities.json`'s top-level `timeline` array, and the `GLOBALS.DATA.timeline` reads of it, still use the old name. That's not a leftover naming smell — it's a data contract shared with the upstream O-TUD project (see `json_schema.md`), and renaming the JSON field would break every existing `activities.json`. When you see `GLOBALS.DATA.timeline[dimensionIndex]` in code, read it as "the Dimension config at this index," not as a Timeline.

### Start time

The clock time (or, internally, the offset in minutes from the Day boundary) at which an Entry begins.

### End time

The clock time (or, internally, the offset in minutes from the Day boundary) at which an Entry stops. Paired with Start time to define the span an Entry covers.

### Duration

The length of an Entry, derived by subtracting its Start time from its End time — not stored independently, always computed from the two.

### Entry

One recorded span of time within a Timeline: a Start time, an End time, and the Activity selected for that Dimension during that span. The actual data a Respondent produces — as distinct from an Activity, which is just the menu of things they could have chosen.

### Mode

A per-Dimension setting — `single-choice` or `multiple-choice` — controlling whether a Respondent may select exactly one Activity for that Dimension in a given span of time, or several at once (e.g. "Who" is typically multiple-choice; "Primary activity" is single-choice).

### Respondent

The person filling in the diary. Not yet named explicitly anywhere in the code, but every other term above is defined from their point of view — they're the implicit actor behind every Entry.

### Timeline

One Respondent's filled-in record of Entries for a single Dimension, for one Diary — e.g. "the Location timeline" is everywhere they've recorded where they were, across the whole day. Rendered by the `<el-timeline>` component, one per Dimension, and held in application state as `state.timelines[dimensionIndex]`.

> See the note under **Dimension** — "timeline" no longer needs disambiguating in code: it consistently means *this* sense now, the per-Respondent record, everywhere except the raw `config/activities.json` field (which was intentionally left alone as a shared data contract).
