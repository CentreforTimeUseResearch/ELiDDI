import { describe, it, expect } from 'vitest';
import { validateDiary, canSubmit } from './validateDiary';

const FULL_DAY = [{ id: 1, startOffsetMins: 0, endOffsetMins: 1440, activity: 'sleeping' }];
const complete = { timelines: [FULL_DAY], status: 0 };
const incomplete = { timelines: [[]], status: 0 };
const configWith = (validation) => ({ day_boundary: '04:00', validation });

describe('validateDiary', () => {
  it('checks nothing when the config has no validation setting', () => {
    expect(validateDiary(incomplete, { day_boundary: '04:00' })).toEqual([]);
    expect(validateDiary(incomplete, configWith({}))).toEqual([]);
  });

  it('does not check a rule set to off', () => {
    expect(validateDiary(incomplete, configWith({ 'no-gaps-in-primary': 'off' }))).toEqual([]);
  });

  it('ignores a rule id ELiDDI has no rule for', () => {
    expect(validateDiary(incomplete, configWith({ 'not-a-rule': 'hard' }))).toEqual([]);
  });

  it('reports a passing rule with its level, title and no message', () => {
    const results = validateDiary(complete, configWith({ 'no-gaps-in-primary': 'hard' }));

    expect(results).toEqual([
      {
        id: 'no-gaps-in-primary',
        title: 'No gaps in Primary activity',
        level: 'hard',
        passed: true,
        message: '',
      },
    ]);
  });

  it('reports a failing rule with its level and the rule message', () => {
    const [result] = validateDiary(incomplete, configWith({ 'no-gaps-in-primary': 'soft' }));

    expect(result.passed).toBe(false);
    expect(result.level).toBe('soft');
    expect(result.message).toBe('No Primary activity has been recorded.');
  });
});

describe('canSubmit', () => {
  const result = (level, passed) => ({ id: 'x', title: 'x', level, passed, message: '' });

  it('is true when there is nothing to check', () => {
    expect(canSubmit([])).toBe(true);
  });

  it('is false while a hard check fails', () => {
    expect(canSubmit([result('hard', false)])).toBe(false);
    expect(canSubmit([result('soft', false), result('hard', false)])).toBe(false);
  });

  it('is true when a soft check fails, which only asks for confirmation', () => {
    expect(canSubmit([result('soft', false)])).toBe(true);
  });

  it('is true when every check passes', () => {
    expect(canSubmit([result('hard', true), result('soft', true)])).toBe(true);
  });

  it('follows a real Diary: blocked while it has a gap, allowed once filled', () => {
    const config = configWith({ 'no-gaps-in-primary': 'hard' });

    expect(canSubmit(validateDiary(incomplete, config))).toBe(false);
    expect(canSubmit(validateDiary(complete, config))).toBe(true);
  });
});
