import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {aShareRanges,aShareSymbol,aShareSourceUrl,aShareWidgetConfig,aSharePresets,aShareWidgetScript,aShareSearch,cleanAShareRecents} from '../src/lib/trends/a-share.ts';
test('exchange-qualified symbols preserve leading zeros and reject unsafe values',()=>{
  assert.equal(aShareSymbol('SSE','000001'),'SSE:000001');assert.equal(aShareSymbol('SZSE',' 000001 '),'SZSE:000001');
  for(const [exchange,code] of [['HKEX','000001'],['SSE','1'],['SSE','<script>'],['SZSE','600519/../'],['BSE','920000']])assert.equal(aShareSymbol(exchange,code),null);
  assert.throws(()=>aShareSourceUrl('SSE:000001?token=secret'));
});
test('name finder supports Chinese names, aliases, initials, partial codes and qualified codes',()=>{
  for(const query of ['茅台','贵州茅台','gzmt','MAOTAI','600519','SH600519','SSE:600519','600519.SH','沪600519','ＳＨ６００５１９'])assert.equal(aShareSearch(query)[0].symbol,'SSE:600519',query);
  for(const query of ['SZ000001','000001.sz','SZSE:000001','深000001'])assert.deepEqual(aShareSearch(query).map(p=>p.symbol),['SZSE:000001'],query);
  assert.equal(aShareSearch('宁德')[0].symbol,'SZSE:300750');assert.ok(aShareSearch('399').length>=2);
  for(const query of ['不存在的股票','<script>','BSE:920000',''])assert.deepEqual(aShareSearch(query),[]);
});
test('bare ambiguous or unlisted six-digit codes require an explicit exchange choice',()=>{
  assert.deepEqual(aShareSearch('000001').map(p=>[p.name,p.symbol]),[['上证指数','SSE:000001'],['平安银行','SZSE:000001']]);
  assert.deepEqual(aShareSearch('000016').map(p=>p.symbol),['SSE:000016','SZSE:000016']);
  assert.deepEqual(aShareSearch('688777').map(p=>p.symbol),['SSE:688777','SZSE:688777']);
  assert.deepEqual(aShareSearch('平安').map(p=>p.name),['平安银行','中国平安']);
});
test('recents are local, validated, deduplicated, and limited to five instruments',()=>{
  assert.deepEqual(cleanAShareRecents(null),[]);assert.deepEqual(cleanAShareRecents('SSE:000001'),[]);
  assert.deepEqual(cleanAShareRecents(['SSE:000001','bad','SZSE:000001','SSE:000001',...aSharePresets.map(p=>p.symbol)]),['SSE:000001','SZSE:000001','SZSE:399001','SZSE:399006','SSE:000300']);
});
test('official chart is configured from simple history controls without duplicate trading toolbar',()=>{
  assert.equal(aShareWidgetScript,'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  const initial=aShareWidgetConfig('SSE:000001');assert.equal(initial.range,'12M');assert.equal(initial.interval,'D');assert.equal(initial.style,'2');
  for(const p of aSharePresets){const c=aShareWidgetConfig(p.symbol,'60M','1');assert.equal(c.symbol,p.symbol);assert.equal(c.range,'60M');assert.equal(c.interval,'D');assert.equal(c.timezone,'Asia/Shanghai');assert.equal(c.withdateranges,false);assert.equal(c.hide_top_toolbar,true);assert.equal(c.allow_symbol_change,false);}
  assert.deepEqual(aShareRanges.map(([value])=>value),['12M','60M','ALL']);
  for(const unsupported of ['3M','6M','100M'])assert.throws(()=>aShareWidgetConfig('SSE:000001',unsupported));assert.throws(()=>aShareWidgetConfig('SSE:000001','12M','evil')); 
});
test('component discloses bounded directory and provider status, never inspecting quote content',()=>{
  const component=fs.readFileSync(new URL('../src/components/ASharePanel.astro',import.meta.url),'utf8');
  const client=fs.readFileSync(new URL('../src/lib/trends/a-share-panel.ts',import.meta.url),'utf8');
  assert.match(component,/收盘历史 · 非实时/);assert.match(component,/不是全市场名称搜索/);assert.match(component,/IP 地址/);assert.match(component,/暂不含北交所/);assert.match(component,/6位代码/);
  assert.match(client,/by TradingView/);assert.match(client,/script\.onerror/);assert.match(client,/panel\.hidden/);assert.doesNotMatch(client,/fetch\(|\.contentDocument|\.contentWindow|postMessage|setInterval|onload\s*=/);
});
