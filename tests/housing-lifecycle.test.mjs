import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import * as model from '../src/lib/trends/housing.ts';
class Element{
 constructor(tag='div'){this.tag=tag;this.dataset={};this.children=[];this.hidden=false;this.attributes={};this.listeners={};this.value='';this.textContent='';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(k,v){this.attributes[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}addEventListener(n,fn){(this.listeners[n]??=[]).push(fn);}fire(n,e={}){for(const fn of this.listeners[n]||[])fn(e);}querySelectorAll(selector){const key=selector.includes('point')?'indexPoint':'indexRow';const out=[];const walk=node=>{if(key in node.dataset)out.push(node);node.children.forEach(walk);};this.children.forEach(walk);return out;}
}
function fixture(category='consumer',small=false){
 const html=fs.readFileSync('src/components/HousingPanel.astro','utf8'),ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()])),doc=new Element('document'),win=new Element('window');
 ids['housing-panel'].children=Object.entries(ids).filter(([id])=>id!=='housing-panel').map(([,element])=>element);ids['housing-data'].textContent=fs.readFileSync('src/data/nbs-housing.json','utf8');
 doc.getElementById=id=>{assert.ok(ids[id],id);return ids[id];};doc.createElement=tag=>new Element(tag);doc.createElementNS=(_,tag)=>new Element(tag);doc.dispatchEvent=e=>doc.fire(e.type,e);
 const source=fs.readFileSync('src/lib/trends/housing-panel.ts','utf8').replace(/^import[^\n]+\n/,'');const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
 vm.runInNewContext(compiled,{...model,document:doc,window:win,location:{search:'?market='+category},URLSearchParams,Intl,matchMedia:()=>({matches:small}),CustomEvent});
 return {ids,doc,category:value=>doc.fire('trends:category-change',{detail:value}),change:(id,value)=>{ids[id].value=value;ids[id].fire('change',{target:ids[id]});},region:r=>doc.fire('trends:region-change',{detail:r}),resize:()=>win.fire('resize')};
}
test('direct index entry, city/type/metric changes and base-break chart render without price math',()=>{
 const f=fixture('housing');assert.equal(f.ids['housing-panel'].hidden,false);assert.equal(f.ids['index-value'].textContent,'99.8');assert.equal(f.ids['index-rate'].textContent,'-0.2%');assert.equal(f.ids['index-paths'].children.length,2);assert.equal(f.ids['index-table'].children.length,12);
 f.change('index-city','上海');f.change('index-kind','resale');f.change('index-metric','yoy');assert.equal(f.ids['index-value'].textContent,'99.2');assert.equal(f.ids['index-rate'].textContent,'-0.8%');assert.match(f.ids['index-title'].textContent,/上海.*二手/);
 f.change('index-range','2026');assert.equal(f.ids['index-table'].children.length,8);assert.equal(f.ids['index-paths'].children.length,1);
});
test('region misses hide values and chart, clear recovers, repeated mode changes retain valid state',()=>{
 const f=fixture('consumer');assert.equal(f.ids['housing-panel'].hidden,true);f.category('housing');f.region({province:'湖北',city:'武汉',district:'武昌区'});assert.equal(f.ids['index-results'].hidden,true);assert.equal(f.ids['index-unavailable'].hidden,false);assert.match(f.ids['index-unavailable-reason'].textContent,/区县级数据尚未接入/);
 f.ids['index-region-clear'].fire('click');assert.equal(f.ids['index-results'].hidden,false);
 f.category('rent');assert.equal(f.ids['index-city-control'].hidden,true);assert.equal(f.ids['index-value'].textContent,'0.0%');f.change('index-metric','yoy');assert.equal(f.ids['index-value'].textContent,'-0.6%');assert.equal(f.ids['index-unit'].textContent,'全国 CPI 分项（%）');
 f.region({province:'北京',city:'北京',district:''});assert.equal(f.ids['index-results'].hidden,true);f.ids['index-region-clear'].fire('click');f.category('a');assert.equal(f.ids['housing-panel'].hidden,true);f.category('rent');f.category('rent');assert.equal(f.ids['index-table'].children.length,12);assert.equal(f.ids['index-paths'].children.length,2);
});
test('observation inspection survives range/metric/resize updates and has an exact source',()=>{
 const f=fixture('housing',true);f.ids['index-slider'].value='4';f.ids['index-slider'].fire('input',{target:f.ids['index-slider']});assert.match(f.ids['index-readout'].textContent,/2026-01.*2025统计基期/);assert.match(f.ids['index-point-source'].href,/t20260213_1962617.html$/);f.change('index-metric','yoy');f.resize();assert.match(f.ids['index-readout'].textContent,/2026-01/);assert.equal(f.ids['index-chart'].attributes.viewBox,'0 0 400 235');f.change('index-range','3');assert.match(f.ids['index-readout'].textContent,/2026-08/);
});
