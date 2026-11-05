// How the store's state is saved to, and restored from, Web Storage
// (localStorage) - the format, its version, validation on load, migration of
// older formats, and when writes happen. Takes the storage object as an
// argument so it can be tested without a real browser.

export const STORAGE_KEY = 'state';

// With server accounts on, each Respondent's local copy has its own key, so
// several people can use one device without overwriting each other
// (docs/adr/0007-server-sync-model.md). The id is the opaque one the server
// returns at login, never the login code.
export const stateKeyFor = (respondentId) => `${STORAGE_KEY}.${respondentId}`;
// Bump when the saved format changes, and teach restoreBlob() to migrate the
// previous version rather than discarding it - this is a Respondent's diary,
// with no server-side copy (unless the study turns on server accounts; see
// docs/adr/0007-server-sync-model.md).
//   (no version) - the raw state object, written before #142
//   1            - { version, state: { ...PERSISTED_KEYS } }
export const STATE_VERSION = 1;

// An allowlist: only diary data and onboarding progress survive a reload.
// Anything else (which panel is open, the active Dimension, layout, zoom) is
// transient UI state, and a newly added slice stays transient by default.
export const PERSISTED_KEYS = ['onboarding', 'onboardingStep', 'currentDate', 'diaries'];

// The part of PERSISTED_KEYS that follows a Respondent between devices when
// server accounts are on. The rest (which day is showing, which onboarding
// screen) stays on the device.
export const SYNCED_KEYS = ['onboarding', 'diaries'];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Each validator checks what would *crash* the app if wrong, not everything
// that could be odd - an over-strict check would throw away a Respondent's
// diary over a cosmetic oddity. Every Timeline reads
// diaries[date]?.timelines[i], so a Diary must have a timelines array; a
// Timeline slot may be null (JSON's rendering of a never-touched Dimension).
const isTimeline = (timeline) =>
  timeline === null || (Array.isArray(timeline) && timeline.every(isPlainObject));
const isDiary = (diary) =>
  isPlainObject(diary) && Array.isArray(diary.timelines) && diary.timelines.every(isTimeline);

const VALIDATORS = {
  onboarding: (value) => typeof value === 'boolean',
  onboardingStep: (value) => Number.isInteger(value) && value >= 0,
  currentDate: (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
  diaries: (value) => isPlainObject(value) && Object.values(value).every(isDiary),
};

function pickPersisted(state) {
  return Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]]));
}

// -> { state, problems }: state holds only the keys that passed validation
// (an absent key falls back to its reducer's default), problems describes
// whatever was dropped. state is undefined if nothing was usable.
function restoreBlob(blob) {
  if (!isPlainObject(blob)) {
    return { state: undefined, problems: ['not an object'] };
  }
  const isLegacy = !('version' in blob);
  if (!isLegacy && blob.version !== STATE_VERSION) {
    return { state: undefined, problems: [`unsupported version ${JSON.stringify(blob.version)}`] };
  }
  const saved = isLegacy ? blob : blob.state;
  if (!isPlainObject(saved)) {
    return { state: undefined, problems: ['no saved state'] };
  }

  const state = {};
  const problems = [];
  PERSISTED_KEYS.forEach((key) => {
    if (!(key in saved)) {
      return;
    }
    if (VALIDATORS[key](saved[key])) {
      state[key] = saved[key];
    } else {
      problems.push(`invalid ${key}`);
    }
  });
  return { state: Object.keys(state).length > 0 ? state : undefined, problems };
}

// A snapshot received from the server -> { state, problems }, validated and
// migrated exactly like a saved copy. Only the keys it carries are returned.
export function restoreSyncedState(stateVersion, state) {
  return restoreBlob({ version: stateVersion, state });
}

function readRaw(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    console.error(`Could not read saved diary data from "${key}":`, error);
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    // QuotaExceededError, or storage that refuses writes (some private modes)
    console.error(`Could not save diary data to "${key}":`, error);
    return false;
  }
}

// The state to seed the store with, or undefined to start from the reducers'
// defaults. Never destroys anything it can't read: the raw saved value is
// copied to a timestamped backup key first, since the next save would
// otherwise overwrite it.
export function loadPersistedState(storage, key = STORAGE_KEY) {
  const raw = readRaw(storage, key);
  if (raw === null) {
    return undefined;
  }

  let result;
  try {
    result = restoreBlob(JSON.parse(raw));
  } catch {
    result = { state: undefined, problems: ['corrupt JSON'] };
  }

  if (result.problems.length > 0) {
    const backupKey = `${key}.backup.${Date.now()}`;
    const backedUp = write(storage, backupKey, raw);
    console.warn(
      `Saved diary data could not be fully restored (${result.problems.join(', ')}).` +
        (backedUp ? ` The original was kept in localStorage under "${backupKey}".` : '')
    );
  }
  return result.state;
}

// Saves the durable slices whenever they change. Returns an unsubscribe.
//   - writes once immediately, so a migrated or partly-discarded blob is
//     replaced by the current format right away
//   - skips the write when no durable slice changed - most dispatches are
//     UI-only (panel, Dimension, zoom) and reducers keep unchanged slices
//     reference-equal
//   - coalesces a burst of dispatches into one write; a microtask (the
//     default) runs before the browser can unload the page, so no change can
//     be lost to the delay
//   - the returned unsubscribe first saves a change that is still waiting for
//     its write, then stops for good: nothing is written afterwards, so a
//     logout can empty the store without the empty state landing in the copy
//     it has just finished with
// key is where it is saved: the single shared one, or one per Respondent.
export function persistStore(
  store,
  storage,
  { schedule = queueMicrotask, key = STORAGE_KEY } = {}
) {
  let lastSaved;
  let flushPending = false;
  let stopped = false;

  const flush = () => {
    flushPending = false;
    if (stopped) {
      return;
    }
    const next = pickPersisted(store.getState());
    if (lastSaved && PERSISTED_KEYS.every((name) => next[name] === lastSaved[name])) {
      return;
    }
    if (write(storage, key, JSON.stringify({ version: STATE_VERSION, state: next }))) {
      lastSaved = next; // a failed write leaves lastSaved stale, so the next change retries
    }
  };

  flush();
  const unsubscribe = store.subscribe(() => {
    if (!flushPending) {
      flushPending = true;
      schedule(flush);
    }
  });
  return () => {
    unsubscribe();
    if (flushPending) {
      flush();
    }
    stopped = true;
  };
}

// Removes a saved copy (used when a Respondent logs out and the server has it)
export function clearPersistedState(storage, key = STORAGE_KEY) {
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Could not remove saved diary data "${key}":`, error);
    return false;
  }
}

// window.localStorage if it's usable, otherwise undefined, in which case the
// diary still works but nothing survives a reload. Merely reading the
// property can throw (storage blocked by browser settings); and Node's own
// global localStorage, which shadows jsdom's under vitest, has no methods
// unless given a backing file.
export function getBrowserStorage(scope = globalThis) {
  try {
    const storage = scope.localStorage;
    if (typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function') {
      return storage;
    }
  } catch {
    // fall through
  }
  console.warn('localStorage is not available - diary entries will not be saved.');
  return undefined;
}
