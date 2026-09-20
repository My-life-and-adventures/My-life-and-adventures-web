import { getSessionToken } from './session';
import type { ApiResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  // A gateway or proxy in front of the API can answer with HTML or an empty body, so the
  // parse is guarded: without this, a 502 surfaces to the user as a raw JSON parser message.
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      res.ok ? 'The server sent an unreadable response.' : 'The server is unavailable right now.',
      'INVALID_RESPONSE',
      res.status,
    );
  }

  if (!json.success) {
    throw new ApiClientError(json.error.message, json.error.code, res.status);
  }

  return json.data;
}
