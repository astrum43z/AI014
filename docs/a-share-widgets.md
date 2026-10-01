# A-share browsing and official chart

## Interaction model

The `/trends/?market=a` view is deliberately chart-first. A compact header keeps the non-real-time warning visible. One finder accepts common Chinese names, aliases, six-digit codes and explicit `SH600519`, `SZ000001`, `SSE:600519`, `600519.SH` notation. There is no separate exchange selector in the normal path.

The name directory contains 13 manually verified items, not every listed security. This limit is stated next to search and in the source disclosure. Unknown names prompt for a code. Unknown codes show exchange-qualified choices without claiming the security or its chart exists. Bare `000xxx` codes always present Shanghai and Shenzhen choices: `000001` visibly distinguishes 上证指数 from 平安银行. No auto-guessing silently sends a visitor to the wrong exchange.

The 大盘指数 / 常用个股 / 最近看过 controls provide touch-sized, horizontally scrollable chips. The last five distinct valid symbols are kept only in this browser under `ai014.trends.a-share-recent`; no names, quotes, account information or analytics are sent to an AI014 service. The last selection restores on return, and unavailable localStorage does not prevent use.

The chart offers 近1年 / 近5年 / 全部 and 收盘走势 / K线图. Changing them remounts one official embed, preserving the selected symbol. These are requested display ranges, not guaranteed historical coverage. TradingView's configurator disables manual interval selection while a default range is selected; accordingly, AI014 does not present a separate conflicting day/week/month selector. Live release QA confirmed that `12M` uses daily bars, `60M` uses weekly bars, and `ALL` uses monthly bars. The short-range `3M` option maps to hourly bars and fails on EOD-only symbols, so short intraday ranges are deliberately not exposed. The provider chooses the actual bar interval for the range and shows it within the chart. The default `interval: D` follows the official generated contract. Top and bottom trading toolbars are hidden through official options, while the price/date/status legend and attribution stay visible. 放大图表 enlarges the chart in the page without trapping focus or taking browser fullscreen.

Search has ordinary keyboard-focusable result buttons, ArrowDown to the first result, Enter for a single match, and Escape to dismiss. A click outside, category change, or selecting a symbol dismisses results. Category transitions tear down the remote embed. Repeated category events and repeated range selections never duplicate it; retry intentionally creates a new request, and stale errors cannot overwrite a newer state.

## Data boundary

No account or API key is needed. No prices are scraped, exported, stored in `trends.json`, or used in the site's calculated rankings. Prices, dates, missing-symbol errors and update-status badges remain inside the provider's chart. Provider attribution remains visible. A failed loader has a retry and a direct provider link; the site never replaces it with invented prices or labels an iframe load as verified market-data availability.

Documented EOD coverage is described without promising real-time service or guaranteeing that every current daily bar is a finalized close. The provider's visible per-symbol status takes precedence. Holidays are not treated as update failures. Availability depends on the visitor's network and TradingView. Shanghai and Shenzhen are supported as queries; Beijing is not promised. The public docs do not guarantee every symbol, fixed historical start dates, or availability in every network.

## Official sources checked 2026-10-01

- Coverage: https://www.tradingview.com/widget-docs/markets/asia-pacific/
- Published constructor, generated config, range menu (`12M`, `60M`, `ALL`) and interval/range behavior: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- Simple chart and hidden-toolbar example: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/demos/basic-area-chart/
- Data limits and unavailable symbols: https://www.tradingview.com/widget-docs/faq/data/
- Attribution and third-party requests: https://www.tradingview.com/widget-docs/faq/general/
- Terms: https://www.tradingview.com/policies/

Name/code directory mapping, using provider instrument pages rather than any prices from these pages:

- 上证指数: https://www.tradingview.com/symbols/SSE-000001/
- 深证成指: https://www.tradingview.com/symbols/SZSE-399001/
- 创业板指: https://www.tradingview.com/symbols/SZSE-399006/
- 沪深300: https://cn.tradingview.com/symbols/SSE-000300/
- 上证50: https://cn.tradingview.com/symbols/SSE-000016/
- 贵州茅台: https://www.tradingview.com/symbols/SSE-600519/
- 宁德时代: https://www.tradingview.com/symbols/SZSE-300750/
- 比亚迪: https://www.tradingview.com/symbols/SZSE-002594/
- 平安银行: https://www.tradingview.com/symbols/SZSE-000001/
- 中国平安: https://www.tradingview.com/symbols/SSE-601318/
- 招商银行: https://cn.tradingview.com/symbols/SSE-600036/
- 五粮液: https://www.tradingview.com/symbols/SZSE-000858/
- 美的集团: https://www.tradingview.com/symbols/SZSE-000333/

The embed license does not permit a raw-bar AI014 API. Obtain an appropriate public-display vendor and exchange agreement before replacing this with a custom raw-data chart. A personal market-data subscription does not substitute for that agreement.

## Verification

Run `npm run check`, `npm test`, `python -m unittest discover -s tests -p 'test_*.py'`, and `npm run build`. Own-DOM tests exercise search normalization, ambiguity, corrupt storage, recent restoration, repeat clicks, switching ranges/style, retry, stale errors, dismissal, category changes, and teardown. They do not certify the remote provider.

For release QA, visit the live A-share URL, test named search and `000001`, switch both exchange choices, select a second stock and return through recent items, change history ranges and chart style, expand/reduce, retry, leave/re-enter the category, and verify the NBS housing and national-food views still work. Confirm attribution, actual chart state and visible range behavior in the browser. Check no horizontal overflow at desktop and narrow widths, and distinguish browser zoom/CSS responsive checks from physical-phone testing.
