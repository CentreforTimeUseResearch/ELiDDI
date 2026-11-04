import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSync } from './syncManager';
import { baseOf, fingerprint } from './reconcile';
import { createSyncStatus, SYNC_STATUS } from './syncStatus';
import { createSession } from '../auth/session';
import { createStore } from '../store/store';
import { eliddiReducer } from '../store/eliddiReducer';
import { STATE_VERSION, STORAGE_KEY } from '../store/persistence';
import { ADD_ENTRY, DISMISS_ONBOARDING, SET_COMPLETE, SWITCH_DATE } from '../store/actionTypes';

const BACKEND = 'https://diary.example.org';
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const DAY = '2026-08-20';
const OTHER_DAY = '2026-08-21';

// --- fakes ------------------------------------------------------------------

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

// timers that only run when the test says so
function manualTimers() {
  let now = 0;
  let nextId = 1;
  let queue = [];
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      queue.push({ id, fn, at: now + ms });
      return id;
    },
    clearTimer(id) {
      queue = queue.filter((timer) => timer.id !== id);
    },
    pendingDelays: () => queue.map((timer) => timer.at - now),
    async advance(ms) {
      now += ms;
      for (;;) {
        const due = queue.filter((timer) => timer.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) {
          return;
        }
        queue = queue.filter((timer) => timer !== due);
        due.fn();
        await settle();
      }
    },
  };
}

// lets stubbed fetches and the awaits around them finish
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// a stand-in backend: one snapshot per Respondent, 'tok-<id>' as their token
function fakeServer() {
  const snapshots = new Map(); // id -> { revision, stateVersion, state }
  const server = {
    snapshots,
    requests: [],
    down: false, // network failure
    failWith: null, // a status to answer every state request with
    set(id, state, { revision = 1, stateVersion = STATE_VERSION } = {}) {
      snapshots.set(id, { revision, stateVersion, state });
    },
    puts: () => server.requests.filter((r) => r.method === 'PUT'),
    fetchFn: vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET';
      const token = options.headers?.Authorization?.replace('Bearer ', '');
      server.requests.push({ method, url, token, body: options.body && JSON.parse(options.body) });
      if (server.down) {
        throw new TypeError('Failed to fetch');
      }
      const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
      if (server.failWith) {
        return reply(server.failWith, {});
      }
      if (!token?.startsWith('tok-')) {
        return reply(401, {});
      }
      const id = token.slice(4);
      const current = snapshots.get(id);
      if (method === 'GET') {
        return current ? reply(200, current) : reply(404, {});
      }
      const body = JSON.parse(options.body);
      if (body.baseRevision !== (current?.revision ?? 0)) {
        return reply(409, current ?? { revision: 0 });
      }
      const next = {
        revision: body.baseRevision + 1,
        stateVersion: body.stateVersion,
        state: body.state,
      };
      snapshots.set(id, next);
      return reply(200, { revision: next.revision });
    }),
  };
  return server;
}

const entry = (activity) => ({ id: 0, startOffsetMins: 0, endOffsetMins: 10, activity });
const diaryWith = (activity, status = 0) => ({ timelines: [[entry(activity)]], status });

const addEntry = (store, date, activity, id = 0) =>
  store.dispatch({
    type: ADD_ENTRY,
    payload: { date, dimensionIndex: 0, id, startOffsetMins: 0, endOffsetMins: 10, activity },
  });

const activityOn = (store, date) =>
  store.getState().diaries[date]?.timelines[0]?.map((e) => e.activity);

