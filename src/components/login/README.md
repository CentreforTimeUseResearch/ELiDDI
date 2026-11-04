# Login (`el-login`)

[← Back to root README](../../../README.md)

---

## What it does

The login form for a study that has turned on **server accounts** (`general.server_accounts`, see [ADR 0007](../../../docs/adr/0007-server-sync-model.md)). The same URL goes to every Respondent, so they identify themselves with a **login code**: 8 letters and numbers, shown as `ABCD-EFGH`. With accounts off the component is never rendered and nothing about the diary changes.

It sits inside a dialog that [DynamicTimelineUI](../dynamicTimelineUI/README.md) opens whenever nobody is logged in. That dialog has no close button and ignores Escape (`dismissible: false` on [DialogWidget](../dialogWidget/README.md)), and the rest of the page (nav bar, timeline) is hidden behind `data-login-required`, because on a shared household device what is behind the dialog would be someone else's diary. The onboarding waits until after login.

## Custom element

`<el-login>`

## Behaviour

- **Input:** a plain text field (not a numeric keypad) with autocapitalise, autocorrect, spellcheck and autofill off. It has no `maxlength`, so a pasted `abcd-efgh` or `ABCD EFGH` works: the server ignores case, spaces and hyphens. The code is trimmed and sent as typed.
- **Accessibility:** the field has a visible label and a hint (`aria-describedby`); errors appear in a `role="alert"` region that is on the page from the start, so they are announced; the field gets `aria-invalid`; the form is a real `<form>` with a submit button, so Enter works; the button is disabled and the form `aria-busy` while a request is out.
- **Errors:** an empty field (no request is made), an unknown code, too many attempts (with how many minutes to wait, from `Retry-After`), a request that could not be made, and any other server error each have their own wording (`describeLoginFailure` in `src/auth/authClient.js`). After an error the text is kept and selected so it can be corrected.
- **Success:** the field is emptied and the session started (`src/auth/session.js`); the dialog then closes.
- **When a login ends** (log out, or it expires) the field and any error are cleared, and a notice says why: "You have logged out." or "Your session has ended. Please log in again."

## Where the pieces are

| File                     | What                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/auth/authClient.js` | `getAccounts(config)`, `login()`, `logout()`, `signOut()` and the failure wording. `fetch` can be injected; they never throw for a failed request.                                                                       |
| `src/auth/session.js`    | `appSession`: who is logged in, when it ends (a timer, plus a check on read and when the tab becomes visible again), and the bearer token. `get()` never exposes the token; `getToken()` is for `Authorization` headers. |

**Where the token lives.** In `sessionStorage` under `eliddi.session`, never in the Redux store (which is saved to `localStorage`) and never in a storage key. `sessionStorage` survives a reload but not closing the tab, so a login does not outlive the sitting on a shared device. The backend controls how long it lasts (`ELIDDI_TOKEN_LIFETIME`, 12 hours by default).

**Log out / switch person.** The [nav bar](../navbar/README.md) has a "Log out (switch person)" item (only when accounts are on). It ends the login on this device first, then tells the server (`POST /logout`) as a best effort. If the server cannot be reached the token stays valid there until it expires, but the page can no longer use it.

**What this does not do yet.** The diary in the browser is still the single `state` key: keying it by Respondent id, clearing it on logout and syncing it with the server are [#208](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/208) and [#209](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/209). `appSession.get().respondentId` is the id to key it by.

---

[← Back to root README](../../../README.md)
