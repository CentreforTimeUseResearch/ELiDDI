import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMaxEditableTimeInMinutes, getCurrentDiaryDateKey } from './time';

// GLOBALS.DATA.day_boundary is "04:00" (240 minutes) in the real config
// vitest.setup.js loads for these tests.
describe('getMaxEditableTimeInMinutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined when the given date is not the actual current diary day', () => {
    expect(getMaxEditableTimeInMinutes('2000-01-01', 240)).toBeUndefined();
  });

  it('returns dayBoundaryInMinutes when "now" is exactly the day boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 4, 0, 0)); // 04:00 local
    const today = getCurrentDiaryDateKey();

    expect(getMaxEditableTimeInMinutes(today, 240)).toBe(240);
  });

  // this is the day-boundary-wrap case: naive wall-clock comparison would
  // treat 03:59 as "very early", but it's actually the very last minute of
  // the diary day that started the previous calendar day at 04:00
  it('treats one minute before the boundary as near the end of the diary day, not the start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 3, 59, 0)); // 03:59 local
    const today = getCurrentDiaryDateKey();

    expect(getMaxEditableTimeInMinutes(today, 240)).toBe(240 + 1439);
  });

  it('rolls the diary day back to the previous calendar date before the boundary, and rejects the next calendar date as "today"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 2, 0, 0)); // 02:00 local, still within yesterday's diary day
    const today = getCurrentDiaryDateKey();

    expect(today).toBe('2026-08-20');
    expect(getMaxEditableTimeInMinutes('2026-08-20', 240)).toBeDefined();
    expect(getMaxEditableTimeInMinutes('2026-08-21', 240)).toBeUndefined();
  });
});