function setup() {
  const store = createStore(eliddiReducer);
  const storage = memoryStorage();
  const server = fakeServer();
  const timers = manualTimers();
  const status = createSyncStatus();
  const history = [];
  status.subscribe((value) => history.push(value));
  const session = createSession({
    storage: memoryStorage(),
    setTimer: () => 0,
    clearTimer: () => {},
  });
  const sync = createSync({
    store,
    session,
    storage,
    backendUrl: BACKEND,
    status,
    fetchFn: server.fetchFn,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  sync.start();

  const world = {
    store,
    storage,
    server,
    timers,
    status,
    history,
    session,
    sync,
    async login(id) {
      session.start({ token: `tok-${id}`, respondentId: id, expiresAt: FUTURE });
      await settle();
    },
    async logout() {
      session.end('logout');
      await settle();
    },
    // the copy on this device, as persistStore + the sync bookkeeping saved it
    copy: (id) => JSON.parse(storage.getItem(`${STORAGE_KEY}.${id}`) ?? 'null'),
    meta: (id) => JSON.parse(storage.getItem(`${STORAGE_KEY}.${id}.sync`) ?? 'null'),
    // a copy left by an earlier visit
    seedCopy(id, state, { revision = 0, dirty = true, base = {} } = {}) {
      storage.setItem(`${STORAGE_KEY}.${id}`, JSON.stringify({ version: STATE_VERSION, state }));
      storage.setItem(`${STORAGE_KEY}.${id}.sync`, JSON.stringify({ revision, dirty, base }));
    },
    // a burst of work, then the quiet period that sends it
    async editAndWait(date, activity) {
      addEntry(store, date, activity);
      await timers.advance(2000);
    },
  };
  return world;
}

let w;
beforeEach(() => {
  w = setup();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// --- logging in -----------------------------------------------------------------

describe('logging in', () => {
  it('shows nothing until the server has answered, then starts empty when nobody has anything', async () => {
    await w.login('A');

    expect(w.history).toEqual([SYNC_STATUS.LOADING, SYNC_STATUS.SAVED]);
    expect(w.store.getState().diaries).toEqual({});
    expect(w.server.puts()).toHaveLength(0);
  });

  it('asks for the server’s copy with the Respondent’s token', async () => {
    await w.login('A');

    expect(w.server.requests[0]).toMatchObject({
      method: 'GET',
      url: `${BACKEND}/state`,
      token: 'tok-A',
    });
  });

  it('adopts the server’s copy when this device has none', async () => {
    w.server.set(
      'A',
      { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } },
      { revision: 3 }
    );

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
    expect(w.store.getState().onboarding).toBe(false);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    expect(w.server.puts()).toHaveLength(0);
  });

  it('adopts the server’s copy over a local one that has no unsent changes', async () => {
    w.seedCopy('A', { diaries: { [DAY]: diaryWith('Stale') } }, { revision: 2, dirty: false });
    w.server.set(
      'A',
      { onboarding: true, diaries: { [DAY]: diaryWith('Fresh') } },
      { revision: 3 }
    );

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['Fresh']);
    expect(w.server.puts()).toHaveLength(0);
  });

  it('keeps this device’s onboarding step and day, which are never synced', async () => {
    w.seedCopy('A', { onboardingStep: 3, currentDate: OTHER_DAY }, { revision: 1, dirty: false });
    w.server.set('A', { onboarding: true, diaries: {} });

    await w.login('A');

    expect(w.store.getState().onboardingStep).toBe(3);
    expect(w.store.getState().currentDate).toBe(OTHER_DAY);
  });

  it('sends this device’s copy when the server has nothing yet', async () => {
    w.seedCopy('A', { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } });

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
    expect(w.server.puts()).toHaveLength(1);
    expect(w.server.puts()[0].body).toEqual({
      baseRevision: 0,
      stateVersion: STATE_VERSION,
      state: { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } },
    });
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    expect(w.meta('A')).toMatchObject({ revision: 1, dirty: false });
    expect(w.meta('A').base[DAY]).toBe(fingerprint(diaryWith('Sleep')));
  });

  describe('when this device has unsent changes and the server has a different copy', () => {
    beforeEach(() => {
      w.seedCopy(
        'A',
        {
          onboarding: false,
          diaries: {
            [DAY]: diaryWith('Edited here'),
            [OTHER_DAY]: diaryWith('Finished here', 100),
            '2026-08-22': diaryWith('Only here'),
          },
        },
        { revision: 1, dirty: true }
      );
      w.server.set(
        'A',
        {
          onboarding: true,
          diaries: {
            [DAY]: diaryWith('Edited elsewhere'),
            [OTHER_DAY]: diaryWith('Half done elsewhere', 0),
            '2026-08-19': diaryWith('Only there'),
          },
        },
        { revision: 5 }
      );
    });

    it('merges per day: the server wins a clash, a finished Diary wins, the rest are kept', async () => {
      await w.login('A');

      const { diaries } = w.store.getState();
      expect(activityOn(w.store, DAY)).toEqual(['Edited elsewhere']);
      expect(diaries[OTHER_DAY].status).toBe(100);
      expect(activityOn(w.store, '2026-08-22')).toEqual(['Only here']);
      expect(activityOn(w.store, '2026-08-19')).toEqual(['Only there']);
      expect(w.store.getState().onboarding).toBe(false);
    });

    it('keeps the version it replaced in a backup', async () => {
      await w.login('A');

      const backupKey = [...w.storage.data.keys()].find((key) => key.includes('.backup.'));
      expect(JSON.parse(w.storage.data.get(backupKey))).toEqual({
        diaries: { [DAY]: diaryWith('Edited here') },
      });
    });

    it('sends the merged copy on top of the server’s revision', async () => {
      await w.login('A');

      expect(w.server.puts()).toHaveLength(1);
      expect(w.server.puts()[0].body.baseRevision).toBe(5);
      expect(w.server.snapshots.get('A').revision).toBe(6);
      expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    });
  });

  it('never reads or writes the old single "state" key', async () => {
    w.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, state: { diaries: { [DAY]: diaryWith('Stranger') } } })
    );

    await w.login('A');
    await w.editAndWait(DAY, 'Mine');

    expect(activityOn(w.store, DAY)).toEqual(['Mine']);
    expect(
      JSON.parse(w.storage.getItem(STORAGE_KEY)).state.diaries[DAY].timelines[0][0].activity
    ).toBe('Stranger');
  });

  it('picks up a login that survived a page reload', async () => {
    const store = createStore(eliddiReducer);
    const session = createSession({
      storage: memoryStorage(),
      setTimer: () => 0,
      clearTimer: () => {},
    });
    session.start({ token: 'tok-A', respondentId: 'A', expiresAt: FUTURE });
    w.server.set('A', { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } });

    createSync({
      store,
      session,
      storage: w.storage,
      backendUrl: BACKEND,
      status: createSyncStatus(),
      fetchFn: w.server.fetchFn,
    }).start();
    await settle();

    expect(activityOn(store, DAY)).toEqual(['Sleep']);
  });
});

