import type { CountRecords, NarratorCount } from './types.ts';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nameKey, readJSON, render, publicRanking } from './common.ts';

// Each spelling remains in the source snapshot. Never add search totals together.

export function topRanking(records: CountRecords, limit = 20) {
  const groups = new Map<string, NarratorCount[]>();
  for (const row of Object.values(records)) {
    const key = nameKey(row.name);
    if (key === 'デジタルボイス') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const normalized: CountRecords = {};
  for (const [key, rows] of groups) {
    rows.sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? ''));
    const row = { ...rows[0] };
    const counts = new Set(
      rows
        .filter((r) => r.count != null && !r.error && !r.lower_bound)
        .map((r) => r.count),
    );
    if (counts.size > 1)
      row.error =
        'Search totals differ between name variants; manual review is required';
    Object.defineProperty(normalized, key, { value: row, enumerable: true });
  }
  const data = publicRanking(normalized);
  return {
    ...data,
    generated_at: new Date().toISOString(),
    total_narrators: data.ranking.length,
    rank_limit: limit,
    ranking: data.ranking.filter((r) => r.rank <= limit),
  };
}

export function build(input = 'data/public-counts.json', output = 'dist') {
  const data = topRanking(readJSON<CountRecords>(input, {}));
  if (!data.ranking.length)
    throw Error('No ranking data is available for publication');
  mkdirSync(output, { recursive: true });
  render(
    resolve(output, 'index.html'),
    data,
    undefined,
    '登録したナレーターのAudible日本版での作品数を比較しています。配信予定作品やポッドキャストを含む場合があります。同数は同順位です。',
  );
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  build();
