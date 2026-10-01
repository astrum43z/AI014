export type Point = { date: string; value: number; low?: number; high?: number; sourceUrl?: string };
export type Instrument = { id: string; name: string; category: string; symbol: string; unit: string; source: string; sourceUrl: string; coverage: string; points: Point[]; frequency: string; retrievedAt?: string; sourceUpdatedAt?: string; sourceKey?: string; refreshFailed?: boolean; refreshPending?: boolean; market?: string; specification?: string; historyNote?: string };
export const categories = [ ['all','全部市场'], ['housing','全国房价'], ['rent','全国租金'], ['a','A 股'], ['hk','港股'], ['us','美股'], ['consumer','大陆食品'], ['commodity','大陆大宗'], ['metal','黄金白银'], ['fx','外汇'] ];
export const provinces = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港','澳门','台湾'];
export const ranges = [ ['2p','近2期'], ['7d','近7天'], ['1m','近1月'], ['3m','近3月'], ['12m','近1年'], ['36m','近3年'], ['72m','近6年'], ['all','全部'] ] as const;
export type Range = typeof ranges[number][0];
export type UnitMode = 'original' | 'jin';
const day = (date:string)=>Date.parse(date+'T00:00:00Z');
function monthStart(date:string, months:number):string {
 const end=new Date(day(date)), d=end.getUTCDate();
 end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth()-months);
 const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
 end.setUTCDate(Math.min(d,last)); return end.toISOString().slice(0,10);
}
export function windowPoints(points:Point[],months:number):Point[] {
 if(!points.length||!months)return points;
 const start=monthStart(points.at(-1)!.date,months);return points.filter(p=>p.date>=start);
}
export function rangeStart(points:Point[],range:Range):string|null {
 if(!points.length)return null;
 if(range==='all')return points[0].date;
 if(range==='2p')return points[Math.max(0,points.length-2)].date;
 if(range==='7d')return new Date(day(points.at(-1)!.date)-6*86400000).toISOString().slice(0,10);
 return monthStart(points.at(-1)!.date,Number(range.slice(0,-1)));
}
export function rangePoints(points:Point[],range:Range):Point[] {
 const start=rangeStart(points,range);return start?points.filter(p=>p.date>=start):[];
}
export function rangeSummary(points:Point[],range:Range):string {
 const label=ranges.find(r=>r[0]===range)![1];
 if(!points.length)return `已选${label} · 暂无已核实数据`;
 const shown=rangePoints(points,range), start=rangeStart(points,range)!;
 const requested=`已选${label} · ${start} → ${points.at(-1)!.date}`;
 const actual=`实际收录 ${points[0].date} → ${points.at(-1)!.date}；此区间 ${shown.length} 个观测值`;
 const partial=start<points[0].date?'。更早历史尚未接入，扩大区间不会增加观测值。':'';
 return `${requested}\n${actual}${partial}`;
}
export function displayUnit(unit:string,mode:UnitMode):string { return mode==='jin'&&/^元\/(公斤|千克|kg)$/i.test(unit)?'元/斤':unit; }
export function displayValue(value:number,unit:string,mode:UnitMode):number { return displayUnit(unit,mode)==='元/斤'&&unit!=='元/斤'?value/2:value; }
export function displayPoints(points:Point[],unit:string,mode:UnitMode):Point[] { return points.map(p=>({...p,value:displayValue(p.value,unit,mode),...(p.low!==undefined?{low:displayValue(p.low,unit,mode)}:{}),...(p.high!==undefined?{high:displayValue(p.high,unit,mode)}:{})})); }
export function change(points:Point[]):number|null { return points.length<2||points[0].value===0?null:(points.at(-1)!.value/points[0].value-1)*100; }
export function chartPath(points:Point[],width=900,height=260):string {
 if(points.length<2)return '';
 const values=points.map(p=>p.value), min=Math.min(...values),max=Math.max(...values),spread=max-min||Math.abs(max)*.01||1;
 const start=day(points[0].date),elapsed=day(points.at(-1)!.date)-start;
 return points.map((p,i)=>`${i?'L':'M'}${((elapsed?(day(p.date)-start)/elapsed:i/(points.length-1))*width).toFixed(2)},${(height-12-(p.value-min)/spread*(height-24)).toFixed(2)}`).join(' ');
}
export function freshness(i:Instrument,now=new Date()):string {
 if(!i.points.length)return '待接入';if(i.refreshFailed)return '更新失败 · 保留旧值';
 const age=(now.getTime()-day(i.points.at(-1)!.date))/86400000;
 if(age>(i.sourceKey==='nbs'?25:i.sourceKey==='mara'||i.category==='consumer'?12:i.category==='fx'?7:75))return '数据滞后';
 if(i.refreshPending)return '已核验 · 自动更新待验证';
 return i.sourceKey==='nbs'?'旬度市场均价':i.sourceKey==='mara'?'每日批发均价':i.category==='consumer'?'市场单品均价':i.category==='fx'?'每日参考汇率':'月度历史均价';
}
