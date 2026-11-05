# Submission (`src/submission/`)

[← Back to root README](../../README.md)

---

## What it does

Sends one Diary to the study's server. Plain functions, not a custom element: the Diary, its date and the study config go in as arguments.

Terminology (Diary, Entry, Dimension, Day boundary) follows [CONTEXT.md](../../CONTEXT.md). The payload is a contract, described in [ADR 0006](../../docs/adr/0006-diary-submission-payload.md).

## API

`submitDiary({ diary, date, config, session })` POSTs the Diary for `date` as JSON and resolves to a result. It never throws for a failed request. Where it goes comes from `getSubmitTarget(config)`:

- **Accounts off** (the default): `config.general.submit_completed_diary_url`, no credentials, exactly as before.
- **Accounts on** (`general.server_accounts`): `<backend_url>/submit` with `Authorization: Bearer <token>` from `session` (the page's `appSession` by default). `submit_completed_diary_url` is ignored, so the token is only ever sent to the backend. See [ADR 0006](../../docs/adr/0006-diary-submission-payload.md#with-server-accounts).

| Result                                  | Meaning                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `{ ok: true }`                          | The server answered 2xx.                                                                                                      |
| `{ ok: false, reason: 'http', status }` | The server answered with a non-2xx status.                                                                                    |
| `{ ok: false, reason: 'network' }`      | The request could not be made (offline, CORS, DNS).                                                                           |
| `{ ok: false, reason: 'unauthorized' }` | Accounts on, and nobody is logged in or the server answered 401. The login is ended so the dialog appears; the Diary is kept. |
| `{ ok: false, reason: 'no-url' }`       | The study has no submit URL. No request is made.                                                                              |
| `{ ok: false, reason: 'no-diary' }`     | There is no Diary to send. No request is made.                                                                                |

It only sends. Marking the Diary complete and showing the outcome are the caller's job.

## Tests

`submitDiary.test.js`, with `fetch` stubbed.

---

[← Back to root README](../../README.md)
