# CMC DEX research integration — Phase 1

Status: development branch only; no trading or production changes.

## Scope
- Read-only DEX data ingestion using server-side CMC credentials.
- Network + contract-address identifiers; never identify assets by ticker alone.
- Pair quotes, pool liquidity, holder concentration, and available security signals.
- $100 paper-only opportunity evaluation, with explicit gas, DEX fees, slippage, price impact, and freshness checks.
- No wallet signing, swaps, order execution, or deployment.

## Data contract
Each candidate must carry network, token contract, pool/pair identifier, quote timestamp, data source, liquidity USD, quoted prices, and risk flags. Reject missing or stale critical fields instead of substituting invented values.

## Proposed gating
1. Validate supported network and exact token contract.
2. Verify pair/pool identity and available liquidity.
3. Reject stale quotes, incomplete security data, and unsupported routes.
4. Compute estimated net return = expected output value - input value - swap fees - gas - slippage - other route costs.
5. Paper-log both candidate and rejection reason. Never label a quoted spread as realized profit.

## Next implementation steps
- Confirm DEX endpoint access and plan limits using a server-side secret; never commit keys.
- Add typed adapter and mocked fixture tests.
- Add read-only API route and UI with source/freshness indicators.
- Run tests and review before merging.

Official documentation: https://coinmarketcap.com/api/dex/
