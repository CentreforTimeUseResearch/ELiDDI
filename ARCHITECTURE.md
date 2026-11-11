# Architecture

The one-page map of how ELiDDI is put together, for a developer arriving fresh. It links out rather than repeating: the domain words (Dimension, Timeline, Entry…) are [CONTEXT.md](CONTEXT.md), decisions with a "why" are [docs/adr/](docs/adr/), behaviour is specified in [docs/design/](docs/design/README.md), and each source folder's own README goes deeper.

## The two layers

ELiDDI is a **progressive-enhancement** diary ([README → Architecture](README.md#architecture) has the short version):

1. **No-JS layer.** At build time, Vite's `transformIndexHtml` hook runs `scripts/generate_no_js.js`, which validates `config/config.json` against `config/config.schema.json` and injects a complete, submittable `<form>` of 144 time-slot cards — plus a `<script>GLOBALS = {DATA: …}</script>` block carrying the config — into `index.html`. The generation itself is the pure `buildDiaryHtml()` in `scripts/lib/generateNoJs.js`. [ADR 0004](docs/adr/0004-no-js-form-submission-format.md) fixes the form's submission format.
2. **JS layer.** `src/main.js` first deep-freezes `GLOBALS` (`src/freezeGlobals.js` — at module-evaluation time, deliberately before `DOMContentLoaded`, because custom elements upgrade and read the config while modules are still evaluating). The generated markup is wrapped in `<el-dynamic-timeline>`, whose `connectedCallback` replaces the form with the interactive UI. Finally the `no-js` class comes off `<body>`, switching the CSS over.

A study can skip the fallback form (`general.accessibility.generateHtmlFallback: false`), and server-accounts studies always do — a plain form cannot log in ([ADR 0007](docs/adr/0007-server-sync-model.md)).

## Layer map

| Where             | What                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/` | Every custom element, one folder each, all extending `TinyBase` ([README](src/components/README.md), [class diagram](src/components/CLASS_DIAGRAM.md)). Plain helper classes live beside the component that owns them. |
| `src/store/`      | The hand-rolled Redux clone, the singleton `appStore`, the reducer tree, and `localStorage` persistence with `STATE_VERSION` migrations ([README](src/store/README.md)).                                               |
| `src/sync/`       | Server-accounts sync: fills the store at login, pushes after edits, reconciles conflicts ([README](src/sync/README.md), [ADR 0007](docs/adr/0007-server-sync-model.md)). Inert when accounts are off.                  |
| `src/auth/`       | Login-code client for the ELiDDI backend, and the session (token, expiry).                                                                                                                                             |
| `src/submission/` | Final diary submission ([ADR 0006](docs/adr/0006-diary-submission-payload.md)).                                                                                                                                        |
| `src/validation/` | The configurable diary checks (pure: Diary + config in, results out).                                                                                                                                                  |
| `src/config/`     | `appConfig.js` — the **only** reader of `GLOBALS`; everything else imports its named getters (#255).                                                                                                                   |
| `src/i18n/`       | The UI-string catalogue and `t()` ([ADR 0008](docs/adr/0008-ui-strings-from-a-message-catalogue.md)). Config-supplied content (Dimension and Activity names) is per-study data, not catalogue strings.                 |
| `src/utils/`      | Small shared functions — time arithmetic, HTML escaping, announcements, the shared half-minute ticker. Deliberately function-based, no classes.                                                                        |
| `src/testing/`    | Test-only fixtures (e.g. special-character configs). Not shipped behaviour.                                                                                                                                            |
| `scripts/`        | The no-JS generator CLI and its pure library (`scripts/lib/`), which may import from `src/` (it shares `utils/html.js` and the i18n catalogue).                                                                        |
| `config/`         | The study config — the single source of truth for diary content — and its JSON schema ([json_schema.md](json_schema.md)).                                                                                              |
| `docs/`           | ADRs, the [UI behaviour specs](docs/design/README.md) (read the relevant flow **before** any UI change), and agent guides.                                                                                             |

**No runtime dependencies.** `package.json` has only `devDependencies`; everything in `src/` and `scripts/` is vanilla JS/DOM. That is a rule, not an accident (see [CLAUDE.md](CLAUDE.md)).

## The component contract (`TinyBase`)

Every element extends `TinyBase` (`src/components/base.js`). The rules it enforces are easy to violate from outside, so they are stated here as well as in its comments:

- **Rendering** is `render()` setting `innerHTML` (or appending a cloned `<template>`). Each component self-registers via `customElements.define(...)` at the end of its file, so importing the file is what makes the tag work.
- **Props.** HTML attributes only carry strings, so a parent passes objects and callbacks through the **props registry** (`src/components/propsRegistry.js`): `setProps({...})` while building the template returns a `key="<uuid>"` attribute; the child resolves it once, on first connect. The parent owns the key and frees it on its own re-render or disconnect.
- **Lifecycle.** Anything that outlives a single render — listeners on `this`, `document` or `window`, timers, store subscriptions, helper objects with a `destroy()` — is set up in `connectedCallback` and torn down through `registerCleanup()` / `listen()`, which `disconnectedCallback` runs. Listeners on elements a component's own `render()` creates may be bound directly in `render()`: they are discarded with that markup.
- **`renderOnce`.** A component whose markup must survive a DOM move (the Timelines, the stacks, login, the validation panel) sets `static renderOnce = true`: it renders on first connect only, and a reconnect re-runs just the rest of `connectedCallback`. That makes the lifecycle rule above load-bearing: a raw `addEventListener` on kept markup in `connectedCallback` **stacks a duplicate on every reconnect** — the bug class #251 fixed. Bind through `listen()`, or inside `render()`.
- **One store.** `getStore()` returns the singleton `appStore`; components subscribe through `registerCleanup(store.subscribe(...))` and read state in the callback.

## State, persistence, config

- Entries store times as **minutes since the day boundary**, not midnight ([ADR 0001](docs/adr/0001-day-boundary-not-midnight.md)); the reducer tree and the `{ [date]: Diary }` shape are in the [store README](src/store/README.md).
- A Respondent's diary may exist **only in their browser**: changing the shape of a persisted slice needs a `STATE_VERSION` bump and a migration in `src/store/persistence.js` — read that file first.
- With server accounts on, the store starts empty and `src/sync/` owns filling, keying (`state.<respondentId>`) and pushing it; with them off, none of that code runs.
- Study config is read through `src/config/appConfig.js`'s getters, never from `GLOBALS` directly; UI strings come from `t()` in `src/i18n/`. New user-facing literals in a component are a review flag.

## Where to go deeper

[CONTEXT.md](CONTEXT.md) for the language · [src/components/CLASS_DIAGRAM.md](src/components/CLASS_DIAGRAM.md) for every class and who owns what · [docs/design/flows/](docs/design/README.md) for how the UI must behave (including the no-JS baseline) · [docs/adr/](docs/adr/) for the decisions · [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
