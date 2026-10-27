import { describe, it, expect } from 'vitest';
import { primarySecondaryDiffer } from './primarySecondaryDiffer';
import { validateDiary } from '../validateDiary';

const config = { day_boundary: '04:00' };
let nextId = 0;
const entry = (startOffsetMins, endOffsetMins, activity) => ({
  id: nextId++,
  startOffsetMins,
  endOffsetMins,
  activity,
});
const diaryWith = (primary, secondary) => ({ timelines: [primary, secondary], status: 0 });
const check = (diary, cfg = config) => primarySecondaryDiffer.check({ diary, config: cfg });

describe('primarySecondaryDiffer', () => {
  it('passes when the same slot has different Activities', () => {
    const diary = diaryWith([entry(0, 1440, 'sleeping')], [entry(0, 1440, 'resting')]);

    expect(check(diary)).toEqual({ passed: true });
  });

  it('fails when the same Activity is in the same slot, naming the time range and Activity', () => {
    const diary = diaryWith(
      [entry(0, 1440, 'sleeping')],
      [entry(0, 60, 'resting'), entry(60, 120, 'sleeping'), entry(120, 1440, 'resting')]
    );

    const result = check(diary);

    expect(result.passed).toBe(false);
    expect(result.message).toBe(
      '"sleeping" is recorded as both Primary and Secondary activity from 05:00 to 06:00.'
    );
  });

  it('reports the first clash when there are several', () => {
    const diary = diaryWith(
      [entry(0, 100, 'sleeping'), entry(100, 1440, 'resting')],
      [entry(0, 100, 'sleeping'), entry(100, 200, 'sleeping'), entry(200, 300, 'resting')]
    );

    expect(check(diary).message).toContain('"sleeping" is recorded as both');
    expect(check(diary).message).toContain('from 04:00 to 05:40');
  });

  it('passes when the same Activity is at different times', () => {
    const diary = diaryWith(
      [entry(0, 60, 'sleeping'), entry(60, 1440, 'resting')],
      [entry(0, 60, 'resting'), entry(60, 1440, 'sleeping')]
    );

    expect(check(diary).passed).toBe(true);
  });

  it('passes when the Secondary activity is only recorded for part of the day', () => {
    const diary = diaryWith([entry(0, 1440, 'sleeping')], [entry(600, 700, 'resting')]);

    expect(check(diary).passed).toBe(true);
  });

  it('passes when a slot has a Primary Entry but no Secondary Entry', () => {
    expect(check(diaryWith([entry(0, 1440, 'sleeping')], [])).passed).toBe(true);
  });

  it('fails for a free-text Secondary Entry equal to the Primary Activity', () => {
    const diary = diaryWith(
      [entry(0, 1440, 'Watching TV/DVD')],
      [entry(100, 130, 'Watching TV/DVD')]
    );

    expect(check(diary).passed).toBe(false);
  });

  it('compares the Activity names exactly', () => {
    const diary = diaryWith([entry(0, 1440, 'Sleeping')], [entry(0, 1440, 'sleeping')]);

    expect(check(diary).passed).toBe(true);
  });

  it('fails when the clash is in a single slot', () => {
    const diary = diaryWith([entry(0, 1440, 'sleeping')], [entry(200, 210, 'sleeping')]);

    expect(check(diary).message).toContain('from 07:20 to 07:30');
  });

  it.each([
    ['no Diary', undefined],
    ['no Timelines yet', { timelines: [], status: 0 }],
    ['only a Primary Timeline', { timelines: [[entry(0, 1440, 'sleeping')]], status: 0 }],
  ])('passes, rather than throwing, for %s', (_, diary) => {
    expect(check(diary).passed).toBe(true);
  });

  it('takes its level from the config', () => {
    const diary = diaryWith([entry(0, 1440, 'sleeping')], [entry(0, 1440, 'sleeping')]);

    const hard = validateDiary(diary, {
      ...config,
      validation: { 'primary-secondary-differ': 'hard' },
    });
    const soft = validateDiary(diary, {
      ...config,
      validation: { 'primary-secondary-differ': 'soft' },
    });
    const off = validateDiary(diary, {
      ...config,
      validation: { 'primary-secondary-differ': 'off' },
    });

    expect(hard.map((r) => [r.id, r.level, r.passed])).toEqual([
      ['primary-secondary-differ', 'hard', false],
    ]);
    expect(soft[0].level).toBe('soft');
    expect(off).toEqual([]);
  });
});
