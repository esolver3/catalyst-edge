import { env } from "cloudflare:workers";
import { getMarketStore } from "../../../db";
import { readMarket, marketStatus } from "../../../lib/market-cache";
import { readCmcResponse } from "../../../lib/market-errors";

const CMC_BASE = "https://pro-api.coinmarketcap.com/public-api";
const CMC_DATA_BASE = "https://api.coinmarketcap.com/data-api/v3";
const STABLE = new Set([
  "USDT",
  "USDC",
  "DAI",
  "FDUSD",
  "USDE",
  "USDS",
  "PYUSD",
  "TUSD",
  "USDD",
  "FRAX",
  "USD1",
]);
type Quote = {
  price: number;
  volume_24h: number;
  market_cap: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  last_updated?: string;
};
type Coin = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote: { USD: Quote };
};
type PublicCoin = {
  id: number;
  name: string;
  symbol: string;
  cmcRank: number;
  quotes: Array<{
    name: string;
    price: number;
    volume24h: number;
    marketCap: number;
    percentChange1h: number;
    percentChange24h: number;
    percentChange7d: number;
    lastUpdated?: string;
  }>;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 10 ? 4 : n < 1000 ? 2 : 0,
  }).format(n);
function scoreCoin(coin: Coin, marketChange: number) {
  const q = coin.quote.USD;
  const momentum =
    q.percent_change_1h * 0.25 +
    q.percent_change_24h * 0.5 +
    q.percent_change_7d * 0.25;
  const direction = momentum >= 0 ? 1 : -1;
  const aligned = [
    q.percent_change_1h,
    q.percent_change_24h,
    q.percent_change_7d,
  ].filter((x) => Math.sign(x) === direction).length;
  const turnover = q.market_cap > 0 ? q.volume_24h / q.market_cap : 0;
  const liquidity = clamp(turnover * 90, 0, 18);
  const trend = aligned * 5;
  const regime = Math.sign(marketChange) === direction ? 8 : 0;
  const confidence = Math.round(
    clamp(48 + Math.abs(momentum) * 1.5 + liquidity + trend + regime, 51, 94),
  );
  const side: "LONG" | "SHORT" = direction > 0 ? "LONG" : "SHORT";
  const volatility = clamp(
    Math.abs(q.percent_change_1h) + Math.abs(q.percent_change_24h) / 4,
    1.2,
    5,
  );
  const targetMove = clamp(1.8 + confidence / 35 + volatility / 3, 2.5, 7);
  const stopMove = clamp(targetMove * 0.45, 1.2, 3);
  const target =
    q.price * (1 + (side === "LONG" ? targetMove : -targetMove) / 100);
  const stop = q.price * (1 + (side === "LONG" ? -stopMove : stopMove) / 100);
  const factors = [
    {
      label: "Momentum",
      value: Math.round(clamp(50 + momentum * 4, 5, 95)),
      detail: `${q.percent_change_24h.toFixed(2)}% / 24h`,
    },
    {
      label: "Liquidity",
      value: Math.round(clamp(turnover * 250, 5, 95)),
      detail: `${(turnover * 100).toFixed(1)}% turnover`,
    },
    {
      label: "Trend alignment",
      value: Math.round((aligned / 3) * 100),
      detail: `${aligned}/3 periods agree`,
    },
    {
      label: "Market regime",
      value: Math.sign(marketChange) === direction ? 82 : 38,
      detail: `Global ${marketChange >= 0 ? "risk-on" : "risk-off"}`,
    },
  ];
  return {
    id: coin.id,
    asset: coin.symbol,
    name: coin.name,
    rank: coin.cmc_rank,
    side,
    confidence,
    price: money(q.price),
    rawPrice: q.price,
    change: Number(q.percent_change_24h.toFixed(2)),
    entry: `${money(q.price * 0.997)}–${money(q.price * 1.003)}`,
    target: money(target),
    stop: money(stop),
    targetMove: Number(targetMove.toFixed(1)),
    stopMove: Number(stopMove.toFixed(1)),
    catalyst:
      aligned === 3
        ? "Momentum confirmed across 1h, 24h and 7d"
        : "Momentum plus liquidity confirmation",
    horizon: volatility > 3 ? "4–12h" : "12–24h",
    risk: volatility > 3.5 ? "High" : volatility > 2 ? "Medium" : "Low",
    factors,
  };
}
function buildPayload(
  coins: Coin[],
  globalData: any,
  mode: string,
  endpoints: string[],
) {
  const g = globalData;
  const quote =
    g.quote?.USD ?? g.quotes?.find((item: any) => item.cryptoId === 2781);
  if (!quote) throw new Error("CMC returned no USD global quote");
  const marketChange = Number(
    quote.total_market_cap_yesterday_percentage_change ??
      quote.totalMarketCapYesterdayPercentageChange ??
      0,
  );
  const signals = coins
      .filter((c) => {
        const q = c.quote?.USD;
        return (
          !STABLE.has(c.symbol) &&
          q?.market_cap > 100_000_000 &&
          q?.volume_24h > 1_000_000 &&
          q.volume_24h / q.market_cap > 0.001
        );
      })
      .map((c) => scoreCoin(c, marketChange))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
  if (signals.length === 0 || signals.some((s) => !Number.isFinite(s.rawPrice) || s.rawPrice <= 0 || !Number.isFinite(s.confidence))) {
    throw new Error("CMC returned unusable market quotes");
  }
  if (![quote.total_market_cap ?? quote.totalMarketCap, quote.total_volume_24h ?? quote.totalVolume24H, g.btc_dominance ?? g.btcDominance, g.eth_dominance ?? g.ethDominance, marketChange].every((x) => typeof x === "number" && Number.isFinite(x))) {
    throw new Error("CMC returned invalid global metrics");
  }
  const sourceTimes = [quote.last_updated, ...coins.filter((c) => signals.some((s) => s.id === c.id)).map((c) => c.quote.USD.last_updated)].map((x) => Date.parse(x));
  if (sourceTimes.some((x) => !Number.isFinite(x) || Date.now() - x > 20 * 60_000 || x > Date.now() + 60_000)) {
    throw new Error("CMC source quotes are stale or missing timestamps");
  }
  const longs = signals.filter((s) => s.side === "LONG").length;
  return {
    live: true,
    mode,
    updatedAt: new Date().toISOString(),
    sourceAsOf: new Date(Math.min(...sourceTimes)).toISOString(),
    regime: {
      label: marketChange >= 0 ? "RISK-ON" : "RISK-OFF",
      score: Math.round(clamp(50 + Math.abs(marketChange) * 8, 50, 92)),
      marketChange: Number(marketChange.toFixed(2)),
    },
    global: {
      marketCap: quote.total_market_cap ?? quote.totalMarketCap,
      volume: quote.total_volume_24h ?? quote.totalVolume24H,
      btcDominance: g.btc_dominance ?? g.btcDominance,
      ethDominance: g.eth_dominance ?? g.ethDominance,
    },
    summary: {
      active: signals.length,
      longs,
      shorts: signals.length - longs,
      highConviction: signals.filter((s) => s.confidence >= 80).length,
    },
    signals,
    endpoints,
  };
}

