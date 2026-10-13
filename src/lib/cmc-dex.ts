/** Read-only CoinMarketCap DEX client. Never submits trades. */
const ROOT = "https://pro-api.coinmarketcap.com";
const PLATFORMS = new Set(["ethereum","bsc","solana","base","arbitrum","polygon"]);
export type DexPool = { address:string; exchange:string; liquidityUsd:number; volume24hUsd:number };
export type DexSnapshot = { platform:string; address:string; fetchedAt:string; pools:DexPool[]; source:"cmc-keyed"|"cmc-public" };
export function validateToken(platform:string,address:string):void {
  if (!PLATFORMS.has(platform)) throw new Error("Unsupported platform");
  if (!/^[a-zA-Z0-9]{25,64}$/.test(address)) throw new Error("Invalid token address");
  if (platform !== "solana" && !/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Invalid EVM address");
}
export function evaluatePaperSpread(inputUsd:number, outputUsd:number, gasUsd:number, feeUsd:number, slippageUsd:number) {
  if (![inputUsd,outputUsd,gasUsd,feeUsd,slippageUsd].every(Number.isFinite) || inputUsd<=0 || [gasUsd,feeUsd,slippageUsd].some(v=>v<0)) throw new Error("Invalid cost inputs");
  const netUsd=outputUsd-inputUsd-gasUsd-feeUsd-slippageUsd;
  return {netUsd,netPct:netUsd/inputUsd*100,profitable:netUsd>0, simulated:true as const};
}
export async function fetchDexPools(platform:string,address:string, apiKey?:string, fetcher:typeof fetch=fetch):Promise<DexSnapshot> {
  validateToken(platform,address);
  const keyed=Boolean(apiKey);
  const url=new URL(ROOT+(keyed?"":"/public-api")+"/v1/dex/token/pools");
  url.searchParams.set("platform",platform);url.searchParams.set("address",address);url.searchParams.set("size","20");
  const response=await fetcher(url.toString(),{headers:{"Accept":"application/json",...(keyed?{"X-CMC_PRO_API_KEY":apiKey!}:{})},signal:AbortSignal.timeout(10000),cache:"no-store"});
  if(!response.ok) throw new Error("CMC DEX upstream HTTP "+response.status);
  const json:unknown=await response.json();
  if(typeof json!=="object"||json===null) throw new Error("Invalid CMC response");
  const body=json as Record<string,unknown>;
  const status=body.status as Record<string,unknown>|undefined;
  if(status && typeof status.error_code==="number" && status.error_code!==0) throw new Error("CMC DEX upstream error "+status.error_code);
  const rows=Array.isArray(body.data)?body.data:Array.isArray(json)?json:null;
  if(!rows) throw new Error("Missing CMC DEX pools");
  const pools:DexPool[]=rows.map((row:unknown)=>{
    if(!row||typeof row!=="object") throw new Error("Invalid pool");
    const p=row as Record<string,unknown>;
    const liquidityUsd=Number(p.liqUsd),volume24hUsd=Number(p.v24);
    if(typeof p.addr!=="string"||!p.addr||!Number.isFinite(liquidityUsd)||liquidityUsd<0||!Number.isFinite(volume24hUsd)||volume24hUsd<0) throw new Error("Incomplete pool");
    return {address:p.addr,exchange:typeof p.exn==="string"?p.exn:"Unknown",liquidityUsd,volume24hUsd};
  });
  return {platform,address,fetchedAt:new Date().toISOString(),pools,source:keyed?"cmc-keyed":"cmc-public"};
}
