import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  STORAGE_KEY,
  STATE_VERSION,
  loadPersistedState,
  persistStore,
  getBrowserStorage,
} from './persistence';
import { createStore } from './store';
import { eliddiReducer } from './eliddiReducer';
import { ADD_ENTRY, SHOW_PANEL, SWITCH_DIMENSION, SWITCH_DATE } from './actionTypes';

// a minimal in-memory Web Storage (getItem/setItem) - the test environment's
// own localStorage isn't usable (see getBrowserStorage)
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: vi.fn((key, value) => {
      data.set(key, String(value));
    }),
  };
}

const DIARIES = {
  '2026-08-21': {
    timelines: [[{ id: 0, startOffsetMins: 0, endOffsetMins: 30, activity: 'Sleep' }]],
    status: 0,
  },
};

const PERSISTED = {
  onboarding: false,
  onboardingStep: 2,
  currentDate: '2026-08-21',
  diaries: DIARIES,
};

function backupsIn(storage) {
  return [...storage.data.keys()].filter((key) => key.startsWith(`${STORAGE_KEY}.backup.`));
}

describe('loadPersistedState', () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined when nothing has been saved yet', () => {
    expect(loadPersistedState(memoryStorage())).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('restores the current versioned format', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: STATE_VERSION, state: PERSISTED }),
    });

    expect(loadPersistedState(storage)).toEqual(PERSISTED);
    expect(backupsIn(storage)).toHaveLength(0);
  });

  // every Diary saved before #142 is in this format - it must migrate, not
  // be discarded, or every returning Respondent loses their diary
  it('migrates the legacy unversioned format, keeping only durable keys', () => {
    const legacy = { ...PERSISTED, isDesktopLayout: true, someRetiredSlice: 'x' };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });

    expect(loadPersistedState(storage)).toEqual(PERSISTED);
    expect(backupsIn(storage)).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  // JSON serialises the holes dimensionTimelines leaves (a Dimension touched
  // before a lower-indexed one) as null - Timeline treats a non-array slot
  // as "not created yet", so these are valid
  it('accepts null Timeline slots', () => {
    const diaries = { '2026-08-21': { timelines: [null, null, []], status: 0 } };
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: STATE_VERSION, state: { ...PERSISTED, diaries } }),
    });

    expect(loadPersistedState(storage).diaries).toEqual(diaries);
  });

  it.each([
    ['corrupt JSON', '{"version": 1, "state": {'],
    ['an unsupported version', JSON.stringify({ version: 99, state: PERSISTED })],
    ['a non-object', JSON.stringify(42)],
  ])('starts fresh from %s, backing the raw value up first', (_, raw) => {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });

    expect(loadPersistedState(storage)).toBeUndefined();

    const backups = backupsIn(storage);
    expect(backups).toHaveLength(1);
    expect(storage.data.get(backups[0])).toBe(raw);
    expect(warn).toHaveBeenCalledOnce();
  });

  // regression coverage (#142): persisted state used to become the app's
  // initial state with no check at all. Every Timeline reads
  // diaries[date]?.timelines[i], so a Diary with no timelines array threw
  // on boot - with no way for the Respondent to recover
  it('drops only the unreadable key, keeping the rest, and backs the original up', () => {
    const broken = { ...PERSISTED, diaries: { '2026-08-21': { status: 0 } } };
    const raw = JSON.stringify({ version: STATE_VERSION, state: broken });
    const storage = memoryStorage({ [STORAGE_KEY]: raw });

    const state = loadPersistedState(storage);

    expect(state).toEqual({ onboarding: false, onboardingStep: 2, currentDate: '2026-08-21' });
    expect(storage.data.get(backupsIn(storage)[0])).toBe(raw);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('diaries'));
  });

  it.each([
    ['currentDate', 20260821],
    ['currentDate', 'yesterday'],
    ['onboardingStep', -1],
    ['onboarding', 'yes'],
    ['diaries', []],
    ['diaries', { '2026-08-21': { timelines: [[null]], status: 0 } }],
  ])('rejects an invalid %s (%j)', (key, value) => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: STATE_VERSION,
        state: { ...PERSISTED, [key]: value },
      }),
    });

    expect(loadPersistedState(storage)).not.toHaveProperty(key);
  });

  it('returns undefined, without throwing, when storage itself throws on read', () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadPersistedState(storage)).toBeUndefined();
  });

  it('round-trips state saved by persistStore', () => {
    const storage = memoryStorage();
    const store = createStore(eliddiReducer, PERSISTED);
    persistStore(store, storage, { schedule: (flush) => flush() });

    expect(loadPersistedState(storage)).toEqual(PERSISTED);
  });
});