// --- saving ------------------------------------------------------------------------

describe('saving changes', () => {
  beforeEach(async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
  });

  it('writes the local copy at once and marks it unsent', async () => {
    addEntry(w.store, DAY, 'Sleep');
    await settle();

    expect(w.copy('A').state.diaries[DAY].timelines[0][0].activity).toBe('Sleep');
    expect(w.meta('A')).toMatchObject({ revision: 1, dirty: true });
    expect(w.server.puts()).toHaveLength(0);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVING);
  });

  it('sends a burst of changes as one request after a quiet period', async () => {
    addEntry(w.store, DAY, 'Sleep', 0);
    await w.timers.advance(1000);
    addEntry(w.store, DAY, 'Work', 1);
    await w.timers.advance(1000);
    expect(w.server.puts()).toHaveLength(0); // the quiet period started again

    await w.timers.advance(1000);

    expect(w.server.puts()).toHaveLength(1);
    expect(w.server.puts()[0].body.baseRevision).toBe(1);
    expect(w.server.puts()[0].body.state.diaries[DAY].timelines[0]).toHaveLength(2);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    expect(w.meta('A')).toMatchObject({ revision: 2, dirty: false });
    expect(Object.keys(w.meta('A').base)).toEqual([DAY]);
  });

  it('builds each write on the revision of the one before', async () => {
    await w.editAndWait(DAY, 'Sleep');
    addEntry(w.store, DAY, 'Work', 1);
    await w.timers.advance(2000);

    expect(w.server.puts().map((r) => r.body.baseRevision)).toEqual([1, 2]);
  });

  it('sends the onboarding choice', async () => {
    w.store.dispatch({ type: DISMISS_ONBOARDING });
    await w.timers.advance(2000);

    expect(w.server.puts()[0].body.state.onboarding).toBe(false);
  });

  it('does not send anything for device-local changes such as the day being viewed', async () => {
    w.store.dispatch({ type: SWITCH_DATE, payload: OTHER_DAY });
    await w.timers.advance(10000);

    expect(w.server.puts()).toHaveLength(0);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('sends only the synced part of the state', async () => {
    await w.editAndWait(DAY, 'Sleep');

    expect(Object.keys(w.server.puts()[0].body.state).sort()).toEqual(['diaries', 'onboarding']);
  });

  it('sends a change made while a request was out in a second request', async () => {
    addEntry(w.store, DAY, 'Sleep', 0);
    const settled = w.timers.advance(2000); // starts the first request
    addEntry(w.store, DAY, 'Work', 1); // before it has been answered
    await settled;
    await w.timers.advance(2000);

    expect(w.server.puts()).toHaveLength(2);
    expect(w.server.snapshots.get('A').state.diaries[DAY].timelines[0]).toHaveLength(2);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('sends at once when asked to (the page is being left)', async () => {
    addEntry(w.store, DAY, 'Sleep');

    w.sync.flush();
    await settle();

    expect(w.server.puts()).toHaveLength(1);
  });

  it('does nothing when asked to send and nothing is unsent', async () => {
    w.sync.flush();
    await settle();

    expect(w.server.puts()).toHaveLength(0);
  });
});

// --- another device changed it ----------------------------------------------------------

describe('when another device saved first', () => {
  beforeEach(async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
  });

  it('merges the server’s copy and sends the result, losing nothing', async () => {
    w.server.set(
      'A',
      { onboarding: true, diaries: { [OTHER_DAY]: diaryWith('From the tablet') } },
      { revision: 4 }
    );

    await w.editAndWait(DAY, 'From the phone');

    expect(activityOn(w.store, DAY)).toEqual(['From the phone']);
    expect(activityOn(w.store, OTHER_DAY)).toEqual(['From the tablet']);
    expect(w.server.snapshots.get('A').revision).toBe(5);
    expect(Object.keys(w.server.snapshots.get('A').state.diaries).sort()).toEqual([DAY, OTHER_DAY]);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('takes the server’s version of a day both devices changed, and keeps this device’s as a backup', async () => {
    w.server.set(
      'A',
      { onboarding: true, diaries: { [DAY]: diaryWith('From the tablet') } },
      { revision: 4 }
    );

    await w.editAndWait(DAY, 'From the phone');

    expect(activityOn(w.store, DAY)).toEqual(['From the tablet']);
    const backupKey = [...w.storage.data.keys()].find((key) => key.includes('.backup.'));
    expect(JSON.parse(w.storage.data.get(backupKey)).diaries[DAY].timelines[0][0].activity).toBe(
      'From the phone'
    );
  });

  it('copes with the server having lost the Respondent’s state', async () => {
    w.server.snapshots.delete('A');

    await w.editAndWait(DAY, 'Sleep');

    expect(w.server.snapshots.get('A').revision).toBe(1);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });
});

describe('when two devices work on different days', () => {
  // found in the browser: another device saving a different day must not make
  // this one lose an edit it made to its own
  it('keeps this device’s edit to a day the other device did not touch', async () => {
    w.server.set(
      'A',
      { onboarding: true, diaries: { [DAY]: diaryWith('Sleep') } },
      { revision: 2 }
    );
    await w.login('A');
    // the tablet adds another day; the day this device will edit is as it was
    w.server.set(
      'A',
      {
        onboarding: true,
        diaries: { [DAY]: diaryWith('Sleep'), [OTHER_DAY]: diaryWith('From the tablet') },
      },
      { revision: 3 }
    );

    addEntry(w.store, DAY, 'Work', 1);
    await w.timers.advance(2000);

    expect(activityOn(w.store, DAY)).toEqual(['Sleep', 'Work']);
    expect(activityOn(w.store, OTHER_DAY)).toEqual(['From the tablet']);
    expect(w.server.snapshots.get('A').state.diaries[DAY].timelines[0]).toHaveLength(2);
    expect([...w.storage.data.keys()].some((key) => key.includes('.backup.'))).toBe(false);
  });

  it('takes the other device’s edit to a day this device did not touch', async () => {
    w.server.set(
      'A',
      { onboarding: true, diaries: { [DAY]: diaryWith('Sleep') } },
      { revision: 2 }
    );
    await w.login('A');
    w.server.set(
      'A',
      { onboarding: true, diaries: { [DAY]: diaryWith('Edited on the tablet') } },
      { revision: 3 }
    );

    addEntry(w.store, OTHER_DAY, 'Work');
    await w.timers.advance(2000);

    expect(activityOn(w.store, DAY)).toEqual(['Edited on the tablet']);
    expect(activityOn(w.store, OTHER_DAY)).toEqual(['Work']);
    expect([...w.storage.data.keys()].some((key) => key.includes('.backup.'))).toBe(false);
  });

  it('keeps an edit made offline across a reload, once the server answers', async () => {
    const base = baseOf({ [DAY]: diaryWith('Sleep') });
    w.seedCopy(
      'A',
      {
        onboarding: true,
        diaries: {
          [DAY]: {
            ...diaryWith('Sleep'),
            timelines: [[entry('Sleep'), { ...entry('Work'), id: 1 }]],
          },
        },
      },
      { revision: 2, dirty: true, base }
    );
    w.server.set(
      'A',
      {
        onboarding: true,
        diaries: { [DAY]: diaryWith('Sleep'), [OTHER_DAY]: diaryWith('From the tablet') },
      },
      { revision: 3 }
    );

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['Sleep', 'Work']);
    expect(activityOn(w.store, OTHER_DAY)).toEqual(['From the tablet']);
  });
});

// --- failures ---------------------------------------------------------------------------

describe('when the server cannot be reached', () => {
  beforeEach(async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    w.server.down = true;
  });

  it('keeps the change here, says it is not saved, and retries after 5 seconds, then 10', async () => {
    await w.editAndWait(DAY, 'Sleep');

    expect(w.status.get()).toBe(SYNC_STATUS.UNSAVED);
    expect(w.copy('A').state.diaries[DAY]).toBeDefined();
    expect(w.timers.pendingDelays()).toEqual([5000]);

    await w.timers.advance(5000);
    expect(w.server.puts()).toHaveLength(2);
    expect(w.timers.pendingDelays()).toEqual([10000]);
  });

  it('stops doubling at one minute', async () => {
    await w.editAndWait(DAY, 'Sleep');
    for (const wait of [5000, 10000, 20000, 40000, 60000]) {
      await w.timers.advance(wait);
    }

    expect(w.timers.pendingDelays()).toEqual([60000]);
  });

  it('sends the change once the server is back', async () => {
    await w.editAndWait(DAY, 'Sleep');
    w.server.down = false;

    await w.timers.advance(5000);

    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    expect(w.server.snapshots.get('A').revision).toBe(2);
    expect(w.timers.pendingDelays()).toEqual([]);
  });

  it('tries at once when asked to (the connection came back)', async () => {
    await w.editAndWait(DAY, 'Sleep');
    w.server.down = false;

    w.sync.flush();
    await settle();

    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('treats a server error like a network failure', async () => {
    w.server.down = false;
    w.server.failWith = 503;

    await w.editAndWait(DAY, 'Sleep');

    expect(w.status.get()).toBe(SYNC_STATUS.UNSAVED);
  });
});

describe('when the server refuses the state', () => {
  it.each([413, 422])('says so and stops sending (status %i)', async (status) => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    w.server.failWith = status;

    await w.editAndWait(DAY, 'Sleep');
    addEntry(w.store, DAY, 'More', 1);
    await w.timers.advance(60000);

    expect(w.status.get()).toBe(SYNC_STATUS.REJECTED);
    expect(w.server.puts()).toHaveLength(1);
    expect(w.copy('A').state.diaries[DAY].timelines[0]).toHaveLength(2);
  });
});

describe('when the server holds a newer format than this page understands', () => {
  it('does not show or touch it, and asks for a reload', async () => {
    w.server.set(
      'A',
      { onboarding: false, diaries: {} },
      { revision: 2, stateVersion: STATE_VERSION + 1 }
    );

    await w.login('A');

    expect(w.status.get()).toBe(SYNC_STATUS.OUTDATED);
    expect(w.store.getState().onboarding).toBe(true); // nothing was loaded
    expect(w.server.puts()).toHaveLength(0);
  });

  it('stops writing if it turns up on a conflict', async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    w.server.set(
      'A',
      { onboarding: true, diaries: {} },
      { revision: 2, stateVersion: STATE_VERSION + 1 }
    );

    await w.editAndWait(DAY, 'Sleep');
    await w.timers.advance(60000);

    expect(w.status.get()).toBe(SYNC_STATUS.OUTDATED);
    expect(w.server.puts()).toHaveLength(1);
    expect(w.server.snapshots.get('A').revision).toBe(2);
  });
});

describe('when the diary cannot be loaded at login', () => {
  it('with nothing on this device, says so and offers to try again', async () => {
    w.server.down = true;

    await w.login('A');

    expect(w.status.get()).toBe(SYNC_STATUS.LOAD_FAILED);
    expect(w.store.getState().diaries).toEqual({});

    w.server.down = false;
    w.server.set('A', { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } });
    w.status.retry();
    await settle();

    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
  });

  it('with a copy on this device, works from it and keeps trying', async () => {
    w.seedCopy(
      'A',
      { onboarding: false, diaries: { [DAY]: diaryWith('Sleep') } },
      { revision: 2, dirty: false }
    );
    w.server.down = true;

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
    expect(w.status.get()).toBe(SYNC_STATUS.UNSAVED);

    w.server.down = false;
    w.server.set(
      'A',
      {
        onboarding: false,
        diaries: { [DAY]: diaryWith('Sleep'), [OTHER_DAY]: diaryWith('Later') },
      },
      { revision: 4 }
    );
    await w.timers.advance(5000);

    expect(activityOn(w.store, OTHER_DAY)).toEqual(['Later']);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('with a copy and work done meanwhile, merges once the server answers', async () => {
    w.seedCopy('A', { onboarding: false, diaries: {} }, { revision: 2, dirty: false });
    w.server.down = true;
    await w.login('A');
    addEntry(w.store, DAY, 'Offline work');
    w.server.down = false;
    w.server.set(
      'A',
      { onboarding: false, diaries: { [OTHER_DAY]: diaryWith('Elsewhere') } },
      { revision: 4 }
    );

    await w.timers.advance(5000);

    expect(activityOn(w.store, DAY)).toEqual(['Offline work']);
    expect(activityOn(w.store, OTHER_DAY)).toEqual(['Elsewhere']);
    expect(w.server.snapshots.get('A').revision).toBe(5);
  });

  it('treats a server copy it cannot read as a failure, and does not overwrite it', async () => {
    w.server.set('A', { onboarding: 'maybe', diaries: {} });

    await w.login('A');

    expect(w.status.get()).toBe(SYNC_STATUS.LOAD_FAILED);
    expect(w.server.puts()).toHaveLength(0);
  });
});

// --- the login running out -----------------------------------------------------------------

describe('when the token is refused or runs out', () => {
  beforeEach(async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
  });

  it('ends the session as expired, keeps the work, and stops sending', async () => {
    w.server.failWith = 401;

    await w.editAndWait(DAY, 'Sleep');

    expect(w.session.get()).toBeNull();
    expect(w.status.get()).toBe(SYNC_STATUS.IDLE);
    expect(w.copy('A').state.diaries[DAY]).toBeDefined();
    expect(w.meta('A').dirty).toBe(true);
    await w.timers.advance(60000);
    expect(w.server.puts()).toHaveLength(1);
  });

  it('sends what was unsent when the same person logs in again', async () => {
    addEntry(w.store, DAY, 'Sleep');
    await settle();
    w.session.end('expired');
    expect(w.server.puts()).toHaveLength(0);

    await w.login('A');

    expect(w.server.snapshots.get('A').state.diaries[DAY]).toBeDefined();
    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('does not clear the diary from the store when the login runs out', async () => {
    addEntry(w.store, DAY, 'Sleep');
    await settle();

    w.session.end('expired');

    expect(activityOn(w.store, DAY)).toEqual(['Sleep']);
    expect(w.copy('A')).not.toBeNull();
  });

  it('stops retrying when the login runs out', async () => {
    w.server.down = true;
    await w.editAndWait(DAY, 'Sleep');
    expect(w.timers.pendingDelays()).toEqual([5000]);

    w.session.end('expired');

    expect(w.timers.pendingDelays()).toEqual([]);
  });

  it('keeps the copy and ends the session when the token is refused at login', async () => {
    await w.logout();
    w.seedCopy('A', { diaries: { [DAY]: diaryWith('Kept') } }, { revision: 1, dirty: true });
    w.server.failWith = 401;

    await w.login('A');

    expect(w.session.get()).toBeNull();
    expect(w.copy('A').state.diaries[DAY]).toBeDefined();
  });
});

// --- logging out ----------------------------------------------------------------------------------

describe('logging out', () => {
  beforeEach(async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
  });

  it('empties the store at once, so the next person sees nothing of this diary', async () => {
    await w.editAndWait(DAY, 'Sleep');

    await w.logout();

    expect(w.store.getState().diaries).toEqual({});
    expect(w.store.getState().onboarding).toBe(true);
    expect(w.status.get()).toBe(SYNC_STATUS.IDLE);
  });

  it('removes the local copy when everything had been sent', async () => {
    await w.editAndWait(DAY, 'Sleep');

    await w.logout();

    expect(w.copy('A')).toBeNull();
    expect(w.meta('A')).toBeNull();
    expect(w.server.puts()).toHaveLength(1);
  });

  it('sends what was unsent first, then removes the copy', async () => {
    addEntry(w.store, DAY, 'Not yet sent');
    await settle();

    await w.logout();

    expect(w.server.snapshots.get('A').state.diaries[DAY].timelines[0][0].activity).toBe(
      'Not yet sent'
    );
    expect(w.copy('A')).toBeNull();
  });

  it('keeps the copy, with its changes, if they could not be sent', async () => {
    addEntry(w.store, DAY, 'Not yet sent');
    await settle();
    w.server.down = true;

    await w.logout();

    expect(w.store.getState().diaries).toEqual({});
    expect(w.copy('A').state.diaries[DAY].timelines[0][0].activity).toBe('Not yet sent');
    expect(w.meta('A').dirty).toBe(true);
  });

  it('does not save the emptied store over the copy', async () => {
    addEntry(w.store, DAY, 'Not yet sent');
    w.server.down = true;

    await w.logout();

    expect(w.copy('A').state.diaries[DAY]).toBeDefined();
  });

  it('leaves the next login on this device a clean start, not a late request for the last one', async () => {
    addEntry(w.store, DAY, 'Sleep');
    await settle();
    const logout = w.logout();
    await w.login('B');
    await logout;

    expect(w.store.getState().diaries).toEqual({});
    expect(w.status.get()).toBe(SYNC_STATUS.SAVED);
  });

  it('drops a diary that arrives after the Respondent has already logged out', async () => {
    w.session.end('logout');
    await settle();
    w.server.set('B', { onboarding: false, diaries: { [DAY]: diaryWith('B’s') } });
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const original = w.server.fetchFn.getMockImplementation();
    w.server.fetchFn.mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });

    w.session.start({ token: 'tok-B', respondentId: 'B', expiresAt: FUTURE });
    w.session.end('logout');
    release();
    await settle();

    expect(w.store.getState().diaries).toEqual({});
    expect(w.status.get()).toBe(SYNC_STATUS.IDLE);
  });
});

