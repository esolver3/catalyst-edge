"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CircleDollarSign,
  Clock3,
  Gauge,
  Newspaper,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
type Factor = { label: string; value: number; detail: string };
type Signal = {
  id: number;
  asset: string;
  name: string;
  rank: number;
  side: "LONG" | "SHORT";
  confidence: number;
  price: string;
  change: number;
  entry: string;
  target: string;
  stop: string;
  targetMove: number;
  stopMove: number;
  catalyst: string;
  horizon: string;
  risk: string;
  factors: Factor[];
};
type Payload = {
  live: boolean;
  updatedAt: string;
  regime: { label: string; score: number; marketChange: number };
  global: {
    marketCap: number;
    volume: number;
    btcDominance: number;
    ethDominance: number;
  };
  summary: {
    active: number;
    longs: number;
    shorts: number;
    highConviction: number;
  };
  signals: Signal[];
  endpoints: string[];
  message?: string;
};
const fallback: Signal = {
  id: 1,
  asset: "BTC",
  name: "Bitcoin",
  rank: 1,
  side: "LONG",
  confidence: 0,
  price: "—",
  change: 0,
  entry: "—",
  target: "—",
  stop: "—",
  targetMove: 0,
  stopMove: 0,
  catalyst: "Waiting for live CoinMarketCap data",
  horizon: "—",
  risk: "—",
  factors: [],
};
function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="score-ring"
      style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}
    >
      <span>{score || "—"}</span>
    </div>
  );
}
const compact = (n?: number) => (n ? `$${(n / 1e12).toFixed(2)}T` : "—");
export default function Home() {
  const [filter, setFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paperIds, setPaperIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    return fetch("/api/market")
      .then((r) => r.json())
      .then((p: Payload) => {
        if (!p.live) throw new Error(p.message || "CMC unavailable");
        setData(p);
        setSelectedId((x) => x ?? p.signals[0]?.id ?? null);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  const refresh = () => {
    setLoading(true);
    void load();
  };
  useEffect(load, []);
  const visible = useMemo(
    () =>
      (data?.signals ?? []).filter(
        (s) =>
          (filter === "ALL" || s.side === filter) &&
          `${s.asset} ${s.name}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [data, filter, query],
  );
  const selected =
    data?.signals.find((s) => s.id === selectedId) ??
    data?.signals[0] ??
    fallback;
  const time = data?.updatedAt
    ? new Date(data.updatedAt).toISOString().slice(11, 19)
    : "—";
  const verified = Boolean(data && !error);
  const inPaper = paperIds.includes(selected.id);
  const togglePaper = () =>
    setPaperIds(
      inPaper
        ? paperIds.filter((id) => id !== selected.id)
        : [...paperIds, selected.id],
    );
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">
            <Activity size={19} />
          </div>
          <div>
            <b>CATALYST EDGE</b>
            <span>CMC DECISION ENGINE</span>
          </div>
        </div>
        <div className="market-status">
          <i className={error ? "offline" : ""} />{" "}
          {error ? "CMC DEGRADED" : data ? "CMC LIVE" : "CONNECTING"}{" "}
          <span>•</span>{" "}
          {verified ? "2 VERIFIED ENDPOINTS" : "AWAITING VERIFICATION"}{" "}
          <b>{time} UTC</b>
        </div>
        <div className="header-actions">
          <span className="mode">PAPER LIST · {paperIds.length}</span>
        </div>
      </header>
      <nav className="rail" aria-label="Dashboard sections">
        <a className="active" href="#signals">
          <Zap size={20} />
          <span>Signals</span>
        </a>
        <a href="#markets">
          <Gauge size={20} />
          <span>Markets</span>
        </a>
        <a href="#evidence">
          <Newspaper size={20} />
          <span>Evidence</span>
        </a>
        <a href="#risk">
          <ShieldCheck size={20} />
          <span>Risk</span>
        </a>
      </nav>
      <section className="workspace">
        <div className="headline-row" id="markets">
          <div>
            <div className="eyebrow">
              <Radio size={13} /> EXPLAINABLE SIGNAL ENGINE
            </div>
            <h1>Trade setups, ranked by live evidence.</h1>
            <p>
              Every score is calculated from CMC momentum, liquidity, trend
              alignment and market regime.
            </p>
          </div>
          <div className="pulse">
            <span>Market pulse</span>
            <strong
              className={data?.regime.label === "RISK-ON" ? "green" : "red"}
            >
              {data?.regime.label ?? "CALCULATING"}
            </strong>
            <div>
              <i style={{ width: `${data?.regime.score ?? 0}%` }} />
            </div>
            <small>{data?.regime.score ?? 0} / 100</small>
          </div>
        </div>
        {error && (
          <div className="error-banner">
            Live CMC connection is retrying: {error}{" "}
            <button type="button" onClick={refresh}>Retry</button>
          </div>
        )}
        <div className="stats">
          <article>
            <span>Ranked setups</span>
            <strong>{data?.summary.active ?? "—"}</strong>
            <small>
              <Sparkles size={13} />
              {data?.summary.highConviction ?? 0} high conviction
            </small>
          </article>
          <article>
            <span>Total market cap</span>
            <strong>{compact(data?.global.marketCap)}</strong>
            <small
              className={(data?.regime.marketChange ?? 0) >= 0 ? "up" : "down"}
            >
              {(data?.regime.marketChange ?? 0) >= 0 ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              )}{" "}
              {data?.regime.marketChange ?? 0}%
            </small>
          </article>
          <article>
            <span>BTC dominance</span>
            <strong>
              {data ? `${data.global.btcDominance.toFixed(1)}%` : "—"}
            </strong>
            <small>CMC global metrics</small>
          </article>
          <article>
            <span>Signal mix</span>
            <strong>
              {data ? `${data.summary.longs}L / ${data.summary.shorts}S` : "—"}
            </strong>
            <small>Direction from weighted momentum</small>
          </article>
        </div>
        <div className="content-grid" id="signals">
          <section className="panel signals-panel">
            <div className="panel-head">
              <div>
                <h2>Ranked setups</h2>
                <span>
                  {loading
                    ? "Calculating…"
                    : error
                      ? "Showing last verified result"
                      : "Refreshed from CMC"}
                </span>
              </div>
              <div className="filters">
                <button
                  type="button"
                  onClick={refresh}
                  aria-label="Refresh live market data"
                >
                  <RefreshCw size={13} />
                </button>
                <div className="search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find asset"
                    aria-label="Find asset"
                  />
                </div>
                {(["ALL", "LONG", "SHORT"] as const).map((x) => (
                  <button
                    type="button"
                    key={x}
                    onClick={() => setFilter(x)}
                    className={filter === x ? "on" : ""}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <div className="setup-list">
              {visible.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`setup ${selected.id === s.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="asset">
                    <span>{s.asset[0]}</span>
                    <div>
                      <strong>{s.asset}</strong>
                      <small>
                        #{s.rank} · {s.name}
                      </small>
                    </div>
                  </div>
                  <div className="price">
                    <strong>{s.price}</strong>
                    <small className={s.change >= 0 ? "up" : "down"}>
                      {s.change >= 0 ? "+" : ""}
                      {s.change}%
                    </small>
                  </div>
                  <div className={`side ${s.side.toLowerCase()}`}>{s.side}</div>
                  <div className="catalyst">
                    <strong>{s.catalyst}</strong>
                    <small>
                      <Clock3 size={12} />
                      {s.horizon} · {s.risk} risk
                    </small>
                  </div>
                  <div className="score">
                    <ScoreRing score={s.confidence} />
                    <small>score</small>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <aside className="panel detail-panel" id="risk">
            <div className="detail-top">
              <div>
                <span>MODEL OUTPUT</span>
                <h2>
                  {selected.asset}{" "}
                  <em className={selected.side.toLowerCase()}>
                    {selected.side}
                  </em>
                </h2>
              </div>
              <ScoreRing score={selected.confidence} />
            </div>
            <div className="levels">
              <div>
                <span>ENTRY ZONE</span>
                <strong>{selected.entry}</strong>
              </div>
              <div>
                <span>TAKE PROFIT</span>
                <strong className="green">{selected.target}</strong>
              </div>
              <div>
                <span>INVALIDATION</span>
                <strong className="red">{selected.stop}</strong>
              </div>
            </div>
            <div className="factor-list">
              <span>WHY THIS SCORE</span>
              {selected.factors.map((f) => (
                <div className="factor" key={f.label}>
                  <div>
                    <b>{f.label}</b>
                    <small>{f.detail}</small>
                  </div>
                  <div>
                    <i style={{ width: `${f.value}%` }} />
                  </div>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
            <div className="allocation">
              <div>
                <span>Paper allocation</span>
                <strong>$100.00</strong>
              </div>
              <div>
                <span>Modeled loss at stop</span>
                <strong>${selected.stopMove.toFixed(2)}</strong>
              </div>
            </div>
            <button
              type="button"
              className={`execute ${inPaper ? "added" : ""}`}
              onClick={togglePaper}
              disabled={!data}
            >
              <Target size={17} />{" "}
              {inPaper ? "REMOVE FROM PAPER LIST" : "ADD TO PAPER LIST"}
            </button>
            <p className="disclaimer">
              Browser-local paper watchlist only. No order is sent. Research
              signal, not a guarantee or financial advice.
            </p>
          </aside>
        </div>
        <section className="panel catalyst-panel" id="evidence">
          <div className="panel-head">
            <div>
              <h2>API evidence</h2>
              <span>
                Connection status for the CMC data used in this result
              </span>
            </div>
            <span className={`source-btn ${verified ? "" : "unverified"}`}>
              <CircleDollarSign size={15} />{" "}
              {verified
                ? "Verified · 60s cache"
                : error
                  ? "Degraded"
                  : "Connecting"}
            </span>
          </div>
          {(
            data?.endpoints ?? [
              "GET /public-api/v1/cryptocurrency/listings/latest",
              "GET /public-api/v1/global-metrics/quotes/latest",
            ]
          ).map((e, i) => (
            <div className="news" key={e}>
              <time>0{i + 1}</time>
              <div>
                <span>CoinMarketCap API</span>
                <strong>{e}</strong>
              </div>
              <em className={verified ? "bullish" : "mixed"}>
                {verified ? "HTTP 200" : "PENDING"}
              </em>
              <b>{i ? "Regime · dominance" : "Price · volume · rank"}</b>
              <div className="impact">
                <i style={{ width: verified ? "100%" : "0%" }} />
                <small>{verified ? "live" : "waiting"}</small>
              </div>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
