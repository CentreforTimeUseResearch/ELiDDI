# Keep `timeline` as the config field name for O-TUD compatibility

`config/config.json`'s top-level `timeline` array holds what the rest of the codebase calls a Dimension. It isn't renamed to match, and shouldn't be: it's a data contract shared with the upstream O-TUD project, and renaming it would break every existing `activities.json`. Read `GLOBALS.DATA.timeline[dimensionIndex]` as "the Dimension config at this index," not as a Timeline.
