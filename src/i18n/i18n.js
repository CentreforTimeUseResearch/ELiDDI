// t(key, params): the one way user-facing strings are looked up
// (docs/adr/0008-ui-strings-from-a-message-catalogue.md).
//
// The language is resolved on every call, never latched at module-evaluation
// time: custom elements start upgrading (and rendering, and therefore
// translating) while modules are still being evaluated, before anything has
// had a chance to call an init function - the ordering lesson
// freezeGlobals.js records. In the browser it comes from
// GLOBALS.DATA.general.language; setLocale() is the explicit override for
// the two callers that have a config but no GLOBALS: the no-JS generator
// (scripts/lib/generateNoJs.js) and tests.
//
// Pure by contract - no console, no process - because the generator imports
// it at build time, same rule as scripts/lib/generateNoJs.js itself.
import en from './en.js';

// language code -> catalogue; adding a language is one import + one line here
const catalogues = { en };

let localeOverride;

export function setLocale(code) {
  localeOverride = code || undefined;
}

function activeCatalogue() {
  const code = localeOverride ?? globalThis.GLOBALS?.DATA?.general?.language;
  return catalogues[code] ?? en;
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
