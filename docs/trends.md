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


## 2026-10-01：大陆商品与手机布局

商品入口改用人民币原生统计资料：国家统计局的50种流通领域重要生产资料（9类，规格写入名称）以及农业农村部的11项食品批发均价（包含28种蔬菜、6种水果监测篮子）。旧国际原油、铜、铝、美国小麦序列已移除，不作汇率换算冒充国内价格。黄金白银继续明确标注国际来源，外汇维持原有ECB口径。

初始大陆数据范围有限：NBS 2026年9月上旬、中旬；MARA 9月28–30日。未导入的多年历史、节假日和缺失日不补点、不插值。NBS的日期取旬末日，不是当天现价；MARA为公告当日14:00批发均价，不是品牌SKU或零售价。来源链接保留到每个观测值。原始公告网页由官方发布，本站仅整理事实数据并注明出处，不镜像全文、图片或声称取得第三方数据库授权。

`mainland-trends.py` 分别校验两类公告的日期、50/11项固定覆盖和原始单位；通过官方列表页发现最新公告，每次最多读取6份。任何来源获取或解析失败保留该来源整组最后成功值并显示失败状态，不影响其他来源。重新构建不等于来源刷新成功。来源清单见 `mainland-source-manifest.json`；9/30 MARA由官方网页已索引文本核对，直接HTML当次返回错误页面，因此没有将错误HTML作为成功证据。

手机布局：原市场横向导航换为原生选择器；价格表以信息卡呈现；名称、单位、价格、日期和状态无需横滑；图表采用窄屏坐标与更大文字；按钮和滑块触区至少44px；手机有独立排序选择器。选择品种后定位图表，搜索无结果隐藏旧图表。桌面仍保留横向标签和表格。

## 2026-10-01：单品、计价显示与历史区间

- 蔬菜/水果监测篮子（MARA 28种蔬菜、6种水果）仍保留在内部原始快照以校验完整公告，但不再作为用户可选品种展示。单品市场均价必须注明具体市场；最低/最高价格同时展示，不能称为零售成交价或全国统一价格。
- 计价显示默认按斤，可切回原始单位，并在本浏览器保存。只有元/公斤、元/千克、元/kg以1斤=0.5公斤进行显示层除以2；元/吨、元/斤、外汇、贵金属及指数不变。原始快照与百分比计算都不变。卡片、详情、最高/最低、坐标轴、滑块、图表点提示统一使用相同转换函数。
- 时间区间增加近2期、近7天、近1月；保留3月、1年、3年、6年和全部。区间锚定该品种最新观测日期；日期说明明确展示所选区间及实际收录跨度。较长选择超出历史覆盖时说明不会增加观测值，不插值或制造历史。只有1点时显示明确状态，仍可查看该点及来源；没有数据时禁用区间。
- 图表横轴按真实日历间隔，而不是给稀疏数据等距排列。点提示和滑块可以查看每次公告；切换单位、收藏或调整窗口大小保留正在查看的日期。

单品蔬果初始接入20项、75个已核验观测（无锡朝阳蔬菜市场12项，锡澄果品市场8项），来自无锡朝阳集团公开价格表。个别蔬菜可追溯到2026-08-21；水果可核验2026-09-12、09-27、10-01，部分品种只有2期。不是完整每日或多年数据库。源表产地/规格为空时明确说明，不将不同品种、规格混并。极端最高/最低值按源表保留，不修饰成零售可购区间；主值直接取源表单品均价，不自行取最高最低中点。

来源网页会更新，同一URL不保证仍展示导入日期；初始事实从公开来源的索引页面文本核验，证据记录与哈希见produce-source-manifest.json。没有声称第三方开放数据库许可，仅引用有限公开事实并注明原站。produce-trends.py在既有工作日更新流程中读取公开列表及其实际分页链接，未接入私有API或新凭据。日期、单位、价格区间、同日冲突、来源域名及历史退步均做检查；获取失败时整组保留旧值并显示失败状态。


### Same-day source-refresh verification

On 2026-10-01 the HTTPS ingestion path was exercised against the provider's actual HTML. The initial parser failed because cells were split across lines. It now uses HTML table cell boundaries, deduplicates page-one aliases, prioritizes only currently discovered pages referenced by existing observations, and stops once all selected items are found. The verified request set was vegetable pages 1, 2 and 4 plus fruit page 1. Twenty individual items were parsed; nine genuine October 1 observations were appended, bringing the verified produce snapshot to 84 points. No historical prices were changed. Direct-source hashes and factual row extracts are retained in produce-http-verification.json.

The source status is now successful because that ingestion completed; this does not guarantee every future scheduled run or source connection. A source timeout or parse failure still preserves the whole previous source snapshot and displays its failure marker. Snapshot regression tests check known prices at their actual dates instead of freezing the latest price, allowing later valid updates.
