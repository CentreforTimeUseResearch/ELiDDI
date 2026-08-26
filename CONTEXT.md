# ELiDDI

The time-use diary domain: Respondents record Entries against fixed Dimensions (Primary activity, Location, Who, etc.) for each Diary they fill in.

## Structure

**Diary**:
A Respondent's complete record for one calendar day: every Timeline (one per Dimension) together with its Diary status. Identified by its date; a Respondent accumulates one Diary per day they record.

**Diary status**:
Whether a Diary is still in progress or has been completed.

**Dimension**:
One of the fixed axes a Respondent records for every span of time in the day — Primary activity, Secondary activity, Location, Who, Device, Enjoyment, in that order. Each Dimension has a Mode and its own Category → Activity hierarchy.
_Avoid_: Column

**Timeline**:
One Respondent's filled-in record of Entries for a single Dimension, within one Diary — e.g. "the Location timeline" is everywhere they've recorded where they were, across the whole day.

**Respondent**:
The person filling in the diary. Every other term here is defined from their point of view — they're the implicit actor behind every Entry.

## Recording a span of time

**Entry**:
One recorded span of time within a Timeline: a Start time, an End time, and the Activity selected for that Dimension during that span. The actual data a Respondent produces — as distinct from an Activity, which is just the menu of things they could have chosen.

**Start time**:
The clock time at which an Entry begins, measured as an offset from the Day boundary.

**End time**:
The clock time at which an Entry stops, measured as an offset from the Day boundary.

**Duration**:
The length of an Entry, derived by subtracting its Start time from its End time — not stored independently, always computed from the two.

**Day boundary**:
The clock time at which a diary day is considered to start and end. A diary day doesn't run midnight-to-midnight — it runs day-boundary-to-day-boundary, so every Start time / End time / Duration is measured from this boundary, not from midnight. See ADR-0001.

## Activity data

**Activity**:
A single thing a Respondent can record against a Dimension for a span of time (e.g. "sleeping", "washing, dressing"). An Activity is a _choice_, not a record of it happening — the record is an Entry.

**Category**:
A named grouping of Activities within one Dimension (e.g. "Personal" grouping "sleeping", "resting", "washing, dressing"). Purely organisational — it isn't itself selectable or recorded.

**Child item**:
A sub-Activity nested inside an Activity, for cases where an Activity needs finer-grained options. Selecting a child item is still selecting an Activity — the parent/child relationship organises choices, it isn't a separate domain concept.

**Mode**:
A per-Dimension setting controlling whether a Respondent may select exactly one Activity for that Dimension in a given span of time (single-choice), or several at once (multiple-choice).
