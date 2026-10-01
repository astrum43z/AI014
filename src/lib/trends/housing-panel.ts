import {indexSeries,indexGeometry,nativeRate,resolveRegion,validateHousing,type HousingSnapshot,type IndexMode,type HousingKind,type IndexMetric,type IndexRange,type IndexPoint,type Region} from './housing';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const panel=el('housing-panel');
const data:HousingSnapshot=JSON.parse(el('housing-data').textContent!);validateHousing(data);
const select=(id:string)=>el<HTMLSelectElement>(id);
const initial=new URLSearchParams(location.search).get('market');
let mode:IndexMode=initial==='rent'?'rent':'housing',active=initial==='rent'||initial==='housing',city='北京',kind:HousingKind='new',metric:IndexMetric='mom',range:IndexRange='all',inspectedMonth='';
let region:Region={province:'',city:'',district:''},shown:IndexPoint[]=[];
const set=(id:string,value:string)=>{el(id).textContent=value;};
const number=(n:number)=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const percent=(n:number)=>`${n>0?'+':''}${number(n)}%`;
const svgNS='http://www.w3.org/2000/svg';
function svg(tag:string,attributes:Record<string,string|number>,text?:string){const node=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;}
function inspect(index:number){
 const point=shown[index];if(!point)return;inspectedMonth=point.month;
 const desc=mode==='housing'?`环比 ${number(point.mom)}（上月=100），同比 ${number(point.yoy)}（上年同月=100）`:`环比 ${percent(point.mom)}，同比 ${percent(point.yoy)}`;
 const value=`${point.month} · ${desc} · ${point.baseYear}统计基期 · ${point.publishedAt}发布`;
 set('index-readout',value);const slider=el<HTMLInputElement>('index-slider');slider.value=String(index);slider.setAttribute('aria-valuetext',value);
 el<HTMLAnchorElement>('index-point-source').href=point.sourceUrl;
 panel.querySelectorAll<SVGCircleElement>('[data-index-point]').forEach(dot=>dot.classList.toggle('active',Number(dot.dataset.indexPoint)===index));
 panel.querySelectorAll<HTMLTableRowElement>('[data-index-row]').forEach(row=>row.classList.toggle('active',Number(row.dataset.indexRow)===index));
}
function chart(points:IndexPoint[]){
 const small=matchMedia('(max-width:760px)').matches,w=small?300:650,h=small?150:180,left=20,top=20;
 el('index-chart').setAttribute('viewBox',small?'0 0 400 235':'0 0 760 260');
 const g=indexGeometry(points,mode==='housing'?100:0,w,h);for(const id of ['index-grid','index-paths','index-dots','index-labels'])el(id).replaceChildren();
 for(let i=0;i<5;i++){const y=top+i*h/4;el('index-grid').append(svg('line',{x1:left,x2:left+w,y1:y,y2:y,stroke:'#34382e'}));el('index-labels').append(svg('text',{x:left+w+10,y:y+4},(g.max-(g.max-g.min)*i/4).toFixed(2)));}
 el('index-grid').append(svg('line',{x1:left,x2:left+w,y1:top+g.baselineY,y2:top+g.baselineY,stroke:'#85866a','stroke-dasharray':'4 5'}));
 for(const d of g.paths)el('index-paths').append(svg('path',{d,transform:`translate(${left},${top})`,fill:'none',stroke:'#e5cc7d','stroke-width':2.5,'vector-effect':'non-scaling-stroke'}));
 if(g.breakX!==null){const x=left+g.breakX;el('index-grid').append(svg('line',{x1:x,x2:x,y1:top,y2:top+h,stroke:'#9d8756','stroke-dasharray':'3 5'}));el('index-labels').append(svg('text',{x,y:top+h+24,'text-anchor':'middle'},'2026-01 换基'));}
 for(const [x,label,anchor] of [[left,points[0].month,'start'],[left+w,points.at(-1)!.month,'end']] as const)el('index-labels').append(svg('text',{x,y:top+h+(small?5:0)+49,'text-anchor':anchor},label));
 points.forEach((point,index)=>{const dot=svg('circle',{cx:g.dots[index].x+left,cy:g.dots[index].y+top,r:4,'data-index-point':index});dot.append(svg('title',{},`${point.month} · ${number(point.value)}${mode==='rent'?'%':''} · ${point.baseYear}统计基期`));dot.addEventListener('click',()=>inspect(index));dot.addEventListener('pointerenter',()=>inspect(index));el('index-dots').append(dot);});
 set('index-chart-title',`${mode==='rent'?'全国租赁房房租 CPI':city+' '+(kind==='new'?'新建商品住宅':'二手住宅')} ${metric==='mom'?'环比':'同比'}，${points[0].month}至${points.at(-1)!.month}；换基处断线`);
}
function table(points:IndexPoint[]){
 set('index-table-mom',mode==='housing'?'环比（上月=100）':'环比涨跌幅（%）');set('index-table-yoy',mode==='housing'?'同比（上年同月=100）':'同比涨跌幅（%）');const body=el('index-table');body.replaceChildren();
 points.forEach((point,index)=>{const row=document.createElement('tr');row.dataset.indexRow=String(index);for(const value of [point.month,number(point.mom),number(point.yoy),String(point.baseYear)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}const cell=document.createElement('td'),link=document.createElement('a');link.href=point.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=point.publishedAt+' ↗';cell.append(link);row.append(cell);body.append(row);});
}
function render(){
 panel.hidden=!active;if(!active)return;
 const rent=mode==='rent',metricName=metric==='mom'?'环比':'同比';
 el('index-city-control').hidden=rent;el('index-kind-control').hidden=rent;
 set('index-title',rent?'全国租赁房房租 CPI':`${city} · ${kind==='new'?'新建商品住宅':'二手住宅'}价格指数`);
 set('index-scope',rent?'全国 CPI 租赁房房租分项 · 涨跌幅，不是元/月或元/平方米的租金水平 · 暂无城市、区县租金':'覆盖70个大中城市的市辖区整体，不包括县；不是各区单列，也不是全国平均房价或每平方米成交价');
 const resolution=resolveRegion(data.cities,mode,region);el('index-unavailable').hidden=resolution.supported;el('index-results').hidden=!resolution.supported;
 if(!resolution.supported){set('index-unavailable-reason',resolution.reason!);return;}
 if(resolution.city&&city!==resolution.city){city=resolution.city;select('index-city').value=city;set('index-title',`${city} · ${kind==='new'?'新建商品住宅':'二手住宅'}价格指数`);}
 shown=indexSeries(data,mode,city,kind,metric,range);const latest=indexSeries(data,mode,city,kind,metric).at(-1)!;
 set('index-value-label',`最新${metricName}${rent?'涨跌幅':'指数'}`);set('index-value',rent?percent(latest.value):number(latest.value));
 set('index-unit',rent?'全国 CPI 分项（%）':metric==='mom'?'上月 = 100':'上年同月 = 100');
 set('index-rate-label',rent?`最新${metric==='mom'?'同比':'环比'}涨跌幅`:`对应${metricName}涨跌`);
 set('index-rate',percent(nativeRate(latest,mode,rent?(metric==='mom'?'yoy':'mom'):metric)));
 set('index-rate-note',rent?'另一对比期的官方涨跌幅':'本期原始指数 − 100；不计算区间收益');
 set('index-latest-month',latest.month);set('index-published',`${latest.publishedAt} 发布 · ${latest.baseYear}统计基期`);
 set('index-method',rent?`图中为各月官方${metricName}涨跌幅（%），零线表示相应对比期没有变化。缺失月份不补造，不连乘成租金价格。`:`图中为各月原始${metricName}指数（${metric==='mom'?'上月':'上年同月'}=100）。100表示相应对比期价格不变；例如99.8表示下降0.2%。这些不是同一固定基日的价格点。`);
 chart(shown);table(shown);const slider=el<HTMLInputElement>('index-slider');slider.max=String(shown.length-1);const prior=shown.findIndex(p=>p.month===inspectedMonth);inspect(prior<0?shown.length-1:prior);
 set('index-coverage-count',`当前 ${shown.length} 个真实月度观测 · ${shown[0].month} → ${shown.at(-1)!.month}。完整快照只有12期，更早历史尚未接入。`);
}
for(const [id,update] of [['index-city',(v:string)=>{city=v;region={province:'',city:'',district:''};document.dispatchEvent(new CustomEvent('trends:region-reset'));}],['index-kind',(v:string)=>{kind=v as HousingKind;}],['index-metric',(v:string)=>{metric=v as IndexMetric;}],['index-range',(v:string)=>{range=v as IndexRange;}]] as const)select(id).addEventListener('change',event=>{update((event.target as HTMLSelectElement).value);render();});
el('index-slider').addEventListener('input',event=>inspect(Number((event.target as HTMLInputElement).value)));
el('index-region-clear').addEventListener('click',()=>{region={province:'',city:'',district:''};document.dispatchEvent(new CustomEvent('trends:region-reset'));render();});
document.addEventListener('trends:category-change',((event:CustomEvent<string>)=>{active=event.detail==='housing'||event.detail==='rent';if(active)mode=event.detail as IndexMode;render();}) as EventListener);
document.addEventListener('trends:region-change',((event:CustomEvent<Region>)=>{region=event.detail;render();}) as EventListener);
window.addEventListener('resize',render);render();
