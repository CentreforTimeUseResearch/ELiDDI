import { describe, it, expect } from 'vitest';
import { buildDevConfig, parseArgs, parseLoginCodes, DEFAULT_BACKEND_URL } from './devLocal.js';

describe('parseArgs', () => {
  it('defaults to accounts off with the sibling backend folder', () => {
    expect(parseArgs([])).toEqual({
      withServer: false,
      keepServer: false,
      fresh: false,
      backendDir: '../ELiDDI_backend',
      backendUrl: DEFAULT_BACKEND_URL,
      help: false,
      viteArgs: [],
    });
  });

  it('reads the options, and takes the backend folder from the environment', () => {
    const options = parseArgs(['--with-server', '--keep-server', '--backend-url', 'http://x:1'], {
      ELIDDI_BACKEND_DIR: '/b',
    });

    expect(options).toMatchObject({
      withServer: true,
      keepServer: true,
      backendDir: '/b',
      backendUrl: 'http://x:1',
    });
    expect(
      parseArgs(['--with-server', '--backend-dir', '/c'], { ELIDDI_BACKEND_DIR: '/b' })
    ).toMatchObject({
      backendDir: '/c',
    });
  });

  it('passes what follows a lone -- to vite', () => {
    expect(parseArgs(['--with-server', '--', '--port', '5174']).viteArgs).toEqual([
      '--port',
      '5174',
    ]);
  });

  it('refuses an unknown option, a missing value, and server-only options without a server', () => {
    expect(() => parseArgs(['--nope'])).toThrow('unknown option --nope');
    expect(() => parseArgs(['--with-server', '--backend-url'])).toThrow('needs a value');
    expect(() => parseArgs(['--fresh'])).toThrow('--with-server');
    expect(() => parseArgs(['--keep-server'])).toThrow('--with-server');
  });
});

describe('buildDevConfig', () => {
  const config = {
    general: { name: 'x', server_accounts: true, backend_url: 'http://old' },
    timeline: [1],
  };

  it('turns accounts on and points them at the backend', () => {
    const built = buildDevConfig(config, { withServer: true, backendUrl: 'http://localhost:5000' });

    expect(built.general).toMatchObject({
      name: 'x',
      server_accounts: true,
      backend_url: 'http://localhost:5000',
    });
    expect(built.timeline).toEqual([1]);
  });

  it('turns accounts off whatever the file says, and drops backend_url', () => {
    const built = buildDevConfig(config, { withServer: false });

    expect(built.general.server_accounts).toBe(false);
    expect(built.general).not.toHaveProperty('backend_url');
  });

  it('does not change the config it is given', () => {
    buildDevConfig(config, { withServer: false });

    expect(config.general.server_accounts).toBe(true);
    expect(config.general.backend_url).toBe('http://old');
  });
});

describe('parseLoginCodes', () => {
  const log = [
    'backend-1  | WARNING in __init__: TEST PHASE login codes (stand-in for the email sent to each Respondent):',
    'backend-1  |   ABCD-EFGH',
    'backend-1  |   JK2M-NP3Q',
    'backend-1  |  * Running on http://0.0.0.0:5000',
  ].join('\n');

  it('reads the codes under the heading, and stops at the next line', () => {
    expect(parseLoginCodes(log)).toEqual(['ABCD-EFGH', 'JK2M-NP3Q']);
  });

  it('uses the last block when the backend has started more than once', () => {
    const twice = `${log}\n${log.replace('ABCD-EFGH', 'WXYZ-2345')}`;

    expect(parseLoginCodes(twice)).toEqual(['WXYZ-2345', 'JK2M-NP3Q']);
  });

  it('finds none before the heading appears', () => {
    expect(parseLoginCodes('starting up')).toEqual([]);
  });
});
