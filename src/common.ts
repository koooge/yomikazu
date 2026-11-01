import { dirname } from 'node:path';
import type {
  RankingReport,
  CountedNarrator,
  CountRecords,
  NarratorCount,
} from './types.ts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export const BASE = 'https://www.audible.co.jp';
export const nameKey = (name: string) =>
  name.normalize('NFKC').replace(/\s+/gu, '');
export const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export const readJSON = <T>(path: string, fallback: T): T =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
export const writeJSON = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

export function searchURL(value: string) {
  const url = new URL(value);
  if (
    url.origin !== BASE ||
    url.pathname !== '/search' ||
    url.username ||
    url.password
  )
    throw Error('Expected an Audible Japan search URL');
  return url.href;
}

export function orderedRows<T extends CountedNarrator>(
  records: T[],
): (T & { rank: number })[] {
  let previous: number | undefined,
    rank = 0;
  return records
    .slice()
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
    .map((row, i) => {
      if (row.count !== previous) rank = i + 1;
      previous = row.count;
      return { ...row, rank };
    });
}

export function render(
  output: string,
  data: RankingReport,
  target: string | undefined,
  notes: string,
) {
  const row = data.ranking.find(
    (r) => nameKey(r.name) === nameKey(target ?? ''),
  );
  const summary = target
    ? row
      ? `${row.name}：${row.rank}位・${row.count}件`
      : `${target}：件数・順位未確認`
    : data.rank_limit
      ? `確認済み${data.total_narrators}名中 上位${data.rank_limit}位・${data.ranking.length}名を表示`
      : `掲載${data.ranking.length}名`;
  const table = data.ranking
    .map(
      (r) =>
        `<tr class="${target && nameKey(r.name) === nameKey(target) ? 'target' : ''}"><td>${r.rank}</td><td>${r.url ? `<a href="${escape(searchURL(r.url))}">${escape(r.name)}</a>` : escape(r.name)}</td><td>${r.count.toLocaleString('ja-JP')}</td><td>${escape(r.checked_at ?? '')}</td></tr>`,
    )
    .join('');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>yomikazu</title><style>body{font:16px/1.7 system-ui;max-width:1080px;margin:40px auto;padding:0 20px;background:#f8f7f3}table{width:100%;border-collapse:collapse;background:white}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}.target,section{background:#fff0d4}section{padding:20px}input{padding:12px;margin:20px 0}.scroll{overflow-x:auto}</style><h1>yomikazu — ナレーター作品数ランキング</h1><section><strong>${escape(summary)}</strong><p>調査対象のナレーター内での順位です。Audible全体の順位とは異なる場合があります。</p><p><strong>日本からの検索結果と件数が異なる場合があります。</strong><br>Audibleの作品数は、データを取得する接続元の地域によって変わります。そのため、日本から検索した件数より少なく表示される場合があり、順位にも影響します。</p></section><p>${escape(notes)}</p><label>ナレーター名で検索 <input id="filter" placeholder="ナレーター名を入力"></label><div class="scroll"><table><thead><tr><th>順位</th><th>ナレーター</th><th>件数</th><th>確認日時（UTC）</th></tr></thead><tbody>${table}</tbody></table></div><details><summary>件数・順位未確定</summary><ul>${(data.unresolved ?? []).map((r) => `<li>${escape(r.name)}：${escape(r.error ? '件数を確認できませんでした' : r.lower_bound ? r.count + '件以上' : '未確認')}</li>`).join('')}</ul></details><script>const normalize=s=>s.normalize('NFKC').replace(/\\s/g,'').toLowerCase();document.querySelector('#filter').addEventListener('input',e=>{for(const r of document.querySelectorAll('tbody tr'))r.hidden=!normalize(r.cells[1].textContent).includes(normalize(e.target.value));});</script></html>`,
  );
  writeJSON(output.replace(/\.[^./]+$/, '') + '.json', data);
  console.log(
    `Generated ranking for ${data.ranking.length} narrators: ${output}`,
  );
}

export function publicRanking(
  records: CountRecords,
): RankingReport & { unresolved: NarratorCount[] } {
  const values = Object.values(records);
  const valid = (r: NarratorCount): r is CountedNarrator =>
    r.count != null && !r.error && !r.lower_bound;
  return {
    metric: values.every((r) => r.source_type === 'audible_catalog_api')
      ? 'audible_catalog_api_total'
      : 'legacy_or_mixed_search_total',
    scope: 'audible.co.jp / all languages',
    coverage: 'listed_narrators',
    ranking: orderedRows(values.filter(valid)),
    unresolved: values.filter((r) => !valid(r)),
  };
}
