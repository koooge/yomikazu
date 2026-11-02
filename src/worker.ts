import { catalogURL, validateCatalog } from './api.ts';

interface Env {
  PROXY_TOKEN: string;
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!env.PROXY_TOKEN)
    return new Response('Proxy token is not configured', {
      status: 503,
      headers,
    });
  if (request.headers.get('Authorization') !== `Bearer ${env.PROXY_TOKEN}`)
    return new Response('Unauthorized', { status: 401, headers });
  if (request.method !== 'GET')
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...headers, Allow: 'GET' },
    });
  const url = new URL(request.url);
  if (url.pathname !== '/1.0/catalog/products')
    return new Response('Not found', { status: 404, headers });
  const allowed = new Set(['narrator', 'num_results', 'response_groups']);
  if (
    [...url.searchParams.keys()].some((key) => !allowed.has(key)) ||
    !url.searchParams.get('narrator')?.trim() ||
    !/^[1-3]$/.test(url.searchParams.get('num_results') ?? '1')
  )
    return new Response('Invalid catalog query', { status: 400, headers });
  let stage = 'fetch';
  try {
    const upstream = await fetchImpl(
      catalogURL({
        narrator: url.searchParams.get('narrator')!,
        num_results: url.searchParams.get('num_results') ?? '1',
        response_groups: 'contributors,product_attrs',
      }),
      {
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { Accept: 'application/json', 'User-Agent': 'Yomikazu/0.1' },
      },
    );
    if (!upstream.ok) {
      console.error('Audible API returned an error', {
        status: upstream.status,
      });
      return new Response('Audible API request failed', {
        status: upstream.status,
        headers: { ...headers, 'X-Yomikazu-Error': 'upstream-http' },
      });
    }
    stage = 'read-json';
    const data: unknown = await upstream.json();
    stage = 'validate-catalog';
    return Response.json(validateCatalog(data), { headers });
  } catch (error) {
    console.error('Audible proxy request failed', {
      stage,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response('Audible API request failed', {
      status: 502,
      headers: { ...headers, 'X-Yomikazu-Error': stage },
    });
  }
}

export default {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
};
