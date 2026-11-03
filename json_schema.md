# JSON Schema for `config/config.json`

## Context

`config/config.json` is the single source of truth for ELiDDI's diary content (per CLAUDE.md) — it drives both the no-JS HTML generation (`scripts/generate_no_js.js`) and, eventually, the JS-enhanced layer. Right now nothing validates its shape: the only "enforcement" is implicit, coming from `generate_no_js.js` throwing at build time if certain fields are missing (e.g. `category.name`, `activity.name`, or the `timeline` array having too few entries). There's no JSON Schema, no TypeScript types, no runtime validation of any kind, and no documentation of which fields are actually required vs. optional vs. dead/unused metadata.

The goal is to produce a JSON Schema that others (researchers configuring new diary studies, contributors editing the config) can use to know what a valid `config.json` looks like, and to wire it into the existing test suite so schema drift is caught automatically in pre-commit/CI rather than surfacing as a cryptic build-time crash.

Two research passes over the full 2637-line file plus every consumer (`scripts/generate_no_js.js`, `src/components/activityPanel/activityPanel.js`, and the rest of `src/`) established the real shape and its inconsistencies. Key findings that drive the design below:

- **Only `generate_no_js.js` and one line of dead code (`activityPanel.js:7`) actually read this file from disk.** Everything else in `src/` reads the runtime-injected `GLOBALS.DATA` instead, never the file itself. `general.*` was never read by any code when this was written (since then `general.accessibility.generateHtmlFallback` and `general.server_accounts` are read by `generate_no_js.js`, and `general.submit_completed_diary_url` by `src/submission/submitDiary.js`; see "Later additions" below). **Correction (re-verified 2026-09-04): `generate_no_js.js` is order-independent, not positional** — it builds every dimension's no-JS form generically from that dimension's own `mode`/`name` fields via `.map()`/`.forEach()`, with no `timeline[0]`/`timeline[1]`-style indexing anywhere in the file, and no code path that throws based on order. The actual positional dependency lives in the JS-enhanced layer: `src/components/timelineStack/timelineStack.js` assigns each dimension a 0-based index in array order, and `Timeline`/`ActivityPicker` use that index to look up `GLOBALS.DATA.timeline[dimensionIndex]` — so array position controls which dimension shows first and the picker's sequence, not which dimension is required at which index. No code anywhere hardcodes "index N must be dimension X".
- **Data has real inconsistencies that a strict schema would wrongly flag as bugs**: `color` hex codes mix upper/lower case; `code` integers are reused across sibling activities (not unique); activities come in two shapes — a "coded" flavor (`code`/`label`/`short`/`vshort`, used by Primary/Secondary) and an "example" flavor (`examples`, always `""`, used by Location/Who/Device/Enjoyment) — plus a third minimal shape for the two "Other" category activities that have neither.
- **`min_coverage` is a string of digits, not a number.** `instructions` (in `general`) is a boolean despite its name suggesting text.
- Per user decision: build a **lenient/descriptive schema** (matches what the data does today, no `additionalProperties: false`, no forced `oneOf` flavor discriminator) plus **automated validation** wired into the existing `npm test` path (already run by `.husky/pre-commit` and `.github/workflows/checks.yml`), rather than a schema file with no enforcement.

### Upstream documentation (new finding)

ELiDDI's `config/config.json` shares its field vocabulary with a sibling/upstream project, **O-TUD (o-timeusediary)**, which publishes field-level docs at https://andreifoldes.github.io/o-timeusediary/docs/activities-config.html. `general.app_name` in ELiDDI's own data is literally `"O-TUD"`, confirming the lineage. This is a second, independent source for field semantics (beyond just reading `generate_no_js.js` and the sample data) and should be used to cross-check the definitions below rather than superseding them where the two disagree with ELiDDI's actual behavior.

- **Structural divergence — important.** The upstream docs describe `timeline` as an **object keyed by name** (`primary`, `secondary`, `location`, `who`, `device`, `enjoyment`). ELiDDI's actual `config/config.json` has `timeline` as an **array** (confirmed at line 18 of the real file). ELiDDI has diverged from upstream here — the docs cannot be used as a structural spec for `timeline`; the array shape already established from reading the real file remains the ground truth. Order in that array is not read positionally by `generate_no_js.js` (see the correction above) — it only controls display order in the JS-enhanced layer. The upstream docs are still useful for field-level semantics _within_ each timeline column, category, and activity, since those nested shapes match.

- **`general` required fields, per upstream docs**: only `experimentID` and `primary_redirect_url` are documented as required; `app_name`, `version`, `author`, `language`, `instructions`, `fallbackToCSV`, and `accessibility` are documented as optional. This refines the earlier plan, which (working from a single sample file where all 8 fields happened to be present) had provisionally marked all of them required. The docs give an authoritative reason to relax that — treat the sample's 100% presence as coincidental completeness, not a hard requirement.
- **`accessibility` sub-fields have documented defaults** (`enableReducedMotion`, `enableHighContrast`, `enableForcedColors` — each defaults to `true`), reinforcing that they're optional-with-defaults rather than required. ELiDDI's real data sets all three to `false`, which is valid data, just not the documented default. `autoscrollSpeed` is **not mentioned in the upstream docs at all** — it's an ELiDDI-specific extension to the `accessibility` object and should be documented in the schema as such (optional number, no upstream default to cite).

