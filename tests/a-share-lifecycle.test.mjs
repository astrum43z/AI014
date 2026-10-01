import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as dependencies from '../src/lib/trends/a-share.ts';

// Own-DOM contract tests only: no remote provider quotes or network assertions.
class Element {
  constructor(tag='div'){this.tag=tag;this.hidden=false;this.dataset={};this.style={};this.attributes={};this.children=[];this.listeners={};this.value='';this.textContent='';this.focused=false;const classes=new Set();this.classList={toggle(name,force){const enabled=force??!classes.has(name);enabled?classes.add(name):classes.delete(name);return enabled;},contains(name){return classes.has(name);}};}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  fire(type,event={}){for(const handler of this.listeners[type]||[])handler(event);}
  focus(){this.focused=true;this.fire('focus');}blur(){this.focused=false;}scrollIntoView(){this.scrolled=true;}
  querySelector(selector){return this.children.find(node=>node.tag===selector);}
  querySelectorAll(selector){return this.children.filter(node=>node.tag===selector);}
  contains(target){return target===this||this.children.some(node=>node.contains(target));}
}
function fixture(initialCategory='consumer',saved='[]',denyStorage=false){
  const panel=new Element(),outer=new Element(),ids=Object.fromEntries(['a-share-widget','a-share-status','a-share-query','a-share-results-panel','a-share-results','a-share-choices','a-share-recent-empty','a-share-current','a-share-current-code','a-share-source','a-share-search','a-share-retry','a-share-results-status','a-share-view','a-share-search-close','a-share-expand','a-share-chart'].map(id=>[id,new Element()]));
  panel.hidden=true;panel.closest=()=>outer;
  const finder=new Element();finder.append(ids['a-share-search'],ids['a-share-results-panel']);
  const groups=['指数','个股','recent'].map(value=>{const b=new Element('button');b.dataset.aShareGroup=value;return b;});
  const ranges=dependencies.aShareRanges.map(([value])=>{const b=new Element('button');b.dataset.aShareRange=value;return b;});
  panel.querySelector=selector=>ids[selector.slice(1)];panel.querySelectorAll=selector=>selector==='[data-a-share-group]'?groups:selector==='[data-a-share-range]'?ranges:[...ids['a-share-choices'].children,...ids['a-share-results'].children];
  const document=new Element('document');document.createElement=tag=>new Element(tag);document.querySelector=selector=>selector==='#a-share-panel'?panel:{dataset:{category:initialCategory}};
  const localStorage={getItem(){if(denyStorage)throw Error('Denied');return saved;},setItem(_key,value){if(denyStorage)throw Error('Denied');saved=value;}};
  const source=fs.readFileSync(new URL('../src/lib/trends/a-share-panel.ts',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'').replace('export function initASharePanel','function initASharePanel');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const context=vm.createContext({document,localStorage,Node:Element,...dependencies});vm.runInContext(compiled+'\ninitASharePanel();',context);
  const category=value=>document.fire('trends:category-change',{detail:value});
  const script=()=>ids['a-share-widget'].children[0]?.children.find(child=>child.tag==='script');
  const search=query=>{ids['a-share-query'].value=query;ids['a-share-query'].fire('input');};
  const submit=()=>ids['a-share-search'].fire('submit',{preventDefault(){}});
  return {panel,outer,ids,groups,ranges,category,script,context,search,submit,saved:()=>saved};
}
test('lazy mounting, duplicate events and teardown remain safe across other market navigation',()=>{
  const f=fixture();assert.equal(f.panel.hidden,true);assert.equal(f.script(),undefined);
  f.category('a');assert.equal(f.panel.hidden,false);assert.equal(f.outer.classList.contains('is-a-share'),true);const script=f.script();assert.equal(JSON.parse(script.textContent).symbol,'SSE:000001');
  f.category('a');assert.equal(f.script(),script);vm.runInContext('initASharePanel();',f.context);assert.equal(f.ids['a-share-retry'].listeners.click.length,1);
  f.category('housing');assert.equal(f.panel.hidden,true);assert.equal(f.script(),undefined);assert.equal(f.outer.classList.contains('is-a-share'),false);
  f.category('a');assert.notEqual(f.script(),script);assert.equal(f.ids['a-share-widget'].children.length,1);
});
test('name search selects the right exchange, clears the search, and persists only symbol recents',()=>{
  const f=fixture('a');f.search('茅台');assert.equal(f.ids['a-share-results'].children.length,1);f.submit();
  assert.equal(JSON.parse(f.script().textContent).symbol,'SSE:600519');assert.equal(f.ids['a-share-current'].textContent,'贵州茅台');assert.equal(f.ids['a-share-query'].value,'');assert.equal(f.ids['a-share-results-panel'].hidden,true);
  assert.equal(f.ids['a-share-source'].href,'https://www.tradingview.com/symbols/SSE-600519/');assert.deepEqual(JSON.parse(f.saved()),['SSE:600519']);
  f.groups[2].fire('click');assert.equal(f.ids['a-share-choices'].children.length,1);assert.equal(f.ids['a-share-choices'].children[0].attributes['aria-pressed'],'true');
});
test('ambiguous bare code never silently switches chart and exposes named choices',()=>{
  const f=fixture('a'),before=f.script();f.search('000001');f.submit();assert.equal(f.script(),before);assert.equal(f.ids['a-share-results'].children.length,2);
  assert.match(f.ids['a-share-results-status'].textContent,/不同交易所/);f.ids['a-share-results'].children[1].fire('click');assert.equal(JSON.parse(f.script().textContent).symbol,'SZSE:000001');assert.equal(f.ids['a-share-current'].textContent,'平安银行');
});
test('unknown names remain honest, qualified unknown codes remain usable, Escape closes results',()=>{
  const f=fixture('a'),before=f.script();f.search('不存在');f.submit();assert.equal(f.script(),before);assert.match(f.ids['a-share-results-status'].textContent,/未收录/);
  f.panel.fire('keydown',{key:'Escape'});assert.equal(f.ids['a-share-results-panel'].hidden,true);assert.equal(f.ids['a-share-query'].value,'');
  f.search('sh688777');f.submit();assert.equal(JSON.parse(f.script().textContent).symbol,'SSE:688777');assert.equal(f.ids['a-share-current'].textContent,'上海 688777');
});
test('range and chart type controls update the same symbol without duplicated embeds',()=>{
  const f=fixture('a');f.search('宁德');f.submit();f.ranges[1].fire('click');let cfg=JSON.parse(f.script().textContent);assert.equal(cfg.symbol,'SZSE:300750');assert.equal(cfg.range,'60M');assert.match(f.ids['a-share-current-code'].textContent,/周线/);
  const same=f.script();f.ranges[1].fire('click');assert.equal(f.script(),same);
  f.ids['a-share-view'].fire('change',{target:{value:'candles'}});cfg=JSON.parse(f.script().textContent);assert.equal(cfg.interval,'D');assert.equal(cfg.style,'1');assert.equal(cfg.hide_top_toolbar,true);assert.equal(f.ids['a-share-widget'].children.length,1);
  f.ids['a-share-expand'].fire('click');assert.equal(f.panel.classList.contains('a-share-expanded'),true);assert.equal(f.ids['a-share-expand'].attributes['aria-pressed'],'true');assert.equal(f.ids['a-share-chart'].scrolled,true);
});
test('recent selection restores safely even when storage is corrupted or unavailable',()=>{
  const f=fixture('a',JSON.stringify(['bad','SZSE:000001']));assert.equal(JSON.parse(f.script().textContent).symbol,'SZSE:000001');assert.equal(f.groups[1].attributes['aria-pressed'],'true');
  for(const args of [['broken',false],['[]',true]]){const t=fixture('a',...args);assert.equal(JSON.parse(t.script().textContent).symbol,'SSE:000001');t.search('茅台');t.submit();assert.equal(JSON.parse(t.script().textContent).symbol,'SSE:600519');}
});
test('retry and stale errors never overwrite the latest request or leak between markets',()=>{
  const f=fixture('a'),first=f.script();f.ids['a-share-retry'].fire('click');const retry=f.script();assert.notEqual(first,retry);
  first.onerror();assert.doesNotMatch(f.ids['a-share-status'].textContent,/未能加载/);retry.onerror();assert.match(f.ids['a-share-status'].textContent,/未能加载/);
  f.category('consumer');f.category('a');retry.onerror();assert.doesNotMatch(f.ids['a-share-status'].textContent,/未能加载/);
});
