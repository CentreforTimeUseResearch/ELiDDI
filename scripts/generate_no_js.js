// Prints the no-JS diary HTML for vite.config.js to inject at __GENERATED__.
// The config comes from the ACTIONS_ENV environment variable when set (a
// deploy's injected config), otherwise from config/config.json. Exits
// non-zero - failing the build, `vite dev` and the deploy workflow - if the
// config can't be read or parsed, or breaks config/config.schema.json, so a
// broken config never ships as a broken or empty diary. The generation itself
// is in lib/generateNoJs.js.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDiaryHtml } from './lib/generateNoJs.js';
import { createConfigValidator } from './lib/validateConfig.js';

const CONFIG_PATH = fileURLToPath(new URL('../config/config.json', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('../config/config.schema.json', import.meta.url));

function readConfigJson() {
  const injected = process.env.ACTIONS_ENV;
  return injected
    ? { source: 'ACTIONS_ENV', json: injected }
    : {
        source: CONFIG_PATH,
        json: fs.readFileSync(CONFIG_PATH, 'utf8'),
      };
}

function fail(source, ...details) {
  console.error(
    `generate_no_js: could not build the diary from the config in ${source}:`,
    ...details
  );
  process.exit(1);
}

let source = CONFIG_PATH;
try {
  const config = readConfigJson();
  source = config.source;

  const validate = createConfigValidator(JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')));
  const problems = validate(JSON.parse(config.json));
  if (problems.length > 0) {
    fail(
      source,
      `it doesn't match config/config.schema.json\n${problems.map((problem) => `  - ${problem}`).join('\n')}`
    );
  }

  process.stdout.write(`${buildDiaryHtml(config.json)}\n`);
} catch (error) {
  fail(source, error.message);
}
