import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STATE_VERSION, STORAGE_KEY } from './persistence';

// appStore is built once, when it is first imported, from the study config; each
// test loads a fresh copy of it with the config and the browser storage it needs
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: vi.fn((key, value) => void data.set(key, String(value))),
    removeItem: vi.fn((key) => void data.delete(key)),
  };
}

const SAVED = JSON.stringify({
  version: STATE_VERSION,
  state: { onboarding: false, diaries: { '2026-08-20': { timelines: [], status: 0 } } },
});

describe('appStore', () => {
  let originalGeneral;

  beforeEach(() => {
    originalGeneral = GLOBALS.DATA.general;
    vi.resetModules();
  });

  afterEach(() => {
    GLOBALS.DATA.general = originalGeneral;
    vi.unstubAllGlobals();
  });

  it('without server accounts, starts from the saved diary and keeps saving it', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: SAVED });
    vi.stubGlobal('localStorage', storage);

    const { appStore } = await import('./appStore');

    expect(appStore.getState().onboarding).toBe(false);
    expect(Object.keys(appStore.getState().diaries)).toEqual(['2026-08-20']);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('with server accounts, starts empty and does not touch the single saved diary', async () => {
    GLOBALS.DATA.general = {
      ...originalGeneral,
      server_accounts: true,
      backend_url: 'https://diary.example.org',
    };
    const storage = memoryStorage({ [STORAGE_KEY]: SAVED });
    vi.stubGlobal('localStorage', storage);

    const { appStore } = await import('./appStore');

    expect(appStore.getState().onboarding).toBe(true);
    expect(appStore.getState().diaries).toEqual({});
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data.get(STORAGE_KEY)).toBe(SAVED);
  });
});
