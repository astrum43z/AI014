import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {aShareSymbol,aShareSourceUrl,aShareWidgetConfig,aSharePresets,aShareWidgetScript} from '../src/lib/trends/a-share.ts';
test('A-share symbols require an explicit exchange and preserve leading zeros',()=>{
  assert.equal(aShareSymbol('SSE','000001'),'SSE:000001');assert.equal(aShareSymbol('SZSE','000001'),'SZSE:000001');
  assert.equal(aShareSymbol('SZSE',' 300750 '),'SZSE:300750');
  for(const [exchange,code] of [['HKEX','000001'],['SSE','1'],['SSE','<script>'],['SZSE','600519/../'],['BSE','920000']])assert.equal(aShareSymbol(exchange,code),null);
});
test('official embed is daily, attributed, and restricted to validated public symbols',()=>{
  assert.equal(aShareWidgetScript,'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  assert.equal(aShareSourceUrl('SZSE:399001'),'https://www.tradingview.com/symbols/SZSE-399001/');
  assert.throws(()=>aShareSourceUrl('SSE:000001?token=secret'));
  for(const p of aSharePresets){const c=aShareWidgetConfig(p.symbol);assert.equal(c.symbol,p.symbol);assert.equal(c.interval,'D');assert.equal(c.timezone,'Asia/Shanghai');assert.equal(c.withdateranges,true);assert.equal(c.allow_symbol_change,false);}
});
test('component discloses third-party EOD data and loader never treats iframe load as data verification',()=>{
  const component=fs.readFileSync(new URL('../src/components/ASharePanel.astro',import.meta.url),'utf8');
  const client=fs.readFileSync(new URL('../src/lib/trends/a-share-panel.ts',import.meta.url),'utf8');
  assert.match(component,/日线历史 \/ EOD覆盖/);assert.match(component,/IP 地址/);assert.match(component,/暂不含北交所/);assert.match(component,/6位代码/);
  assert.match(client,/by TradingView/);assert.match(client,/script\.onerror/);assert.match(client,/panel\.hidden/);assert.doesNotMatch(client,/fetch\(|\.contentDocument|\.contentWindow|postMessage|setInterval|onload\s*=/);
});
