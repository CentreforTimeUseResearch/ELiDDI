import { describe, it, expect, afterEach } from 'vitest';
import {
  studyConfig,
  dimensions,
  dimension,
  dayBoundary,
  onboardingSteps,
  language,
  primaryRedirectUrl,
  accounts,
} from './appConfig';

// vitest.setup.js provides the real config/config.json as GLOBALS; these
// tests swap it per-assertion to prove every getter reads lazily, per call
const realGlobals = globalThis.GLOBALS;
afterEach(() => {
  globalThis.GLOBALS = realGlobals;
});

describe('appConfig', () => {
  it('returns the live config values', () => {
    expect(studyConfig()).toBe(realGlobals.DATA);
    expect(dimensions()).toBe(realGlobals.DATA.timeline);
    expect(dimension(0)).toBe(realGlobals.DATA.timeline[0]);
    expect(dayBoundary()).toBe(realGlobals.DATA.day_boundary);
    expect(onboardingSteps()).toBe(realGlobals.DATA.instructions);
    expect(language()).toBe(realGlobals.DATA.general.language);
    expect(primaryRedirectUrl()).toBe(realGlobals.DATA.general.primary_redirect_url);
  });

  it('reads per call, not at module evaluation', () => {
    globalThis.GLOBALS = { DATA: { day_boundary: '05:30' } };
    expect(dayBoundary()).toBe('05:30');
  });

  it('tolerates a missing GLOBALS without throwing', () => {
    globalThis.GLOBALS = undefined;
    expect(studyConfig()).toBeUndefined();
    expect(dimensions()).toEqual([]);
    expect(dimension(0)).toBeUndefined();
    expect(dayBoundary()).toBeUndefined();
    expect(onboardingSteps()).toEqual([]);
    expect(language()).toBeUndefined();
    expect(primaryRedirectUrl()).toBeUndefined();
    expect(accounts()).toEqual({ enabled: false, backendUrl: '' });
  });

  it('accounts() mirrors getAccounts over the live config', () => {
    globalThis.GLOBALS = {
      DATA: { general: { server_accounts: true, backend_url: 'https://api.example.org/' } },
    };
    expect(accounts()).toEqual({ enabled: true, backendUrl: 'https://api.example.org' });
  });
});
