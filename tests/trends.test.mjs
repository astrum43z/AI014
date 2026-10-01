import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {windowPoints,change,chartPath,freshness} from '../src/lib/trends/model.ts';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/trends.json',import.meta.url)));
test('official historical snapshots have valid dated positive values and source provenance',()=>{assert.equal(data.instruments.length,69);for(const i of data.instruments){assert.match(i.sourceUrl,/^https:\/\/(www\.ecb\.europa\.eu|thedocs\.worldbank\.org|www\.stats\.gov\.cn|scs\.moa\.gov\.cn)\//);assert.ok(i.coverage);assert.ok(i.points.length>=(i.sourceKey?2:20));let prior='';for(const p of i.points){assert.match(p.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(p.date>prior);assert.ok(p.date<=data.retrievedAt);assert.ok(Number.isFinite(p.value)&&p.value>0);prior=p.date;}}});
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


test('mainland goods retain native units and official short histories',()=>{const goods=data.instruments.filter(i=>['consumer','commodity'].includes(i.category));assert.equal(goods.length,61);for(const i of goods){assert.match(i.unit,/^元\//);assert.match(i.sourceKey,/^(nbs|mara)$/);assert.ok(i.points.every(p=>p.sourceUrl?.startsWith('https://')));assert.match(i.coverage,/不.*插值/);}assert.equal(goods.find(i=>i.name==='猪肉').points.at(-1).value,16.42);assert.equal(goods.find(i=>i.name==='电解铜（1#）').points.at(-1).value,108770);assert.ok(!data.instruments.some(i=>['brent','copper','aluminum','wheat'].includes(i.id)));});
