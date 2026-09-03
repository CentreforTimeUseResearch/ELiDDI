import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import Ajv from 'ajv';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const schema = JSON.parse(readFileSync(path.join(__dirname, 'config.schema.json'), 'utf8'));
const data = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

describe('config/config.json schema', () => {
  it('validates against config.schema.json', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(data);

    expect(valid, ajv.errorsText(validate.errors, { separator: '\n' })).toBe(true);
  });
});
