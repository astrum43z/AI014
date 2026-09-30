export type Point = { date: string; value: number };
export type Instrument = { id: string; name: string; category: string; symbol: string; unit: string; source: string; sourceUrl: string; coverage: string; points: Point[]; frequency: string };
export const categories = [ ['all','全部市场'], ['housing','全国房价'], ['rent','全国租金'], ['a','A 股'], ['hk','港股'], ['us','美股'], ['consumer','消费商品'], ['commodity','大宗商品'], ['metal','黄金白银'], ['fx','外汇'] ];
export const provinces = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港','澳门','台湾'];
export function windowPoints(points: Point[], months: number): Point[] {
 if (!points.length || !months) return points;
 const end = new Date(points.at(-1)!.date+'T00:00:00Z'); end.setUTCMonth(end.getUTCMonth()-months);
 return points.filter(p=>new Date(p.date+'T00:00:00Z')>=end);
}
export function change(points: Point[]): number | null { return points.length<2 || points[0].value===0 ? null : (points.at(-1)!.value/points[0].value-1)*100; }
export function chartPath(points: Point[], width=900, height=260): string {
 if(points.length<2)return '';
 const values=points.map(p=>p.value); const min=Math.min(...values), max=Math.max(...values), spread=max-min || Math.abs(max)*.01 || 1;
 return points.map((p,i)=>`${i?'L':'M'}${(i/(points.length-1)*width).toFixed(2)},${(height-12-(p.value-min)/spread*(height-24)).toFixed(2)}`).join(' ');
}
