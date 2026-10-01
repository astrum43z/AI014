import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {windowPoints,change,chartPath,freshness} from '../src/lib/trends/model.ts';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/trends.json',import.meta.url)));
const national=JSON.parse(fs.readFileSync(new URL('../src/data/mofcom-produce.json',import.meta.url)));
const storedIds=new Set(data.instruments.map(i=>i.id));
data.instruments.push(...national.items.filter(i=>!storedIds.has(i.id)).map(i=>({...national.metadata,id:i.id,name:i.name,retrievedAt:national.retrievedAt,sourceUpdatedAt:national.dates.at(-1),points:national.dates.map((date,n)=>({date,value:i.values[n]}))})));
test('official historical snapshots have valid dated positive values and source provenance',()=>{assert.equal(data.instruments.length,105);for(const i of data.instruments){assert.match(i.sourceUrl,/^https:\/\/(www\.ecb\.europa\.eu|thedocs\.worldbank\.org|www\.stats\.gov\.cn|scs\.moa\.gov\.cn|cif\.mofcom\.gov\.cn)\//);assert.ok(i.coverage);assert.ok(i.points.length>=(i.sourceKey?2:20));let prior='';for(const p of i.points){assert.match(p.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(p.date>prior);assert.ok(p.date<=data.retrievedAt);assert.ok(Number.isFinite(p.value)&&p.value>0);prior=p.date;}}});
test('range is anchored to series vintage rather than today',()=>{const points=[{date:'2024-01-01',value:2},{date:'2024-07-01',value:3},{date:'2024-12-01',value:4}];assert.equal(windowPoints(points,6).length,2);assert.equal(windowPoints(points,0).length,3);assert.equal(change(points),100);assert.equal(change([]),null);assert.equal(change(points.slice(0,1)),null);});
test('chart path handles flat and unavailable data without NaN',()=>{assert.equal(chartPath([]),'');assert.equal(chartPath([{date:'2024-01-01',value:1}]),'');assert.doesNotMatch(chartPath([{date:'2024-01-01',value:1},{date:'2024-02-01',value:1}]),/NaN|Infinity/);});
test('international precious metals use the verified September workbook and August monthly averages',()=>{const expected={xau:4411,xag:65.4};for(const [id] of Object.entries(expected)){const i=data.instruments.find(i=>i.id===id);assert.ok(i.points.length>=92);assert.ok(i.points.at(-1).date>='2026-08-01');assert.ok(i.sourceUpdatedAt>='2026-09-02');assert.ok(i.sourceUpdatedAt<=data.retrievedAt);assert.match(i.sourceUrl,/CMO-Historical-Data-Monthly.xlsx$/);assert.match(i.coverage,/不是今日现价或实时行情/);assert.match(i.frequency,/月度/);}});

test("USD/CNY cross-rate is explicitly derived from same-day ECB quotes",()=>{const derived=data.instruments.find(i=>i.id==="usd-cny");const cny=data.instruments.find(i=>i.id==="eur-cny");const usd=data.instruments.find(i=>i.id==="eur-usd");assert.match(derived.coverage,/EUR\/CNY ÷ EUR\/USD/);for(let n=0;n<derived.points.length;n++){assert.equal(derived.points[n].date,cny.points[n].date);assert.equal(derived.points[n].value,cny.points[n].value/usd.points[n].value);}});

test('freshness distinguishes missing, lagging, failed and monthly data',()=>{
 const i={category:'fx',points:[{date:'2026-09-30',value:1}]};
 assert.equal(freshness(i,new Date('2026-10-01')),'每日参考汇率');
 assert.equal(freshness(i,new Date('2026-10-09')),'数据滞后');
 assert.equal(freshness({...i,category:'metal',points:[{date:'2026-08-01',value:1}]},new Date('2026-09-30')),'月度历史均价');
 assert.equal(freshness({...i,refreshFailed:true}),'更新失败 · 保留旧值');
 assert.equal(freshness({...i,points:[]}),'待接入');
});


test('mainland goods retain native units and official short histories',()=>{const goods=data.instruments.filter(i=>['consumer','commodity'].includes(i.category));assert.equal(goods.length,97);for(const i of goods){assert.match(i.unit,/^元\//);assert.match(i.sourceKey,/^(nbs|mara|mofcom)$/);assert.ok(i.points.every(p=>(p.sourceUrl||i.sourceUrl).startsWith('https://')));assert.match(i.coverage+(i.historyNote||''),/不.*插值/);}assert.equal(goods.find(i=>i.name==='猪肉').points.find(p=>p.date==='2026-09-30').value,16.42);assert.equal(goods.find(i=>i.name==='电解铜（1#）').points.find(p=>p.date==='2026-09-20').value,108770);assert.ok(!data.instruments.some(i=>['brent','copper','aluminum','wheat'].includes(i.id)));});

test('斤 display halves only native yuan per kilogram and never mutates data',async()=>{
 const {displayUnit,displayValue,displayPoints}=await import('../src/lib/trends/model.ts');
 for(const unit of ['元/公斤','元/千克','元/kg']){assert.equal(displayUnit(unit,'jin'),'元/斤');assert.equal(displayValue(16.42,unit,'jin'),8.21);assert.equal(displayValue(16.42,unit,'original'),16.42);}
 for(const unit of ['元/吨','元/斤','USD / EUR','美元/金衡盎司','指数点']){assert.equal(displayUnit(unit,'jin'),unit);assert.equal(displayValue(100,unit,'jin'),100);}
 const raw=[{date:'2026-09-28',value:16.44,low:12,high:19,sourceUrl:'https://example.org/report'},{date:'2026-09-30',value:16.42}],before=JSON.stringify(raw),converted=displayPoints(raw,'元/公斤','jin');
 assert.equal(JSON.stringify(raw),before);assert.equal(converted[1].value,8.21);assert.equal(change(raw),change(converted));assert.notEqual(raw[0],converted[0]);assert.equal(converted[0].low,6);assert.equal(converted[0].high,9.5);assert.equal(converted[0].sourceUrl,raw[0].sourceUrl);
});
test('short windows work and longer windows clearly report insufficient history',async()=>{
 const {rangePoints,rangeSummary,rangeStart}=await import('../src/lib/trends/model.ts');
 const points=[{date:'2026-09-28',value:16.44},{date:'2026-09-29',value:16.24},{date:'2026-09-30',value:16.42}];
 assert.equal(rangePoints(points,'2p').length,2);assert.equal(rangePoints(points,'7d').length,3);
 assert.match(rangeSummary(points,'72m'),/已选近6年/);assert.match(rangeSummary(points,'72m'),/更早历史尚未接入/);assert.match(rangeSummary(points,'all'),/实际收录 2026-09-28/);
 assert.equal(rangeStart([{date:'2024-03-31',value:1}],'1m'),'2024-02-29');assert.match(rangeSummary([],'1m'),/暂无已核实数据/);
});
test('chart uses actual calendar spacing instead of equal intervals',()=>{
 const path=chartPath([{date:'2026-09-01',value:1},{date:'2026-09-02',value:2},{date:'2026-09-11',value:3}],100,100);
 assert.match(path,/L10\.00,/);assert.match(path,/L100\.00,/);
});

test('national produce is 36 actual weekly single-item series with clear geography and unchanged kilo values',async()=>{
 const {displayPoints}=await import('../src/lib/trends/model.ts');
 const produce=data.instruments.filter(i=>i.sourceKey==='mofcom');assert.equal(produce.length,36);
 assert.ok(produce.reduce((n,i)=>n+i.points.length,0)>=3276);
 for(const i of produce){assert.match(i.id,/^cn-mofcom-/);assert.match(i.symbol,/全国/);assert.match(i.frequency,/周度/);assert.match(i.source,/信息来源：商务预报/);assert.match(i.coverage,/并非政府统一定价/);assert.match(i.historyNote,/不插值/);assert.equal(i.unit,'元/公斤');assert.ok(i.points.length>=91);assert.equal(i.points[0].date,'2025-01-03');assert.ok(i.points.at(-1).date>='2026-09-25');assert.ok(i.points.every(p=>p.low===undefined&&p.high===undefined));assert.equal(displayPoints(i.points,i.unit,'jin')[0].value,i.points[0].value/2);}
 const cucumber=produce.find(i=>i.name==='黄瓜');assert.equal(cucumber.points.find(p=>p.date==='2026-09-25').value,4.21);
 assert.equal(produce.find(i=>i.name==='苹果').points.find(p=>p.date==='2026-09-25').value,9.25);
 assert.equal(freshness(cucumber,new Date('2026-10-01')),'周度全国单品批发价格');
 assert.equal(freshness({...cucumber,refreshFailed:true},new Date('2026-10-01')),'更新失败 · 保留旧值');
 assert.equal(data.instruments.filter(i=>i.sourceKey==='chaoyang').length,0);
});

test("retired local-market records stay absent from the public catalogue",()=>{
 assert.ok(data.instruments.every(i=>!i.id.startsWith("cn-chaoyang-")&&!JSON.stringify(i).includes("chinachaoyang")));
 const catalogue=fs.readFileSync("src/lib/trends/catalog.ts","utf8");
 assert.match(catalogue,/sourceKey!=='chaoyang'/);
});
