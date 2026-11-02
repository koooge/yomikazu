import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleRequest } from '../src/worker.ts';
import { fetchCatalog } from '../src/api.ts';

test('Rejects unauthorized requests and unsupported proxy targets before fetching', async () => {
  const env = { PROXY_TOKEN: 'test-token' };
  for (const [path, token, method, status] of [
    ['/1.0/catalog/products?narrator=Sample', '', 'GET', 401],
    ['/other', 'test-token', 'GET', 404],
    ['/1.0/catalog/products?narrator=Sample', 'test-token', 'POST', 405],
    ['/1.0/catalog/products', 'test-token', 'GET', 400],
    [
      '/1.0/catalog/products?narrator=Sample&url=https://example.com',
      'test-token',
      'GET',
      400,
    ],
    [
      '/1.0/catalog/products?narrator=Sample&num_results=50',
      'test-token',
      'GET',
      400,
    ],
  ] as const) {
    const result = await handleRequest(
      new Request(`https://proxy.example${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
      async () => {
        throw Error('Unexpected upstream request');
      },
    );
    assert.equal(result.status, status);
  }
  const missing = await worker.fetch(new Request('https://proxy.example'), {
    PROXY_TOKEN: '',
  });
  assert.equal(missing.status, 503);
});

test('Routes catalog requests through the proxy without forwarding the shared token to Audible', async () => {
  const result = await fetchCatalog(
    { narrator: 'Sample AND Narrator', num_results: '1' },
    async (url, options) => {
      assert.equal(new URL(url).origin, 'https://proxy.example');
      return handleRequest(
        new Request(url, options),
        { PROXY_TOKEN: 'test-token' },
        async (upstream, init) => {
          const target = new URL(String(upstream));
          assert.equal(target.origin, 'https://api.audible.co.jp');
          assert.equal(
            target.searchParams.get('narrator'),
            'Sample AND Narrator',
          );
          assert.equal(new Headers(init?.headers).has('Authorization'), false);
          assert.equal(init?.redirect, 'error');
          return Response.json({ products: [], total_results: 123 });
        },
      );
    },
    { url: 'https://proxy.example', token: 'test-token' },
  );
  assert.equal(result.total_results, 123);
  await assert.rejects(
    fetchCatalog({}, fetch, { url: 'https://proxy.example', token: undefined }),
    /TOKEN/,
  );
});

test('Returns upstream errors and rejects invalid catalog responses', async () => {
  for (const upstream of [
    new Response('Unavailable', { status: 429 }),
    Response.json({ error: 'bad' }),
  ]) {
    const response = await handleRequest(
      new Request(
        'https://proxy.example/1.0/catalog/products?narrator=Sample',
        {
          headers: { Authorization: 'Bearer test-token' },
        },
      ),
      { PROXY_TOKEN: 'test-token' },
      async () => upstream,
    );
    assert.equal(response.status, upstream.status === 429 ? 429 : 502);
    assert.equal(
      response.headers.get('X-Yomikazu-Error'),
      upstream.status === 429 ? 'upstream-http' : 'validate-catalog',
    );
  }
});

test('Reports proxy failures in catalog client errors', async () => {
  for (const reason of [
    'fetch',
    'read-json',
    'validate-catalog',
    'upstream-http',
  ]) {
    await assert.rejects(
      fetchCatalog(
        { narrator: 'Sample', num_results: '1' },
        async () =>
          new Response('Audible API request failed', {
            status: 502,
            headers: { 'X-Yomikazu-Error': reason },
          }),
        { url: 'https://proxy.example', token: 'test-token' },
      ),
      new RegExp(`HTTP 502 \\(${reason}\\)`),
    );
  }
});
