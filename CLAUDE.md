# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## No runtime JS dependencies

This project must not depend on any JavaScript library at runtime — `package.json` must have no `dependencies`, only `devDependencies` (build tooling, linting, testing). All application code in `src/` and `scripts/` should be written in vanilla JS/DOM APIs. Do not add a library (e.g. a framework, a state management library, a date/utility library) to `dependencies` to solve a task; either implement it directly (see `src/store/store.js` for the existing hand-rolled Redux clone as a model) or ask the user first if it seems unavoidable.

## Commands

```bash
npm run dev          # start Vite dev server
npm run build        # production build, outputs to dist/ (base path is relative: --base=./)
npm run preview      # preview production build locally
npm test             # run vitest in watch mode
npm test -- --run    # run vitest once (used in CI)
npm run lint         # ESLint over src/ and scripts/
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier over src/ and scripts/
npm run format:check # check formatting without writing
```

Husky + lint-staged run on commit (see `.husky/` and `.lintstagedrc`).

### Test file naming: `.test.js` vs `.te-st.js`

Vitest only picks up `*.test.js`. A handful of components with no meaningful behavior to test yet have their spec file deliberately named `*.te-st.js` instead — this is intentional, not a typo. It keeps empty/placeholder specs out of the test run until there's something real to assert. Most components now have real, running `*.test.js` files. When a component's tests are ready to run in CI, rename its `*.te-st.js` file to `*.test.js`. Only run a single test file with `npx vitest run path/to/file.test.js`.

Tests run against `jsdom` and rely on `vitest.setup.js` (registered via `test.setupFiles` in `vite.config.js`) to provide the `GLOBALS` global that components read `GLOBALS.DATA` from at construction/render time — see `src/main.js`/`index.html` for how this is populated for real in the browser. The setup file also polyfills `HTMLDialogElement.prototype.showModal`/`close`, which jsdom doesn't implement. Components that receive callbacks via the `setProps`/`key` pattern (see `TinyBase` in `src/components/base.js`) need a caller to call `setProps` on their behalf in tests — several test files define a small `TestHarness extends TinyBase` for this.

## Architecture

`ARCHITECTURE.md` at the repo root is the one-page map (layer map, component lifecycle contract, links); what follows here is the agent-oriented detail.

ELiDDI is a **progressive enhancement** time-use diary. The core principle is that the diary must work without JavaScript as a plain HTML form, then be enhanced by a web component when JS is available.

### How the two layers connect

**No-JS layer** — `scripts/generate_no_js.js` is a thin Node CLI that reads `config/config.json` (or `ACTIONS_ENV`) and prints the full diary HTML, exiting non-zero if the config can't be read or parsed or doesn't match `config/config.schema.json` (validated by `scripts/lib/validateConfig.js`, which `config/config.schema.test.js` also uses); the generation itself is the pure `buildDiaryHtml(configJson)` in `scripts/lib/generateNoJs.js`, tested in `generateNoJs.test.js`. Vite's `transformIndexHtml` hook (in `vite.config.js`) runs this script at build/dev time and injects the output into `index.html` at the `__GENERATED__` placeholder inside `<div id="data">`. The result is a complete `<form>` with 144 time-slot cards rendered as `<li>` elements, requiring no JS to submit. The script also emits a `<script>GLOBALS = {DATA: ...}</script>` block so the raw config is available to the JS layer at runtime, and generates `<datalist>` elements with flattened activity options for the free-text/autocomplete inputs.

This whole no-JS form can be skipped per-study by setting `general.accessibility.generateHtmlFallback: false` in `config/config.json` (exposed as a checkbox in the ELiDDI_deployer tool, unchecked by default there). When explicitly `false`, `generate_no_js.js` still emits the `GLOBALS` script block but skips the datalists/cards/form entirely, outputting just an empty `<el-dynamic-timeline></el-dynamic-timeline>` for the JS layer to render into. Absent or `true` keeps the current full-HTML behavior, so configs that predate this flag are unaffected.

The same output is produced when `general.server_accounts` is `true` (a plain form cannot log in), whatever `generateHtmlFallback` says. `server_accounts` (default off) opts a study in to the ELiDDI_backend login and sync; it requires `general.backend_url`, and with it absent or `false` nothing changes (see `docs/adr/0007-server-sync-model.md`).

**JS layer** — `src/main.js` first imports `src/freezeGlobals.js`, which deep-freezes `GLOBALS` (via `deepFreeze` in `src/utils/deepfreeze.js`) synchronously at module-evaluation time — deliberately _before_ `DOMContentLoaded`, since deferring it that long left `GLOBALS` mutable while `<script type="module">`-deferred custom elements were already upgrading and reading it (see the comment in `freezeGlobals.js`). `main.js` then imports `DynamicTimelineUI` (`src/components/dynamicTimelineUI/dynamicTimelineUI.js`), which self-registers as `<el-dynamic-timeline>`. The generated HTML wraps the diary contents in `<el-dynamic-timeline>`, so this component's `connectedCallback` fires when JS loads and takes over rendering (currently a work in progress — it renders `<el-nav-bar>`, `<el-timeline-stack>`, and two `<el-dialog>`s — one hosting onboarding, one hosting the date picker — replacing the no-JS form markup). Finally, a `DOMContentLoaded` listener removes the `no-js` class from `<body>` so the JS-layer CSS takes over (see CSS switching below).

