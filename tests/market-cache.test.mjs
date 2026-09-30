import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Miniflare } from 'miniflare';
const js = ts.transpileModule(readFileSync('lib/market-cache.ts', 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readMarket, marketStatus} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const mf = new Miniflare({modules:true,script:'export default { fetch(){return new Response("ok")} }',d1Databases:['DB']});
const db = await mf.getD1Database('DB');
await db.exec(readFileSync('drizzle/0000_clear_wrecker.sql','utf8').replaceAll('\n',' '));
const reset = () => db.prepare('DELETE FROM market_cache').run();
const payload = () => ({updatedAt:new Date().toISOString(),signals:[{asset:'BTC'}]});
try {
await test('cold instance reads the shared successful snapshot',async()=>{
  await reset();let calls=0;
  const one=await readMarket(db,async()=>{calls++;return payload()});
  const two=await readMarket(db,async()=>{calls++;throw Error('should not fetch')});
  assert.equal(calls,1);assert.equal(one.source,'upstream');assert.equal(two.source,'cache');assert.deepEqual(one.payload,two.payload);
  assert.equal(marketStatus(two.payload,two.source).live,false);
});
await test('concurrent refreshes make only one upstream request',async()=>{
  await reset();let calls=0;
  const results=await Promise.all(Array.from({length:12},()=>readMarket(db,async()=>{calls++;await new Promise(r=>setTimeout(r,50));return payload()})));
  assert.equal(calls,1);assert.equal(results.filter(r=>r.source==='upstream').length,1);
});
await test('outage retains the newest snapshot and backs off',async()=>{
  await reset();const old={...payload(),updatedAt:new Date(Date.now()-600000).toISOString()};
  await db.prepare('INSERT INTO market_cache (key,payload,updated_at) VALUES (?,?,?)').bind('cmc-market-v1',JSON.stringify(old),Date.parse(old.updatedAt)).run();
  let calls=0;const fail=async()=>{calls++;throw Error('429')};
  const one=await readMarket(db,fail);const two=await readMarket(db,fail);
  assert.deepEqual(one.payload,old);assert.deepEqual(two.payload,old);assert.equal(calls,1);
  assert.equal(marketStatus(one.payload,one.source).status,'stale');
});
await test('upstream stale timestamps cannot be relabeled fresh',async()=>{
  await reset();const result=await readMarket(db,async()=>({updatedAt:new Date(Date.now()-600000).toISOString()}));assert.equal(result.payload,null);
});
await test('expired lease cannot overwrite newer data',async()=>{
  await reset();let release;const paused=new Promise(r=>release=r);const older=payload();
  const first=readMarket(db,async()=>{await paused;return older});
  for(let i=0;i<100;i++){const row=await db.prepare('SELECT lease_token FROM market_cache').first();if(row?.lease_token)break;await new Promise(r=>setTimeout(r,5));}
  await db.prepare('UPDATE market_cache SET lease_until=0').run();
  const newer={...payload(),signals:[{asset:'ETH'}]};await readMarket(db,async()=>newer);release();
  const last=await first;assert.deepEqual(last.payload,newer);
});
await test('source quotes age out even when the fetched timestamp is recent', () => {
  assert.equal(marketStatus({...payload(), sourceAsOf:new Date(Date.now()-21*60000).toISOString()}, 'upstream').status, 'stale');
});
await test('recovery replaces stale data after backoff expires',async()=>{
  await db.prepare('UPDATE market_cache SET updated_at=0,retry_after=0,lease_until=0').run();
  const fresh=payload();const result=await readMarket(db,async()=>fresh);assert.deepEqual(result.payload,fresh);assert.equal(result.source,'upstream');
});
} finally {await mf.dispose()}
