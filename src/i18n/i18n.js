// t(key, params): the one way user-facing strings are looked up
// (docs/adr/0008-ui-strings-from-a-message-catalogue.md).
//
// The language is resolved on every call, never latched at module-evaluation
// time: custom elements start upgrading (and rendering, and therefore
// translating) while modules are still being evaluated, before anything has
// had a chance to call an init function - the ordering lesson
// freezeGlobals.js records. In the browser it comes from the study config
// (general.language, read through src/config/appConfig.js); setLocale() is
// the explicit override for the two callers that have a config but no
// injected study config: the no-JS generator (scripts/lib/generateNoJs.js)
// and tests.
//
// Pure by contract - no console, no process - because the generator imports
// it at build time, same rule as scripts/lib/generateNoJs.js itself.
import en from './en.js';
import { language } from '../config/appConfig';

// language code -> catalogue; adding a language is one import + one line here
const catalogues = { en };

let localeOverride;

export function setLocale(code) {
  localeOverride = code || undefined;
}

function activeCode() {
  return localeOverride ?? language();
}

function activeCatalogue() {
  return catalogues[activeCode()] ?? en;
}

// The BCP 47 tag to give Intl / toLocaleDateString for the study's language,
// so dates read in the same language as the words around them rather than
// following the browser (every Respondent in a study sees what was piloted -
// ADR 0008). English is the British English the app has always shown
// ("Saturday 7 November"); a language with no catalogue falls back with the
// words, to English.
export function dateLocale() {
  const code = activeCode();
  if (!catalogues[code] || code === 'en') {
    return 'en-GB';
  }
  return code;
}

// Lookup order: active catalogue, then en, then the key itself - a
// translation gap renders as its visible, greppable key rather than
// throwing or silently falling back to English (see the ADR).
export function t(key, params) {
  const message = activeCatalogue()[key] ?? en[key] ?? key;
  if (!params) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

// test seam: register a catalogue without editing the module (returns an
// undo, shaped for registerCleanup/afterEach)
export function addCatalogue(code, catalogue) {
  catalogues[code] = catalogue;
  return () => {
    delete catalogues[code];
  };
}
