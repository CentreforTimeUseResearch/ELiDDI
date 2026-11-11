import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from './en';

// A mistyped catalogue key does not throw - t() falls back to the key itself
// (ADR 0008), so it would render as "login.gate.retyr" in the page. This
// finds every quoted string in src/ that looks like a key in one of the
// catalogue's namespaces and checks it exists. Keys built from a template
// (`keyboardHelp.${key}.heading`) can't be seen statically and are not covered.
const SRC = join(import.meta.dirname, '..');
const namespaces = [...new Set(Object.keys(en).map((key) => key.split('.')[0]))];
const KEY_LIKE = new RegExp(
  `['"\`]((?:${namespaces.join('|')})\\.[A-Za-z][A-Za-z0-9.]*)['"\`]`,
  'g'
);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const isSource = entry.name.endsWith('.js') && !entry.name.includes('.test.');
    return isSource && !path.includes(join('src', 'i18n')) ? [path] : [];
  });
}

describe('catalogue keys used in src/', () => {
  it('every key a component refers to exists in the English catalogue', () => {
    const missing = [];
    for (const file of sourceFiles(SRC)) {
      for (const [, key] of readFileSync(file, 'utf8').matchAll(KEY_LIKE)) {
        if (!(key in en)) missing.push(`${file.slice(SRC.length + 1)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('finds the keys it is meant to (the scan itself works)', () => {
    const used = new Set();
    for (const file of sourceFiles(SRC)) {
      for (const [, key] of readFileSync(file, 'utf8').matchAll(KEY_LIKE)) used.add(key);
    }
    expect(used.has('login.gate.retry')).toBe(true);
    expect(used.has('syncNotice.unsent')).toBe(true);
  });
});
