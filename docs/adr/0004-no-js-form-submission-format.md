# No-JS form submission format

The no-JS diary (`scripts/lib/generateNoJs.js`) is a plain `<form method="post">`, and whatever receives it has to decode it field by field. So the field names and values are a contract, written down here.

Every field is named `{slot}-{dimension}`. `{slot}` is the card id `{chunk}_{cardNum}` (`1_1` is 04:00–04:09, `8_18` is 03:50–03:59; see the time-slot structure in the README). `{dimension}` is the Dimension's name, lower-cased with every space a hyphen (`primary-activity`, `who`).

| Dimension Mode                       | Control                                         | Submitted                                                                                         |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| single-choice                        | `<select>`                                      | one value: the chosen option, or `""` when left on "Not answered"                                 |
| single-choice with `allow_free_text` | text input (with a `<datalist>` of the options) | one value: whatever was typed, possibly `""`                                                      |
| multiple-choice                      | one checkbox per option                         | one entry per ticked box, each with that option as its value; nothing at all when none are ticked |

Plus one field per slot, `{slot}-activity_continued_until_next_entry`, sent as `on` when ticked and absent otherwise.

An option's value is its displayed text: `Category - Activity`, or `Category - Activity - Child item`, with the `Category - ` prefix dropped for an unnamed category. A `<select>` starts on an empty "Not answered" choice, so an untouched slot is distinguishable from a chosen first activity. There is no built-in option beyond what the study config lists.

Before #160, Primary activity and Enjoyment shared the name `{slot}-enjoyed`, checkboxes had no value (each ticked box sent just `on`), and every multiple-choice Dimension got a hard-coded "Alone" box. Submissions from that version can't be fully decoded.
