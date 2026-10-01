import { rangePoints, rangeSummary, displayUnit, displayValue, displayPoints, change, chartPath, freshness, type Instrument, type Range, type UnitMode } from './model';
const data:Instrument[]=JSON.parse(document.querySelector('#trend-data')!.textContent!);
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let category='consumer',query='',favoritesOnly=false,range:Range='1m',selected=data.find(i=>i.category==='consumer'&&i.points.some(p=>p.low!==undefined))?.id||data.find(i=>i.category==='consumer'&&i.points.length)?.id||data[0].id,sort='name',direction=1,region='';
let unitMode:UnitMode='jin',inspectedDate='',favorites=new Set<string>();
try {
 const saved=JSON.parse(localStorage.getItem('ai014.trends.favorites')||'[]');
 if(Array.isArray(saved))favorites=new Set(saved.filter(v=>typeof v==='string'));
 if(localStorage.getItem('ai014.trends.unit')==='original')unitMode='original';
} catch {}
const format=(n:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(n);
const pct=(n:number|null)=>n===null?'—':`${n>0?'+':''}${n.toFixed(2)}%`;
const tone=(n:number|null)=>n===null?'':n>0?'positive':n<0?'negative':'';
const text=(id:string,value:string)=>{get(id).textContent=value;};
const quoteRange=(p:Instrument['points'][number],i:Instrument)=>p.low!==undefined&&p.high!==undefined?`最低 ${format(displayValue(p.low,i.unit,unitMode))} / 最高 ${format(displayValue(p.high,i.unit,unitMode))} ${displayUnit(i.unit,unitMode)}`:'';
const selectedItem=()=>data.find(i=>i.id===selected)!;
const matches=()=>data.filter(i=>(category==='all'||i.category===category)&&(!favoritesOnly||favorites.has(i.id))&&`${i.name} ${i.symbol} ${i.source} ${i.market||''}`.toLowerCase().includes(query));
function toggleFavorite(id:string){favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('ai014.trends.favorites',JSON.stringify([...favorites]));}catch{}render();}
function cell(value:string,cls='',label=''){const el=document.createElement('td');el.textContent=value;el.className=cls;el.dataset.label=label;return el;}
function inspectPoint(index:number){
 const i=selectedItem(),points=rangePoints(i.points,range),p=points[index];if(!p)return;
 inspectedDate=p.date;get<HTMLInputElement>('point-slider').value=String(index);
 const value=`${p.date} · ${p.low!==undefined?'单品均价 ':''}${format(displayValue(p.value,i.unit,unitMode))} ${displayUnit(i.unit,unitMode)}${quoteRange(p,i)?' · '+quoteRange(p,i):''}`;
 text('point-readout',value);get<HTMLInputElement>('point-slider').setAttribute('aria-valuetext',value);
 get<HTMLAnchorElement>('point-source').href=p.sourceUrl||i.sourceUrl;
 get('chart-point-title').textContent=value;
 document.querySelectorAll<SVGCircleElement>('[data-point]').forEach(el=>el.classList.toggle('active',Number(el.dataset.point)===index));
}
function render(){
 document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
 document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===unitMode)));
 get('favorites-only').setAttribute('aria-pressed',String(favoritesOnly));get<HTMLSelectElement>('category-select').value=category;
 const list=matches().sort((a,b)=>sort==='name'?direction*a.name.localeCompare(b.name,'zh-CN'):((change(rangePoints(a.points,range))??-Infinity)-(change(rangePoints(b.points,range))??-Infinity))*direction);
 if(list.length&&!list.some(i=>i.id===selected)){selected=list[0].id;inspectedDate='';}
 const rows=get('market-rows');rows.replaceChildren();
 for(const i of list){
  const tr=document.createElement('tr');tr.classList.toggle('selected',i.id===selected);
  const name=document.createElement('td'),button=document.createElement('button');button.className='instrument-link';button.textContent=i.name;
  button.addEventListener('click',()=>{selected=i.id;inspectedDate='';render();get('selected-instrument').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});get('selected-instrument').focus({preventScroll:true});});
  const symbol=document.createElement('small');symbol.textContent=i.symbol;name.append(button,symbol);
  const value=i.points.at(-1),delta=change(rangePoints(i.points,range)),saved=document.createElement('td'),star=document.createElement('button');
  star.textContent=favorites.has(i.id)?'★':'☆';star.className='star';star.setAttribute('aria-label',`${favorites.has(i.id)?'取消收藏':'收藏'}${i.name}`);star.setAttribute('aria-pressed',String(favorites.has(i.id)));star.addEventListener('click',()=>toggleFavorite(i.id));saved.append(star);
  const price=cell(value?format(displayValue(value.value,i.unit,unitMode))+' '+displayUnit(i.unit,unitMode):'—','price-cell',value?.low!==undefined?'单品均价':'最新参考值');if(value&&quoteRange(value,i)){const limits=document.createElement('small');limits.className='quote-range';limits.textContent=quoteRange(value,i);price.append(limits);}
  tr.append(name,price,cell(pct(delta),tone(delta),'区间变化'),cell(value?.date||'—','date-cell','数据截至'),cell(freshness(i),value?'available':'muted','状态'),saved);rows.append(tr);
 }
 text('result-count',`${list.length} 个品种`);get('no-results').hidden=list.length>0;get('selected-instrument').hidden=!list.length;if(!list.length)return;
 const i=selectedItem(),regional=region&&(i.category==='housing'||i.category==='rent'),unit=displayUnit(i.unit,unitMode);
 text('instrument-title',(regional?region+' · ':'')+i.name);text('instrument-symbol',i.symbol);get('instrument-source').replaceChildren();
 const source=document.createElement('a');source.href=i.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent=`来源：${i.source} ↗`;get('instrument-source').append(source);
 const raw=rangePoints(i.points,range),points=displayPoints(raw,i.unit,unitMode),latest=i.points.at(-1),delta=change(raw);
 text('value-label',latest?.low!==undefined?'最新单品均价':'最新参考值');text('quote-range',latest?quoteRange(latest,i):'');get('quote-range').hidden=!latest||!quoteRange(latest,i);
 text('last-value',latest?format(displayValue(latest.value,i.unit,unitMode)):'—');text('instrument-unit',unit);text('last-date',latest?.date||'暂无数据');
 text('frequency',`${i.frequency}${i.sourceUpdatedAt?' · 发布于 '+i.sourceUpdatedAt:''} · ${freshness(i)}${i.retrievedAt?' · 获取于 '+i.retrievedAt:''}`);
 text('period-change',pct(delta));get('period-change').className=tone(delta);text('period-dates',raw.length?`${raw[0].date} → ${raw.at(-1)!.date}`:'待接入可核实序列');
 text('range-status',rangeSummary(i.points,range));text('instrument-coverage',(regional?`所选地区：${region}。目前没有该地区已核实的数据。 `:'')+i.coverage);
 text('unit-detail',unit!==i.unit?`原始单位 ${i.unit} · 显示值按 1斤 = 0.5公斤换算，涨跌幅不变`:i.unit==='元/斤'?'来源原始单位为元/斤，无需换算':/^元\/(公斤|千克|kg)$/i.test(i.unit)?'当前显示来源原始单位；可切换为元/斤':`此品种保持原始单位 ${i.unit}`);
 const fav=get<HTMLButtonElement>('detail-favorite');fav.textContent=favorites.has(i.id)?'★ 已收藏':'☆ 收藏';fav.setAttribute('aria-pressed',String(favorites.has(i.id)));
 get('chart-empty').hidden=points.length>1;get('trend-chart').style.display=points.length>1?'block':'none';
 text('chart-empty-title',points.length===1?'所选区间只有1个观测值':'暂无已核实序列');text('chart-empty-copy',points.length===1?'无法计算涨跌或绘制折线。试试“近2期”或扩大区间；不补造缺失价格。':'覆盖说明见下方。不用模拟曲线替代真实行情。');
 document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.range===range));b.disabled=!i.points.length;});
 if(points.length>1)renderChart(points,unit);
 get('chart-inspector').hidden=!points.length;const slider=get<HTMLInputElement>('point-slider');slider.max=String(Math.max(0,points.length-1));slider.disabled=points.length<2;
 const prior=points.findIndex(p=>p.date===inspectedDate);if(points.length)inspectPoint(prior>=0?prior:points.length-1);
 text('chart-caption',points.length?`${points.length} 个观测值 · ${unit} · 非实时${i.sourceKey?' · 仅已核实公告，缺失日不补点':''}`:'暂无数据时不计算趋势与涨跌');
}
function renderChart(points:ReturnType<typeof displayPoints>,unit:string){
 const small=matchMedia('(max-width:760px)').matches,w=small?300:900,h=small?190:250;
 get('trend-chart').setAttribute('viewBox',small?'0 0 400 250':'0 0 1000 310');
 const d=chartPath(points,w,h);get('chart-line').setAttribute('d',d);get('chart-line').setAttribute('transform','translate(10,10)');
 get('chart-fill').setAttribute('d',`${d} L${w},${h+10} L0,${h+10} Z`);get('chart-fill').setAttribute('transform','translate(10,10)');
 const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),grid=get('chart-grid'),labels=get('chart-labels'),markers=get('chart-markers');grid.replaceChildren();labels.replaceChildren();markers.replaceChildren();
 const svgNS='http://www.w3.org/2000/svg';
 for(let j=0;j<5;j++){
  const y=22+j*(h-24)/4,line=document.createElementNS(svgNS,'line');for(const [k,v] of Object.entries({x1:10,x2:w+10,y1:y,y2:y,stroke:'#343531'}))line.setAttribute(k,String(v));grid.append(line);
  const label=document.createElementNS(svgNS,'text');label.setAttribute('x',String(w+20));label.setAttribute('y',String(y+5));label.textContent=format(max-(max-min)*j/4);labels.append(label);
 }
 for(const [x,date]of [[10,points[0].date],[w-140,points.at(-1)!.date]]){const label=document.createElementNS(svgNS,'text');label.setAttribute('x',String(x));label.setAttribute('y',String(h+48));label.textContent=String(date);labels.append(label);}
 if(points.length<=60){
  const coords=[...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)];
  points.forEach((p,index)=>{const circle=document.createElementNS(svgNS,'circle'),title=document.createElementNS(svgNS,'title');circle.setAttribute('cx',String(Number(coords[index][1])+10));circle.setAttribute('cy',String(Number(coords[index][2])+10));circle.setAttribute('r','4');circle.dataset.point=String(index);title.textContent=`${p.date} · ${p.low!==undefined?'单品均价 ':''}${format(p.value)} ${unit}${p.low!==undefined&&p.high!==undefined?` · 最低 ${format(p.low)} / 最高 ${format(p.high)} ${unit}`:''}`;circle.append(title);circle.addEventListener('click',()=>inspectPoint(index));circle.addEventListener('pointerenter',()=>inspectPoint(index));markers.append(circle);});
 }
}
get<HTMLSelectElement>('category-select').addEventListener('change',e=>{category=(e.target as HTMLSelectElement).value;render();});
get<HTMLSelectElement>('mobile-sort').addEventListener('change',e=>{const v=(e.target as HTMLSelectElement).value;sort=v==='name'?'name':'change';direction=v==='change-desc'?-1:1;render();});
window.addEventListener('resize',()=>render());
get<HTMLInputElement>('trend-search').addEventListener('input',e=>{query=(e.target as HTMLInputElement).value.trim().toLowerCase();render();});
document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category!;render();}));
document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range as Range;render();}));
document.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach(b=>b.addEventListener('click',()=>{unitMode=b.dataset.unit as UnitMode;try{localStorage.setItem('ai014.trends.unit',unitMode);}catch{}render();}));
document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(b=>b.addEventListener('click',()=>{direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort!;render();}));
get('favorites-only').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;render();});get('detail-favorite').addEventListener('click',()=>toggleFavorite(selected));
get('point-slider').addEventListener('input',e=>inspectPoint(Number((e.target as HTMLInputElement).value)));
let appliedRegion=['','',''];
const dialog=get<HTMLDialogElement>('region-dialog');get('region-open').addEventListener('click',()=>{['region-province','region-city','region-district'].forEach((id,n)=>get<HTMLInputElement>(id).value=appliedRegion[n]);dialog.returnValue='';dialog.showModal();});
get('region-reset').addEventListener('click',()=>{for(const id of ['region-province','region-city','region-district'])get<HTMLInputElement>(id).value='';});
dialog.addEventListener('close',()=>{if(dialog.returnValue!=='apply')return;appliedRegion=['region-province','region-city','region-district'].map(id=>get<HTMLInputElement>(id).value.trim());region=appliedRegion.filter(Boolean).join(' / ');text('region-open',(region||'全国')+' / 地区筛选 ⌄');category=category==='rent'?'rent':'housing';render();});
render();
