# Trends implementation and data contract

Route: `/trends/`. Homepage and product content remain unchanged. Main navigation and sitemap include Trends.

The dashboard supports category filtering, free-text instrument/source search, sortable name/period-change table, local-browser favorites, selectable historical windows, daily/monthly observation inspection and a province/city/district request UI. Region names are user-entered filters, not claims of nationwide geographic data coverage. No county statistics are fabricated or substituted with city statistics.

## Snapshot coverage

- ECB official historic XML: five EUR reference pairs plus derived USD/CNY, 2019-01 to 2026-09-30. Daily reference rates, not executable live quotes.
- World Bank Pink Sheet official September 2026 workbook: gold, silver, Brent oil, copper, aluminum and US HRW wheat, 2019-01 to 2026-08 (92 observations per series). Source workbook states updated 2026-09-02. Identified as monthly historical averages, not live prices, in the UI. The official landing page lists the next release as 2026-10-02; September observations are not yet published. Date day `01` is a month identifier, not a daily quote.
- Housing, rent, A/HK/US equities and consumer goods have navigable entries with explicit missing-data status. They have no fabricated prices or charts.
- No nationwide province/city/district/county housing or rent feed is connected. NBS housing data coverage is 70 large/medium cities and is an index, not a nationwide price per square metre.

`src/data/trends.json` is a build-time static snapshot. The GitHub Pages workflow attempts refresh on weekdays at 18:23 UTC, then validates, caches and deploys the snapshot. No API key is embedded. Source URLs are on every detail view. `docs/trends-source-checksums.json` records hashes of the downloaded source files used for this import. Original sources can change; preserve downloaded originals when performing later imports.

## Reproducible import

Download the two source files from the source URLs in the JSON into local files. Inspect their dates and columns first. Install Python openpyxl if needed, then run `python scripts/import-trends.py /path/to/ecb.xml /path/to/wb.xlsx`. Pass an optional third argument (`YYYY-MM-DD`) for a reproducible retrieval date; otherwise the importer uses today. The import excludes future dates. Never change a source date merely to make data look fresh.

`npm run check`, `npm test`, and `npm run build` are the required repository checks. Sandboxed environments may need `ASTRO_TELEMETRY_DISABLED=1` and a writable npm cache. Browser regression script: `node tests/trends-browser.cjs` with the local site listening at http://127.0.0.1:4321 (Playwright and Chromium required). Region Cancel/Escape must preserve applied state; favorites survive reload and missing data has no chart.

## September 2026 refresh verification

The workbook endpoint was followed from https://www.worldbank.org/en/research/commodity-markets on 2026-09-30, rather than guessed from an old release identifier. Current endpoint: https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx. Select the `Monthly Prices` worksheet explicitly because the first sheet is a hidden diagnostic table. Publication date is read from the workbook and future publication dates are rejected. August 2026 prices were cross-checked against the official September Pink Sheet PDF: gold 4411, silver 65.4, Brent 90.9, copper 14326, aluminum 3251, US HRW wheat 330 (units as displayed in the dashboard).

## Automatic updates and failures

The existing deploy workflow now also runs on weekday schedule (18:23 UTC) and manual dispatch. ECB is checked each run. The World Bank official landing page is checked each new month until a workbook published in that month is retrieved; then that workbook is not downloaded again until next month. This follows monthly publication, not intraday commodity pricing. Provider delays and GitHub scheduler delays remain possible.

Each source is parsed and validated independently before replacing its instruments. Failed downloads, invalid/shortened series, regressed vintages, wrong instrument sets and future publication dates retain the previous values, retrieval date and SHA-256 checksum. Successful raw downloads are retained as workflow artifacts for 90 days. Unit tests, Astro checks and a full build must pass before caching or deployment. No new token or repository-write permission is added. The committed snapshot is a verified recovery baseline; newer snapshots and refresh status are stored in the Actions cache and deployed build, not committed to the repository.

Cache storage is not permanent. Scheduled/manual runs fail closed when the matching last-good cache is unavailable, leaving the current published site unchanged rather than silently reverting its history. A push seeds a fresh cache from the committed baseline if no matching cache exists. Cache save failures or scheduler delays can prevent continuity; check failed workflows and restore a verified baseline when needed. The browser's age-based stale labels remain active even when deployment stops.

The UI shows per-source failure state and per-instrument retrieval date. Client-side age checks mark FX older than 7 days and monthly observations older than 75 days as stale, even if scheduled refresh stops. Thresholds allow weekends and the monthly release lag, not an assurance of latest availability. There is no intraday price feed. Missing housing/rent/stocks/consumer coverage remains explicit.

Run `python -m unittest discover -s tests -p 'test_*.py'` in addition to the JS checks. The tests cover official-link allowlisting, history regression, last-good preservation and monthly download cadence.

## Next housing source candidate (not integrated)

Verified on 2026-09-30: https://www.stats.gov.cn/sj/zxfb/202609/t20260915_1965304.html provides August 2026 NBS new-home and second-hand-home city-level indices (month-on-month, year-on-year and year-to-date comparative indices), released September 15. Its HTML tables are downloadable. They do not supply county-level prices, rent, or currency-per-square-metre values. A future integration must preserve those scopes and denominators rather than passing these rolling indices into price-return calculations unchanged.
