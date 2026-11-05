// Talks to the ELiDDI backend's state endpoints (ELiDDI_backend: GET and PUT
// /state, docs/adr/0007-server-sync-model.md). Never throws for a failed
// request: the caller gets a result saying what to do next.

const isWholeNumber = (value) => Number.isInteger(value) && value >= 0;

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const isSnapshot = (body) =>
  body !== null &&
  typeof body === 'object' &&
  isWholeNumber(body.revision) &&
  Number.isInteger(body.stateVersion) &&
  body.state !== null &&
  typeof body.state === 'object' &&
  !Array.isArray(body.state);

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// -> { kind: 'ok', revision, stateVersion, state }
//  | { kind: 'none' }          the server has nothing for this Respondent yet
//  | { kind: 'unauthorized' }  the token was refused
//  | { kind: 'retry' }         could not get an answer worth using; try again later
export async function fetchState({ backendUrl, token, fetchFn = fetch }) {
  let response;
  try {
    response = await fetchFn(`${backendUrl}/state`, {
      headers: authHeaders(token),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'retry' };
  }
  if (response.status === 404) {
    return { kind: 'none' };
  }
  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }
  if (!response.ok) {
    return { kind: 'retry' };
  }
  const body = await readJson(response);
  return isSnapshot(body) ? { kind: 'ok', ...pick(body) } : { kind: 'retry' };
}

const pick = ({ revision, stateVersion, state }) => ({ revision, stateVersion, state });

// -> { kind: 'ok', revision }                  the write was accepted
//  | { kind: 'conflict', revision, snapshot }  baseRevision was stale; snapshot is the
//                                              server's current { revision, stateVersion,
//                                              state }, or null if it has none
//  | { kind: 'unauthorized' }
//  | { kind: 'rejected', status }              the server refuses this state (too large,
//                                              invalid): retrying will not help
//  | { kind: 'retry' }                         network failure or a server error
export async function pushState({
  backendUrl,
  token,
  baseRevision,
  stateVersion,
  state,
  fetchFn = fetch,
}) {
  let response;
  try {
    response = await fetchFn(`${backendUrl}/state`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRevision, stateVersion, state }),
      cache: 'no-store',
    });
  } catch {
    return { kind: 'retry' };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }
  if (response.status === 409) {
    const body = await readJson(response);
    if (isSnapshot(body)) {
      return { kind: 'conflict', revision: body.revision, snapshot: pick(body) };
    }
    // the server has nothing, though we thought it did: start again from 0
    return {
      kind: 'conflict',
      revision: isWholeNumber(body?.revision) ? body.revision : 0,
      snapshot: null,
    };
  }
  if (response.status >= 400 && response.status < 500) {
    return { kind: 'rejected', status: response.status };
  }
  if (!response.ok) {
    return { kind: 'retry' };
  }
  const body = await readJson(response);
  return isWholeNumber(body?.revision) && body.revision > 0
    ? { kind: 'ok', revision: body.revision }
    : { kind: 'retry' };
}
