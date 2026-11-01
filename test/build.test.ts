import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { topRanking, build } from '../src/build.ts';

test('Includes ties at rank 20 and excludes lower ranks', () => {
  const records = Object.fromEntries(
    Array.from({ length: 23 }, (_, i) => [
      i,
      { name: `ナレーター${i}`, count: i < 19 ? 100 - i : i < 21 ? 20 : 10 },
    ]),
  );
  const data = topRanking(records);
  assert.equal(data.total_narrators, 23);
  assert.equal(data.ranking.length, 21);
  assert.equal(data.ranking.at(-1)?.rank, 20);
});
test('Merges name variants and marks conflicting totals as unresolved', () => {
  const data = topRanking({
    a: { name: '朗読 太郎', count: 30 },
    b: { name: '朗読太郎', count: 30 },
    c: { name: '別の 人', count: 40 },
    d: { name: '別の人', count: 50 },
  });
  assert.equal(data.ranking.length, 1);
  assert.equal(data.ranking[0].count, 30);
  assert.equal(data.unresolved.length, 1);
});
test('Generates HTML and JSON for publication', () => {
  const folder = mkdtempSync(join(tmpdir(), 'yomikazu-build-'));
  try {
    const input = join(folder, 'counts.json');
    writeFileSync(
      input,
      JSON.stringify({
        sample: {
          name: '架空のナレーター',
          count: 100,
          url: 'https://www.audible.co.jp/search?searchNarrator=sample',
          checked_at: '2026-11-01T00:00:00Z',
          source_type: 'audible_catalog_api',
        },
      }),
    );
    const data = build(input, folder);
    const html = readFileSync(join(folder, 'index.html'), 'utf8');
    assert.match(html, /上位20位/);
    assert.ok(data.ranking.length > 0);
    assert.ok(data.ranking.every((r) => r.rank <= 20));
    assert.equal(
      JSON.parse(readFileSync(join(folder, 'index.json'), 'utf8')).coverage,
      'listed_narrators',
    );
  } finally {
    rmSync(folder, { recursive: true });
  }
});
