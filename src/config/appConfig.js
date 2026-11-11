// The one place that reads the study config global (GLOBALS, injected by
// scripts/generate_no_js.js and frozen by src/freezeGlobals.js). Everything
// else imports a named getter from here, so what readers depend on is
// explicit, defaults live in one place, and tests can reason about config
// access through one seam (#255).
//
// Every getter reads lazily, per call, never latching at module-evaluation
// time: custom elements begin upgrading while modules are still being
// evaluated (the ordering lesson freezeGlobals.js records), and a test may
// swap globalThis.GLOBALS around a single assertion.
//
// Read-only by design: the returned objects are the frozen originals. The one
// deliberate exception to "nothing else touches GLOBALS" is
// src/testing/specialCharacters.js, a test-only helper that mutates the
// (unfrozen, test-environment) config - a mutation this seam must not offer.
function data() {
  return globalThis.GLOBALS?.DATA;
}

// the whole study config, for the functions that take one as an argument
// (validateDiary, submitDiary, signOut) - callers that need a single value
// use the named getters below instead
export function studyConfig() {
  return data();
}

// the Dimension definitions, in order (config's `timeline` key - ADR 0002
// explains the name)
export function dimensions() {
  return data()?.timeline ?? [];
}

export function dimension(index) {
  return dimensions()[index];
}

// "HH:MM" the diary day starts at (ADR 0001); parseDayBoundary /
// getDayBoundaryInMinutes in src/utils/time.js turn it into minutes
export function dayBoundary() {
  return data()?.day_boundary;
}

// the onboarding walkthrough steps (config's top-level `instructions` array)
export function onboardingSteps() {
  return data()?.instructions ?? [];
}

// two-letter code selecting the UI-string catalogue (ADR 0008)
export function language() {
  return data()?.general?.language;
}

// where the Respondent is sent after final submission
export function primaryRedirectUrl() {
  return data()?.general?.primary_redirect_url;
}

// -> { enabled, backendUrl } for a study config. Accounts are off unless the
// config explicitly says true (and names a backend), so a config that predates
// the setting behaves exactly as before. Takes the config as an argument for
// callers that hold one; accounts() below is the running study's.
export function getAccounts(config) {
  const general = config?.general;
  const backendUrl = typeof general?.backend_url === 'string' ? general.backend_url : '';
  return {
    enabled: general?.server_accounts === true && backendUrl !== '',
    backendUrl: backendUrl.replace(/\/+$/, ''),
  };
}

// { enabled, backendUrl } for server accounts (ADR 0007), for the running study
export function accounts() {
  return getAccounts(data());
}
