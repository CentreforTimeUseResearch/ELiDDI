import { describe, it, expect, afterEach } from 'vitest';
import { t, setLocale, addCatalogue } from './i18n';
import en from './en';

describe('t()', () => {
  afterEach(() => setLocale(undefined));

  it('returns the English string by default', () => {
    expect(t('login.title')).toBe(en['login.title']);
  });

  it('returns the key itself when no catalogue has it', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('fills {name} placeholders from params', () => {
    const undo = addCatalogue('zz', { greet: 'Hello {name}, it is {day}' });
    setLocale('zz');
    expect(t('greet', { name: 'Ada', day: 'Tuesday' })).toBe('Hello Ada, it is Tuesday');
    undo();
  });

  it('leaves a placeholder visible when params do not supply it', () => {
    const undo = addCatalogue('zz', { greet: 'Hello {name}' });
    setLocale('zz');
    expect(t('greet', {})).toBe('Hello {name}');
    undo();
  });

  describe('language selection', () => {
    it('setLocale switches catalogues, and a translated key wins over English', () => {
      const undo = addCatalogue('zz', { 'login.title': 'Zz login' });
      setLocale('zz');
      expect(t('login.title')).toBe('Zz login');
      undo();
    });

    it('a key the active catalogue lacks falls back to English', () => {
      const undo = addCatalogue('zz', {});
      setLocale('zz');
      expect(t('login.title')).toBe(en['login.title']);
      undo();
    });

    it('an unknown language code falls back to English entirely', () => {
      setLocale('xx');
      expect(t('login.title')).toBe(en['login.title']);
    });

    it('setLocale(undefined) returns control to GLOBALS/default', () => {
      const undo = addCatalogue('zz', { 'login.title': 'Zz login' });
      setLocale('zz');
      setLocale(undefined);
      expect(t('login.title')).toBe(en['login.title']);
      undo();
    });

    it('reads GLOBALS.DATA.general.language per call when no override is set', () => {
      const undo = addCatalogue('zz', { 'login.title': 'Zz login' });
      const previous = globalThis.GLOBALS;
      globalThis.GLOBALS = { DATA: { general: { language: 'zz' } } };
      try {
        expect(t('login.title')).toBe('Zz login');
      } finally {
        globalThis.GLOBALS = previous;
        undo();
      }
    });
  });
});
