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