async function fetchProPayload(apiKey?: string) {
  const base = apiKey ? "https://pro-api.coinmarketcap.com" : CMC_BASE;
  const source = apiKey ? "CMC authenticated API" : "CMC Keyless Public API";
  const headers: Record<string, string> = apiKey ? { "X-CMC_PRO_API_KEY": apiKey } : {};
  const [listingsRes, globalRes] = await Promise.all([
    fetch(`${base}/v1/cryptocurrency/listings/latest?limit=100&convert=USD`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000), headers,
    }),
    fetch(`${base}/v1/global-metrics/quotes/latest?convert=USD`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000), headers,
    }),
  ]);
  const [listings, global] = await Promise.all([
    readCmcResponse<{data: Coin[]}>(listingsRes, source, "/v1/cryptocurrency/listings/latest"),
    readCmcResponse<{data: {quote: {USD: Quote}}}>(globalRes, source, "/v1/global-metrics/quotes/latest"),
  ]);
  if (!Array.isArray(listings?.data) || !global?.data?.quote?.USD) {
    throw new Error("CMC API returned an unexpected payload");
  }
  return buildPayload(
    listings.data as Coin[],
    global.data,
    source,
    [
      apiKey ? "GET /v1/cryptocurrency/listings/latest" : "GET /public-api/v1/cryptocurrency/listings/latest",
      apiKey ? "GET /v1/global-metrics/quotes/latest" : "GET /public-api/v1/global-metrics/quotes/latest",
    ],
  );
}

