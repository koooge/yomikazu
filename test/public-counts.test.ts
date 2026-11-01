import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchURL, publicRanking } from '../src/common.ts';
import { fetchCatalog, validateCatalog } from '../src/api.ts';
import { main } from '../src/public-counts.ts';
test('Validates API responses, sends unauthenticated requests, and handles failures',async()=>{
  assert.throws(()=>validateCatalog({products:[],total_results:-1}));
  assert.throws(()=>validateCatalog({products:[]}));
  const result=await fetchCatalog({narrator:'架空の名前'},async(url,options)=>{
    assert.equal(new URL(url).searchParams.get('narrator'),'架空の名前');
    assert.equal(new Headers(options.headers).get('Authorization'),null);
    return {ok:true,json:async()=>({products:[],total_results:0})};
  });
  assert.equal(result.total_results,0);
  await assert.rejects(fetchCatalog({},async()=>({ok:false,status:429,json:async()=>null})),/429/);
  await assert.rejects(fetchCatalog({},async()=>({ok:true,json:async()=>({error:'bad'})})),/Invalid catalog API response/);
});
test('Excludes lower bounds, failed requests, and unconfirmed counts',()=>{
  const result=publicRanking({a:{name:'A',count:9},b:{name:'B',count:9},c:{name:'C',count:3},d:{name:'D',count:999,error:'timeout'},e:{name:'E',count:10000,lower_bound:true},f:{name:'F',count:null}});
  assert.deepEqual(result.ranking.map(r=>r.rank),[1,1,3]); assert.equal(result.unresolved.length,3);
  assert.throws(()=>searchURL('https://example.com/search'));
});
test('Supports optional targets and candidate files, escapes HTML, and has no default person',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'yomikazu-'));
  try {
    const output=join(folder,'report.html'), counts=join(folder,'counts.json');
    const candidates=join(folder,'narrators.json');
    writeFileSync(candidates,'[]');
    const args=['--output',output,'--counts',counts,'--candidates',candidates];
    await main(args);
    assert.deepEqual(JSON.parse(readFileSync(join(folder,'report.json'),'utf8')).ranking,[]);
    await main([...args,'--target','<script>架空の名前</script>']);
    const data=JSON.parse(readFileSync(join(folder,'report.json'),'utf8'));
    assert.equal(data.unresolved.length,1);
    assert.ok(!readFileSync(output,'utf8').includes('<script>架空の名前</script>'));
    writeFileSync(candidates,JSON.stringify(['候補 一郎','候補 二郎','候補 一郎']));
    await main(args);
    assert.deepEqual(JSON.parse(readFileSync(join(folder,'report.json'),'utf8')).unresolved.map((r: {name: string})=>r.name),['候補 一郎','候補 二郎']);
  } finally { rmSync(folder,{recursive:true}); }
});

test('Builds the top ranking after a refresh with cached counts', async()=>{
  const folder=mkdtempSync(join(tmpdir(),'yomikazu-refresh-'));
  try {
    const counts=join(folder,'counts.json'), candidates=join(folder,'names.json');
    writeFileSync(counts,JSON.stringify({sample:{name:'Sample',count:10}}));
    writeFileSync(candidates,'[]');
    await main(['--refresh','--counts',counts,'--candidates',candidates,'--output',join(folder,'report.html')]);
    const report=JSON.parse(readFileSync(join(folder,'index.json'),'utf8'));
    assert.equal(report.ranking[0].name,'Sample');
    assert.equal(report.rank_limit,20);
  } finally {rmSync(folder,{recursive:true});}
});
