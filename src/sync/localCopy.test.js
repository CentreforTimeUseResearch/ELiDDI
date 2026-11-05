import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearLocalCopy, readLocalCopy, saveBackup, writeSyncMeta } from './localCopy';
import { STATE_VERSION } from '../store/persistence';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

const saved = JSON.stringify({ version: STATE_VERSION, state: { onboarding: false } });

describe('localCopy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('readLocalCopy', () => {
    it('is null when there is no storage, or no copy for that Respondent', () => {
      expect(readLocalCopy(undefined, 'r-1')).toBeNull();
      expect(readLocalCopy(memoryStorage({ 'state.r-2': saved }), 'r-1')).toBeNull();
    });

    it('returns the copy with its revision and whether it has unsent changes', () => {
      const storage = memoryStorage({
        'state.r-1': saved,
        'state.r-1.sync': JSON.stringify({
          revision: 4,
          dirty: false,
          base: { '2026-08-20': 'abc' },
        }),
      });

      expect(readLocalCopy(storage, 'r-1')).toEqual({
        state: { onboarding: false },
        revision: 4,
        dirty: false,
        base: { '2026-08-20': 'abc' },
      });
    });

    it.each([
      ['missing', {}],
      ['damaged', { 'state.r-1.sync': 'not json' }],
      ['incomplete', { 'state.r-1.sync': JSON.stringify({ revision: 4 }) }],
    ])('assumes there are unsent changes when the bookkeeping is %s', (_, extra) => {
      const storage = memoryStorage({ 'state.r-1': saved, ...extra });

      expect(readLocalCopy(storage, 'r-1')).toMatchObject({ revision: 0, dirty: true, base: {} });
    });
  });

  it('writes the bookkeeping beside the copy', () => {
    const storage = memoryStorage();

    writeSyncMeta(storage, 'r-1', {
      revision: 2,
      dirty: true,
      base: { d: 'abc' },
      extra: 'ignored',
    });

    expect(JSON.parse(storage.data.get('state.r-1.sync'))).toEqual({
      revision: 2,
      dirty: true,
      base: { d: 'abc' },
    });
  });

  it('does not throw when the bookkeeping cannot be written', () => {
    const storage = {
      setItem: () => {
        throw new Error('full');
      },
    };

    expect(() => writeSyncMeta(storage, 'r-1', { revision: 1, dirty: false })).not.toThrow();
    expect(() => writeSyncMeta(undefined, 'r-1', { revision: 1, dirty: false })).not.toThrow();
  });

  it('clears the copy and its bookkeeping, but not backups or other people’s copies', () => {
    const storage = memoryStorage({
      'state.r-1': saved,
      'state.r-1.sync': '{}',
      'state.r-1.backup.1': '{}',
      'state.r-2': saved,
    });

    clearLocalCopy(storage, 'r-1');

    expect([...storage.data.keys()].sort()).toEqual(['state.r-1.backup.1', 'state.r-2']);
  });

  describe('saveBackup', () => {
    it('keeps the replaced Diaries under a key of their own', () => {
      const storage = memoryStorage();

      const key = saveBackup(storage, 'r-1', { '2026-08-20': { timelines: [], status: 0 } }, 123);

      expect(key).toBe('state.r-1.backup.123');
      expect(JSON.parse(storage.data.get(key))).toEqual({
        diaries: { '2026-08-20': { timelines: [], status: 0 } },
      });
    });

    it('writes nothing when nothing was replaced', () => {
      const storage = memoryStorage();

      expect(saveBackup(storage, 'r-1', {})).toBeNull();
      expect(storage.data.size).toBe(0);
    });
  });
});
