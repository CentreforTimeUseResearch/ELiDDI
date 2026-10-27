# Validation (`src/validation/`)

[← Back to root README](../../README.md)

---

## What it does

Checks one Diary against the Validation rules a study has switched on, and says whether the Respondent may submit it. It is plain functions, not a custom element: the Diary and the study config go in as arguments, so it needs no store and no `GLOBALS`.

Terminology (Validation rule, Hard check, Soft check, Diary, Entry) follows [CONTEXT.md](../../CONTEXT.md).

## API

| Export                         | Purpose                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateDiary(diary, config)` | One `{ id, title, level, passed, message }` per rule that is on, in the order the rules are listed in `validateDiary.js`. `message` says what is wrong, and is `''` when the rule passed. |
| `canSubmit(results)`           | `true` unless a **hard** check is failing. A failing **soft** check only asks the Respondent to confirm.                                                                                  |

`diary` is a Diary from the store (`{ timelines, status }`, one Entry array per Dimension). `config` is the study config; only `config.validation` and `config.day_boundary` are read.

## Which rules are on

`config.validation` maps a rule id to `'off'`, `'soft'` or `'hard'` (see `config/config.schema.json`). ELiDDI ships every rule and the config only switches them, so a missing setting, a missing rule, or `'off'` means the rule is not checked and is not in the results. An id that ELiDDI has no rule for is ignored.

| Rule id                    | Rule                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-gaps-in-primary`       | Every ten-minute slot of the whole day is used by a Primary activity Entry. Slots still in the future today count as gaps.                                                             |
| `primary-secondary-differ` | The same Activity is not recorded as both Primary and Secondary activity in the same slot. A slot with nothing on either Dimension never clashes. Activity names are compared exactly. |

| `minimum-sleep` | At least 4 hours of Primary activity Entries with Activity code 101 (sleeping). Sleep recorded as a Secondary activity does not count. |
| `eating-or-drinking` | At least one Primary or Secondary activity Entry has Activity code 104 (eating, drinking). |

Both are meant to be soft, but take their level from the config like any rule. Entries store the Activity's display name, so `activityCodes.js` looks the name up in the study config to find its code; a free-text Entry has no code and never counts. The codes and the 4 hour threshold are constants in that file.

## Adding a rule

The slot helpers in `slots.js` (`entrySlots`, `slotClockTime`) are shared by the rules.

Write it under `rules/` as `{ id, title, check({ diary, config }) }`, where `check` returns `{ passed, message }`, and add it to `RULES` in `validateDiary.js`. Add its id to `validation` in `config/config.schema.json`.

## Tests

`validateDiary.test.js` (which rules run, levels, `canSubmit`) and one test file per rule under `rules/`.

---

[← Back to root README](../../README.md)
