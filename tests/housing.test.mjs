import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateHousing,indexSeries,nativeRate,indexGeometry,resolveRegion,provinceForCity} from '../src/lib/trends/housing.ts';
const data=JSON.parse(fs.readFileSync('src/data/nbs-housing.json','utf8'));
test('NBS snapshot has exactly twelve real months, seventy city pairs and source metadata',()=>{
 validateHousing(data);assert.equal(data.cities.length,70);assert.equal(Object.keys(provinceForCity).length,70);assert.equal(data.housing.length*70*2,1680);assert.equal(data.rent.length,12);
 const manifest=JSON.parse(fs.readFileSync('docs/nbs-housing-source-manifest.json','utf8'));assert.equal(manifest.sources.length,24);
 for(const item of manifest.sources){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert.ok(item.bytes>1000);const row=data[item.kind].find(x=>x.month===item.month);assert.equal(row.sourceUrl,item.sourceUrl);assert.equal(row.publishedAt,item.publishedAt);}
 assert.equal(data.housing[4].month,'2026-01');assert.equal(data.housing[4].baseYear,2025);assert.equal(data.housing[3].baseYear,2020);assert.equal(data.housing[4].new[0][2],null);assert.equal(data.rent[4].ytd,null);
});
test('known source values remain original rolling indexes and rental percentage rates',()=>{
 const newHome=indexSeries(data,'housing','北京','new','mom'),resale=indexSeries(data,'housing','北京','resale','yoy'),rent=indexSeries(data,'rent','北京','new','yoy');
 assert.equal(newHome.at(-1).value,99.8);assert.equal(newHome.at(-1).yoy,97.7);assert.equal(resale.at(-1).mom,99.9);assert.equal(resale.at(-1).value,96.5);assert.equal(nativeRate(newHome.at(-1),'housing','mom'),-.2);assert.equal(rent.at(-1).value,-.6);assert.equal(rent.at(-1).mom,0);
 assert.equal(indexSeries(data,'housing','上海','new','yoy').at(-1).value,103);assert.equal(indexSeries(data,'housing','unknown','new','mom').length,0);
});
test('rolling series never cross the base break with a connected line',()=>{
 for(const mode of ['housing','rent'])for(const metric of ['mom','yoy']){
  const points=indexSeries(data,mode,'北京','new',metric),before=JSON.stringify(points),geometry=indexGeometry(points,mode==='housing'?100:0);
  assert.equal(geometry.paths.length,2);assert.equal((geometry.paths[0].match(/L/g)||[]).length,3);assert.equal((geometry.paths[1].match(/L/g)||[]).length,7);assert.ok(geometry.breakX>0);assert.doesNotMatch(geometry.paths.join(' '),/NaN|Infinity/);assert.equal(JSON.stringify(points),before);
 }
 assert.equal(indexGeometry(indexSeries(data,'rent','北京','new','mom','2026'),0).paths.length,1);
 assert.equal(indexGeometry([],0).paths.length,0);
 assert.equal(indexSeries(data,'housing','北京','resale','mom','3').length,3);
 assert.equal(indexSeries(data,'housing','北京','resale','mom','2025').length,4);
 const source=fs.readFileSync('src/lib/trends/housing-panel.ts','utf8');assert.doesNotMatch(source,/\bchange\(|\.reduce\([^\n]*\*/);
});
test('no county, provincial aggregate or regional rent is replaced by another scope',()=>{
 const empty={province:'',city:'',district:''};assert.deepEqual(resolveRegion(data.cities,'rent',empty),{supported:true});
 assert.equal(resolveRegion(data.cities,'housing',{province:'湖北',city:'武汉市',district:''}).city,'武汉');
 for(const r of [{province:'湖北',city:'武汉',district:'武昌区'},{province:'北京',city:'武汉',district:''},{province:'湖北',city:'',district:''},{province:'',city:'昆山市',district:''}])assert.equal(resolveRegion(data.cities,'housing',r).supported,false);
 assert.equal(resolveRegion(data.cities,'rent',{...empty,city:'北京'}).supported,false);
});
test('invalid counts, base regimes, provenance and period labels fail closed',()=>{
 const cases=[d=>d.cities.pop(),d=>d.housing.pop(),d=>d.housing[4].baseYear=2020,d=>d.housing[0].new.pop(),d=>d.housing[0].new[0][0]=-1,d=>d.housing[0].sourceUrl='https://example.org/fake',d=>d.rent[0].month='2025-08',d=>d.housing[4].new[0][2]=97.6];
 for(const mutate of cases){const d=structuredClone(data);mutate(d);assert.throws(()=>validateHousing(d));}
});
test('dedicated index UI avoids price returns and visibly declares missing coverage and refresh',()=>{
 const markup=fs.readFileSync('src/components/HousingPanel.astro','utf8');assert.match(markup,/不包括县/);assert.match(markup,/不是每月支付的平均租金/);assert.match(markup,/暂未接入自动更新/);assert.match(markup,/换基处断开/);assert.match(markup,/id="index-unavailable"/);
 const dashboard=fs.readFileSync('src/lib/trends/dashboard.ts','utf8');assert.match(dashboard,/if\(isAShare\|\|isIndex\)/);assert.match(dashboard,/trends:region-change/);
 const prices=JSON.parse(fs.readFileSync('src/data/trends.json','utf8'));assert.equal(prices.instruments.some(i=>['housing','rent'].includes(i.category)),false);assert.ok(prices.instruments.every(i=>i.sourceKey!=='chaoyang'));
 const national=JSON.parse(fs.readFileSync('src/data/mofcom-produce.json','utf8'));assert.equal(national.items.reduce((n,i)=>n+i.values.length,0),3276);
});
