const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let tokenProvider = async () => null;

/** Wired by AuthProvider: returns the current Firebase ID token (or demo token). */
export function setTokenProvider(provider) {
  tokenProvider = provider;
}

export async function apiFetch(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the CloudQueue API. Check your connection and try again.'
    );
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload && payload.error) || {};
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('cloudqueue:unauthorized'));
    }
    throw new ApiError(
      response.status,
      error.code || 'http_error',
      error.message || `Request failed with status ${response.status}`,
      error.details
    );
  }

  return payload;
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
};

export { API_BASE };
