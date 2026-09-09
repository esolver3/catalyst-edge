# Catalyst Edge — DoraHacks Submission Package

## Project name

Catalyst Edge

## Track

Markets and Trading Tools

## One-line pitch

Catalyst Edge turns live CoinMarketCap data into ranked, explainable long and short research setups with clear entry, target and invalidation levels.

## Project description

Crypto traders often see hundreds of price movements without a consistent way to separate useful momentum from noise. Catalyst Edge converts live CoinMarketCap market data into a focused decision surface.

The engine screens the top 100 cryptoassets, removes stablecoins and thin markets, then scores each remaining asset using weighted 1-hour, 24-hour and 7-day momentum, volume-to-market-cap turnover, directional trend alignment and the global market regime. The strongest setups are ranked with a direction, confidence score, entry band, target, invalidation level, time horizon and fixed $100 paper allocation.

Every score is explainable. A trader can select a setup and see exactly how momentum, liquidity, trend alignment and market regime affected the result. The interface also exposes the CMC endpoints and connection status so judges can verify that the product is using live data.

Catalyst Edge is a research and paper-trading tool. It does not promise profits or provide financial advice.

## CoinMarketCap endpoints used

- `GET /public-api/v1/cryptocurrency/listings/latest`
- `GET /public-api/v1/global-metrics/quotes/latest`

The calls run server-side and are cached for 60 seconds.

## What the CMC API made possible

CoinMarketCap supplied normalized rankings, prices, market capitalizations, trading volumes and multi-period percentage changes across the market, plus global capitalization and dominance metrics. That allowed Catalyst Edge to compare assets consistently and score each setup against the same market-wide evidence.

## Current limitation

The public prototype uses CMC's keyless public endpoints so anyone can run the demo without receiving a private key. This surface is narrower than the full Startup-tier API and uses a 60-second cache. A production version would use the participant's server-side Startup-tier key for broader endpoints and higher request capacity without exposing the key to the browser.

## Links

- Live demo: https://catalyst-edge.saptael.chatgpt.site
- Public repository: https://github.com/esolver3/catalyst-edge

## 45-second demo video plan

1. **0–5 seconds:** Open the live demo and say, “Catalyst Edge turns live CoinMarketCap data into explainable trade research.”
2. **5–12 seconds:** Point to **CMC LIVE**, the UTC refresh time and the market pulse.
3. **12–22 seconds:** Show the ranked setups and switch between **ALL**, **LONG** and **SHORT**.
4. **22–32 seconds:** Select one asset and show its entry band, take-profit, invalidation and $100 paper allocation.
5. **32–40 seconds:** Show the four factor bars explaining the score.
6. **40–45 seconds:** Scroll to **API evidence** and say, “The endpoints and live status are visible, and the complete code is public on GitHub.”

## X post draft

I built Catalyst Edge for the CoinMarketCap API Hackathon — an explainable market engine that ranks live crypto setups using momentum, liquidity, trend alignment and the global CMC market regime.

Demo: [DEMO_VIDEO_LINK]
DoraHacks: [DORAHACKS_SUBMISSION_LINK]

#BuildwithCMC #CoinMarketCap #CryptoData #TradingTools
