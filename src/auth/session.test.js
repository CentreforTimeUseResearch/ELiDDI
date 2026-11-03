import { describe, it, expect, vi } from 'vitest';
import { createSession, SESSION_KEY } from './session';

const T0 = Date.parse('2030-01-01T09:00:00Z');
const LOGIN = { token: 'tok', respondentId: 'r-1', expiresAt: '2030-01-01T21:00:00Z' };

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

// a clock and timer queue the tests drive by hand
function fakeTime(start = T0) {
  let current = start;
  const timers = new Map();
  let nextId = 1;
  return {
    now: () => current,
    setTimer: (fn, ms) => {
      timers.set(nextId, { fn, at: current + ms });
      return nextId++;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      current += ms;
      [...timers].forEach(([id, timer]) => {
        if (timer.at <= current) {
          timers.delete(id);
          timer.fn();
        }
      });
    },
    set(ms) {
      current = ms;
    },
    pending: () => timers.size,
  };
}

function setup(storage = memoryStorage(), time = fakeTime()) {
  return { storage, time, session: createSession({ storage, ...time }) };
}

describe('session', () => {
  it('starts with nobody logged in', () => {
    const { session } = setup();

    expect(session.get()).toBeNull();
    expect(session.getToken()).toBeNull();
  });

  it('start() logs in; get() exposes who, never the token', () => {
    const { session } = setup();

    session.start(LOGIN);

    expect(session.get()).toEqual({ respondentId: 'r-1', expiresAt: LOGIN.expiresAt });
    expect(JSON.stringify(session.get())).not.toContain('tok');
    expect(session.getToken()).toBe('tok');
  });

  it.each([
    [{ ...LOGIN, token: '' }],
    [{ ...LOGIN, respondentId: undefined }],
    [{ ...LOGIN, expiresAt: 'yesterday' }],
    [{ ...LOGIN, expiresAt: '2029-12-31T00:00:00Z' }],
  ])('refuses to start an unusable login %j', (login) => {
    const { session } = setup();

    expect(() => session.start(login)).toThrow();
    expect(session.get()).toBeNull();
  });

  it('tells subscribers about a login, a logout and an expiry', () => {
    const { session } = setup();
    const seen = vi.fn();
    session.subscribe(seen);

    session.start(LOGIN);
    session.end('logout');
    session.start(LOGIN);
    session.end('expired');

    expect(seen.mock.calls).toEqual([
      [{ respondentId: 'r-1', expiresAt: LOGIN.expiresAt }, 'login'],
      [null, 'logout'],
      [{ respondentId: 'r-1', expiresAt: LOGIN.expiresAt }, 'login'],
      [null, 'expired'],
    ]);
  });

  it('can be unsubscribed from', () => {
    const { session } = setup();
    const seen = vi.fn();
    session.subscribe(seen)();

    session.start(LOGIN);

    expect(seen).not.toHaveBeenCalled();
  });

  it('ending when nobody is logged in tells nobody', () => {
    const { session } = setup();
    const seen = vi.fn();
    session.subscribe(seen);

    session.end('logout');

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('expiry', () => {
  it('ends the login by itself when it runs out', () => {
    const { session, time } = setup();
    const seen = vi.fn();
    session.start(LOGIN);
    session.subscribe(seen);

    time.advance(12 * 60 * 60 * 1000 - 1000);
    expect(session.get()).not.toBeNull();

    time.advance(2000);
    expect(session.get()).toBeNull();
    expect(seen).toHaveBeenCalledWith(null, 'expired');
  });

  it('notices an expiry on read, even if a sleeping device never ran the timer', () => {
    const { session, time } = setup();
    session.start(LOGIN);
    const seen = vi.fn();
    session.subscribe(seen);

    time.set(T0 + 13 * 60 * 60 * 1000); // woke up late; no timer has fired

    expect(session.getToken()).toBeNull();
    expect(seen).toHaveBeenCalledWith(null, 'expired');
  });

  it('check() ends a login that has run out and leaves a live one alone', () => {
    const { session, time } = setup();
    session.start(LOGIN);

    session.check();
    expect(session.get()).not.toBeNull();

    time.set(Date.parse(LOGIN.expiresAt) + 1);
    session.check();
    expect(session.get()).toBeNull();
  });

  it('stops its timer when the login ends', () => {
    const { session, time } = setup();
    session.start(LOGIN);
    expect(time.pending()).toBe(1);

    session.end('logout');

    expect(time.pending()).toBe(0);
  });

  it('keeps only one timer across logins', () => {
    const { session, time } = setup();

    session.start(LOGIN);
    session.start({ ...LOGIN, token: 'tok2' });

    expect(time.pending()).toBe(1);
  });

  it('never asks for a timer longer than setTimeout can wait', () => {
    const setTimer = vi.fn(() => 1);
    const session = createSession({ now: () => T0, setTimer, clearTimer: () => {} });

    session.start({ ...LOGIN, expiresAt: '2099-01-01T00:00:00Z' });

    expect(setTimer.mock.calls[0][1]).toBeLessThanOrEqual(2 ** 31 - 1);
  });
});

describe('storage', () => {
  it('keeps the login in the storage it was given, under one key', () => {
    const { session, storage } = setup();

    session.start(LOGIN);

    expect(Object.keys(storage.data)).toEqual([SESSION_KEY]);
    expect(JSON.parse(storage.data[SESSION_KEY])).toEqual(LOGIN);
  });

  it('forgets the login when it ends', () => {
    const { session, storage } = setup();
    session.start(LOGIN);

    session.end('logout');

    expect(storage.data).toEqual({});
  });

  it('restores a login after a reload', () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify(LOGIN) });

    const { session } = setup(storage);

    expect(session.get()).toEqual({ respondentId: 'r-1', expiresAt: LOGIN.expiresAt });
    expect(session.getToken()).toBe('tok');
  });

  it('restores nothing, and clears it, when the saved login has run out', () => {
    const storage = memoryStorage({
      [SESSION_KEY]: JSON.stringify({ ...LOGIN, expiresAt: '2029-01-01T00:00:00Z' }),
    });

    const { session } = setup(storage);

    expect(session.get()).toBeNull();
    expect(storage.data).toEqual({});
  });

  it.each(['not json', '{"token":1}', '[]', '"x"'])('ignores damaged storage %j', (saved) => {
    const storage = memoryStorage({ [SESSION_KEY]: saved });

    const { session } = setup(storage);

    expect(session.get()).toBeNull();
    expect(storage.data).toEqual({});
  });

  it('still works, for this page, when storage refuses writes', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const { session } = setup(storage);

    session.start(LOGIN);
    expect(session.getToken()).toBe('tok');

    session.end('logout');
    expect(session.getToken()).toBeNull();
  });

  it('works without any storage', () => {
    const session = createSession({ storage: undefined, ...fakeTime() });

    session.start(LOGIN);

    expect(session.get()).not.toBeNull();
  });
});
