import { describe, it, expect } from 'vitest';

describe('freezeGlobals', () => {
  // regression test: GLOBALS used to only be frozen inside main.js's
  // DOMContentLoaded handler, which fires after every custom element in the
  // document has already been constructed/rendered against a fully mutable
  // GLOBALS - freezing it as the first thing main.js imports closes that gap
  it('deep-freezes GLOBALS as an import side effect, before DOMContentLoaded could ever fire', async () => {
    globalThis.GLOBALS = { DATA: { day_boundary: '04:00', instructions: [{ title: 'a' }] } };

    expect(Object.isFrozen(GLOBALS)).toBe(false);

    await import('./freezeGlobals');

    expect(Object.isFrozen(GLOBALS)).toBe(true);
    expect(Object.isFrozen(GLOBALS.DATA)).toBe(true);
    expect(Object.isFrozen(GLOBALS.DATA.instructions[0])).toBe(true);

    // a mutation attempt must be rejected (module code runs in strict mode,
    // so this throws rather than silently succeeding)
    expect(() => {
      GLOBALS.DATA.day_boundary = '00:00';
    }).toThrow(TypeError);
    expect(GLOBALS.DATA.day_boundary).toBe('04:00');
  });
});
