# A-share daily-history component

## Integration and data boundary

The A-share category mounts TradingView's published Advanced Chart widget. It uses daily candles by default, an exchange-qualified six-digit code form, and four presets: SSE:000001, SZSE:399001, SSE:600519 and SZSE:300750. The component is loaded only when A-shares are selected and removed when the visitor leaves that category. The route `/trends/?market=a` selects it directly.

No account or API key is needed. No prices are scraped, exported, added to `trends.json`, or used in the site's calculated ranking. Provider attribution remains visible. Prices, dates, missing-symbol errors and update-status badges remain inside the provider's chart. A failed loader has a retry and a direct provider link; the site never replaces it with invented prices.

The component describes documented EOD coverage without promising real-time service or guaranteeing that every symbol's current daily bar is a finalized close. A live check on 2026-10-01 found SSE index and stock widgets marked “End of day data”, whereas SZSE:399001 displayed a different update-frequency badge. The provider's visible per-symbol status therefore takes precedence over a hard-coded freshness assertion. Holidays are not treated as update failures.

The widget's availability depends on the visitor's network and TradingView. Coverage currently includes Shanghai and Shenzhen; Beijing is not promised. The public docs do not guarantee every symbol, a fixed historical start date, or availability in every network.

## Official sources checked 2026-10-01

- Free widget market list: https://www.tradingview.com/widget-docs/markets/
- SSE/SZSE stocks and indices listed as EOD: https://www.tradingview.com/widget-docs/markets/asia-pacific/
- Published widget constructor and embed script: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- Data limits, unsupported symbols, no quote-export API, and paid personal plans not changing widget data: https://www.tradingview.com/widget-docs/faq/data/
- Attribution and third-party request details: https://www.tradingview.com/widget-docs/faq/general/
- Terms and attribution requirements: https://www.tradingview.com/policies/

Use only the official embed. Its display permission does not permit obtaining raw bars for an AI014-owned API or chart. For a custom raw-data chart, obtain a vendor agreement explicitly allowing public external display and required exchange approvals. Buying a personal market-data subscription is not a substitute.

## Verification

Run `npm run check`, `npm test`, and `npm run build`. Node lifecycle tests cover lazy mounting, direct A-category initialization, duplicate events, initialization idempotence, exchange-qualified leading-zero symbols, presets, search, retries, invalid input, stale errors, and teardown on leaving A-shares. These tests do not certify provider availability.

Before calling a production release verified, visit `/trends/?market=a` in a real browser, confirm actual daily bars and provider attribution, switch the four presets, exercise custom Shanghai/Shenzhen codes, retry, and leave/re-enter the A category. Check the narrow mobile layout and that consumer/commodity charts still work. Cloud-browser localhost access may be unavailable; a successful unit test is not visual QA.
