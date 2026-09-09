# Catalyst Edge

Catalyst Edge is an explainable market-signal engine built for the 2026 CoinMarketCap API Hackathon. It turns live CMC market data into ranked, short-duration research setups with transparent risk levels and factor-by-factor scoring.

## What it does

- Pulls the top 100 cryptoassets and global market metrics from CoinMarketCap.
- Removes stablecoins and thin assets from the candidate set.
- Scores momentum, liquidity, trend alignment and market-regime agreement.
- Ranks the strongest long and short research signals.
- Calculates an entry band, target, invalidation level and a fixed $100 paper allocation.
- Shows the CMC endpoints and their live status in the product UI.

## CoinMarketCap API use

The public prototype uses CMC's Keyless Public API so judges can run it without secrets:

- `GET /public-api/v1/cryptocurrency/listings/latest`
- `GET /public-api/v1/global-metrics/quotes/latest`

Requests run server-side and are cached for 60 seconds. A keyed Startup-tier integration can replace the base URL without exposing the key to the browser.

## Scoring model

The model combines weighted 1-hour, 24-hour and 7-day momentum; volume-to-market-cap turnover; directional agreement across periods; and agreement with the global market-cap regime. The score is deterministic and every component is visible in the interface.

This is decision-support research, not financial advice or a claim of guaranteed returns.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Hackathon track

AI Agents and Automation
