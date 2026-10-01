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

## 2026-10-01：全国36种蔬果单品周价

新增商务部商务预报直接发布的全国单品批发价格：30种蔬菜、6种水果，每品91期，共3276个实际观测，2025-01-03至2026-09-25。默认展示全国黄瓜。蔬菜与水果仅保留全国单品记录。国家统计局、农业农村部、外汇、贵金属、A股组件及独立品牌内容不变。

信息来源：商务预报。官方入口 https://cif.mofcom.gov.cn/cif/html/dataCenter/ 的农副产品→周度监测数据。官方前端公开使用 POST https://cif.mofcom.gov.cn/cif/getWeekLineChart2021.fhtml，参数 indexIds（最多3品）、startDate、endDate；返回title明确标注“全国某品批发价格走势”，UNIT为元/公斤。品种编码来自同站公开zhouduData.js。蔬菜篮子18055947明确排除，没有从篮子推算单品、用地方价冒充全国或填造历史。原始元/公斤不变，按斤展示仍除以2。

DATADATE原样保留为周度观测标签，不改成周末、不声称是具体发布日期或当日现货。单品权重、每期样本数量、品级产地没有在该接口披露，不虚构口径。全国参考批发周价并非政府统一定价、零售价或品牌SKU报价。不推算最高/最低价，不插值补每日点。

网站级版权与免责声明 https://cif.mofcom.gov.cn/cif/html/indexCenter2024/index.html 要求原创官方作品转载保持原意并注明“信息来源：商务预报”；页面和每个单品保留此署名及官方链接。这里是官方公开事实价格的整理，不声称获得通用开放数据库许可或有保证的API服务。来源清单、请求参数、逐品数量和原始响应SHA256见mofcom-source-manifest.json。

新增mofcom-produce-trends.py严格验证全国标题、品名、单位、日期、数值及重复/丢失日期。每次最多3品，串行请求，批次间隔1秒。现有工作日自动流程中仅在上次成功刷新满7天时再次请求；新适配器首次运行及失败后下次运行会重试。任何批次失败保留整组最后核验值、日期和校验哈希，并标记来源失败；成功后更新源状态和获取日期。始终沿用最新观测标签判断是否滞后。没有发布数字限流或服务保证，采用低频缓存。首次生产自动流程尚未执行时UI明确显示待验证。

运行python -m unittest discover -s tests -p 'test_*.py'、npm run check、npm test和npm run build。新增测试覆盖36品真实周度事实、全国/地方分离、默认选择、按斤换算、七天缓存边界、首次刷新、失败后重试、无效来源拒绝及完整旧值/哈希保留。

全国周价初始快照以src/data/mofcom-produce.json单独紧凑存储，共用91个真实周度日期轴与36列原始价格，避免重写其他来源的快照。构建时展开为同一Instrument结构；已缓存的源记录优先。首次自动刷新会把缺少的全国记录加到工作流缓存的trends.json，随后仍使用原有缓存与整源失败保留规则；其他源原始文件不变。

## Retired sources and empty product catalogue

Retired local-market data, adapters and evidence files are removed from the current source tree; repository history remains unchanged. The active catalogue rejects retired source IDs even when reading a stale snapshot. The refresh worker strips them and their status/checksum entries before loading the national bootstrap, and cannot request their former endpoint. The existing cache key hashes the changed committed snapshot, so old source snapshots no longer match; no workflow permissions, triggers or schedules are changed. All 36 national weekly series and 3276 observations remain unchanged, as do other national food, industrial, FX, precious-metal and A-share sources.

No public product remains. Product cards/navigation and static detail routes disappear, the product index uses an honest empty state, and the removed social image is no longer published.
