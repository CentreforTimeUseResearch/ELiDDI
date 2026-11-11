# Manual test: server accounts on two devices

A script for checking the whole of server accounts ([ADR 0007](adr/0007-server-sync-model.md)) by hand against the Docker backend: login, one Diary following a Respondent from one device to another, two devices disagreeing, a server that goes away, a login that runs out, and a shared device. About 30 minutes. Run it before a release that touches `src/sync/`, `src/auth/`, `src/submission/` or the backend's `/login`, `/state` or `/submit`.

The automated tests cover each piece against a fake server. This is the only check that the pieces work together, in a real browser, against the real backend.

## Set up

**1. The backend** (in `ELiDDI_backend`; needs Docker running):

```bash
docker compose up --build
docker compose logs backend      # find the "TEST PHASE login codes" block
```

You get six dummy Respondents. Call two of them **A** and **B** and keep their codes (`ABCD-EFGH` style; case, spaces and hyphens are ignored when typing).

To start from nothing, stop the backend and delete `data/eliddi.sqlite3` and `data/dummy_codes.json`, then start it again (this makes new codes).

**2. The page** (in `ELiDDI`). Use `ACTIONS_ENV` so `config/config.json` stays as committed:

```bash
# bash
ACTIONS_ENV="$(node -e "const c=require('./config/config.json');c.general.server_accounts=true;c.general.backend_url='http://localhost:5000';console.log(JSON.stringify(c))")" npm run dev
```

```powershell
# PowerShell
$env:ACTIONS_ENV = node -e "const c=require('./config/config.json');c.general.server_accounts=true;c.general.backend_url='http://localhost:5000';console.log(JSON.stringify(c))"
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173/`).

**3. Two "devices".** Device 1 is a normal browser window. Device 2 is a **private (incognito) window**, or another browser: it has its own `localStorage` and `sessionStorage`, which is what makes it a separate device. Open the page in both.

To look inside a browser at any point: DevTools → Application → Local Storage (keys `state.<respondentId>`, `state.<respondentId>.sync`, `state.<respondentId>.backup.*`) and Session Storage (`eliddi.session`, the login).

**4. The server's side**, whenever a step says "check the server":

```bash
docker compose exec backend python -c "import sqlite3;c=sqlite3.connect('data/eliddi.sqlite3');print(c.execute('select respondent_id,revision,length(state) from diary_states').fetchall())"
docker compose exec backend python -c "import sqlite3;c=sqlite3.connect('data/eliddi.sqlite3');print(c.execute('select respondent_id,date,status from submissions').fetchall())"
```

## The test

Each step says what to do and what you should see. Anything else is a bug: write down the step and what happened.

### 1. Login gate

| Do                         | Expect                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Open the page on device 1. | A login dialog over a hidden diary. No way to close it. No diary or onboarding behind it.     |
| Enter a wrong code.        | "That code was not recognised." The dialog stays.                                             |
| Enter A's code.            | "Loading your diary…" briefly, then the diary and the onboarding. The nav bar says **Saved**. |
| DevTools: Local Storage.   | `state.<A's id>` and `state.<A's id>.sync` (`dirty: false`). No plain `state` key written.    |

### 2. One Diary, two devices

| Do                                                               | Expect                                                                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Device 1: add a few Entries to today's Primary activity.         | Nav bar: **Saving…**, then **Saved** about two seconds after you stop. Check the server: revision went up. |
| Device 2: log in as **A**.                                       | The same Entries, already there. (Onboarding is skipped if you finished it on device 1.)                   |
| Device 2: add an Entry in a different Dimension. Wait for Saved. | Check the server: revision went up again.                                                                  |
| Device 1: reload the page.                                       | Still logged in (same tab). Shows device 1's Entries, then the new Entry from device 2.                    |

### 3. Two devices, different days

| Do                                                                                 | Expect                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Device 1: use the date picker to go to yesterday and add an Entry. Wait for Saved. |                                                                           |
| Device 2 (without reloading): go to today and change an Entry. Wait for Saved.     | Saved, with **no notice**: the two devices changed different days.        |
| Reload both.                                                                       | Each shows yesterday's Entry and today's change. Nothing lost, no notice. |

### 4. Two devices, the same day

