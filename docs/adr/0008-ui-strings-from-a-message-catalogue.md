# UI strings come from a message catalogue

ELiDDI will be deployed in studies that are not run in English. Until now every user-facing string — button labels, aria-labels, screen-reader announcements, validation messages, prompts — has been a literal at its point of use, so translating the diary meant forking it. This ADR says where strings live and how a study picks a language. It covers the mechanism; migrating the existing strings is tracked separately (#249 for the JS layer, #250 for the no-JS form).

## The catalogue

`src/i18n/` holds one catalogue per language: a flat object of dotted keys to strings (`en.js` is the reference and ships complete). Components call `t(key, params)` (`src/i18n/i18n.js`); `{name}` placeholders in a string are filled from `params`.

**Keys, not English-as-key.** The alternative — using the English text itself as the lookup key — reads nicely at the call site but couples every translation to the English copy: rewording a hint orphans its translations silently, and two places that happen to share the same English words ("Log in" as a heading, "Log in" on a button) are forced to share one translation even where a language needs two. Keys are stable under copy edits, greppable, and name what the string is for. The cost is a hop from call site to `en.js` to read the text; keys are namespaced by component (`login.codeHint`) to keep that hop short.

**Flat, dotted keys.** `'login.gate.retry'` as a literal key, not nested objects. Lookup is one property access, a grep for the full key always finds both the definition and every use, and a catalogue stays an eyeballable list.

## Which language

`general.language` in `config/config.json` — the key already existed in the config schema (a two-letter code, optional) and now does this: it selects the catalogue, falling back to `en` when it is absent or no catalogue of that name exists. The config is the single source of truth for diary content, and the language of a study is decided by the researcher configuring it, not by the browser — so `navigator.language` is deliberately not consulted; every Respondent in a study sees the same words that were piloted.

`t()` resolves the language **per call**, lazily, from `GLOBALS.DATA.general.language`. It is not latched at module-evaluation time because custom elements begin upgrading (and rendering, and therefore translating) while modules are still being evaluated — the same ordering lesson `freezeGlobals.js` records. `setLocale(code)` exists as an explicit override for the two callers that have a config but no `GLOBALS`: the no-JS generator, and tests.

## Missing keys and fallback

Lookup is: the active catalogue, then `en`, then the key itself. A missing key therefore renders as `login.gate.retry` in the page — ugly, visible, greppable — rather than throwing (a translation gap must never take the diary down) or silently showing English (which would hide the gap from exactly the pilot that should catch it). `t()` never logs: it is also imported by the generator, which is pure by contract (no `console`, no `process`).

## Plurals and formatting

No plural engine. Where a count changes the sentence, the caller picks between explicit keys (`x.one` / `x.other`) — English and the languages currently in prospect for STRATUS need no more, and a hand-rolled CLDR implementation is exactly the kind of runtime dependency-in-disguise this project avoids. Dates and times keep going through `src/utils/time.js`; if a locale ever needs different clock formatting, that is a change to `time.js`, not to the catalogue. If a target language with real plural complexity arrives, that is a new ADR.

## The no-JS form

The generated fallback form must speak the same language, or a translated study ships an English baseline. `scripts/lib/generateNoJs.js` already imports from `src/` (`src/utils/html.js`), so it imports the same catalogue and calls `setLocale(config.general?.language)` from the config it was handed, at the top of `buildDiaryHtml`. The strings themselves move in #250.

## What a new language costs

One file: `src/i18n/<code>.js`, copied from `en.js` and translated, plus one line registering it in `i18n.js`. Untranslated keys fall back to English. There is no runtime loading, no split bundles: catalogues are small (hundreds of short strings), and a study deploys with one language anyway.

## Consequences

- New user-facing strings go in `en.js` and are read through `t()`; a literal in a component is now a review flag.
- `login` is the reference migration (this change); the remaining JS-layer strings are #249, the generator's are #250.
- Tests assert through the catalogue or against the English catalogue's values — either keeps working, since `en` is the default in jsdom (no `general.language` override in `vitest.setup.js`'s config means the fallback applies).
- Config-supplied content (Dimension names, activity names, onboarding `instructions`) is already per-study data and is **not** in the catalogue: the researcher writes it in the study's language in `config.json`, as today.
