import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { Miniflare } from 'miniflare';
const transpile = (file) => ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const errorsUrl = 'data:text/javascript;base64,'+Buffer.from(transpile('lib/market-errors.ts')).toString('base64');
const {readCmcResponse, MarketRefreshError, refreshFailure} = await import(errorsUrl);
const js = transpile('lib/market-cache.ts').replace('"./market-errors"', JSON.stringify(errorsUrl));
const {readMarket, marketStatus} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const mf = new Miniflare({modules:true,script:'export default { fetch(){return new Response("ok")} }',d1Databases:['DB']});
const db = await mf.getD1Database('DB');
for (const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()) {
  for (const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint')) await db.exec(sql.replaceAll('\n',' '));
}
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
await test('fast concurrent refreshes do not reacquire a just-completed lease',async()=>{
  await reset();let calls=0;
  await Promise.all(Array.from({length:20},()=>readMarket(db,async()=>{calls++;return payload()})));
  assert.equal(calls,1);
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
await test('expired CMC access is persisted across readers, backs off, and clears on recovery',async()=>{
  await reset();const old={...payload(),updatedAt:new Date(Date.now()-600000).toISOString()};
  await db.prepare('INSERT INTO market_cache (key,payload,updated_at) VALUES (?,?,?)').bind('cmc-market-v1',JSON.stringify(old),Date.parse(old.updatedAt)).run();
  let calls=0;
  const fail=async()=>{calls++;return readCmcResponse(Response.json({status:{error_code:1004,error_message:'private-secret-do-not-echo'}},{status:402}),'CMC authenticated API','/v1/cryptocurrency/listings/latest')};
  const before=Date.now();const first=await readMarket(db,fail);const second=await readMarket(db,fail);
  assert.equal(calls,1);assert.deepEqual(first.payload,old);assert.deepEqual(first.feedIssue,second.feedIssue);
  assert.equal(first.feedIssue.code,'access_inactive');assert.equal(first.feedIssue.providerCode,1004);assert.equal(first.feedIssue.requiresOwnerAction,true);
  assert.ok(Date.parse(first.nextRetryAt)>=before+15*60000);assert.equal(JSON.stringify(first).includes('private-secret'),false);
  await db.prepare('UPDATE market_cache SET retry_after=0').run();
  const restored=await readMarket(db,async()=>payload());assert.equal(restored.source,'upstream');assert.equal(restored.feedIssue,undefined);
  const cached=await readMarket(db,fail);assert.equal(cached.feedIssue,undefined);assert.equal(cached.nextRetryAt,undefined);assert.equal(calls,1);
});
await test('cold start reports inactive access without inventing a snapshot',async()=>{
  await reset();const result=await readMarket(db,()=>readCmcResponse(new Response('billing page',{status:402}),'CMC authenticated API','/v1/global-metrics/quotes/latest'));
  assert.equal(result.payload,null);assert.equal(result.feedIssue.code,'access_inactive');
});
await test('rate limits honor Retry-After and classify application errors even with HTTP 200',async()=>{
  await assert.rejects(()=>readCmcResponse(Response.json({status:{error_code:1008}},{status:429,headers:{'Retry-After':'120'}}),'CMC authenticated API','/v1/test'),e=>e instanceof MarketRefreshError && e.issue.code==='rate_limited' && e.retryDelayMs===120000);
  const date=new Date(Date.now()+300000).toUTCString();
  await assert.rejects(()=>readCmcResponse(Response.json({status:{error_code:1008}},{status:429,headers:{'Retry-After':date}}),'CMC authenticated API','/v1/test'),e=>e.retryDelayMs>290000);
  await assert.rejects(()=>readCmcResponse(Response.json({status:{error_code:1010}}),'CMC authenticated API','/v1/test'),e=>e.issue.code==='quota');
});
await test('invalid successful envelopes and arbitrary errors cannot leak private details',async()=>{
  await assert.rejects(()=>readCmcResponse(Response.json({status:{error_code:null},secret:'private'}),'CMC authenticated API','/v1/test'),e=>e.issue.code==='invalid_data' && !JSON.stringify(e).includes('private'));
  assert.equal(JSON.stringify(refreshFailure(Error('secret-api-key'))).includes('secret-api-key'),false);
  assert.equal(marketStatus({updatedAt:'invalid'},'cache').stale,true);
});
await test('valid CMC response remains unchanged',async()=>{
  const body={status:{error_code:0},data:{ok:true}};
  assert.deepEqual(await readCmcResponse(Response.json(body),'CMC authenticated API','/v1/test'),body);
});
} finally {await mf.dispose()}
