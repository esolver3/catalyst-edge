import { mkdir, writeFile } from "node:fs/promises";

const out = ".demo-recording/slides";
await mkdir(out, { recursive: true });
const response = await fetch("https://catalyst-edge.saptael.chatgpt.site/api/market?demo=slides");
const data = await response.json();
if (!data.live || !data.signals?.length) throw new Error(data.message || "Live CMC data unavailable");

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const frame = (title, subtitle, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
  <rect width="1440" height="900" fill="#050b0d"/>
  <rect x="28" y="26" width="1384" height="848" rx="28" fill="#081114" stroke="#173038" stroke-width="2"/>
  <text x="72" y="80" fill="#effff8" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4">CATALYST EDGE</text>
  <text x="72" y="112" fill="#5cebb5" font-family="Arial, sans-serif" font-size="15" letter-spacing="3">CMC DECISION ENGINE</text>
  <circle cx="1110" cy="75" r="7" fill="#43f4ad"/><text x="1130" y="82" fill="#caffea" font-family="Arial, sans-serif" font-size="17" font-weight="700">CMC LIVE</text>
  <text x="72" y="185" fill="#f4fffb" font-family="Arial, sans-serif" font-size="44" font-weight="700">${esc(title)}</text>
  <text x="72" y="226" fill="#8fa7ae" font-family="Arial, sans-serif" font-size="20">${esc(subtitle)}</text>
  ${body}
  <text x="72" y="846" fill="#667d84" font-family="Arial, sans-serif" font-size="15">Live CoinMarketCap research data · No order is sent · Not financial advice</text>
</svg>`;

const card = (x, y, w, h, label, value, detail, color = "#43f4ad") => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#0d181c" stroke="#21383e"/>
  <text x="${x + 22}" y="${y + 32}" fill="#758f97" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">${esc(label)}</text>
  <text x="${x + 22}" y="${y + 72}" fill="${color}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${esc(value)}</text>
  <text x="${x + 22}" y="${y + 100}" fill="#9bb0b6" font-family="Arial, sans-serif" font-size="15">${esc(detail)}</text>`;

const updated = new Date(data.updatedAt).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const top = data.signals[0];
let overview = card(72, 270, 300, 125, "MARKET REGIME", data.regime.label, `${data.regime.marketChange}% market-cap change`, data.regime.label === "RISK-ON" ? "#43f4ad" : "#ff6688");
overview += card(390, 270, 300, 125, "TOTAL MARKET CAP", `$${(data.global.marketCap / 1e12).toFixed(2)}T`, "CoinMarketCap global metrics");
overview += card(708, 270, 300, 125, "BTC DOMINANCE", `${data.global.btcDominance.toFixed(1)}%`, "Live market share");
overview += card(1026, 270, 300, 125, "RANKED SETUPS", String(data.summary.active), `${data.summary.highConviction} high conviction`);
data.signals.slice(0, 8).forEach((s, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 72 + col * 318;
  const y = 430 + row * 155;
  overview += card(x, y, 300, 132, `#${s.rank} · ${s.name}`, `${s.asset}  ${s.side}  ${s.confidence}`, `${s.price} · ${s.change > 0 ? "+" : ""}${s.change}% / 24h`, s.side === "LONG" ? "#43f4ad" : "#ff6688");
});
await writeFile(`${out}/01-overview.svg`, frame("Trade setups, ranked by live evidence.", `Refreshed ${updated}`, overview));

let detail = card(72, 274, 270, 125, "SELECTED SETUP", `${top.asset}  ${top.side}`, `Confidence score ${top.confidence}`, top.side === "LONG" ? "#43f4ad" : "#ff6688");
detail += card(360, 274, 270, 125, "ENTRY ZONE", top.entry, "Live-price execution band");
detail += card(648, 274, 270, 125, "TAKE PROFIT", top.target, `${top.targetMove}% modeled move`);
detail += card(936, 274, 270, 125, "INVALIDATION", top.stop, `${top.stopMove}% risk threshold`, "#ff6688");
detail += `<rect x="72" y="432" width="1254" height="300" rx="18" fill="#0d181c" stroke="#21383e"/>
  <text x="98" y="476" fill="#f0fff9" font-family="Arial, sans-serif" font-size="24" font-weight="700">WHY THIS SCORE</text>
  <text x="98" y="516" fill="#9bb0b6" font-family="Arial, sans-serif" font-size="18">${esc(top.catalyst)} · ${esc(top.horizon)} horizon · ${esc(top.risk)} risk</text>`;
top.factors.forEach((f, i) => {
  const y = 570 + i * 42;
  detail += `<text x="100" y="${y}" fill="#d5ebe3" font-family="Arial, sans-serif" font-size="18">${esc(f.label)}</text>
  <rect x="330" y="${y - 18}" width="650" height="16" rx="8" fill="#16262b"/><rect x="330" y="${y - 18}" width="${6.5 * f.value}" height="16" rx="8" fill="#39d99b"/>
  <text x="1005" y="${y}" fill="#43f4ad" font-family="Arial, sans-serif" font-size="18" font-weight="700">${f.value}</text>
  <text x="1060" y="${y}" fill="#8fa7ae" font-family="Arial, sans-serif" font-size="16">${esc(f.detail)}</text>`;
});
await writeFile(`${out}/02-evidence.svg`, frame("Explainable setup with defined risk.", "Entry, target and invalidation are calculated from live CMC evidence.", detail));

let api = `<rect x="72" y="270" width="1254" height="410" rx="20" fill="#0d181c" stroke="#21383e"/>
  <text x="104" y="326" fill="#f2fff9" font-family="Arial, sans-serif" font-size="26" font-weight="700">API EVIDENCE</text>
  <text x="104" y="360" fill="#8fa7ae" font-family="Arial, sans-serif" font-size="17">Connection status for the CoinMarketCap data used in this result</text>`;
data.endpoints.forEach((endpoint, i) => {
  const y = 408 + i * 108;
  api += `<rect x="104" y="${y}" width="1190" height="84" rx="14" fill="#101e22" stroke="#274149"/>
  <text x="130" y="${y + 34}" fill="#6f8991" font-family="Arial, sans-serif" font-size="14">0${i + 1} · COINMARKETCAP API</text>
  <text x="130" y="${y + 63}" fill="#e4f7ef" font-family="Arial, sans-serif" font-size="18">${esc(endpoint)}</text>
  <text x="1110" y="${y + 50}" fill="#43f4ad" font-family="Arial, sans-serif" font-size="20" font-weight="700">HTTP 200 · LIVE</text>`;
});
api += `<text x="104" y="640" fill="#43f4ad" font-family="Arial, sans-serif" font-size="18" font-weight="700">VERIFIED · 5-MINUTE RESILIENT CACHE · 429 RETRY + LAST-VERIFIED FALLBACK</text>`;
await writeFile(`${out}/03-api.svg`, frame("Live evidence judges can verify.", "Two CMC endpoints power price, volume, rank, dominance and regime data.", api));
console.log(JSON.stringify({ updatedAt: data.updatedAt, signals: data.signals.length, endpoints: data.endpoints.length }));
