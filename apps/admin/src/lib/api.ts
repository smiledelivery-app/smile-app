'use client';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'smile.admin.session';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken() {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new ApiError(body?.error?.message ?? 'The request could not be completed.', response.status);
  if (!body || !('data' in body)) throw new ApiError('The API returned an invalid response.', response.status);
  return body.data as T;
}

export function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}
