import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createConfigValidator } from '../scripts/lib/validateConfig';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schema = JSON.parse(readFileSync(path.join(__dirname, 'config.schema.json'), 'utf8'));
const data = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// the same check the build runs on every config, including a deploy's
// injected one (scripts/generate_no_js.js)
describe('config/config.json schema', () => {
  it('validates against config.schema.json', () => {
    const problems = createConfigValidator(schema)(data);

    expect(problems).toEqual([]);
  });
});

// #185: the optional per-rule validation setting
describe('config validation setting', () => {
  const validate = createConfigValidator(schema);
  const withValidation = (validation) => ({ ...data, validation });

  it('is optional: a config without it is valid', () => {
    const withoutIt = { ...data };
    delete withoutIt.validation;

    expect(validate(withoutIt)).toEqual([]);
  });

  it('accepts every rule at any level', () => {
    const config = withValidation({
      'no-gaps-in-primary': 'hard',
      'primary-secondary-differ': 'hard',
      'minimum-sleep': 'soft',
      'eating-or-drinking': 'off',
    });

    expect(validate(config)).toEqual([]);
  });

  it('accepts an empty object, and a subset of the rules', () => {
    expect(validate(withValidation({}))).toEqual([]);
    expect(validate(withValidation({ 'minimum-sleep': 'soft' }))).toEqual([]);
  });

  it('rejects an unknown rule id, naming it', () => {
    const problems = validate(withValidation({ 'minimum-sleeep': 'soft' }));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('validation');
    expect(problems[0]).toContain('minimum-sleeep');
  });

  it.each(['strict', 'HARD', true, 1, null])('rejects the level %j', (level) => {
    const problems = validate(withValidation({ 'minimum-sleep': level }));

    expect(problems).not.toEqual([]);
    expect(problems[0]).toContain('validation/minimum-sleep');
  });

  it('rejects validation that is not an object', () => {
    expect(validate(withValidation('hard'))).not.toEqual([]);
    expect(validate(withValidation(['hard']))).not.toEqual([]);
  });
});
