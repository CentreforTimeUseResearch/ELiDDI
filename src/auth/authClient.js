// Talks to the ELiDDI backend's login endpoints (ELiDDI_backend: POST /login,
// POST /logout). Only used when the study turns on server accounts
// (general.server_accounts, see config/config.schema.json). Never throws for
// a failed request: the caller gets a result to show the Respondent.

// -> { enabled, backendUrl } for a study config (GLOBALS.DATA). Accounts are
// off unless the config explicitly says true, so a config that predates the
// setting behaves exactly as before.
export function getAccounts(config) {
  const general = config?.general;
  const backendUrl = typeof general?.backend_url === 'string' ? general.backend_url : '';
  return {
    enabled: general?.server_accounts === true && backendUrl !== '',
    backendUrl: backendUrl.replace(/\/+$/, ''),
  };
}

// -> { ok: true, token, respondentId, expiresAt }
//  | { ok: false, reason: 'empty' }                  (no request is made)
//  | { ok: false, reason: 'invalid' }                 (the code is not known)
//  | { ok: false, reason: 'rate-limited', retryAfterSeconds }  (null if unknown)
//  | { ok: false, reason: 'network' }                 (the request could not be made)
//  | { ok: false, reason: 'server', status }          (anything else)
//
// code is sent as typed (trimmed): the server ignores case, spaces and hyphens
export async function login({ backendUrl, code, fetchFn = fetch }) {
  const typed = typeof code === 'string' ? code.trim() : '';
  if (typed === '') {
    return { ok: false, reason: 'empty' };
  }

  let response;
  try {
    response = await fetchFn(`${backendUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: typed }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (response.status === 401) {
    return { ok: false, reason: 'invalid' };
  }
  if (response.status === 429) {
    const seconds = Number.parseInt(response.headers?.get?.('Retry-After') ?? '', 10);
    return {
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    };
  }
  if (!response.ok) {
    return { ok: false, reason: 'server', status: response.status };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'server', status: response.status };
  }
  const { token, respondentId, expiresAt } = body ?? {};
  if (![token, respondentId, expiresAt].every((value) => typeof value === 'string' && value)) {
    return { ok: false, reason: 'server', status: response.status };
  }
  return { ok: true, token, respondentId, expiresAt };
}

// Ends this login on the server. Best effort: the caller has already ended it
// locally, and a failed request only means the token lives until it expires.
export async function logout({ backendUrl, token, fetchFn = fetch }) {
  try {
    const response = await fetchFn(`${backendUrl}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Logs the current Respondent out: locally first, so the next person on a
// shared device never sees the diary or can use the token, then on the server.
export async function signOut({ session, config, fetchFn = fetch }) {
  const token = session.getToken();
  session.end('logout');
  if (token) {
    await logout({ backendUrl: getAccounts(config).backendUrl, token, fetchFn });
  }
}

const minutes = (seconds) => Math.ceil(seconds / 60);

// Words for the Respondent for a failed login (see login() for the reasons)
export function describeLoginFailure(result) {
  switch (result.reason) {
    case 'empty':
      return 'Enter your login code.';
    case 'invalid':
      return 'That code was not recognised. Check it and try again.';
    case 'rate-limited':
      return result.retryAfterSeconds
        ? `Too many attempts. Please wait ${minutes(result.retryAfterSeconds)} ` +
            `minute${minutes(result.retryAfterSeconds) === 1 ? '' : 's'} and try again.`
        : 'Too many attempts. Please wait a few minutes and try again.';
    case 'network':
      return 'Could not reach the server. Check your connection and try again.';
    default:
      return 'Something went wrong on the server. Please try again later.';
  }
}
