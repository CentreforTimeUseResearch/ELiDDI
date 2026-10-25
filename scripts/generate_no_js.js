// Prints the no-JS diary HTML for vite.config.js to inject at __GENERATED__.
// The config comes from the ACTIONS_ENV environment variable when set (a
// deploy's injected config), otherwise from config/config.json. Exits
// non-zero on a read or parse failure, so a broken config fails the build
// instead of silently producing an empty diary. The generation itself is in
// lib/generateNoJs.js.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDiaryHtml } from './lib/generateNoJs.js';

const CONFIG_PATH = fileURLToPath(new URL('../config/config.json', import.meta.url));

function readConfigJson() {
  const injected = process.env.ACTIONS_ENV;
  return injected
    ? { source: 'ACTIONS_ENV', json: injected }
    : {
        source: CONFIG_PATH,
        json: fs.readFileSync(CONFIG_PATH, 'utf8'),
      };
}

let source = CONFIG_PATH;
try {
  const config = readConfigJson();
  source = config.source;
  process.stdout.write(`${buildDiaryHtml(config.json)}\n`);
} catch (error) {
  console.error(
    `generate_no_js: could not build the diary from the config in ${source}:`,
    error.message
  );
  process.exit(1);
}
