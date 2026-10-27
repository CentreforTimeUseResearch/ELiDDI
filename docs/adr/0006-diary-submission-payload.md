# Diary submission payload

When a Respondent submits a Diary, `submitDiary()` (`src/submission/submitDiary.js`) POSTs it as JSON to `general.submit_completed_diary_url`, and whatever receives it has to decode it. So the shape is a contract, written down here. (The no-JS form has its own, see [0004](0004-no-js-form-submission-format.md).)

One request carries **one Diary**: the day the Respondent is viewing, not everything saved in their browser. The request is `POST` with `Content-Type: application/json`, and the body is:

| Field          | Value                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experimentID` | `general.experimentID` from the study config.                                                                                                                                                       |
| `version`      | `general.version` from the study config.                                                                                                                                                            |
| `dayBoundary`  | `day_boundary` from the study config, e.g. `"04:00"`. Entry offsets are measured from it ([0001](0001-day-boundary-not-midnight.md)), so the receiver needs it to turn them into clock times.       |
| `date`         | The Diary's date, `YYYY-MM-DD`: the day that starts at the Day boundary.                                                                                                                            |
| `status`       | The Diary status as stored: `0` in progress, `100` complete. A first submission is sent before the Diary is marked complete, so it carries `0`; a re-submission of a completed Diary carries `100`. |
| `timelines`    | One array of Entries per Dimension, in the order of `timeline` in the study config (index 0 is Primary activity), exactly as stored. A Dimension with no Entries is an empty array.                 |

An Entry is `{ id, startOffsetMins, endOffsetMins, activity }`: the span in minutes from the Day boundary (end exclusive, so a whole day is `0` to `1440`), and the Activity's display name (`activity` is a list of names in a multiple-choice Dimension). The name is what the Respondent saw, or what they typed for free text; it is not the Activity `code`, which the receiver can look up in the study config.

## The server

The page is served from one origin and posts to another, so the receiving server must answer the CORS preflight for `application/json` (`Access-Control-Allow-Origin`, and `Access-Control-Allow-Headers: Content-Type`). A server that only accepts form encodings will see the preflight fail, and the submission fail with it.

## Failure

A failed submission changes nothing in the browser. The Diary stays as it was, in progress, so the Respondent can try again. `submitDiary()` reports the outcome rather than throwing: success, no Diary, no submit URL (no request is made), `network` (the request could not be made), or `http` with the status when the server answered with anything but 2xx.
