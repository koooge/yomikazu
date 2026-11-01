import { dirname } from 'node:path';
import { build } from './build.ts';
import type { CountRecords } from './types.ts';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { BASE, readJSON, writeJSON, publicRanking, render } from './common.ts';
import { fetchCatalog, catalogURL } from './api.ts';
export const narratorURL = (name: string) =>
  BASE + '/search?' + new URLSearchParams({ searchNarrator: name });
export async function main(args = process.argv.slice(2)) {
  const { values: a } = parseArgs({
    args,
    options: {
      candidates: {
        type: 'string',
        default: fileURLToPath(
          new URL('../data/narrators.json', import.meta.url),
        ),
      },
      counts: {
        type: 'string',
        default: fileURLToPath(
          new URL('../data/public-counts.json', import.meta.url),
        ),
      },
      output: {
        type: 'string',
        default: fileURLToPath(
          new URL('../dist/public-ranking.html', import.meta.url),
        ),
      },
      name: { type: 'string', multiple: true, default: [] },
      target: { type: 'string' },
      refresh: { type: 'boolean' },
      force: { type: 'boolean' },
      limit: { type: 'string', default: '0' },
      delay: { type: 'string', default: '3' },
    },
  });
  const delay = Number(a.delay),
    limit = Number(a.limit);
  if (
    !Number.isFinite(delay) ||
    delay < 1 ||
    !Number.isInteger(limit) ||
    limit < 0
  )
    throw Error(
      'delay must be at least 1 second and limit must be a non-negative integer',
    );
  const records = readJSON<CountRecords>(a.counts, {});
  const candidates = readJSON<unknown>(a.candidates, []);
  if (
    !Array.isArray(candidates) ||
    candidates.some((name) => typeof name !== 'string' || !name.trim())
  )
    throw Error('Candidates must be an array of non-empty names');
  const names = new Set([...candidates, ...a.name]);
  if (a.target) names.add(a.target);
  names.delete('デジタルボイス');
  for (const name of names)
    if (!Object.hasOwn(records, name))
      Object.defineProperty(records, name, {
        value: { name, url: narratorURL(name), count: null },
        enumerable: true,
        writable: true,
        configurable: true,
      });
  if (a.refresh) {
    let todo = Object.values(records).filter(
      (r) => a.force || r.count == null || r.error,
    );
    todo.sort(
      (x, y) =>
        Number(y.name === a.target) - Number(x.name === a.target) ||
        x.name.localeCompare(y.name, 'ja'),
    );
    if (limit) todo = todo.slice(0, limit);
    for (const row of todo) {
      try {
        await setTimeout(delay * 1000);
        const data = await fetchCatalog({
          narrator: row.name,
          num_results: '1',
        });
        Object.assign(row, {
          count: data.total_results,
          lower_bound: false,
          checked_at: new Date().toISOString(),
          source: catalogURL({ narrator: row.name, num_results: '1' }),
          source_type: 'audible_catalog_api',
        });
        delete row.error;
      } catch (error) {
        row.error = error instanceof Error ? error.message : String(error);
      }
      console.log(`${row.name}: ${row.error ?? row.count}`);
      writeJSON(a.counts, records);
    }
  }
  render(
    a.output,
    publicRanking(records),
    a.target,
    'Audible日本版のカタログAPI検索結果（全言語）。配信予定やポッドキャスト等を含む可能性があります。表記ゆれは未統合です。同数は同順位。「以上」と取得失敗は順位に含めません。',
  );
  if (a.refresh) build(a.counts, dirname(a.output));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error('Error: ' + e.message);
    process.exitCode = 1;
  });
