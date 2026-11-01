import type { CatalogResponse } from './types.ts';
type FetchCatalog = (url: string, options: RequestInit) => Promise<{ok: boolean; status?: number; json(): Promise<unknown>}>;
export const API_BASE = 'https://api.audible.co.jp';
export function catalogURL(params: Record<string, string> = {}) {
  const url = new URL('/1.0/catalog/products', API_BASE);
  url.search = new URLSearchParams({num_results:'50',response_groups:'contributors,product_attrs',...params}).toString();
  return url.href;
}
export function validateCatalog(data: unknown): CatalogResponse {
  if (!data || typeof data !== 'object' || !('products' in data) || !Array.isArray(data.products) || !('total_results' in data) || typeof data.total_results !== 'number' || !Number.isSafeInteger(data.total_results) || data.total_results < 0) {
    throw Error('Invalid catalog API response');
  }
  return data as CatalogResponse;
}
export async function fetchCatalog(params: Record<string, string> = {}, fetchImpl: FetchCatalog = fetch) {
  const response = await fetchImpl(catalogURL(params), {
    redirect:'error', signal:AbortSignal.timeout(30000),
    headers:{Accept:'application/json','User-Agent':'Yomikazu/0.1'},
  });
  if (!response.ok) throw Error(`Catalog API: HTTP ${response.status}`);
  return validateCatalog(await response.json());
}
