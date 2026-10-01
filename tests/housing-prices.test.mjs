import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import * as model from '../src/lib/trends/housing-prices.ts';
const data=JSON.parse(fs.readFileSync('src/data/nbs-housing-prices.json','utf8'));
test('twelve annual residential prices retain actual inputs, source dates and exact units',()=>{
 model.validateHousingPrices(data);assert.deepEqual(data.annual.map(p=>p.period),Array.from({length:12},(_,i)=>String(2014+i)));
 const latest=data.annual.at(-1);assert.equal(latest.areaWanSqm,73299);assert.equal(latest.amountYiYuan,73335);assert.equal(model.priceText(latest),'10,005');
 assert.equal(model.meanPrice(data.annual[0]).toFixed(2),'5932.19');assert.equal(model.meanPrice(data.annual[9]).toFixed(2),'10864.38');
 assert.equal(model.meanPrice(data.latestYtd).toFixed(2),'10065.78');assert.equal(data.latestYtd.publishedAt,'2026-09-15');
 const expected=[5932.19,6472.34,7202.56,7613.84,8544.17,9287.08,9979.92,10395.96,10184.59,10864.38,10419.15,10004.91];
 assert.deepEqual(data.annual.map(p=>Number(model.meanPrice(p).toFixed(2))),expected);
});
test('annual curve rejects YTD and never invents local prices or growth rates',()=>{
 const g=model.priceGeometry(data.annual);assert.equal(g.dots.length,12);assert.equal((g.path.match(/L/g)||[]).length,11);assert.doesNotMatch(g.path,/NaN|Infinity/);
 assert.throws(()=>model.priceGeometry([...data.annual,data.latestYtd]));assert.equal(model.supportsNationalPrice({}),true);
 for(const r of [{province:'湖北'},{city:'北京'},{district:'武昌区'}])assert.equal(model.supportsNationalPrice(r),false);
 for(const mutate of [d=>d.annual.pop(),d=>d.annual[0].areaWanSqm=0,d=>d.annual[0].amountYiYuan=NaN,d=>d.annual[0].sourceUrl='https://example.com',d=>d.annual[0].period='2013',d=>d.annual[0].periodType='year-to-date',d=>d.latestYtd.periodType='annual']){const copy=structuredClone(data);mutate(copy);assert.throws(()=>model.validateHousingPrices(copy));}
});
class Element{constructor(){this.hidden=false;this.open=false;this.textContent='';this.value='';this.listeners={};this.attributes={};this.dataset={};this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};}addEventListener(key,fn){(this.listeners[key]??=[]).push(fn);}setAttribute(k,v){this.attributes[k]=v;}fire(k,e={}){for(const fn of this.listeners[k]||[])fn(e);}}
function fixture(category='housing'){
 const markup=fs.readFileSync('src/components/HousingPrices.astro','utf8')+fs.readFileSync('src/components/HousingPanel.astro','utf8'),ids=Object.fromEntries([...markup.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()])),doc=new Element(),dots=Array.from({length:12},(_,i)=>{const e=new Element();e.dataset.pricePoint=String(i);return e;});
 ids['housing-price-data'].textContent=JSON.stringify(data);doc.getElementById=id=>{assert.ok(ids[id],id);return ids[id];};doc.querySelectorAll=()=>dots;doc.dispatchEvent=e=>doc.fire(e.type,e);
 const code=fs.readFileSync('src/lib/trends/housing-prices-panel.ts','utf8').replace(/^import[^\n]+\n/,'');
 class CustomEvent{constructor(type,o={}){this.type=type;this.detail=o.detail;}}
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{...model,document:doc,location:{search:'?market='+category},URLSearchParams,CustomEvent});
 return {ids,dots,doc,category:c=>doc.fire('trends:category-change',{detail:c}),region:r=>doc.fire('trends:region-change',{detail:r})};
}
test('price inspection follows pointer and keyboard slider with per-year official provenance',()=>{
 const f=fixture();assert.equal(f.ids['housing-price-primary'].hidden,false);assert.equal(f.ids['rent-price-primary'].hidden,true);
 f.dots[0].fire('pointerenter');assert.equal(f.ids['housing-price-value'].textContent,'5,932');assert.equal(f.ids['housing-price-source'].href,data.annual[0].sourceUrl);
 f.ids['housing-price-slider'].value='11';f.ids['housing-price-slider'].fire('input');assert.equal(f.ids['housing-price-value'].textContent,'10,005');assert.equal(f.ids['housing-price-year'].textContent,'2025年');assert.match(f.ids['housing-price-slider'].attributes['aria-valuetext'],/2025年/);
 assert.equal(f.dots[11].classes.has('active'),true);assert.equal(f.dots[0].classes.has('active'),false);
});
test('region misses, clear and repeated category changes stay honest and collapse optional indexes',()=>{
 const f=fixture();f.region({province:'湖北',city:'武汉',district:'武昌区'});assert.equal(f.ids['housing-price-results'].hidden,true);assert.equal(f.ids['housing-price-unavailable'].hidden,false);
 f.ids['housing-price-clear'].fire('click');assert.equal(f.ids['housing-price-results'].hidden,false);f.ids['index-optional'].open=true;f.category('housing');assert.equal(f.ids['index-optional'].open,true);
 f.category('rent');assert.equal(f.ids['index-optional'].open,false);assert.equal(f.ids['housing-price-primary'].hidden,true);assert.equal(f.ids['rent-price-primary'].hidden,false);
 f.category('a');assert.equal(f.ids['rent-price-primary'].hidden,true);f.category('housing');f.category('housing');assert.equal(f.ids['housing-price-primary'].hidden,false);assert.equal(f.ids['index-optional'].open,false);
 const direct=fixture('rent');assert.equal(direct.ids['rent-price-primary'].hidden,false);assert.equal(direct.ids['housing-price-primary'].hidden,true);
});
test('default markup is price first, keeps source details collapsed, and separates annual/YTD',()=>{
 const parent=fs.readFileSync('src/components/HousingPanel.astro','utf8'),html=fs.readFileSync('src/components/HousingPrices.astro','utf8');
 assert.ok(parent.indexOf('<HousingPrices />')<parent.indexOf('id="index-optional"'));assert.match(parent,/<details id="index-optional">/);assert.doesNotMatch(parent,/<details[^>]*open/);
 assert.match(html,/全国新建商品住宅 · 年度成交均价/);assert.match(html,/2026年1–8月累计/);assert.match(html,/真实租金价格暂未接入/);assert.match(html,/<details class="price-provenance">/);assert.match(html,/各年度首次发布的数据/);
 assert.equal((html.match(/<svg /g)||[]).length,1);assert.ok(html.includes('data.annual.map'));assert.doesNotMatch(html,/ytd.*circle|latestYtd.*priceGeometry/);
});