// --- several people on one device ---------------------------------------------------------------------

describe('several people on one device', () => {
  it('keeps each person’s copy under their own key', async () => {
    await w.login('A'); // neither has sent its change, so neither copy is cleared
    addEntry(w.store, DAY, 'A’s day');
    await settle();
    w.session.end('expired');
    await settle();

    await w.login('B');
    addEntry(w.store, DAY, 'B’s day');
    await settle();

    expect(w.copy('A').state.diaries[DAY].timelines[0][0].activity).toBe('A’s day');
    expect(w.copy('B').state.diaries[DAY].timelines[0][0].activity).toBe('B’s day');
  });

  it('shows the next person nothing of the last, and removes the last person’s copy when it was all sent', async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    await w.editAndWait(DAY, 'A’s day');
    w.session.end('expired');
    await settle();
    expect(activityOn(w.store, DAY)).toEqual(['A’s day']); // hidden behind the login dialog

    await w.login('B');

    expect(w.store.getState().diaries).toEqual({});
    expect(w.copy('A')).toBeNull();
  });

  it('keeps the last person’s copy, hidden, when it held changes not yet sent', async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    addEntry(w.store, DAY, 'A’s unsent day');
    await settle();
    w.session.end('expired');
    await settle();

    await w.login('B');

    expect(w.store.getState().diaries).toEqual({});
    expect(w.copy('A').state.diaries[DAY]).toBeDefined();
    expect(w.server.puts().filter((request) => request.token === 'tok-A')).toHaveLength(0);
  });

  it('gives A their unsent changes back when A logs in again, and sends them', async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');
    addEntry(w.store, DAY, 'A’s unsent day');
    await settle();
    w.session.end('expired');
    await settle();
    await w.login('B');
    await w.logout();

    await w.login('A');

    expect(activityOn(w.store, DAY)).toEqual(['A’s unsent day']);
    expect(w.server.snapshots.get('A').state.diaries[DAY]).toBeDefined();
  });

  it('does not let a slow answer for the first person land in the second’s diary', async () => {
    w.server.set('A', { onboarding: false, diaries: { [DAY]: diaryWith('A’s') } });
    w.server.set('B', { onboarding: false, diaries: { [OTHER_DAY]: diaryWith('B’s') } });
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const original = w.server.fetchFn.getMockImplementation();
    w.server.fetchFn.mockImplementation(async (url, options) => {
      if (options?.headers?.Authorization === 'Bearer tok-A') {
        await gate;
      }
      return original(url, options);
    });

    w.session.start({ token: 'tok-A', respondentId: 'A', expiresAt: FUTURE });
    w.session.end('logout');
    await w.login('B');
    release();
    await settle();

    expect(activityOn(w.store, OTHER_DAY)).toEqual(['B’s']);
    expect(w.store.getState().diaries[DAY]).toBeUndefined();
  });
});

// --- without usable storage ---------------------------------------------------------------------------

describe('without usable storage', () => {
  it('still syncs, from memory', async () => {
    const store = createStore(eliddiReducer);
    const session = createSession({
      storage: memoryStorage(),
      setTimer: () => 0,
      clearTimer: () => {},
    });
    const server = fakeServer();
    const timers = manualTimers();
    const sync = createSync({
      store,
      session,
      storage: undefined,
      backendUrl: BACKEND,
      status: createSyncStatus(),
      fetchFn: server.fetchFn,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
    sync.start();
    session.start({ token: 'tok-A', respondentId: 'A', expiresAt: FUTURE });
    await settle();

    addEntry(store, DAY, 'Sleep');
    await timers.advance(2000);

    expect(server.snapshots.get('A').state.diaries[DAY]).toBeDefined();
  });
});

describe('marking a Diary complete', () => {
  it('is a change like any other', async () => {
    w.server.set('A', { onboarding: true, diaries: {} }, { revision: 1 });
    await w.login('A');

    w.store.dispatch({ type: SET_COMPLETE, payload: { date: DAY } });
    await w.timers.advance(2000);

    expect(w.server.snapshots.get('A').state.diaries[DAY].status).toBe(100);
  });
});
