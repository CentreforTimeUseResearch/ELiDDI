# Server sync model for Respondent state

**Status:** draft, for review. Part of the server-side accounts epic (#111). Nothing here applies to a study with `server_accounts` off: that path is unchanged, and the diary lives only in the browser.

STRATUS needs a Respondent to start a Diary on one device and finish on another, and its Respondents share devices within a household. This ADR says how a Respondent's state is kept on the server and how the browser stays in step with it. It is written before the code so the backend (`ELiDDI_backend#6`) and the frontend (#208, #209) build to the same rules.

Terms are those of `CONTEXT.md`. A **Respondent** logs in with a login code and gets a bearer token and a **Respondent id** (random, non-secret); see `ELiDDI_backend` `POST /login`.

## What is synced

One **snapshot per Respondent**: `{ stateVersion, state: { onboarding, diaries } }`, held as one JSON value with an integer **revision** that starts at 1 and goes up by 1 on every accepted write.

`currentDate` and `onboardingStep` stay on the device. Which day a Respondent is looking at, and which onboarding screen they are on, are things a Respondent may want to differ between a phone and a desktop, and syncing them would make one device move the other's screen. `onboarding` (done or not) is synced, so a second device does not repeat the introduction.

Anything else in `persistence.js` is already transient and stays so. A slice added to `PERSISTED_KEYS` is device-local by default; adding it to the synced set is a deliberate second step.

The server treats the snapshot as opaque. It checks that it is a JSON object with an integer `stateVersion` and that it is under a size limit (1 MB; a full week of Diaries is well below that), and nothing else. It does not understand Diaries, so a change in their shape never needs a server migration.

## Writing: a stale write is refused

```
GET /state              -> 200 { revision, stateVersion, state }   (404 if the Respondent has none yet)
PUT /state              <- { baseRevision, stateVersion, state }
                        -> 200 { revision }                        the write was accepted
                        -> 409 { revision, stateVersion, state }   baseRevision was not the current one
```

`baseRevision` is the revision the browser last saw (0 when the server has nothing). The server accepts the write only if that is still the current revision, in one transaction. Otherwise it answers `409` with the current snapshot, so the browser can reconcile without a second request.

This is **optimistic concurrency**, chosen over the alternatives:

- _Last write wins_ is the simplest, but it loses a Respondent's entries without anyone noticing, which cannot be repaired because the Diary exists nowhere else. Rejected.
- _The server merges_ would mean the server understands Diaries. Rejected for the reason above.

## Reconciling on a 409

The browser merges **per Diary date**, which is the natural unit (one Diary per day):

1. A date on only one side is kept.
2. A date on both sides and equal is kept.
3. A date on both sides and different: **the server's copy wins**, and the local copy of that date is saved under a backup key (as `persistence.js` already does for unreadable data), and the Respondent is told in words that another device had a newer version of that day.
4. The merged result is pushed with the new `baseRevision`.

**Refinement made in #208.** Rule 3 as first written was wrong for the commonest case: device A edits Tuesday while device B saves Monday, so the server's Tuesday is merely the _old_ Tuesday, and "the server wins" would quietly revert A's edit. So each device also remembers, per date, a short fingerprint of that Diary as the server held it when the two last agreed (the **base**, kept beside the local copy). On a date that differs, if only one side has changed it since the base, that side's version is kept and nothing is backed up. Only when **both** changed it (or there is no base to tell) do the rules above apply: a complete Diary wins, otherwise the server's copy wins and the local one is backed up. The server still never understands Diaries; the base lives in the browser.

The server's copy wins when both sides changed a date because the realistic cause is a Respondent finishing a day on device B after starting it on device A, and device A then opening an old tab. Two devices editing the same day at the same moment is not something a Respondent does on purpose. The backup means that even then nothing is destroyed.

One refinement, to keep: a Diary with status `100` (complete) beats one with status `0` regardless of the above, since "complete" is something the Respondent did deliberately.

## When the browser syncs

Local state is always written first, exactly as now; sync follows it, and the diary never waits for the network.

- **On login:** fetch `GET /state` before showing the diary, then run the first-login rules below.
- **After a change:** push after a short quiet period (about 2 seconds without another change), so a burst of edits is one request.
- **On leaving:** on `visibilitychange` to hidden, try a push straight away.
- **On regaining connection** (`online` event) or the tab becoming visible again: push if anything is unsynced.

The browser remembers `lastSyncedRevision` alongside the local copy, and whether there are unsynced changes (current local state differs from what was last confirmed).

## First login on a device

The local copy is keyed by Respondent id (below), so "what is in this browser" is only ever about this Respondent.

| Server has state | This browser has a copy for this Respondent | Action                                 |
| ---------------- | ------------------------------------------- | -------------------------------------- |
| no               | no                                          | start empty                            |
| yes              | no                                          | adopt the server's state               |
| no               | yes                                         | push the local copy (`baseRevision` 0) |
| yes              | yes, no unsynced changes                    | adopt the server's state               |
| yes              | yes, with unsynced changes                  | reconcile as for a `409`               |

**The existing single `state` key is ignored when accounts are on, and never deleted.** Before accounts exist it holds whoever last used the browser, and on a shared device we cannot tell whose it is, so adopting it into a Respondent's account could put a stranger's diary in the wrong account. A study switching the flag on part-way is not a case STRATUS has (accounts are on from the start). If it ever matters, it is a separate, explicit "import this browser's diary" action, not automatic.

## Local state is keyed by Respondent id

The key is `state.<respondentId>` (the Respondent id is the opaque UUID the server returns at login). The login code is never in a storage key. This lets several Respondents use one device without overwriting each other. The saved value keeps the shape in `persistence.js`, plus `lastSyncedRevision`.

### Shared devices and privacy

This is the part the server cannot solve; the browser holds the diary and anyone with the device and the dev tools can read it. We reduce it rather than pretend to remove it.

- **Logout clears the Respondent's local copy.** The server is the source of truth, so nothing is lost by clearing. Logout first tries a final push. If that fails and there are unsynced changes, the Respondent is told and has to choose between waiting and logging out anyway; we never discard unsynced work silently.
- **There is a visible "switch person / log out" action** wherever the Respondent's identity is shown.
- **An expired token does not clear the local copy.** A Respondent whose token runs out mid-entry must not lose their entries. The diary is hidden behind the login dialog until a login that returns the same Respondent id; a login as a different Respondent id clears the first one's copy (after the same unsynced-changes warning) before showing the new one.
- **Token lifetime is short** (backend default 12 hours, `ELIDDI_TOKEN_LIFETIME`) and the page logs out after a period of **inactivity** (default 30 minutes, to be confirmed with Lausanne). A household member who picks up the tablet after a meal finds the login dialog, not the diary.
- **Not done:** encrypting the local copy. The key would have to live in the page too, so it would not stop anyone who can open dev tools. Not worth the complexity.

Residual risk, to state in the deployment documentation: until logout or the idle timeout, the diary is readable by anyone using that browser profile. The advice to Respondents is to log out on a shared device.

## `STATE_VERSION` and the server copy

`stateVersion` is stored with the snapshot and is the same number as `STATE_VERSION` in `persistence.js`.

- A browser reading a snapshot with an **older** `stateVersion` runs it through `restoreBlob()`'s migrations, as for localStorage, and the next push writes the new version.
- A browser reading a **newer** `stateVersion` than it understands does **not** migrate or write. It shows "reload the page to update" (an old cached copy of the page is the usual cause) and leaves the server copy alone. This is the one rule that stops a stale tab downgrading a Respondent's data.
- A change to the saved format therefore still needs a `STATE_VERSION` bump and a migration, exactly as now. It does not need a server change, because the server does not read the snapshot.

## Failure and offline

The Respondent can always keep working; what they see is whether their work is safe.

| Situation                          | What the browser does                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Network error or `5xx`             | Keep local state, mark "not saved to the server yet", retry after 5 s, doubling to a maximum of 60 s, and on `online`. |
| `401`                              | Stop retrying, keep local state, show the login dialog. After login, push whatever is unsynced.                        |
| `409`                              | Reconcile as above, once, then push again.                                                                             |
| `413` or `422` (server refuses it) | Stop retrying and tell the Respondent something is wrong, with the diary still safe locally. It is a bug, not a state. |

A small status indicator shows one of **Saved**, **Saving**, **Not saved yet (will retry)** or **Log in to save**. Wording and placement are for #208.

Final submission (`POST /submit`, `ELiDDI_backend#7`) does not depend on the sync state: it sends the Diary itself with the token, as `submitDiary()` does now, and an unsynced snapshot does not block it.

## Consequences for the code

- **Done in #208.** The sync is `src/sync/` (see its README); `appStore.js` starts empty when accounts are on and does not read or write the single `state` key; `REPLACE_STATE` fills and empties the singleton store; each Respondent's copy is `state.<respondentId>` with its bookkeeping in `state.<respondentId>.sync`. The login dialog stays up while the diary is fetched, so an empty diary is never shown that is about to be replaced. Two points the ADR left open: if the final push at logout fails, the copy is kept (hidden, marked unsent) and pushed at that Respondent's next login rather than asking them to choose, and backups of overwritten versions (`state.<id>.backup.*`) are not removed at logout, because they are the only place an overwritten version still exists. #209 revisits both. The inactivity timeout is not part of #208.
- **Done in #209.** The ADR's "Respondent is told" is built: a `replaced` notice names the days another device's version took over, and logging out first tries to send what is unsent and, if it cannot, asks the Respondent to try again, log out anyway or stay (`requestLogout` in `src/sync/appSync.js`, `<el-sync-notice>`). "Log out anyway" keeps the #208 behaviour: the copy stays on the device, hidden and marked unsent, and goes to the server at that Respondent's next login. Backups still stay after logout, and there is still no way to restore one in the page.
- **Store seeding** (as designed). `appStore.js` builds the singleton store at module load from one key, but with accounts on the key is only known after login. Components already hold the singleton through `getStore()`, so the store stays a singleton and gains a **replace-state action** that loads a restored state into it at login and empties it at logout. `persistStore` is pointed at `state.<respondentId>` for the session.
- **Comments to change.** `persistence.js` ("with no server-side copy") and `src/store/README.md` ("There is no server copy of a Respondent's diary") are true only with accounts off; they now say so and point here. Done in this change.
- **Backend** (`ELiDDI_backend#6`): the `diary_states` table already has `revision` and `state`; it needs `state_version` added (a migration), and the two endpoints above.
- **Not changed:** the no-JS form cannot log in, so with accounts on it is turned off or warns (#206).

## Open questions

- **Idle timeout and token lifetime** for shared devices: 30 minutes idle and 12 hours are proposals. Lausanne to confirm.
- **Whether to keep a local offline copy after logout** for Respondents on their own device. The rule above clears it for everyone, which is safest for households and costs a login-then-download on the next visit.
- **Per-date merge beyond the rule above** (for example, merging individual Entries within one day) is not attempted. If concurrent editing of one day turns out to matter, it is a later ADR.
