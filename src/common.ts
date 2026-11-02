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
  const narrators = data.narrators ?? [
    ...data.ranking,
    ...(data.unresolved ?? []),
  ];
  const candidateList = `<details class="candidates"><summary>集計対象のナレーター（${narrators.length}名）</summary><p>上位20位以外と、件数を確認できなかったナレーターも含みます。</p><ul>${narrators.map((r) => `<li>${r.url ? `<a href="${escape(searchURL(r.url))}">${escape(r.name)}</a>` : escape(r.name)}</li>`).join('')}</ul></details>`;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>yomikazu</title><style>body{font:16px/1.7 system-ui;max-width:1080px;margin:40px auto;padding:0 20px;background:#f8f7f3}table{width:100%;border-collapse:collapse;background:white}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}.target,section{background:#fff0d4}section{padding:20px}input{padding:12px;margin:20px 0}.scroll{overflow-x:auto}footer{margin-top:32px;text-align:center}.github-link{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:#57606a;border-radius:8px}.github-link:hover{color:#24292f;background:#00000008}.github-link:focus-visible{outline:2px solid #0969da;outline-offset:2px}.candidates{margin:24px 0}.candidates summary{cursor:pointer}.candidates ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px 24px;padding-left:24px}</style><h1>yomikazu — ナレーター作品数ランキング</h1><section><strong>${escape(summary)}</strong><p>調査対象のナレーター内での順位です。Audible全体の順位とは異なる場合があります。</p></section><p>${escape(notes)}</p><label>ナレーター名で検索 <input id="filter" placeholder="ナレーター名を入力"></label><div class="scroll"><table><thead><tr><th>順位</th><th>ナレーター</th><th>件数</th><th>確認日時（UTC）</th></tr></thead><tbody>${table}</tbody></table></div>${candidateList}<details><summary>件数・順位未確定</summary><ul>${(data.unresolved ?? []).map((r) => `<li>${escape(r.name)}：${escape(r.error ? '件数を確認できませんでした' : r.lower_bound ? r.count + '件以上' : '未確認')}</li>`).join('')}</ul></details><footer><p><a class="github-link" href="https://github.com/koooge/yomikazu" aria-label="GitHubでyomikazuを見る" title="GitHubでyomikazuを見る"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.79-1.51-3.79-1.51-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.722 2.637 1.225 3.28.937.102-.728.393-1.225.715-1.507-2.5-.284-5.13-1.25-5.13-5.563 0-1.23.44-2.233 1.16-3.02-.116-.285-.503-1.43.11-2.98 0 0 .945-.302 3.094 1.154A10.79 10.79 0 0 1 12 6.178c.956.004 1.918.13 2.817.379 2.148-1.456 3.091-1.154 3.091-1.154.615 1.55.228 2.695.112 2.98.722.787 1.158 1.79 1.158 3.02 0 4.324-2.634 5.276-5.144 5.555.405.35.766 1.04.766 2.096 0 1.513-.014 2.733-.014 3.104 0 .3.202.65.774.54A11.252 11.252 0 0 0 12 .75Z"/></svg></a></p></footer><script>const normalize=s=>s.normalize('NFKC').replace(/\\s/g,'').toLowerCase();document.querySelector('#filter').addEventListener('input',e=>{for(const r of document.querySelectorAll('tbody tr'))r.hidden=!normalize(r.cells[1].textContent).includes(normalize(e.target.value));});</script></html>`,
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