**CSS switching** — `<body>` starts with `class="no-js"`. The `.no-js` block in `src/style.css` controls the 7-column grid layout for the no-JS state (hiding nav, controlling label visibility, etc.). The JS layer removes this class in `main.js` to activate its own layout.

### Component pattern

Every custom element lives in its own folder under `src/components/<name>/` with a `<name>.js`, `<name>.css`, and a spec file (see test naming note above). Components extend `TinyBase` (`src/components/base.js`), which provides:

- A `props` pattern: `setProps(obj, returnKey)` stores an object of `{key: value}` (auto-binding any function values to the instance) in a module-level singleton `props` map and returns a UUID key; a component instantiated with a `key` attribute looks itself up via `getProps()` in `connectedCallback`. This is how parent components pass data/callbacks to children through HTML attributes.
- `getStore()` — access to the single app-wide store (see State management below).
- `render()` — overridden by each subclass to set `innerHTML`.

Each component file ends with a `customElements.define('tag-name', ClassName)` call, so importing the file has the side effect of registering the element.

### State management

`src/store/store.js` is a minimal hand-rolled Redux clone (`createStore`, `combineReducers` — no external dependency). The singleton store instance is created once in `src/store/appStore.js` (not `base.js` — `TinyBase.getStore()` just returns it), seeded from and saved back to `localStorage` by `src/store/persistence.js`. Read that file before changing the shape of a persisted slice or adding one: a shape change needs a `STATE_VERSION` bump plus a migration, because a Respondent's diary lives only in their browser.

With `general.server_accounts` on, the store starts empty and `src/sync/` (see its README and `docs/adr/0007-server-sync-model.md`) fills it with the logged-in Respondent's diary, saves it under `state.<respondentId>` and syncs it with the backend; the single `state` key is then ignored. With it off, none of that runs. Final submission with accounts on goes to `<backend_url>/submit` with the login token (`src/submission/`, ADR 0006), and `submit_completed_diary_url` is ignored. `docs/server-accounts-test.md` is the manual two-device test.

`src/store/eliddiReducer.js` combines reducers for onboarding state (`onboarding`, `onboardingStep`), the currently-shown panel (`uipanel`), the active Dimension (`currentDimensionIndex`), the currently-viewed Diary date (`currentDate`), and `diaries` — a `{ [date]: Diary }` map, where each Diary is `{ timelines, status }` (one Entry array per Dimension, each entry has `startOffsetMins`/`endOffsetMins`/`id`/`activity`). See `src/store/README.md` for the full reducer tree and what every file in that folder does.

### Data model — `config/config.json`

The config is the single source of truth for diary content. It has two top-level keys:

- `general` — experiment metadata and accessibility settings
- `timeline` — array of Dimension definitions. Each Dimension has a `name`, `mode` (`single-choice` or `multiple-choice`), and nested `categories → activities → childItems` hierarchy. Each activity has `name`, `code`, `color`, and optionally `childItems` for sub-categories.

The current Dimensions in order: Primary activity, Secondary activity, Location, Who, Device, Enjoyment.

See `json_schema.md` for the full schema documentation, and `CONTEXT.md` for the project's ubiquitous language (Dimension, Timeline, Entry, etc.) — use those terms rather than ad hoc ones like "column" when discussing this data model, since the mobile-vertical layout that "column" implies won't hold once a horizontal desktop view exists.

### Time-slot structure

The diary covers a full day in 10-minute slots starting at 04:00, producing 144 slots. These are grouped into 8 chunks of 18 slots (3 hours each). Card IDs follow the pattern `{chunk}_{cardNum}` (e.g. `3_12`). Navigation links within and between chunks use these IDs as fragment targets.

### CI / deployment environment

`scripts/generate_no_js.js` checks `process.env.ACTIONS_ENV`. When absent, it reads `config/config.json` from disk. When set, it uses the env var value directly as the JSON input, allowing the activities config to be injected at deploy time without a file on disk.

- `.github/workflows/checks.yml` runs `npm test -- --run` and `npm run build` on every PR into `main`.
- `.github/workflows/deploy.yml` is a manually-triggered (`workflow_dispatch`) deploy to GitHub Pages; it accepts an optional `data` input that is passed through as `ACTIONS_ENV` so a deploy can use a different activities config than the one committed to the repo. It also accepts an optional `researcher_email` input; when non-empty, a final step emails that address (via the Resend API, using a `RESEND_API_KEY` repo secret) with the deployed Pages URL, read from the preceding `deploy-pages` step's `page_url` output. That step is `continue-on-error: true` so an email failure never fails the deployment itself.

### Additional Notes

- prioritize human cognitive limits over raw efficiency,

## UI design

`docs/design/` is the behavioural spec for the diary UI, modelled on how Google Calendar (web) behaves, with explicit divergences. Start at `docs/design/README.md`. **Before any UI change, read the relevant flow in `docs/design/flows/`** (`create-entry`, `edit-entry`, `move-resize`, `navigate`, `keyboard-interaction`) and keep its acceptance criteria satisfied, including the no-JavaScript baseline. If a change needs behaviour the flow doesn't describe, update the flow first. The specs describe behaviour only; visual tokens are in `docs/agents/DESIGN.md`.

## Agent skills

### Issue tracker

Issues live as GitHub Issues in this repo (CentreforTimeUseResearch/ELiDDI), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
