import type { ApiErrorBody } from '../types';

/** Base URL for every request; `/api` goes through the Vite dev proxy. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const TOKEN_STORAGE_KEY = 'hotel-booking.token';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages from the API's zod validation output, if any. */
  get fieldErrors(): Record<string, string> {
    const details = this.details;
    if (
      typeof details !== 'object' ||
      details === null ||
      !('issues' in details) ||
      !Array.isArray((details as { issues: unknown }).issues)
    ) {
      return {};
    }

    const issues = (details as { issues: Array<{ path?: unknown; message?: unknown }> }).issues;
    const result: Record<string, string> = {};
    for (const issue of issues) {
      if (typeof issue.path === 'string' && typeof issue.message === 'string') {
        result[issue.path] = issue.message;
      }
    }
    return result;
  }
}

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Private browsing mode can block storage; the in-memory copy still works.
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  try {
    inMemoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    inMemoryToken = null;
  }
  return inMemoryToken;
}

export type QueryValue = string | number | boolean | undefined | null;

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { method = 'GET', body, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Request cancelled'
        : 'Could not reach the server. Is the API running?',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody?.error?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error?.details,
    );
  }

  return payload as TResponse;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal): Promise<T> =>
    request<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
