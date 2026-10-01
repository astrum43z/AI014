export type PriceObservation={period:string;periodType:'annual'|'year-to-date';publishedAt:string;areaWanSqm:number;amountYiYuan:number;sourceUrl:string;sha256:string};
export type HousingPrices={schemaVersion:1;retrievedAt:string;sourceName:string;termsUrl:string;methodUrl:string;annual:PriceObservation[];latestYtd:PriceObservation};
export const meanPrice=(point:PriceObservation)=>point.amountYiYuan/point.areaWanSqm*10000;
export const priceText=(point:PriceObservation)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(meanPrice(point));
export function validateHousingPrices(data:HousingPrices){
 if(data.schemaVersion!==1||data.annual.length!==12)throw new Error('Expected 12 official annual prices');
 const check=(p:PriceObservation)=>{
  if(!Number.isFinite(p.areaWanSqm)||p.areaWanSqm<=0||!Number.isFinite(p.amountYiYuan)||p.amountYiYuan<=0)throw new Error('Invalid price inputs');
  if(!/^https:\/\/www\.stats\.gov\.cn\//.test(p.sourceUrl)||!/^[a-f0-9]{64}$/.test(p.sha256)||!/^\d{4}-\d{2}-\d{2}$/.test(p.publishedAt))throw new Error('Missing official provenance');
  if(!Number.isFinite(meanPrice(p)))throw new Error('Invalid mean price');
 };
 data.annual.forEach((p,i)=>{check(p);if(p.periodType!=='annual'||p.period!==String(2014+i)||p.publishedAt<=p.period+'-12-31')throw new Error('Invalid annual period');});
 check(data.latestYtd);if(data.latestYtd.periodType!=='year-to-date'||data.latestYtd.period!=='2026-01/2026-08')throw new Error('YTD must remain separate');
 return data;
}
export function priceGeometry(points:PriceObservation[],width=640,height=190){
 if(!points.length)return {min:0,max:1,path:'',dots:[]};
 if(points.some(p=>p.periodType!=='annual'))throw new Error('Only full years belong in annual chart');
 const values=points.map(meanPrice),min=Math.floor(Math.min(...values)/1000)*1000,max=Math.ceil(Math.max(...values)/1000)*1000+500;
 const first=Number(points[0].period),last=Number(points.at(-1)!.period);
 const dots=points.map((p,i)=>({x:(Number(p.period)-first)/(last-first||1)*width,y:(max-values[i])/(max-min)*height}));
 const path=dots.map((d,i)=>`${i?'L':'M'}${d.x.toFixed(2)},${d.y.toFixed(2)}`).join(' ');
 return {min,max,path,dots};
}
export function supportsNationalPrice(region:{province?:string;city?:string;district?:string}){return !region.province&&!region.city&&!region.district;}
