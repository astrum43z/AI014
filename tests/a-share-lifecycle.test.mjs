import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as dependencies from '../src/lib/trends/a-share.ts';

// This isolated DOM harness exercises our loader, not the remote provider or a browser.
class Element {
  constructor(tag='div'){this.tag=tag;this.hidden=false;this.dataset={};this.style={};this.attributes={};this.children=[];this.listeners={};this.value='';this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  fire(type,event={}){for(const handler of this.listeners[type]||[])handler(event);}
}
function fixture(initialCategory='consumer'){
  const panel=new Element(),ids=Object.fromEntries(['a-share-widget','a-share-status','a-share-exchange','a-share-code','a-share-current','a-share-source','a-share-search','a-share-retry'].map(id=>[id,new Element()]));
  panel.hidden=true;
  const presets=dependencies.aSharePresets.map(p=>{const button=new Element('button');button.dataset.aShareSymbol=p.symbol;return button;});
  panel.querySelector=selector=>ids[selector.slice(1)];panel.querySelectorAll=()=>presets;
  const document=new Element('document');
  document.createElement=tag=>new Element(tag);
  document.querySelector=selector=>selector==='#a-share-panel'?panel:{dataset:{category:initialCategory}};
  const source=fs.readFileSync(new URL('../src/lib/trends/a-share-panel.ts',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'').replace('export function initASharePanel','function initASharePanel');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const context=vm.createContext({document,...dependencies});vm.runInContext(compiled+'\ninitASharePanel();',context);
  const category=value=>document.fire('trends:category-change',{detail:value});
  const script=()=>ids['a-share-widget'].children[0]?.children.find(child=>child.tag==='script');
  return {panel,ids,presets,category,script,context};
}
test('A-share content loads only on selection and repeated category events do not duplicate embeds',()=>{
  const f=fixture();assert.equal(f.panel.hidden,true);assert.equal(f.script(),undefined);
  f.category('a');assert.equal(f.panel.hidden,false);const script=f.script();assert.ok(script);assert.equal(JSON.parse(script.textContent).symbol,'SSE:000001');
  f.category('a');assert.equal(f.script(),script);
  vm.runInContext('initASharePanel();',f.context);assert.equal(f.ids['a-share-retry'].listeners.click.length,1);
  f.category('consumer');assert.equal(f.panel.hidden,true);assert.equal(f.script(),undefined);
  f.category('a');assert.notEqual(f.script(),script);assert.equal(f.ids['a-share-widget'].children.length,1);
});
test('direct A category starts loader and switching symbols keeps selected state consistent',()=>{
  const f=fixture('a');assert.ok(f.script());
  f.presets[2].fire('click');assert.equal(JSON.parse(f.script().textContent).symbol,'SSE:600519');assert.equal(f.ids['a-share-code'].value,'600519');
  assert.equal(f.presets[2].attributes['aria-pressed'],'true');assert.equal(f.presets[0].attributes['aria-pressed'],'false');
  assert.equal(f.ids['a-share-source'].href,'https://www.tradingview.com/symbols/SSE-600519/');
  f.ids['a-share-exchange'].value='SZSE';f.ids['a-share-code'].value='000001';let prevented=false;
  f.ids['a-share-search'].fire('submit',{preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(JSON.parse(f.script().textContent).symbol,'SZSE:000001');assert.match(f.ids['a-share-current'].textContent,/深圳 000001/);
});
test('retry, invalid input and stale failures cannot overwrite the newest request state',()=>{
  const f=fixture('a'),first=f.script();
  f.ids['a-share-retry'].fire('click');const retry=f.script();assert.notEqual(first,retry);assert.equal(f.ids['a-share-widget'].children.length,1);
  first.onerror();assert.doesNotMatch(f.ids['a-share-status'].textContent,/未能加载/);
  retry.onerror();assert.match(f.ids['a-share-status'].textContent,/未能加载/);
  f.ids['a-share-code'].value='<bad>';f.ids['a-share-exchange'].value='SSE';f.ids['a-share-search'].fire('submit',{preventDefault(){}});
  assert.equal(f.script(),retry);assert.match(f.ids['a-share-status'].textContent,/6位代码/);
  f.category('consumer');retry.onerror();assert.doesNotMatch(f.ids['a-share-status'].textContent,/未能加载/);
});
