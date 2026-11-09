import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getMaxEditableTimeInMinutes,
  getCurrentDiaryDateKey,
  formatOffsetAsClockTime,
  parseDayBoundary,
  addDaysToDateKey,
  formatDateKeyAsLongDate,
} from './time';

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

describe('parseDayBoundary', () => {
  it('reads HH:MM as minutes since midnight', () => {
    expect(parseDayBoundary('04:00')).toBe(240);
    expect(parseDayBoundary('06:30')).toBe(390);
  });
});

describe('formatOffsetAsClockTime', () => {
  it('uses the running study day boundary by default', () => {
    expect(formatOffsetAsClockTime(10)).toBe('04:10');
  });

  it('uses a given day boundary instead, wrapping past midnight', () => {
    expect(formatOffsetAsClockTime(10, 360)).toBe('06:10');
    expect(formatOffsetAsClockTime(1440, 240)).toBe('04:00');
  });
});

describe('addDaysToDateKey', () => {
  it('moves a Diary date key by whole days, either way', () => {
    expect(addDaysToDateKey('2026-11-09', 1)).toBe('2026-11-10');
    expect(addDaysToDateKey('2026-11-09', -1)).toBe('2026-11-08');
    expect(addDaysToDateKey('2026-11-09', 0)).toBe('2026-11-09');
  });

  it('crosses month and year ends', () => {
    expect(addDaysToDateKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('knows leap years', () => {
    expect(addDaysToDateKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToDateKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDaysToDateKey('2027-02-28', 1)).toBe('2027-03-01');
  });

  // a day is not always 24 hours: stepping by milliseconds goes wrong (or
  // repeats a date) when the clocks change
  it('is exactly one date per step across clock changes', () => {
    expect(addDaysToDateKey('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysToDateKey('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDaysToDateKey('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDaysToDateKey('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDaysToDateKey('2026-03-30', -1)).toBe('2026-03-29');
  });
});

describe('formatDateKeyAsLongDate', () => {
  it('reads like "Saturday 7 November"', () => {
    expect(formatDateKeyAsLongDate('2026-11-07')).toBe('Saturday 7 November');
    expect(formatDateKeyAsLongDate('2026-11-09')).toBe('Monday 9 November');
  });

  it('does not shift a day with the time zone', () => {
    expect(formatDateKeyAsLongDate('2026-01-01')).toBe('Thursday 1 January');
    expect(formatDateKeyAsLongDate('2026-12-31')).toBe('Thursday 31 December');
  });
});
