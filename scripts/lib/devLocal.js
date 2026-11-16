// The pure parts of scripts/dev-local.js (arguments, the config handed to the
// dev server, the login codes in the backend's log), kept apart from the
// process, Docker and network work so they can be tested.

export const DEFAULT_BACKEND_URL = 'http://localhost:5000';

export const USAGE = `Usage: npm run dev:local -- [options] [-- <vite options>]

Starts the dev server with config/config.json untouched. The config is passed
in through ACTIONS_ENV, so server_accounts is whatever this script says,
whatever the file says.

  (no options)        server_accounts off: no backend, no login
  --with-server       start the Docker backend, turn server_accounts on and
                      point backend_url at it; stops the backend afterwards
  --keep-server       leave a backend this script started running at the end
  --fresh             with --with-server: forget the dummy Respondents and
                      diaries first, so you get new login codes
  --backend-dir <p>   the ELiDDI_backend folder (default ../ELiDDI_backend,
                      or $ELIDDI_BACKEND_DIR)
  --backend-url <u>   where the page reaches the backend (default ${DEFAULT_BACKEND_URL})
  -h, --help          this text

Anything after a lone -- goes to vite, e.g.: npm run dev:local -- --with-server -- --port 5174`;

// -> { withServer, keepServer, fresh, backendDir, backendUrl, help, viteArgs }
// Throws an Error naming an option it does not know or one missing its value.
export function parseArgs(argv, env = {}) {
  const options = {
    withServer: false,
    keepServer: false,
    fresh: false,
    backendDir: env.ELIDDI_BACKEND_DIR || '../ELiDDI_backend',
    backendUrl: DEFAULT_BACKEND_URL,
    help: false,
    viteArgs: [],
  };
  const valueOf = (name, index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${name} needs a value`);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--':
        options.viteArgs = argv.slice(i + 1);
        return options;
      case '--with-server':
        options.withServer = true;
        break;
      case '--keep-server':
        options.keepServer = true;
        break;
      case '--fresh':
        options.fresh = true;
        break;
      case '--backend-dir':
        options.backendDir = valueOf(arg, i++);
        break;
      case '--backend-url':
        options.backendUrl = valueOf(arg, i++);
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  if ((options.keepServer || options.fresh) && !options.withServer) {
    throw new Error('--keep-server and --fresh only mean something with --with-server');
  }
  return options;
}

// -> a copy of the study config with accounts on or off for this dev session.
// Off also drops backend_url, so nothing can reach for a backend that is not
// there. The config is not changed in place.
export function buildDevConfig(config, { withServer, backendUrl = DEFAULT_BACKEND_URL }) {
  const general = { ...config.general, server_accounts: withServer };
  if (withServer) {
    general.backend_url = backendUrl;
  } else {
    delete general.backend_url;
  }
  return { ...config, general };
}

// -> the login codes in the backend's log (`docker compose logs`): the lines
// after the last "TEST PHASE login codes" heading, each one a code such as
// ABCD-EFGH. [] when the heading is not there (yet).
export function parseLoginCodes(logText) {
  const lines = logText.split(/\r?\n/);
  const heading = lines.map((line) => line.includes('TEST PHASE login codes')).lastIndexOf(true);
  if (heading === -1) {
    return [];
  }
  const codes = [];
  for (const line of lines.slice(heading + 1)) {
    const match = line.match(/(?:^|\s)([A-Z0-9]{3,}(?:-[A-Z0-9]{3,})+)\s*$/);
    if (!match) {
      break;
    }
    codes.push(match[1]);
  }
  return codes;
}
