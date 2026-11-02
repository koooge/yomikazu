import type { CatalogResponse } from './types.ts';

type FetchCatalog = (
  url: string,
  options: RequestInit,
) => Promise<{
  ok: boolean;
  status?: number;
  headers?: Headers;
  json(): Promise<unknown>;
}>;
export const API_BASE = 'https://api.audible.co.jp';

export function narratorQuery(name: string) {
  return name
    .normalize('NFKC')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .join(' AND ');
}

export function catalogURL(params: Record<string, string> = {}) {
  const url = new URL('/1.0/catalog/products', API_BASE);
  url.search = new URLSearchParams({
    num_results: '50',
    response_groups: 'contributors,product_attrs',
    ...params,
  }).toString();
  return url.href;
}

export function validateCatalog(data: unknown): CatalogResponse {
  if (
    !data ||
    typeof data !== 'object' ||
    !('products' in data) ||
    !Array.isArray(data.products) ||
    !('total_results' in data) ||
    typeof data.total_results !== 'number' ||
    !Number.isSafeInteger(data.total_results) ||
    data.total_results < 0
  ) {
    throw Error('Invalid catalog API response');
  }
  return data as CatalogResponse;
}

export async function fetchCatalog(
  params: Record<string, string> = {},
  fetchImpl: FetchCatalog = fetch,
  proxy = {
    url: process.env.AUDIBLE_PROXY_URL,
    token: process.env.AUDIBLE_PROXY_TOKEN,
  },
) {
  const url = new URL(catalogURL(params));
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Yomikazu/0.1',
  };
  if (proxy.url) {
    const endpoint = new URL(proxy.url);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password
    )
      throw Error('Expected an HTTPS proxy URL without credentials');
    if (!proxy.token) throw Error('AUDIBLE_PROXY_TOKEN is required');
    url.protocol = endpoint.protocol;
    url.host = endpoint.host;
    headers.Authorization = `Bearer ${proxy.token}`;
  }
  const response = await fetchImpl(url.href, {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers,
  });
  if (!response.ok) {
    const reason = proxy.url
      ? response.headers?.get('X-Yomikazu-Error')
      : undefined;
    throw Error(
      `Catalog API: HTTP ${response.status}${reason ? ` (${reason})` : ''}`,
    );
  }
  return validateCatalog(await response.json());
}
