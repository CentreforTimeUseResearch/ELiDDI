// The Respondent's login for this browser tab: who they are, when it ends, and
// the bearer token (docs/adr/0007-server-sync-model.md).
//
// Kept in sessionStorage, not localStorage: it survives a reload but not
// closing the tab, so a token never outlives the sitting on a shared device.
// The token is held here only; it is never put in the store (which is saved to
// localStorage) and never used in a storage key. The Respondent id is the
// non-secret handle for keying local state.

export const SESSION_KEY = 'eliddi.session';

// setTimeout cannot wait longer than this (about 24.8 days)
const MAX_TIMER_MS = 2 ** 31 - 1;

// subscribers get ({ respondentId, expiresAt } | null, reason), where reason is
// 'login', 'logout' or 'expired'
export function createSession({
  storage,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let current = null; // { token, respondentId, expiresAt }
  let timer = null;
  const subscribers = new Set();

  const expiryMs = (login) => Date.parse(login.expiresAt);
  const isExpired = (login) => !(expiryMs(login) > now());
  const isLogin = (value) =>
    value !== null &&
    typeof value === 'object' &&
    [value.token, value.respondentId, value.expiresAt].every((v) => typeof v === 'string' && v) &&
    Number.isFinite(Date.parse(value.expiresAt));

  const store = (value) => {
    try {
      if (value) {
        storage?.setItem(SESSION_KEY, JSON.stringify(value));
      } else {
        storage?.removeItem(SESSION_KEY);
      }
    } catch {
      // storage that refuses writes: the login then lasts only as long as this page
    }
  };

  const publicView = () =>
    current ? { respondentId: current.respondentId, expiresAt: current.expiresAt } : null;

  const notify = (reason) => subscribers.forEach((fn) => fn(publicView(), reason));

  const end = (reason) => {
    clearTimer(timer);
    timer = null;
    const hadLogin = current !== null;
    current = null;
    store(null);
    if (hadLogin) {
      notify(reason);
    }
  };

  const check = () => {
    if (current && isExpired(current)) {
      end('expired');
    }
  };

  const schedule = () => {
    clearTimer(timer);
    timer = null;
    if (current) {
      const wait = Math.max(expiryMs(current) - now(), 0) + 50;
      timer = setTimer(check, Math.min(wait, MAX_TIMER_MS));
    }
  };

  // restore a login from before a reload, unless it has run out
  try {
    const saved = JSON.parse(storage?.getItem(SESSION_KEY) ?? 'null');
    if (isLogin(saved) && !isExpired(saved)) {
      current = saved;
      schedule();
    } else if (saved !== null) {
      store(null);
    }
  } catch {
    store(null);
  }

  return {
    // { respondentId, expiresAt }, or null when nobody is logged in
    get() {
      check();
      return publicView();
    },
    // for Authorization headers; null when nobody is logged in
    getToken() {
      check();
      return current?.token ?? null;
    },
    start({ token, respondentId, expiresAt }) {
      const login = { token, respondentId, expiresAt };
      if (!isLogin(login) || isExpired(login)) {
        throw new Error('not a usable login');
      }
      current = login;
      store(login);
      schedule();
      notify('login');
    },
    // reason: 'logout' (the Respondent chose to), or 'expired' (a request got 401)
    end,
    // ends the login if its time has run out; call when the page becomes visible again
    check,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

function getSessionStorage(scope = globalThis) {
  try {
    const storage = scope.sessionStorage;
    if (typeof storage?.getItem === 'function' && typeof storage?.setItem === 'function') {
      return storage;
    }
  } catch {
    // fall through
  }
  return undefined;
}

// the one login for this page, like appStore for the diary
export const appSession = createSession({ storage: getSessionStorage() });