describe('persistStore', () => {
  let storage;
  let store;
  let queue;

  // flushes run when the test says so, standing in for queueMicrotask
  const schedule = (flush) => queue.push(flush);
  const runScheduled = () => queue.splice(0).forEach((flush) => flush());
  const savedBlob = () => JSON.parse(storage.data.get(STORAGE_KEY));

  beforeEach(() => {
    queue = [];
    storage = memoryStorage();
    store = createStore(eliddiReducer, PERSISTED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes once at startup, so a migrated legacy blob is re-saved in the current format', () => {
    persistStore(store, storage, { schedule });

    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(savedBlob()).toEqual({ version: STATE_VERSION, state: PERSISTED });
  });

  // regression coverage (#142): persistence excluded transient slices by a
  // denylist, so any newly added slice was silently persisted
  it('saves only the durable slices, never transient UI state', () => {
    persistStore(store, storage, { schedule });
    store.dispatch({ type: SHOW_PANEL, payload: 'details' });
    store.dispatch({ type: SWITCH_DATE, payload: '2026-08-22' });
    runScheduled();

    expect(Object.keys(savedBlob().state).sort()).toEqual([
      'currentDate',
      'diaries',
      'onboarding',
      'onboardingStep',
    ]);
  });

  // regression coverage (#142): every dispatch re-serialised the whole
  // diary set synchronously, including purely UI-only ones
  it('does not write when only transient UI state changed', () => {
    persistStore(store, storage, { schedule });
    storage.setItem.mockClear();

    store.dispatch({ type: SHOW_PANEL, payload: 'details' });
    store.dispatch({ type: SWITCH_DIMENSION, payload: 3 });
    runScheduled();

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('coalesces a burst of dispatches into one write', () => {
    persistStore(store, storage, { schedule });
    storage.setItem.mockClear();

    for (let id = 1; id <= 3; id++) {
      store.dispatch({
        type: ADD_ENTRY,
        payload: {
          date: '2026-08-21',
          dimensionIndex: 1,
          id,
          startOffsetMins: 0,
          endOffsetMins: 10,
        },
      });
    }
    expect(storage.setItem).not.toHaveBeenCalled(); // nothing until the scheduled flush
    runScheduled();

    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(savedBlob().state.diaries['2026-08-21'].timelines[1]).toHaveLength(3);
  });

  it('does not throw when storage is full, and retries on the next change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    persistStore(store, storage, { schedule });
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    store.dispatch({ type: SWITCH_DATE, payload: '2026-08-22' });
    expect(() => runScheduled()).not.toThrow();

    store.dispatch({ type: SHOW_PANEL, payload: 'details' }); // UI-only, but the last write failed
    runScheduled();

    expect(savedBlob().state.currentDate).toBe('2026-08-22');
  });

  it('stops saving once unsubscribed', () => {
    const unsubscribe = persistStore(store, storage, { schedule });
    storage.setItem.mockClear();

    unsubscribe();
    store.dispatch({ type: SWITCH_DATE, payload: '2026-08-22' });
    runScheduled();

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('getBrowserStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined, with a warning, when there is no usable Web Storage', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getBrowserStorage({ localStorage: {} })).toBeUndefined();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('returns undefined when merely reading localStorage throws (storage blocked)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blocked = {
      get localStorage() {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    expect(getBrowserStorage(blocked)).toBeUndefined();
  });

  it('returns localStorage when it is usable', () => {
    const storage = memoryStorage();
    expect(getBrowserStorage({ localStorage: storage })).toBe(storage);
  });
});