- **`activity.code`** is documented upstream as a generic `Number`, not integer-only. ELiDDI's real data only ever uses integers (e.g. `101`, `129`), so keeping `type: integer` in the schema stays accurate to observed data while being slightly stricter than the upstream spec — worth a description note rather than a behavior change.
- **Everything else corroborates** the earlier data-only research: `activity.color` required, `childItems` following the same field set as `activity` but with a lighter required set, `mode` enum of `single-choice`/`multiple-choice`, hex-color format (`#` + 6 chars). No changes needed there beyond citing the docs as a second source.

## Approach

### 1. Schema file — `config/config.schema.json`

JSON Schema **draft-07** (not 2020-12): ajv v8 supports draft-07 natively via `new Ajv()` with no extra import, has the widest editor autocomplete support, and nothing here needs 2020-12-only features. Colocate with the data file it validates.

Top-level:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ELiDDI activities configuration",
  "description": "Validates config/config.json. General metadata is documented but not read by build code; timeline order controls display order in the JS-enhanced layer - scripts/generate_no_js.js itself is order-independent (see correction above).",
  "type": "object",
  "required": ["general", "timeline"],
  "properties": { "general": { "$ref": "#/definitions/general" }, "timeline": { "$ref": "#/definitions/timeline" } },
  "definitions": { ... }
}
```

**`definitions` to author:**

- `hexColor`: `{ "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" }` (case-insensitive by construction).
- `general`: object, `required: ["experimentID", "primary_redirect_url"]` per the upstream O-TUD docs (not all 8 fields — revised from the earlier data-only draft, which over-fit to a single sample file where every field happened to be present). `app_name`, `version`, `author`, `language`, `instructions`, `fallbackToCSV`, `accessibility` all declared as optional `properties` (plus the later ELiDDI-specific additions `submit_completed_diary_url`, `server_accounts` and `backend_url`; see "Later additions"). Document `instructions` as boolean-not-text in its description. `version` gets a loose semver pattern, `language` a loose 2-letter pattern — don't over-validate against full ISO/semver grammars.
- `accessibility`: object, no required fields (upstream docs give each of the 3 booleans a default of `true`, so they're optional-with-defaults, not mandatory). `enableReducedMotion`/`enableHighContrast`/`enableForcedColors` typed as boolean; `autoscrollSpeed` typed as number and documented as an ELiDDI-specific field not present in the upstream O-TUD spec.
- `timeline`: array, `minItems: 5`. **Correction (2026-09-04): no tuple/positional structure.** The original design used draft-07 tuple-style `items` (array form) for indices 0–4 plus `additionalItems`, to capture what research had claimed was a positional invariant enforced by `generate_no_js.js`. Re-verifying against the current source found no such invariant - `generate_no_js.js` is order-independent, and no code anywhere requires a specific dimension at a specific index (order only affects display sequence in `src/components/timelineStack`). The schema now just uses a uniform `"items": { "$ref": "#/definitions/timelineColumn" }`.
- `timelineColumn`: required `name`, `description`, `mode` (enum `single-choice`/`multiple-choice`), `min_coverage` (string, pattern `^\d+$`), `categories` (array of `category`).
- `category`: required `name` (string, `minLength: 1` — deliberately not `pattern: "\\S"`, since the real data uses a literal single space `" "` as a dummy category name on the four simple columns) and `activities` (array of `activity`); optional `color` (only present on the two "Other" categories).
- `activity`: required `name`, `color`. Optional: `code` (integer — upstream docs type this as generic `Number`, but ELiDDI's real data is integer-only, e.g. `101`, `129`, so the schema stays stricter/more accurate to observed data), `label`, `short`, `vshort`, `examples` (all strings), `childItems` (array of `childItem`), `subselection`. Instead of a strict `oneOf` between the "coded" and "example" flavors (which would fight the third, field-less "Other" shape and risk ajv's "matches more than one schema" errors), use a `dependencies` block so `label`/`short`/`vshort` require each other when any one is present — this captures the one real invariant found in the data without forcing a flavor discriminator. Document the two observed flavors in prose in the description.
- `childItem`: same property set as `activity` but **only `name` is required** (`color` is required on top-level activities but optional on childItems, per research) — needs its own definition rather than a direct `$ref` to `activity`. Allows self-referential `childItems` for the always-empty placeholder case found in the data, without requiring depth.
- `subselection`: `{ questions: array of array of string }`. Keep the inner items as generic `string` (not an enum of `"crowdingPrimary"`) since only 2 occurrences of one value is too thin a sample to lock down.

### 2. Validation tooling

- `npm install --save-dev ajv` (skip `ajv-formats` initially — the schema uses `pattern` for everything, not `format`, so it isn't needed unless a later tightening pass wants `format: "uri-reference"` on `primary_redirect_url`).
- New file `config/config.schema.test.js`, mirroring the existing `describe`/`it`/`expect` style from `src/components/accordion/accordion.test.js` (simpler here — no DOM setup needed, it's a pure data test):
  - Load `config.schema.json` and `config.json` via `readFileSync` + `JSON.parse` (not a native JSON import, to sidestep Node/Vite import-attribute version sensitivity).
  - `new Ajv({ allErrors: true, strict: false })` — `strict: false` avoids ajv throwing on the tuple-`items` + sibling `description` pattern used above; `allErrors: true` + `ajv.errorsText(validate.errors, { separator: '\n' })` gives one legible multi-line failure listing every violation instead of stopping at the first.
  - No changes needed to `vite.config.js`, `.husky/pre-commit`, or `.github/workflows/checks.yml` — vitest's default include glob already picks up any `*.test.js`, and `npm test` is already run in both pre-commit and CI.

### 3. Editor integration

Add `"$schema": "./config.schema.json"` as a top-level key in `config/config.json` for VS Code's built-in JSON autocomplete/validation. Verify this extra key doesn't break `generate_no_js.js` (it only reads `data.timeline` - `data.general` is never read by this script, so it's inert either way) and that the schema's lenient `general`/`timeline`-only `required` (no `additionalProperties: false` at the top level) tolerates the extra key.

## Later additions to `general`

These are ELiDDI-specific extensions (not in the upstream O-TUD spec), all optional, and a config without them validates and behaves as it did before they existed.

| Field                                | Type                      | Meaning                                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_completed_diary_url`         | string                    | URL a completed Diary is POSTed to as JSON (payload: `docs/adr/0006-diary-submission-payload.md`). Empty = no submit button.                                                                                                                                |
| `accessibility.generateHtmlFallback` | boolean                   | Absent or `true` = generate the full no-JS diary form; only an explicit `false` skips it.                                                                                                                                                                   |
| `server_accounts` (#206)             | boolean, absent = `false` | `true` = Respondents log in to the ELiDDI backend and their Diary follows them between devices (`docs/adr/0007-server-sync-model.md`). Requires `backend_url`. With it off nothing changes: the Diary lives only in the browser.                            |
| `backend_url` (#206)                 | string, `http(s)://…`     | Base URL of the ELiDDI backend, e.g. `https://diary.example.org`. A path prefix is allowed and a trailing slash does not matter. Only used when `server_accounts` is `true`; required then (an `if`/`then` in the `general` definition), otherwise ignored. |

**`server_accounts` and the no-JS form.** A plain HTML form cannot log in, so with `server_accounts: true` `generate_no_js.js` skips the no-JS form (the same minimal output as `generateHtmlFallback: false`), whatever `generateHtmlFallback` says.

## Critical files

- `config/config.schema.json` — new, the schema itself
- `config/config.schema.test.js` — new, ajv-based vitest validation test
- `config/config.json` — existing data, read-only reference during authoring; gets a `$schema` key added at the end
- `package.json` — add `ajv` to devDependencies
- `scripts/generate_no_js.js` — reference only (not modified); its field access patterns are what determined required-vs-optional above

## Sequencing

0. Cross-check each `definitions` entry against the upstream O-TUD docs (https://andreifoldes.github.io/o-timeusediary/docs/activities-config.html) field-by-field before authoring, noting explicitly (in schema `description`s) any point where ELiDDI's real data diverges from the upstream spec — the `timeline` array-vs-object structure being the one confirmed structural divergence; required/optional status of `general` fields being the one confirmed required-ness divergence.
1. Author `general`/`accessibility`/`timelineColumn`/`category`/`activity` definitions; hand-validate against just the Primary activity column.
2. Extend/validate against Secondary, Location, Who, Device, Enjoyment — specifically confirm the two "Other" activities, the `" "` dummy category names, `examples: ""`, the 2 `subselection` occurrences, and the empty-`childItems: []` placeholders all pass.
3. Add `ajv`, write `config.schema.test.js`, run `npm test` to confirm it passes against the real file.
4. Add the `$schema` key to `config.json`; re-run `npm test` and `npm run build` to confirm nothing breaks.
5. Regression-check the validator: temporarily break a required field in a local (uncommitted) edit (e.g. make `min_coverage` a number, or drop `color` off an activity), confirm `npm test` fails with a legible ajv error pointing at the right path, then revert the change before finishing.

## Verification

- `npm test` (vitest) passes, including the new `config.schema.test.js`, against the real, unmodified `config/config.json`.
- `npm run build` still succeeds (confirms the `$schema` key addition and schema authoring didn't disturb `generate_no_js.js`'s field assumptions).
- The Phase 5 negative test (temporarily breaking a field, confirming the schema test fails with a useful message, then reverting) is the acceptance check that drift is actually caught, not just that the happy path validates.
