import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {windowPoints,change,chartPath} from '../src/lib/trends/model.ts';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/trends.json',import.meta.url)));
test('official historical snapshots have valid dated positive values and source provenance',()=>{assert.equal(data.instruments.length,12);for(const i of data.instruments){assert.match(i.sourceUrl,/^https:\/\/(www\.ecb\.europa\.eu|thedocs\.worldbank\.org)\//);assert.ok(i.coverage);assert.ok(i.points.length>20);let prior='';for(const p of i.points){assert.match(p.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(p.date>prior);assert.ok(p.date<=data.retrievedAt);assert.ok(Number.isFinite(p.value)&&p.value>0);prior=p.date;}}});
test('range is anchored to series vintage rather than today',()=>{const points=[{date:'2024-01-01',value:2},{date:'2024-07-01',value:3},{date:'2024-12-01',value:4}];assert.equal(windowPoints(points,6).length,2);assert.equal(windowPoints(points,0).length,3);assert.equal(change(points),100);assert.equal(change([]),null);assert.equal(change(points.slice(0,1)),null);});
test('chart path handles flat and unavailable data without NaN',()=>{assert.equal(chartPath([]),'');assert.equal(chartPath([{date:'2024-01-01',value:1}]),'');assert.doesNotMatch(chartPath([{date:'2024-01-01',value:1},{date:'2024-02-01',value:1}]),/NaN|Infinity/);});
test('gold and silver are explicitly archived monthly prices, not current quotes',()=>{for(const id of ['xau','xag']){const i=data.instruments.find(i=>i.id===id);assert.equal(i.points.at(-1).date,'2024-12-01');assert.match(i.coverage,/2025-01-03/);assert.match(i.frequency,/归档/);}});

test("USD/CNY cross-rate is explicitly derived from same-day ECB quotes",()=>{const derived=data.instruments.find(i=>i.id==="usd-cny");const cny=data.instruments.find(i=>i.id==="eur-cny");const usd=data.instruments.find(i=>i.id==="eur-usd");assert.match(derived.coverage,/EUR\/CNY ÷ EUR\/USD/);for(let n=0;n<derived.points.length;n++){assert.equal(derived.points[n].date,cny.points[n].date);assert.equal(derived.points[n].value,cny.points[n].value/usd.points[n].value);}});
