import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// appSync, the store and the session are singletons built when first imported,
// so each test loads fresh ones with accounts on and a fake backend
describe('logging out from the page (server accounts on)', () => {
  let originalGeneral;
  let backendDown;
  let requests;
  let modules;

  beforeEach(async () => {
    originalGeneral = GLOBALS.DATA.general;
    GLOBALS.DATA.general = {
      ...originalGeneral,
      server_accounts: true,
      backend_url: 'https://diary.example.org',
    };
    backendDown = false;
    requests = [];
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const method = options.method ?? 'GET';
        requests.push(`${method} ${url}`);
        if (backendDown && url.endsWith('/state')) {
          throw new TypeError('Failed to fetch');
        }
        if (method === 'GET' && url.endsWith('/state')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ revision: 1 }) };
      })
    );
    vi.resetModules();
    modules = {
      sync: await import('./appSync'),
      session: (await import('../auth/session')).appSession,
      store: (await import('../store/appStore')).appStore,
      status: (await import('./syncStatus')).appSyncStatus,
      actions: await import('../store/actionTypes'),
    };
    modules.session.start({ token: 'tok', respondentId: 'A', expiresAt: FUTURE });
    await settle();
  });

  afterEach(() => {
    GLOBALS.DATA.general = originalGeneral;
    vi.unstubAllGlobals();
  });

  const typeSomething = () =>
    modules.store.dispatch({
      type: modules.actions.ADD_ENTRY,
      payload: {
        date: '2026-08-20',
        dimensionIndex: 0,
        id: 0,
        startOffsetMins: 0,
        endOffsetMins: 10,
        activity: 'Sleep',
      },
    });

  it('sends the unsent changes first, then logs out', async () => {
    typeSomething();

    await modules.sync.requestLogout();

    expect(requests.filter((r) => r.startsWith('PUT'))).toHaveLength(1);
    expect(modules.session.get()).toBeNull();
    expect(modules.status.getNotice()).toBeNull();
  });

  it('does not log out when they could not be sent: it asks the Respondent instead', async () => {
    typeSomething();
    backendDown = true;

    await modules.sync.requestLogout();

    expect(modules.session.get()).not.toBeNull();
    expect(modules.store.getState().diaries['2026-08-20']).toBeDefined();
    expect(modules.status.getNotice()).toEqual({ kind: 'unsent' });
  });

  it('logs out anyway when asked to, keeping the changes on this device', async () => {
    typeSomething();
    backendDown = true;
    await modules.sync.requestLogout();

    await modules.sync.logoutAnyway();
    await settle();

    expect(modules.session.get()).toBeNull();
    expect(modules.status.getNotice()).toBeNull();
    expect(modules.store.getState().diaries).toEqual({});
    expect(localStorage.getItem('state.A')).not.toBeNull();
  });

  it('logs out when a second try finds the server back', async () => {
    typeSomething();
    backendDown = true;
    await modules.sync.requestLogout();
    backendDown = false;

    await modules.sync.requestLogout();
    await settle();

    expect(modules.session.get()).toBeNull();
    expect(modules.status.getNotice()).toBeNull();
    expect(localStorage.getItem('state.A')).toBeNull();
  });
});
