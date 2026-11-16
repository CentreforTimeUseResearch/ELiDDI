// `npm run dev:local`: the dev server for local testing, without editing
// config/config.json or remembering the docker/ACTIONS_ENV steps by hand.
//
//   npm run dev:local                    accounts off (no backend, no login)
//   npm run dev:local -- --with-server   starts the Docker backend, turns
//                                        server_accounts on, points the page
//                                        at it, and stops it again at the end
//
// The config goes to the dev server through ACTIONS_ENV (see
// generate_no_js.js), so config/config.json stays as committed and the test
// suite, which reads that file, is never affected. `--help` lists the options.
// The pure parts are in lib/devLocal.js.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDevConfig, parseArgs, parseLoginCodes, USAGE } from './lib/devLocal.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const READY_TIMEOUT_MS = 90_000;

function fail(message) {
  console.error(`dev:local: ${message}`);
  process.exit(1);
}

function docker(args, backendDir) {
  return spawnSync('docker', ['compose', ...args], { cwd: backendDir, encoding: 'utf8' });
}

function backendIsRunning(backendDir) {
  const result = docker(['ps', '--status', 'running', '-q', 'backend'], backendDir);
  return result.status === 0 && result.stdout.trim() !== '';
}

// any HTTP answer will do: it means the backend is listening
async function waitForBackend(url) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// -> { backendDir, startedByUs } once the backend is answering
async function startBackend(options) {
  const backendDir = path.resolve(ROOT, options.backendDir);
  if (!fs.existsSync(path.join(backendDir, 'compose.yaml'))) {
    fail(`no compose.yaml in ${backendDir} (use --backend-dir or ELIDDI_BACKEND_DIR)`);
  }
  if (docker(['version'], backendDir).status !== 0) {
    fail('Docker is not available. Is Docker running?');
  }

  const alreadyRunning = backendIsRunning(backendDir);
  if (options.fresh) {
    if (alreadyRunning) {
      fail('--fresh needs the backend stopped first (docker compose stop, in the backend folder)');
    }
    for (const file of ['eliddi.sqlite3', 'dummy_codes.json']) {
      fs.rmSync(path.join(backendDir, 'data', file), { force: true });
    }
    console.log('dev:local: cleared the backend data, new login codes will be made');
  }

  if (alreadyRunning) {
    console.log('dev:local: the backend is already running, leaving it as it is');
  } else {
    console.log('dev:local: starting the backend (docker compose up -d --build)...');
    const up = spawnSync('docker', ['compose', 'up', '-d', '--build'], {
      cwd: backendDir,
      stdio: 'inherit',
    });
    if (up.status !== 0) {
      fail('docker compose up failed');
    }
  }
  if (!(await waitForBackend(options.backendUrl))) {
    fail(`the backend did not answer at ${options.backendUrl} within ${READY_TIMEOUT_MS / 1000}s`);
  }
  return { backendDir, startedByUs: !alreadyRunning };
}

function printLoginCodes(backendDir) {
  const logs = docker(['logs', '--no-log-prefix', 'backend'], backendDir);
  const codes = parseLoginCodes(`${logs.stdout}\n${logs.stderr}`);
  if (codes.length === 0) {
    console.log(
      'dev:local: no login codes found yet: docker compose logs backend (in the backend folder)'
    );
    return;
  }
  console.log('\ndev:local: login codes (case, spaces and hyphens are ignored when typing):');
  codes.forEach((code, i) => console.log(`  ${String.fromCharCode(65 + i)}  ${code}`));
  console.log('');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), process.env);
  } catch (error) {
    console.error(`dev:local: ${error.message}\n\n${USAGE}`);
    process.exit(1);
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'config.json'), 'utf8'));
  } catch (error) {
    fail(`could not read config/config.json: ${error.message}`);
  }
  const devConfig = buildDevConfig(config, options);

  let backend;
  if (options.withServer) {
    backend = await startBackend(options);
    printLoginCodes(backend.backendDir);
  }
  console.log(
    options.withServer
      ? `dev:local: server_accounts ON, backend ${options.backendUrl}`
      : 'dev:local: server_accounts OFF'
  );

  // vite is run through node, not npx, so that stopping this process stops
  // vite too (on Windows an npx wrapper can be left running)
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(process.execPath, [viteBin, ...options.viteArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ACTIONS_ENV: JSON.stringify(devConfig) },
  });

  let stopping = false;
  const stop = (code) => {
    if (stopping) {
      return;
    }
    stopping = true;
    vite.kill();
    if (backend?.startedByUs && !options.keepServer) {
      console.log('\ndev:local: stopping the backend (docker compose stop)...');
      docker(['stop'], backend.backendDir);
    } else if (backend) {
      console.log('\ndev:local: leaving the backend running');
    }
    process.exit(code);
  };
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  vite.on('exit', (code) => stop(code ?? 0));
  vite.on('error', (error) => {
    console.error(`dev:local: could not start vite: ${error.message}`);
    stop(1);
  });
}

main();
