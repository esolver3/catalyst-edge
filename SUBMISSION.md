# Catalyst Edge — DoraHacks Final Submission Package

## Submission fields

**Project name:** Catalyst Edge<br>
**Track:** Markets and Trading Tools<br>
**One-line pitch:** Catalyst Edge turns live CoinMarketCap data into ranked, explainable long and short research setups with transparent entry, target, invalidation, and risk levels.

### Project description

Crypto traders face hundreds of simultaneous price moves but rarely get a consistent explanation of which signals are meaningful. Catalyst Edge converts live CoinMarketCap market data into a focused, auditable decision surface.

The engine screens the top 100 cryptoassets, excludes stablecoins and illiquid markets, and scores eligible assets using weighted 1-hour, 24-hour, and 7-day momentum; volume-to-market-cap turnover; directional trend alignment; and the global market regime. It ranks the eight strongest setups and assigns each a direction, confidence score, entry band, target, invalidation level, time horizon, risk label, and fixed $100 paper allocation.

Every output is explainable. Selecting a setup reveals the factors behind its score. A browser-local paper list lets users save or remove a setup without connecting a wallet or sending an order. The interface also displays the CoinMarketCap endpoints, last refresh time, and verified connection state.

Catalyst Edge is decision-support research, not financial advice, an execution venue, or a claim of guaranteed returns.

### Why it fits Markets and Trading Tools

- Converts market-wide data into a repeatable screening and ranking workflow.
- Makes every score inspectable instead of presenting a black-box prediction.
- Pairs each setup with explicit upside, invalidation, and modeled loss at the stop.
- Demonstrates a practical, server-side use of live CoinMarketCap data.

### CoinMarketCap integration

- `GET /public-api/v1/cryptocurrency/listings/latest`
- `GET /public-api/v1/global-metrics/quotes/latest`

Requests run server-side, never expose a key to the browser, and use a 60-second shared cache. The public prototype uses CoinMarketCap's keyless public surface so judges can open it without credentials. A production deployment can replace the base URL with the participant's server-side Startup-tier API configuration.

### Technical architecture

1. A Next.js server route fetches the top-100 listings and global metrics in parallel.
2. Stablecoins and assets below the liquidity thresholds are removed.
3. A deterministic scoring function calculates direction, confidence, levels, horizon, risk, and four explainability factors.
4. The responsive React dashboard ranks the results, supports filtering and inspection, and stores a paper watchlist only in the user's browser.

**Stack:** Next.js 16, React 19, TypeScript, Vinext/Vite, and Cloudflare Workers.

### Links

- Live demo: https://catalyst-edge.saptael.chatgpt.site
- 24-second video: https://catalyst-edge.saptael.chatgpt.site/Catalyst_Edge_Demo.mp4
- Public repository: https://github.com/esolver3/catalyst-edge

## Judge walkthrough (45 seconds)

1. **0–5 seconds:** “Catalyst Edge turns live CoinMarketCap data into explainable market research.”
2. **5–12 seconds:** Point to **CMC LIVE**, the UTC refresh time, and the verified endpoints.
3. **12–22 seconds:** Switch between **ALL**, **LONG**, and **SHORT** to show the ranked market screen.
4. **22–32 seconds:** Select one asset and show its entry zone, target, invalidation, modeled loss, and $100 paper allocation.
5. **32–40 seconds:** Show the four factor bars and explain that the score is deterministic and inspectable.
6. **40–45 seconds:** Add the setup to the paper list, then show **API evidence** and the public repository.

## Paste-ready promotional copy

Built for the CoinMarketCap API Hackathon: Catalyst Edge turns live CMC market data into ranked, explainable long and short research setups.

Every result shows its momentum, liquidity, trend alignment, market-regime fit, entry zone, target, and invalidation—plus a browser-local $100 paper watchlist. No wallet and no live order execution.

Live demo: https://catalyst-edge.saptael.chatgpt.site<br>
Video: https://catalyst-edge.saptael.chatgpt.site/Catalyst_Edge_Demo.mp4<br>
Code: https://github.com/esolver3/catalyst-edge

#BuildWithCMC #CoinMarketCap #TradingTools #CryptoData

## Final external checklist

These items live outside the repository and must be confirmed on DoraHacks before submission:

- DoraHacks project page is published and set to **Markets and Trading Tools**.
- Project page includes the live demo, public repository, and 24-second video links above.
- Team member names and contact details are complete.
- Required CoinMarketCap API participation or Startup-tier details are attached, if requested by the event form.
- The final submission is saved and visibly marked submitted before the event deadline.

## Known limitations

- Signals are deterministic research outputs, not backtested performance claims.
- The paper list is browser-local and does not track fills, P&L, or execution.
- The keyless public CMC surface is narrower than a full Startup-tier integration.
- Data refreshes on a 60-second cache rather than tick-by-tick.
