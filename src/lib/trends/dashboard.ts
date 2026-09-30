import { windowPoints, change, chartPath, type Instrument } from './model';
const data:Instrument[]=JSON.parse(document.querySelector('#trend-data')!.textContent!);
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let category='all', query='', favoritesOnly=false, months=12, selected=data.find(i=>i.points.length)?.id || data[0].id, sort='name', direction=1, region='';
let favorites=new Set<string>();
try { const saved=JSON.parse(localStorage.getItem('ai014.trends.favorites') || '[]'); if(Array.isArray(saved))favorites=new Set(saved.filter(v=>typeof v==='string')); } catch {}
const format=(n:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(n);
const pct=(n:number|null)=>n===null?'—':`${n>0?'+':''}${n.toFixed(2)}%`;
const tone=(n:number|null)=>n===null?'':n>0?'positive':n<0?'negative':'';
const text=(id:string,value:string)=>{get(id).textContent=value;};
const matches=()=>data.filter(i=>(category==='all'||i.category===category)&&(!favoritesOnly||favorites.has(i.id))&&`${i.name} ${i.symbol} ${i.source}`.toLowerCase().includes(query));
function toggleFavorite(id:string){favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('ai014.trends.favorites',JSON.stringify([...favorites]));}catch{}render();}
function cell(value:string,cls=''){const el=document.createElement('td');el.textContent=value;el.className=cls;return el;}
function render(){
 document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
 get('favorites-only').setAttribute('aria-pressed',String(favoritesOnly));
 const list=matches().sort((a,b)=>sort==='name'?direction*a.name.localeCompare(b.name,'zh-CN'):((change(windowPoints(a.points,months))??-Infinity)-(change(windowPoints(b.points,months))??-Infinity))*direction);
 if(list.length&&!list.some(i=>i.id===selected))selected=list[0].id;
 const rows=get('market-rows');rows.replaceChildren();
 for(const i of list){const tr=document.createElement('tr');tr.classList.toggle('selected',i.id===selected);const name=document.createElement('td');const button=document.createElement('button');button.className='instrument-link';button.textContent=i.name;button.addEventListener('click',()=>{selected=i.id;render();});const symbol=document.createElement('small');symbol.textContent=i.symbol;name.append(button,symbol);const value=i.points.at(-1);const delta=change(windowPoints(i.points,months));const saved=document.createElement('td');const star=document.createElement('button');star.textContent=favorites.has(i.id)?'★':'☆';star.className='star';star.setAttribute('aria-label',`${favorites.has(i.id)?'取消收藏':'收藏'}${i.name}`);star.setAttribute('aria-pressed',String(favorites.has(i.id)));star.addEventListener('click',()=>toggleFavorite(i.id));saved.append(star);tr.append(name,cell(value?format(value.value):'—'),cell(pct(delta),tone(delta)),cell(value?.date||'—'),cell(value?'历史快照':'待接入',value?'available':'muted'),saved);rows.append(tr);}
 text('result-count',`${list.length} 个品种`);get('no-results').hidden=list.length>0;
 if(list.length&&!list.some(i=>i.id===selected))selected=list[0].id;
 const i=data.find(i=>i.id===selected)!;const regional=region&&(i.category==='housing'||i.category==='rent');
 text('instrument-title',(regional?region+' · ':'')+i.name);text('instrument-symbol',i.symbol);get('instrument-source').replaceChildren();const source=document.createElement('a');source.href=i.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent=`来源：${i.source} ↗`;get('instrument-source').append(source);
 const points=windowPoints(i.points,months),latest=points.at(-1),delta=change(points);
 text('last-value',latest?format(latest.value):'—');text('instrument-unit',i.unit);text('last-date',latest?.date||'暂无数据');text('frequency',i.frequency);text('period-change',pct(delta));get('period-change').className=tone(delta);text('period-dates',points.length?`${points[0].date} → ${latest!.date}`:'待接入可核实序列');text('instrument-coverage',(regional?`所选地区：${region}。目前没有该地区已核实的数据。 `:'')+i.coverage);
 const fav=get<HTMLButtonElement>('detail-favorite');fav.textContent=favorites.has(i.id)?'★ 已收藏':'☆ 收藏';fav.setAttribute('aria-pressed',String(favorites.has(i.id)));
 get('chart-empty').hidden=points.length>1;get<HTMLElement>('trend-chart').style.display=points.length>1?'block':'none';
 document.querySelectorAll<HTMLButtonElement>('[data-months]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.months)===months));b.disabled=i.points.length<2;});
 if(points.length>1){const d=chartPath(points,900,250);get('chart-line').setAttribute('d',d);get('chart-line').setAttribute('transform','translate(10,10)');get('chart-fill').setAttribute('d',`${d} L900,260 L0,260 Z`);get('chart-fill').setAttribute('transform','translate(10,10)');const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values);const grid=get('chart-grid'),labels=get('chart-labels');grid.replaceChildren();labels.replaceChildren();const svgNS='http://www.w3.org/2000/svg';for(let j=0;j<5;j++){const y=22+j*56.5;const line=document.createElementNS(svgNS,'line');for(const [k,v]of Object.entries({x1:10,x2:910,y1:y,y2:y,stroke:'#343531'}))line.setAttribute(k,String(v));grid.append(line);const label=document.createElementNS(svgNS,'text');label.setAttribute('x','925');label.setAttribute('y',String(y+5));label.textContent=format(max-(max-min)*j/4);labels.append(label);}for(const [x,date]of [[10,points[0].date],[760,latest!.date]]){const label=document.createElementNS(svgNS,'text');label.setAttribute('x',String(x));label.setAttribute('y','298');label.textContent=String(date);labels.append(label);}}
 get('chart-inspector').hidden=points.length<2; const slider=get<HTMLInputElement>('point-slider');slider.max=String(Math.max(0,points.length-1));slider.value=slider.max; if(latest)text('point-readout',`${latest.date} · ${format(latest.value)} ${i.unit}`);
 text('chart-caption',points.length?`${points.length} 个观测值 · ${i.unit} · 非实时`:'暂无数据时不计算趋势与涨跌');
}
get<HTMLInputElement>('trend-search').addEventListener('input',e=>{query=(e.target as HTMLInputElement).value.trim().toLowerCase();render();});
document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category!;render();}));
document.querySelectorAll<HTMLButtonElement>('[data-months]').forEach(b=>b.addEventListener('click',()=>{months=Number(b.dataset.months);render();}));
document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(b=>b.addEventListener('click',()=>{direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort!;render();}));
get('favorites-only').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;render();});get('detail-favorite').addEventListener('click',()=>toggleFavorite(selected));
get('point-slider').addEventListener('input',e=>{const i=data.find(i=>i.id===selected)!;const p=windowPoints(i.points,months)[Number((e.target as HTMLInputElement).value)];if(p)text('point-readout',`${p.date} · ${format(p.value)} ${i.unit}`);});
let appliedRegion=['','',''];
const dialog=get<HTMLDialogElement>('region-dialog');get('region-open').addEventListener('click',()=>{['region-province','region-city','region-district'].forEach((id,n)=>get<HTMLInputElement>(id).value=appliedRegion[n]);dialog.showModal();});
get('region-reset').addEventListener('click',()=>{for(const id of ['region-province','region-city','region-district'])get<HTMLInputElement>(id).value='';});
dialog.addEventListener('close',()=>{if(dialog.returnValue!=='apply')return;appliedRegion=['region-province','region-city','region-district'].map(id=>get<HTMLInputElement>(id).value.trim());region=appliedRegion.filter(Boolean).join(' / ');text('region-open',(region||'全国')+' / 地区筛选 ⌄');category=category==='rent'?'rent':'housing';render();});
render();
