# National new-residential monetary prices

The primary housing view shows actual yuan/m² amounts, not a price index.

- Source: NBS annual real-estate news releases, 2014–2025 inclusive, 12 observations. Every record retains its release date, exact official article URL, source-body SHA-256, residential sales amount (亿元), and residential sales area (万平方米).
- Formula: amount / area × 10,000. This is an area-weighted transaction mean based on formal new-home sale contracts reported by real-estate development enterprises. It excludes resale homes. The NBS confirms this formula at the `methodUrl` in the JSON.
- These are original annual publication vintages. Subsequent revisions are not backfilled. Composition, scope and revisions affect comparisons; no cross-year percentage or investment-return calculation is presented. Do not silently substitute later yearbook values.
- 2026 January–August (41776亿元 / 41503万㎡ × 10000 = 10065.78元/㎡) is a distinct cumulative observation, never a full-year or August-only point and never joined onto the annual chart.
- Latest complete year is 2025: 73335亿元 / 73299万㎡ × 10000 = 10004.91元/㎡. Hero values round to whole yuan; the collapsed source table retains two decimals and exact input totals.
- Coverage is nationwide new residential contracts only. Any selected province, city or county hides the national result rather than implying local coverage. No city or county mean is inferred from 70-city indexes.
- No actual rental amount is included. Rental CPI is available only inside an optional collapsed section and remains explicitly a percentage measure.
- NBS website usage terms allow the cited public statistical use. Publisher-specific yearbook graphics and commercially restricted local or portal datasets are not ingested.
- Snapshot verified 2026-10-01; not automatically refreshed. A future update must retain source evidence, use the residential subrows in both totals, validate period types/units, and re-run the full tests and build. Missing periods must not be invented.

Source evidence lives in `src/data/nbs-housing-prices.json`. The main curve uses `annual` only; `latestYtd` is structurally separate. Existing monthly index data and baseline-break handling remain unchanged behind the optional details disclosure.
