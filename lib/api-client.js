// Thin fetch wrapper used by every client-side API call.
//
// Goals:
//   1) Attach the auth token from localStorage automatically.
//   2) Detect 401s and hand back a canonical `SESSION_EXPIRED` code so the
//      UI can auto-logout + show one clear toast instead of silently
//      failing (previous behaviour: fetch would just return `[]` or an
//      empty state, and the user had no idea why).
//   3) Distinguish network failures (fetch throws) from server failures
//      (fetch resolves with !ok) so error states can be specific.
//
// Return shape (never throws for handled cases):
//   { ok: true,  status, data }
//   { ok: false, status, error: { code, message } }
//
//   Codes:
//     NETWORK_ERROR   — TypeError from fetch (offline, DNS, CORS at edge)
//     SESSION_EXPIRED — 401 from server, token invalid/absent
//     BAD_REQUEST     — 4xx other than 401
//     SERVER_ERROR    — 5xx
//     UNKNOWN         — anything else

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('forkcast_token');
}

async function parseBody(response) {
  // Some routes return non-JSON on error (nginx HTML pages, etc.). Be
  // defensive so the UI never crashes on JSON.parse.
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return { message: await response.text() };
  } catch {
    return null;
  }
}

/**
 * apiFetch(path, options?)
 *   path: '/api/…'
 *   options: standard fetch options; `body` may be a string OR object (auto-
 *            JSON-serialized). Set `skipAuth: true` to omit the token.
 */
export async function apiFetch(path, options = {}) {
  const { skipAuth, body, headers: userHeaders, ...rest } = options;

  const headers = { ...(userHeaders || {}) };

  // JSON body auto-serialization
  let finalBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    finalBody = JSON.stringify(body);
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, { ...rest, headers, body: finalBody });
  } catch (err) {
    // fetch itself failed — typically offline, DNS, or CORS blocked.
    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message:
          typeof navigator !== 'undefined' && !navigator.onLine
            ? "You're offline. Reconnect and try again."
            : "Couldn't reach the server. Check your connection and try again.",
      },
    };
  }

  const data = await parseBody(response);

  if (response.ok) {
    return { ok: true, status: response.status, data };
  }

  // Non-2xx — classify.
  let code = 'UNKNOWN';
  if (response.status === 401) code = 'SESSION_EXPIRED';
  else if (response.status >= 400 && response.status < 500) code = 'BAD_REQUEST';
  else if (response.status >= 500) code = 'SERVER_ERROR';

  const message =
    (data && (data.error || data.message)) ||
    (code === 'SESSION_EXPIRED'
      ? 'Your session has expired. Please log in again.'
      : code === 'SERVER_ERROR'
      ? 'The server hit an error. Please try again in a moment.'
      : 'Something went wrong. Please try again.');

  return { ok: false, status: response.status, error: { code, message }, data };
}

// Convenience wrappers so the call sites read cleaner.
export const apiGet    = (path, opts) => apiFetch(path, { ...opts, method: 'GET' });
export const apiPost   = (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body });
export const apiPut    = (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body });
export const apiDelete = (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' });
