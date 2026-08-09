import { type FetchOptions, ofetch } from 'ofetch';

type FetchOpts = FetchOptions<'json'>;

const resolveApiBaseUrl = (): string => {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return '/api';
  const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const url = new URL(normalized);
      if (url.pathname === '/' || url.pathname === '') {
        url.pathname = '/api';
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      return normalized;
    }
  }

  return normalized;
};

const baseURL = resolveApiBaseUrl();

const baseFetch = ofetch.create({
  baseURL,
  credentials: 'include',
  retry: 0,
});

let refreshPromise: Promise<boolean> | null = null;

const tryRefresh = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = baseFetch('/auth/refresh', { method: 'POST' })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      });
  }
  return refreshPromise;
};

const isAuthFreeUrl = (url: string): boolean =>
  url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/logout');

export const apiRequest = async <T>(url: string, options: FetchOpts = {}): Promise<T> => {
  try {
    return (await baseFetch<T>(url, options)) as T;
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status !== 401 || isAuthFreeUrl(url)) throw err;

    const refreshed = await tryRefresh();
    if (!refreshed) throw err;

    return (await baseFetch<T>(url, options)) as T;
  }
};

export const api = {
  get: <T>(url: string, options?: FetchOpts) => apiRequest<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: unknown, options?: FetchOpts) =>
    apiRequest<T>(url, { ...options, method: 'POST', body: body as FetchOpts['body'] }),
  patch: <T>(url: string, body?: unknown, options?: FetchOpts) =>
    apiRequest<T>(url, { ...options, method: 'PATCH', body: body as FetchOpts['body'] }),
  delete: <T>(url: string, options?: FetchOpts) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
