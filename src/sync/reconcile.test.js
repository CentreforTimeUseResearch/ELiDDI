import { describe, it, expect } from 'vitest';
import { baseOf, fingerprint, mergeStates, sameContent } from './reconcile';

const diary = (activity, status = 0) => ({
  timelines: [[{ id: 0, startOffsetMins: 0, endOffsetMins: 10, activity }]],
  status,
});
const state = (diaries, onboarding = false) => ({ onboarding, diaries });

describe('sameContent', () => {
  it('ignores the order of object keys', () => {
    expect(sameContent({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
  });

  it('notices a difference anywhere inside, and array order', () => {
    expect(sameContent(diary('Sleep'), diary('Work'))).toBe(false);
    expect(sameContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});

describe('mergeStates', () => {
  it('keeps a Diary that is on only one side', () => {
    const { state: merged, replacedLocal } = mergeStates(
      state({ '2026-08-20': diary('Sleep') }),
      state({ '2026-08-21': diary('Work') })
    );

    expect(Object.keys(merged.diaries).sort()).toEqual(['2026-08-20', '2026-08-21']);
    expect(replacedLocal).toEqual({});
  });

  it('keeps a Diary that is the same on both sides, with nothing to back up', () => {
    const { state: merged, replacedLocal } = mergeStates(
      state({ '2026-08-20': diary('Sleep') }),
      state({ '2026-08-20': diary('Sleep') })
    );

    expect(merged.diaries['2026-08-20']).toEqual(diary('Sleep'));
    expect(replacedLocal).toEqual({});
  });

  it("takes the server's Diary when they differ, and hands back this device's", () => {
    const local = diary('Local edit');
    const server = diary('Edited elsewhere');

    const { state: merged, replacedLocal } = mergeStates(
      state({ '2026-08-20': local }),
      state({ '2026-08-20': server })
    );

    expect(merged.diaries['2026-08-20']).toBe(server);
    expect(replacedLocal).toEqual({ '2026-08-20': local });
  });

  it('keeps a complete local Diary over an in-progress one on the server', () => {
    const local = diary('Done', 100);

    const { state: merged, replacedLocal } = mergeStates(
      state({ '2026-08-20': local }),
      state({ '2026-08-20': diary('Half way', 0) })
    );

    expect(merged.diaries['2026-08-20']).toBe(local);
    expect(replacedLocal).toEqual({});
  });

  it('takes a complete server Diary over a complete local one that differs', () => {
    const server = diary('Server', 100);

    const { state: merged } = mergeStates(
      state({ '2026-08-20': diary('Local', 100) }),
      state({ '2026-08-20': server })
    );

    expect(merged.diaries['2026-08-20']).toBe(server);
  });

  it('merges each date on its own', () => {
    const { state: merged, replacedLocal } = mergeStates(
      state({ a: diary('L-a'), b: diary('L-b', 100), c: diary('same') }),
      state({ a: diary('S-a'), b: diary('S-b'), c: diary('same'), d: diary('S-d') })
    );

    expect(merged.diaries.a.timelines[0][0].activity).toBe('S-a');
    expect(merged.diaries.b.timelines[0][0].activity).toBe('L-b');
    expect(merged.diaries.d.timelines[0][0].activity).toBe('S-d');
    expect(Object.keys(replacedLocal)).toEqual(['a']);
  });

  it('counts onboarding as done if either side finished it', () => {
    expect(mergeStates(state({}, true), state({}, false)).state.onboarding).toBe(false);
    expect(mergeStates(state({}, false), state({}, true)).state.onboarding).toBe(false);
    expect(mergeStates(state({}, true), state({}, true)).state.onboarding).toBe(true);
  });

  it('does not change either input', () => {
    const local = state({ a: diary('L') });
    const server = state({ a: diary('S') });
    const before = JSON.stringify([local, server]);

    mergeStates(local, server);

    expect(JSON.stringify([local, server])).toBe(before);
  });
});

describe('mergeStates with a base (what the server held when this device last agreed)', () => {
  const base = baseOf({ d: diary('Original') });

  it('keeps this device’s version of a day only this device changed', () => {
    const local = diary('Edited here');

    const { state: merged, replacedLocal } = mergeStates(
      state({ d: local }),
      state({ d: diary('Original') }),
      base
    );

    expect(merged.diaries.d).toBe(local);
    expect(replacedLocal).toEqual({});
  });

  it('takes the server’s version of a day only the server changed', () => {
    const server = diary('Edited elsewhere');

    const { state: merged, replacedLocal } = mergeStates(
      state({ d: diary('Original') }),
      state({ d: server }),
      base
    );

    expect(merged.diaries.d).toBe(server);
    expect(replacedLocal).toEqual({});
  });

  it('when both changed the day, the server wins and this device’s version is handed back', () => {
    const local = diary('Edited here');

    const { state: merged, replacedLocal } = mergeStates(
      state({ d: local }),
      state({ d: diary('Edited elsewhere') }),
      base
    );

    expect(merged.diaries.d.timelines[0][0].activity).toBe('Edited elsewhere');
    expect(replacedLocal).toEqual({ d: local });
  });

  it('when both changed the day, a complete one still beats an in-progress one', () => {
    const local = diary('Done', 100);

    const { state: merged } = mergeStates(
      state({ d: local }),
      state({ d: diary('Edited elsewhere') }),
      base
    );

    expect(merged.diaries.d).toBe(local);
  });

  it('treats a day with no base as changed on both sides, so nothing is quietly overwritten', () => {
    const { replacedLocal } = mergeStates(
      state({ d: diary('Here') }),
      state({ d: diary('There') }),
      {}
    );

    expect(Object.keys(replacedLocal)).toEqual(['d']);
  });
});

describe('fingerprint', () => {
  it('is the same for the same content however its keys are ordered', () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ b: [1, 2], a: 1 }));
  });

  it('differs when the content differs', () => {
    expect(fingerprint(diary('Sleep'))).not.toBe(fingerprint(diary('Work')));
  });

  it('is short enough to keep one per day', () => {
    expect(fingerprint(diary('Sleep'))).toMatch(/^[0-9a-f]{1,8}$/);
  });
});
