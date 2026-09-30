const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const viewport of [{width:1440,height:1100},{width:390,height:844},{width:360,height:760}]){
const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4321/trends/');await page.locator('#chart-line[d]').waitFor();
assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('#market-rows tr').count(),18);
assert.equal(await page.locator('#instrument-title').textContent(),'美元 / 人民币');assert.match(await page.locator('#instrument-coverage').textContent(),/推导参考汇率/);
const first=await page.locator('#chart-line').getAttribute('d');await page.locator('[data-months="3"]').click();assert.notEqual(await page.locator('#chart-line').getAttribute('d'),first);
await page.locator('#point-slider').fill('0');assert.match(await page.locator('#point-readout').textContent(),/CNY \/ USD/);
await page.locator('#detail-favorite').click();await page.reload();await page.locator('#favorites-only').click();assert.equal(await page.locator('#market-rows tr').count(),1);await page.locator('#favorites-only').click();
await page.locator('[data-category="metal"]').click();assert.equal(await page.locator('#market-rows tr').count(),2);assert.match(await page.locator('#instrument-coverage').textContent(),/整月均价/);assert.match(await page.locator('#last-date').textContent(),/^\d{4}-\d{2}-01$/);
await page.locator('[data-category="all"]').click();await page.locator('#trend-search').fill('不存在');assert.equal(await page.locator('#market-rows tr').count(),0);assert.equal(await page.locator('#no-results').isVisible(),true);await page.locator('#trend-search').fill('EUR/USD');assert.equal(await page.locator('#market-rows tr').count(),1);await page.locator('#trend-search').fill('');
await page.locator('[data-category="housing"]').click();assert.equal(await page.locator('#chart-empty').isVisible(),true);assert.equal(await page.locator('#trend-chart').isVisible(),false);assert.equal(await page.locator('[data-months="12"]').isDisabled(),true);
await page.locator('#region-open').click();await page.locator('#region-province').selectOption('湖北');await page.locator('#region-city').fill('武汉');await page.locator('#region-district').fill('武昌区');await page.locator('#region-apply').click();assert.match(await page.locator('#instrument-title').textContent(),/湖北 \/ 武汉 \/ 武昌区/);assert.match(await page.locator('#instrument-coverage').textContent(),/没有该地区已核实/);
await page.locator('#region-open').click();await page.locator('#region-city').fill('取消修改');await page.keyboard.press('Escape');assert.doesNotMatch(await page.locator('#instrument-title').textContent(),/取消修改/);assert.equal(await page.locator('#region-dialog').evaluate(d=>d.open),false);
await page.locator('[data-category="fx"]').click();await page.locator('[data-sort="change"]').click();const row1=await page.locator('#market-rows tr').first().textContent();await page.locator('[data-sort="change"]').click();assert.notEqual(await page.locator('#market-rows tr').first().textContent(),row1);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:`/tmp/ai014-trends-${viewport.width}.png`,fullPage:true});
assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${viewport.width}: categories, true charts, ranges, observation slider, persistent favorites, search, missing states, region Apply/Escape, sorting, no overflow/errors`);
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
