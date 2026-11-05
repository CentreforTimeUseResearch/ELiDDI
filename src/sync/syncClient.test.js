import { describe, it, expect, vi } from 'vitest';
import { fetchState, pushState } from './syncClient';

const BACKEND = 'https://diary.example.org';
const SNAPSHOT = { revision: 4, stateVersion: 1, state: { onboarding: false, diaries: {} } };

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('no body');
    return body;
  },
});
const stub = (response) => vi.fn().mockResolvedValue(response);

describe('fetchState', () => {
  it('asks for the Respondent’s state with the token and returns the snapshot', async () => {
    const fetchFn = stub(reply(200, SNAPSHOT));

    const result = await fetchState({ backendUrl: BACKEND, token: 'tok', fetchFn });

    expect(result).toEqual({ kind: 'ok', ...SNAPSHOT });
    expect(fetchFn.mock.calls[0][0]).toBe(`${BACKEND}/state`);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchFn.mock.calls[0][1].cache).toBe('no-store');
  });

  it('says there is nothing yet on 404', async () => {
    expect(
      await fetchState({ backendUrl: BACKEND, token: 't', fetchFn: stub(reply(404, {})) })
    ).toEqual({
      kind: 'none',
    });
  });

  it('says the token was refused on 401', async () => {
    expect(
      await fetchState({ backendUrl: BACKEND, token: 't', fetchFn: stub(reply(401, {})) })
    ).toEqual({
      kind: 'unauthorized',
    });
  });

  it.each([
    ['a server error', () => stub(reply(503, {}))],
    ['a network failure', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
    ['a body that is not JSON', () => stub(reply(200, undefined))],
    ['a body that is not a snapshot', () => stub(reply(200, { revision: 'x' }))],
  ])('asks to try again later on %s', async (_, makeFetch) => {
    const result = await fetchState({ backendUrl: BACKEND, token: 't', fetchFn: makeFetch() });

    expect(result).toEqual({ kind: 'retry' });
  });
});

describe('pushState', () => {
  const push = (fetchFn) =>
    pushState({
      backendUrl: BACKEND,
      token: 'tok',
      baseRevision: 3,
      stateVersion: 1,
      state: SNAPSHOT.state,
      fetchFn,
    });

  it('sends the base revision, version and state, and returns the new revision', async () => {
    const fetchFn = stub(reply(200, { revision: 4 }));

    const result = await push(fetchFn);

    expect(result).toEqual({ kind: 'ok', revision: 4 });
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`${BACKEND}/state`);
    expect(options.method).toBe('PUT');
    expect(options.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(options.body)).toEqual({
      baseRevision: 3,
      stateVersion: 1,
      state: SNAPSHOT.state,
    });
  });

  it('hands back the server’s snapshot on a 409', async () => {
    const result = await push(stub(reply(409, SNAPSHOT)));

    expect(result).toEqual({ kind: 'conflict', revision: 4, snapshot: SNAPSHOT });
  });

  it('copes with a 409 that carries no snapshot (the server has nothing)', async () => {
    const result = await push(stub(reply(409, { revision: 0 })));

    expect(result).toEqual({ kind: 'conflict', revision: 0, snapshot: null });
  });

  it('says the token was refused on 401', async () => {
    expect(await push(stub(reply(401, {})))).toEqual({ kind: 'unauthorized' });
  });

  it.each([413, 422, 400])(
    'says the state was refused (not worth retrying) on %i',
    async (status) => {
      expect(await push(stub(reply(status, {})))).toEqual({ kind: 'rejected', status });
    }
  );

  it.each([
    ['a server error', () => stub(reply(500, {}))],
    ['a network failure', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
    ['an acceptance with no usable revision', () => stub(reply(200, {}))],
  ])('asks to try again later on %s', async (_, makeFetch) => {
    expect(await push(makeFetch())).toEqual({ kind: 'retry' });
  });
});
