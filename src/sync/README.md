# Sync (`src/sync/`)

[← Back to root README](../../README.md)

---

## What it does

Keeps a Respondent's diary in step with the ELiDDI backend when the study turns on **server accounts** (`general.server_accounts`). With accounts off, none of this runs: `appSync.js` creates nothing and the diary lives only in the browser, as before. The design and the reasons for it are in [ADR 0007](../../docs/adr/0007-server-sync-model.md); this is how the code is laid out.

The rule that shapes everything: **the diary never waits for the network.** Every change is written to the device first; the server follows.

## Files

| File             | Role                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appSync.js`     | Wires the one manager to the app's store, session and storage, and to `visibilitychange` / `online`. Imported by `main.js`. Does nothing with accounts off.                             |
| `syncManager.js` | `createSync(...)`: follows the login session and runs the rules below. Everything outside it (store, session, storage, `fetch`, timers) is injected, so it is tested without a browser. |
| `syncClient.js`  | `fetchState`, `pushState`: `GET` and `PUT /state`. Never throw; the result says what to do next (`ok`, `none`, `conflict`, `unauthorized`, `rejected`, `retry`).                        |
| `reconcile.js`   | Pure. `mergeStates(local, server, base)`: the per-day merge. `fingerprint` / `baseOf`: the short per-day fingerprints that make it a three-way merge.                                   |
| `localCopy.js`   | A Respondent's copy on this device: `readLocalCopy`, `writeSyncMeta`, `clearLocalCopy`, `saveBackup`.                                                                                   |
| `syncStatus.js`  | `appSyncStatus`: one small observable (`saved`, `saving`, `unsaved`, …) that the components read, so none of them needs the manager.                                                    |

## What lives where on the device

| Key                                | Holds                                                                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.<respondentId>`             | The diary, saved by `persistStore` exactly as without accounts.                                                                                                                                                                                             |
| `state.<respondentId>.sync`        | `{ revision, dirty, base }`: the server revision it matches, whether there may be unsent changes, and the per-day fingerprints of what the server held then. Written _before_ the diary itself, so a crash leaves at worst an extra push, never a lost one. |
| `state.<respondentId>.backup.*`    | A version of a day that the server's copy replaced. Never removed automatically.                                                                                                                                                                            |
| `state` (the old single key)       | Ignored and never deleted: on a shared device it may belong to anyone.                                                                                                                                                                                      |
| `sessionStorage['eliddi.session']` | The login (see [Login](../components/login/README.md)). Not part of this folder.                                                                                                                                                                            |

`dirty` is the one flag that must never be wrong in the unsafe direction: if the bookkeeping is missing or unreadable it is read as "there may be unsent changes".

## The life of a login

**Login.** Fetch `GET /state`, then, per the table in the ADR:

| Server has state | This device has a copy of this Respondent | Result                                |
| ---------------- | ----------------------------------------- | ------------------------------------- |
| no               | no                                        | start empty                           |
| yes              | no, or one with no unsent changes         | adopt the server's                    |
| no               | yes                                       | send this device's (`baseRevision` 0) |
| yes              | yes, with unsent changes                  | merge (below), then send the result   |

The diary is not shown until this is decided (status `loading`; the login dialog stays up). The onboarding step and the day being viewed are kept from this device's copy, since they are never synced.

**Changing.** The store is watched for changes to `onboarding` or `diaries`. A change marks the copy unsent and, after 2 seconds with no further change, sends it. A change made while a request is out goes in a second request. `visibilitychange` and `online` send at once.

**Merging.** Per day: only on one side, or equal: kept. Different: if only one side changed it since the **base**, that side's version; if both did, a complete Diary beats an in-progress one, otherwise the server's wins and this device's is saved as a backup. Onboarding counts as done if either side finished it. A `409` from the server runs the same merge and sends again.

**Failing.**

| What happened                               | What it does                                                                           | Status                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| network error or `5xx`                      | keeps the change, retries after 5 s, doubling to 60 s, and on `online`                 | `unsaved`                       |
| `401`                                       | ends the session as expired; keeps the copy; after the next login sends what is unsent | `idle` (the login dialog shows) |
| `413`, `422`, other `4xx`                   | stops sending; the diary stays safe on the device                                      | `rejected`                      |
| server holds a newer `stateVersion`         | does not read it into the diary or write to it                                         | `outdated`                      |
| the diary cannot be fetched, no copy here   | says so and offers "Try again"                                                         | `load-failed`                   |
| the diary cannot be fetched, a copy is here | works from the copy and retries the fetch; merges when the server answers              | `unsaved`                       |
| five conflicts in a row                     | backs off like a network failure rather than hammering the server                      | `unsaved`                       |

**Logging out.** The store is emptied at once (the next person must not see this diary); then what the server lacks is sent; then the copy is removed. If that last send fails, the copy stays (hidden, marked unsent) and is sent at that Respondent's next login.

**The login running out.** The diary and the copy are kept and sending stops. If the _same_ Respondent logs in again, their copy is reconciled and anything unsent goes. If a _different_ Respondent logs in, the first one's copy is removed if everything had been sent, and kept hidden if not.

## Known gaps

- What the Respondent is **told** about a merge that replaced something, and a choice at logout when changes could not be sent, are [#209](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/209).
- Backups (`.backup.*`) stay on the device after logout. They are the only place an overwritten version exists, so they are not cleared automatically; on a shared device that is a privacy question to settle with Lausanne.
- No inactivity timeout yet (ADR 0007 proposes 30 minutes).
- `PUT /state` carries the whole diary set each time. It is well under the server's 1 MB limit for a study's length, so there is no delta format.

---

[← Back to root README](../../README.md)
