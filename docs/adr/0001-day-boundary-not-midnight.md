# Day boundary runs 04:00-to-04:00, not midnight-to-midnight

A diary day is measured from the Day boundary (currently 04:00) to the same clock time the next calendar day, not from midnight to midnight. Every Entry's Start time, End time, and Duration are stored as offsets from this boundary. This avoids splitting a Respondent's overnight activity (e.g. sleep) across two separate calendar-day records.

## Consequences

The boundary is already deploy-time configurable (`GLOBALS.DATA.day_boundary`, from `config/config.json`), so different studies can set their own boundary. Full support for arbitrary values isn't complete, though: the timeline SVG's grid lines and hour labels are static markup keyed to 04:00, not computed from the config value, so changing the boundary correctly shifts entry data and positions but not the displayed hour labels.
