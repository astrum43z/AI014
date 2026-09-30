# Trends implementation and data contract

Route: `/trends/`. Homepage and product content remain unchanged. Main navigation and sitemap include Trends.

The dashboard supports category filtering, free-text instrument/source search, sortable name/period-change table, local-browser favorites, selectable historical windows, daily/monthly observation inspection and a province/city/district request UI. Region names are user-entered filters, not claims of nationwide geographic data coverage. No county statistics are fabricated or substituted with city statistics.

## Snapshot coverage

- ECB official historic XML: five EUR reference pairs, 2019-01 to 2026-09-30. Daily reference rates, not executable live quotes.
- World Bank Pink Sheet official archived workbook: gold, silver, Brent oil, copper, aluminum and US HRW wheat, 2019-01 to 2024-12. Source workbook states updated 2025-01-03. Deliberately identified as stale archived monthly data in the UI. Date day `01` is a month identifier, not a daily quote.
- Housing, rent, A/HK/US equities and consumer goods have navigable entries with explicit missing-data status. They have no fabricated prices or charts.
- No nationwide province/city/district/county housing or rent feed is connected. NBS housing data coverage is 70 large/medium cities and is an index, not a nationwide price per square metre.

`src/data/trends.json` is a build-time static snapshot. There is no automated scheduled data refresh and no API key is embedded. Source URLs are on every detail view. `docs/trends-source-checksums.json` records hashes of the downloaded source files used for this import. Original sources can change; preserve downloaded originals when performing later imports.

## Reproducible import

Download the two source files from the source URLs in the JSON into local files. Inspect their dates and columns first. Install Python openpyxl if needed, then run `python scripts/import-trends.py /path/to/ecb.xml /path/to/wb.xlsx`. Update the explicit `asof` retrieval date in that importer when fetching a newer snapshot; the import excludes future dates. Never change a source date merely to make data look fresh.

`npm run check`, `npm test`, and `npm run build` are the required repository checks. Sandboxed environments may need `ASTRO_TELEMETRY_DISABLED=1` and a writable npm cache. Browser regression script: `node tests/trends-browser.cjs` with the local site listening at http://127.0.0.1:4321 (Playwright and Chromium required). Region Cancel/Escape must preserve applied state; favorites survive reload and missing data has no chart.
