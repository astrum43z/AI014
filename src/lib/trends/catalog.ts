import snapshot from '../../data/trends.json';
import type { Instrument } from './model';
import { nationalProduceBootstrap } from './national-produce';
const stored=(snapshot.instruments as Instrument[]).filter(i=>i.sourceKey!=='chaoyang'&&!i.id.startsWith('cn-chaoyang-')); 
const storedIds=new Set(stored.map(i=>i.id));
const resolvedSnapshot=[...stored,...nationalProduceBootstrap.filter(i=>!storedIds.has(i.id))];
const pending = (id:string,name:string,category:string,symbol:string,unit:string,source:string,sourceUrl:string,coverage:string):Instrument=>({id,name,category,symbol,unit,source,sourceUrl,coverage,points:[],frequency:'尚未接入'});
export const instruments:Instrument[] = [
 ...resolvedSnapshot.filter(i=>!['cn-mara-6','cn-mara-7'].includes(i.id)),
 pending('hsi','恒生指数','hk','HSI','指数点','恒生指数','https://www.hsi.com.hk/','港股入口已建立；待接入许可范围明确的指数与个股历史行情。'),
 pending('sp500','标普 500','us','SPX','指数点','S&P Dow Jones Indices','https://www.spglobal.com/spdji/','美股入口已建立；待接入许可范围明确的指数与个股历史行情。'),
 ...(!snapshot.instruments.some((x:Instrument)=>x.category==='metal') ? [pending('gold','黄金','metal','XAU','美元/金衡盎司','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','月度国际参考价，非实时交易报价。等待导入可核实历史数据。'),pending('silver','白银','metal','XAG','美元/金衡盎司','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','月度国际参考价，非实时交易报价。等待导入可核实历史数据。')] : []),
 ...(!snapshot.instruments.some((x:Instrument)=>x.category==='fx') ? [pending('eur-usd','欧元 / 美元','fx','EUR/USD','USD / EUR','欧洲中央银行','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','每日参考汇率，非可成交报价。等待历史数据导入。')] : [])
];
export const retrievedAt = snapshot.retrievedAt;

const refreshStatus = {...(snapshot as { refreshStatus?: Record<string, {status: string}> }).refreshStatus};
if(!refreshStatus.mofcom)refreshStatus.mofcom={status:'verified-snapshot'};
for (const instrument of instruments) {
 instrument.refreshPending = refreshStatus?.[instrument.sourceKey || '']?.status==='verified-snapshot';
 instrument.refreshFailed = refreshStatus?.[instrument.sourceKey || (instrument.category==='fx'?'ecb':'worldbank')]?.status==='error';
}
export const worldBankVintage = snapshot.instruments.find(i=>i.category==='metal')?.points.at(-1)?.date.slice(0,7);
export const worldBankPublished = (snapshot.instruments.find(i=>i.category==='metal') as Instrument | undefined)?.sourceUpdatedAt;


export const nationalProduceRefreshPending = refreshStatus?.mofcom?.status==='verified-snapshot';

const nationalProduce = resolvedSnapshot.filter(i=>i.sourceKey==='mofcom');
export const nationalProduceCount = nationalProduce.length;
export const nationalProduceObservationCount = nationalProduce.reduce((n,i)=>n+i.points.length,0);
export const nationalProduceStart = nationalProduce.flatMap(i=>i.points.map(p=>p.date)).sort()[0];
export const nationalProduceEnd = nationalProduce.flatMap(i=>i.points.map(p=>p.date)).sort().at(-1);
