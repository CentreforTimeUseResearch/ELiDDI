import { describe, it, expect } from 'vitest';
import { minimumSleep } from './minimumSleep';
import { validateDiary } from '../validateDiary';

const dimension = (activities) => ({ categories: [{ activities }] });
const config = {
  day_boundary: '04:00',
  timeline: [
    dimension([
      { label: 'Sleeping', code: 101 },
      { label: 'Eating, Drinking, Meal', code: 104 },
      { label: 'Working', code: 201 },
    ]),
    dimension([
      { label: 'Sleeping', code: 101 },
      { label: 'Eating, Drinking, Meal', code: 104 },
    ]),
  ],
};
let nextId = 0;
const entry = (startOffsetMins, endOffsetMins, activity) => ({
  id: nextId++,
  startOffsetMins,
  endOffsetMins,
  activity,
});
const check = (diary, cfg = config) => minimumSleep.check({ diary, config: cfg });
const diaryWith = (primary, secondary = []) => ({ timelines: [primary, secondary], status: 0 });

describe('minimumSleep', () => {
  it('passes with exactly 4 hours of sleeping', () => {
    expect(check(diaryWith([entry(0, 240, 'Sleeping')]))).toEqual({ passed: true });
  });

  it('fails with 3h 50m, saying how much was found', () => {
    const result = check(diaryWith([entry(0, 230, 'Sleeping')]));

    expect(result.passed).toBe(false);
    expect(result.message).toBe('3h 50m of sleep recorded (less than 4h).');
  });

  it('fails with no sleeping at all', () => {
    const result = check(diaryWith([entry(0, 1440, 'Working')]));

    expect(result.passed).toBe(false);
    expect(result.message).toBe('0m of sleep recorded (less than 4h).');
  });

  it('adds up sleeping split over several Entries', () => {
    const diary = diaryWith([
      entry(0, 100, 'Sleeping'),
      entry(100, 600, 'Working'),
      entry(600, 750, 'Sleeping'),
    ]);

    expect(check(diary).passed).toBe(true);
    const short = diaryWith([entry(0, 100, 'Sleeping'), entry(600, 700, 'Sleeping')]);

    expect(check(short).message).toBe('3h 20m of sleep recorded (less than 4h).');
  });

  it('does not count sleeping recorded as a Secondary activity', () => {
    const diary = diaryWith([entry(0, 1440, 'Working')], [entry(0, 600, 'Sleeping')]);

    expect(check(diary).passed).toBe(false);
  });

  it('never counts a free-text Entry', () => {
    expect(check(diaryWith([entry(0, 600, 'sleeping')])).passed).toBe(false);
  });

  it('fails, rather than throwing, when the config has no Activity coded 101', () => {
    const noSleep = { ...config, timeline: [dimension([{ label: 'Working', code: 201 }])] };

    expect(check(diaryWith([entry(0, 600, 'Sleeping')]), noSleep).passed).toBe(false);
  });

  it.each([
    ['no Diary', undefined],
    ['no Timelines yet', { timelines: [], status: 0 }],
  ])('fails, rather than throwing, for %s', (_, diary) => {
    expect(check(diary).passed).toBe(false);
  });

  it('is a soft or hard check depending on the config', () => {
    const diary = diaryWith([entry(0, 60, 'Sleeping')]);

    const [result] = validateDiary(diary, { ...config, validation: { 'minimum-sleep': 'soft' } });

    expect(result).toMatchObject({ id: 'minimum-sleep', level: 'soft', passed: false });
  });
});
