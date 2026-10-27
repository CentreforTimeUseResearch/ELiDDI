import { describe, it, expect } from 'vitest';
import { noGapsInPrimary } from './noGapsInPrimary';

const config = { day_boundary: '04:00' };
let nextId = 0;
const entry = (startOffsetMins, endOffsetMins) => ({
  id: nextId++,
  startOffsetMins,
  endOffsetMins,
  activity: 'sleeping',
});
const diaryWith = (...primaryEntries) => ({ timelines: [primaryEntries], status: 0 });
const check = (diary, cfg = config) => noGapsInPrimary.check({ diary, config: cfg });

describe('noGapsInPrimary', () => {
  it('passes when one Entry covers the whole day', () => {
    expect(check(diaryWith(entry(0, 1440)))).toEqual({ passed: true });
  });

  it('passes when Entries run back to back, in any order', () => {
    const diary = diaryWith(entry(600, 1440), entry(0, 300), entry(300, 600));

    expect(check(diary).passed).toBe(true);
  });

  it('passes when Entries overlap', () => {
    expect(check(diaryWith(entry(0, 800), entry(700, 1440))).passed).toBe(true);
  });

  it('fails for a single missing slot, naming it', () => {
    const result = check(diaryWith(entry(0, 60), entry(70, 1440)));

    expect(result.passed).toBe(false);
    expect(result.message).toBe('Primary activity is missing from 05:00 to 05:10.');
  });

  it('finds a gap at the very start of the day', () => {
    const result = check(diaryWith(entry(20, 1440)));

    expect(result.passed).toBe(false);
    expect(result.message).toBe('Primary activity is missing from 04:00 to 04:20.');
  });

  it('finds a gap at the very end of the day', () => {
    const result = check(diaryWith(entry(0, 1430)));

    expect(result.passed).toBe(false);
    expect(result.message).toBe('Primary activity is missing from 03:50 to 04:00.');
  });

  it('reports the first gap and counts the others', () => {
    const one = check(diaryWith(entry(0, 100), entry(110, 200), entry(210, 1440)));
    const two = check(diaryWith(entry(0, 100), entry(110, 200), entry(210, 300), entry(310, 1440)));

    expect(one.message).toBe('Primary activity is missing from 05:40 to 05:50 (and 1 more gap).');
    expect(two.message).toBe('Primary activity is missing from 05:40 to 05:50 (and 2 more gaps).');
  });

  it('treats a slot a shorter or off-grid Entry touches as used', () => {
    expect(check(diaryWith(entry(5, 1440))).passed).toBe(true);
  });

  it('reads the gap as clock times from the study day boundary', () => {
    const result = check(diaryWith(entry(10, 1440)), { day_boundary: '06:00' });

    expect(result.message).toBe('Primary activity is missing from 06:00 to 06:10.');
  });

  it.each([
    ['no Diary', undefined],
    ['a Diary with no Timelines yet', { timelines: [], status: 0 }],
    ['a Diary whose Primary Timeline is empty', { timelines: [[]], status: 0 }],
  ])('fails, rather than throwing, for %s', (_, diary) => {
    expect(check(diary)).toEqual({
      passed: false,
      message: 'No Primary activity has been recorded.',
    });
  });

  it('looks only at the Primary activity Timeline', () => {
    const diary = { timelines: [[entry(0, 60)], [entry(0, 1440)]], status: 0 };

    expect(check(diary).passed).toBe(false);
  });
});
