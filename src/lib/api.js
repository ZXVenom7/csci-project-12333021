// Thin wrapper around fetch for the dealership API.
// REACT_APP_API_URL is only needed when the API lives on another origin.
const BASE = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '') + '/api';

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

async function request(method, path, body) {
  const options = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE + path, options);
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const error = (data && data.error) || {};
    throw new ApiError(response.status, error.message || 'Something went wrong. Please try again.', error.fields);
  }
  return data;
}

/** Builds a query string, skipping empty values. */
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  get: (path, params) => request('GET', path + toQuery(params)),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};
