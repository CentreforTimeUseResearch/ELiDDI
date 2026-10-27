import { describe, it, expect } from 'vitest';
import { eatingOrDrinking } from './eatingOrDrinking';
import { validateDiary } from '../validateDiary';

const dimension = (activities) => ({ categories: [{ activities }] });
const activities = [
  { label: 'Sleeping', code: 101 },
  { label: 'Eating, Drinking, Meal', code: 104 },
];
const config = { day_boundary: '04:00', timeline: [dimension(activities), dimension(activities)] };
let nextId = 0;
const entry = (activity) => ({ id: nextId++, startOffsetMins: 0, endOffsetMins: 30, activity });
const check = (diary, cfg = config) => eatingOrDrinking.check({ diary, config: cfg });
const diaryWith = (primary, secondary = []) => ({ timelines: [primary, secondary], status: 0 });

describe('eatingOrDrinking', () => {
  it('passes with one Primary Entry coded 104', () => {
    expect(check(diaryWith([entry('Eating, Drinking, Meal')]))).toEqual({ passed: true });
  });

  it('passes with one Secondary Entry coded 104', () => {
    const diary = diaryWith([entry('Sleeping')], [entry('Eating, Drinking, Meal')]);

    expect(check(diary).passed).toBe(true);
  });

  it('fails when there is none, saying so', () => {
    const result = check(diaryWith([entry('Sleeping')], [entry('Sleeping')]));

    expect(result).toEqual({ passed: false, message: 'No eating or drinking recorded.' });
  });

  it('never counts a free-text Entry', () => {
    expect(check(diaryWith([entry('lunch')], [entry('Eating')])).passed).toBe(false);
  });

  it('fails, rather than throwing, when the config has no Activity coded 104', () => {
    const noEating = { ...config, timeline: [dimension([activities[0]])] };

    expect(check(diaryWith([entry('Eating, Drinking, Meal')]), noEating).passed).toBe(false);
  });

  it.each([
    ['no Diary', undefined],
    ['no Timelines yet', { timelines: [], status: 0 }],
  ])('fails, rather than throwing, for %s', (_, diary) => {
    expect(check(diary).passed).toBe(false);
  });

  it('is a soft or hard check depending on the config', () => {
    const [result] = validateDiary(diaryWith([entry('Sleeping')]), {
      ...config,
      validation: { 'eating-or-drinking': 'hard' },
    });

    expect(result).toMatchObject({ id: 'eating-or-drinking', level: 'hard', passed: false });
  });
});