async function fetchPublicDataPayload() {
  const [listingsRes, globalRes] = await Promise.all([
    fetch(
      `${CMC_DATA_BASE}/cryptocurrency/listing?start=1&limit=100&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    ),
    fetch(`${CMC_DATA_BASE}/global-metrics/quotes/latest?convert=USD`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    }),
  ]);
  const [listings, global] = await Promise.all([
    readCmcResponse<{data: {cryptoCurrencyList: PublicCoin[]}}>(listingsRes, "CMC Public Data API", "/data-api/v3/cryptocurrency/listing"),
    readCmcResponse<{data: {quotes: object[]}}>(globalRes, "CMC Public Data API", "/data-api/v3/global-metrics/quotes/latest"),
  ]);
  if (!Array.isArray(listings?.data?.cryptoCurrencyList) || !global?.data?.quotes) {
    throw new Error("CMC public data API returned an unexpected payload");
  }
  const coins = (listings.data.cryptoCurrencyList as PublicCoin[]).map((coin) => {
    const q = coin.quotes.find((quote) => quote.name === "USD") ?? coin.quotes[0];
    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      cmc_rank: coin.cmcRank,
      quote: {
        USD: {
          price: q.price,
          volume_24h: q.volume24h,
          market_cap: q.marketCap,
          percent_change_1h: q.percentChange1h,
          percent_change_24h: q.percentChange24h,
          percent_change_7d: q.percentChange7d,
          last_updated: q.lastUpdated,
        },
      },
    } satisfies Coin;
  });
  return buildPayload(
    coins,
    global.data,
    "CMC Public Data API",
    [
      "GET /data-api/v3/cryptocurrency/listing",
      "GET /data-api/v3/global-metrics/quotes/latest",
    ],
  );
}

async function fetchMarketPayload() {
  const apiKey = (env as Cloudflare.Env).CMC_API_KEY;
  if (apiKey) return fetchProPayload(apiKey);
  try {
    return await fetchProPayload();
  } catch {
    return fetchPublicDataPayload();
  }
}

function marketResponse(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const result = await readMarket(getMarketStore(), fetchMarketPayload);
    const health = { feedIssue: result.feedIssue, nextRetryAt: result.nextRetryAt, refreshing: result.refreshing };
    if (!result.payload) {
      return marketResponse({ live: false, status: "unavailable", ...health, message: result.feedIssue?.message ?? (result.refreshing ? "First market refresh is in progress. Retrying shortly." : "CMC is unavailable. Retrying shortly.") }, 503);
    }
    const status = marketStatus(result.payload, result.source);
    return marketResponse({
      ...result.payload,
      ...status,
      ...health,
      servedAt: new Date().toISOString(),
      warning: status.stale ? `${result.feedIssue?.message ?? "Live refresh is unavailable."} Showing the latest saved CMC snapshot; these setups are stale.` : undefined,
    });
  } catch (error) {
    console.error("Market persistence failed", error instanceof Error ? error.message : "Unknown failure");
    return marketResponse({ live: false, status: "unavailable", message: "Market data storage is temporarily unavailable. Retrying shortly." }, 503);
  }
}