| Do                                                                             | Expect                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device 1 and 2 both on today. Device 1: add an Entry "from 1". Wait for Saved. |                                                                                                                                                                                                 |
| Device 2 (not reloaded): add a different Entry "from 2". Wait.                 | A banner: "Another device had a newer version of <today>…the newer version. Your earlier version is kept on this device." Today now shows device 1's version. Press **OK** and the banner goes. |
| DevTools on device 2: Local Storage.                                           | A `state.<A's id>.backup.<time>` key holding the "from 2" version.                                                                                                                              |

### 5. The server goes away

Stop the backend (`docker compose stop`) with device 1 logged in.

| Do                                                                     | Expect                                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Device 1: add an Entry.                                                | The diary works at once. Nav bar: **Not saved yet - will retry**.                                                                 |
| Choose **Log out (switch person)** in the menu.                        | Not logged out. A banner: "Your latest changes could not be sent…" with **Try again**, **Log out anyway**, **Stay logged in**.    |
| **Try again** (server still down).                                     | The same banner again.                                                                                                            |
| **Stay logged in**.                                                    | The banner goes; the diary is still there.                                                                                        |
| Start the backend again (`docker compose start`). Wait up to a minute. | Nav bar goes to **Saved** by itself.                                                                                              |
| Stop the backend again, add an Entry, log out, **Log out anyway**.     | Logged out; the login dialog shows; the diary is gone from the page. Local Storage still has `state.<A's id>` with `dirty: true`. |
| Start the backend, log in as **A**.                                    | The Entry you made while it was down is there, and the nav bar goes to **Saved**.                                                 |

### 6. A login that runs out

| Do                                                                                                                                                                                                             | Expect                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| In the backend, end every login (this logs out every Respondent): `docker compose exec backend python -c "import sqlite3;c=sqlite3.connect('data/eliddi.sqlite3');c.execute('delete from tokens');c.commit()"` | Nothing changes on the page yet.                                                   |
| Device 1: add an Entry and wait.                                                                                                                                                                               | The save is refused: the login dialog appears and says the login has ended.        |
| Log in as **A** again.                                                                                                                                                                                         | The diary is back with the Entry you added, and it reaches the server (**Saved**). |

### 7. A shared device

| Do                                                                                                             | Expect                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device 1, logged in as A with Entries on screen: log out.                                                      | The diary disappears at once. Local Storage no longer has A's copy (everything had been sent).                                                                                                             |
| Log in as **B**.                                                                                               | An empty diary and the onboarding. **Nothing of A's.** B's Local Storage keys use B's id.                                                                                                                  |
| Add an Entry as B. Log out. Log in as A.                                                                       | A sees A's Entries only.                                                                                                                                                                                   |
| Log in as A, then without logging out delete the Session Storage key `eliddi.session` and reload. Log in as B. | B sees none of A's diary. (A's copy stays in Local Storage, hidden, until A logs in again: nothing was logged out, so nothing cleared it. That is why Respondents are told to log out on a shared device.) |

### 8. Final submission

Make a Diary that passes the study's required checks (open the checks panel from the submission status button, the check or question mark in the nav bar), then press **Diary complete**.

| Do                                                         | Expect                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press **Diary complete**.                                  | The Diary is marked complete (and the page redirects if the study has a `primary_redirect_url`). Check the server: a `submissions` row for A and that date.                         |
| Edit the Diary, then submit again.                         | A second `submissions` row (the server keeps each submission).                                                                                                                      |
| End A's login as in step 6, then press **Diary complete**. | "Your login has run out. Log in again…" The login dialog appears; the Diary is not marked complete and nothing is lost. After logging in and pressing the button again, it submits. |

### 9. Accounts off (nothing changed)

Stop Vite. Start it without `ACTIONS_ENV` (so `config/config.json` is used as committed). Reload.

| Expect                                                                                                         |
| -------------------------------------------------------------------------------------------------------------- |
| No login dialog, no sync status, no "Log out" item. The diary works and is saved under the single `state` key. |

## Clean up

`docker compose down`. Delete `data/eliddi.sqlite3` and `data/dummy_codes.json` for a fresh start next time. Close the private window.

## When this finds a bug

Open an issue in the repository the cause is in (`src/sync/` and `src/auth/` are here; `/login`, `/state` and `/submit` are in `ELiDDI_backend`) and link ADR 0007. Add an automated test for it where the fake server in `src/sync/syncManager.test.js` can reproduce it.
