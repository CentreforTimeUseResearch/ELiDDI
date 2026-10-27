import { noGapsInPrimary } from './rules/noGapsInPrimary';

// Checks one Diary against the Validation rules a study has switched on, and
// says whether the Respondent may submit it (CONTEXT.md: Validation rule,
// Hard check, Soft check). Pure - the Diary and the study config are
// arguments, so it needs no store and no GLOBALS.

// Every rule ELiDDI ships, in the order they are reported. The config only
// chooses which are active and how strictly (config.validation, rule id ->
// 'off' | 'soft' | 'hard'). A rule is a { id, title, check } where
// check({ diary, config }) -> { passed, message } (message is for a failure).
// To add a rule, write it under ./rules/ and list it here.
const RULES = [noGapsInPrimary];

const ACTIVE_LEVELS = ['soft', 'hard'];

// -> one { id, title, level, passed, message } per rule that is on, in RULES
// order. A rule that is missing from config.validation, or 'off', is not
// checked and not in the result; neither is an id in the config that
// ELiDDI has no rule for.
export function validateDiary(diary, config) {
  const levels = config?.validation ?? {};
  return RULES.filter((rule) => ACTIVE_LEVELS.includes(levels[rule.id])).map((rule) => {
    const { passed, message } = rule.check({ diary, config });
    return {
      id: rule.id,
      title: rule.title,
      level: levels[rule.id],
      passed,
      message: passed ? '' : message,
    };
  });
}

// a Diary can be submitted unless a hard check is failing - a failing soft
// check only asks the Respondent to confirm
export function canSubmit(results) {
  return !results.some((result) => result.level === 'hard' && !result.passed);
}
