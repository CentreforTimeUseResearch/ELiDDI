import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createConfigValidator } from './validateConfig';

// vitest runs from the project root
const read = (file) => JSON.parse(readFileSync(path.join(process.cwd(), 'config', file), 'utf8'));
const SCHEMA = read('config.schema.json');
const CONFIG = read('config.json');
const validate = createConfigValidator(SCHEMA);
const withConfig = (change) => {
  const config = structuredClone(CONFIG);
  change(config);
  return config;
};

describe('createConfigValidator', () => {
  it('reports no problems for the committed config', () => {
    expect(validate(CONFIG)).toEqual([]);
  });

  // #145 made a midnight day boundary work end to end
  it('accepts a 00:00 day boundary', () => {
    expect(validate(withConfig((config) => (config.day_boundary = '00:00')))).toEqual([]);
  });

  it('names the field and the rule for each problem', () => {
    const problems = validate(
      withConfig((config) => {
        config.timeline[2].categories[0].activities[3].color = 'red';
        delete config.timeline[1].categories;
      })
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        'timeline/2/categories/0/activities/3/color must match pattern "^#[0-9a-fA-F]{6}$"',
        "timeline/1 must have required property 'categories'",
      ])
    );
  });

  it('lists the allowed values for an unknown Mode', () => {
    const problems = validate(withConfig((config) => (config.timeline[0].mode = 'single')));

    expect(problems).toEqual([
      'timeline/0/mode must be equal to one of the allowed values: single-choice, multiple-choice',
    ]);
  });

  it('reports a problem at the root of the config', () => {
    const problems = validate(withConfig((config) => delete config.day_boundary));

    expect(problems).toEqual(["(config root) must have required property 'day_boundary'"]);
  });
});
