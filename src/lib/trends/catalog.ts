import snapshot from '../../data/trends.json';
import type { Instrument } from './model';
const pending = (id:string,name:string,category:string,symbol:string,unit:string,source:string,sourceUrl:string,coverage:string):Instrument=>({id,name,category,symbol,unit,source,sourceUrl,coverage,points:[],frequency:'尚未接入'});
export const instruments:Instrument[] = [
 ...snapshot.instruments as Instrument[],
 pending('housing','全国住宅价格','housing','HOUSING','指数','国家统计局','https://www.stats.gov.cn/sj/','国家统计局公开住宅价格指数覆盖 70 个大中城市，不是全国均价。尚未导入历史序列；省级汇总及区县需额外来源。'),
 pending('rent','全国住宅租金','rent','RENT','元/月','待确定授权数据源','https://www.stats.gov.cn/sj/','尚无已接入的全国省、市、区县统一租金序列。不能把住宅价格指数或租赁挂牌价当作实际成交租金。'),
 pending('csi300','沪深 300','a','000300','指数点','中证指数','https://www.csindex.com.cn/','A 股入口已建立；待接入许可范围明确的指数与个股历史行情。'),
 pending('hsi','恒生指数','hk','HSI','指数点','恒生指数','https://www.hsi.com.hk/','港股入口已建立；待接入许可范围明确的指数与个股历史行情。'),
 pending('sp500','标普 500','us','SPX','指数点','S&P Dow Jones Indices','https://www.spglobal.com/spdji/','美股入口已建立；待接入许可范围明确的指数与个股历史行情。'),
 pending('consumer','消费商品价格','consumer','CONSUMER','依商品规格','待确定商品与授权来源','https://www.stats.gov.cn/sj/','需按品牌、型号、规格、渠道记录实际价格。CPI 不能替代单件商品价格；目前没有已核实的商品报价。'),
 ...(!snapshot.instruments.some((x:Instrument)=>x.category==='metal') ? [pending('gold','黄金','metal','XAU','美元/金衡盎司','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','月度国际参考价，非实时交易报价。等待导入可核实历史数据。'),pending('silver','白银','metal','XAG','美元/金衡盎司','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','月度国际参考价，非实时交易报价。等待导入可核实历史数据。')] : []),
 ...(!snapshot.instruments.some((x:Instrument)=>x.category==='commodity') ? [pending('crude','原油','commodity','BRENT','美元/桶','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','大宗商品采用月度国际参考价，等待历史序列导入。'),pending('copper','铜','commodity','COPPER','美元/吨','世界银行 Pink Sheet','https://www.worldbank.org/en/research/commodity-markets','大宗商品采用月度国际参考价，等待历史序列导入。')] : []),
 ...(!snapshot.instruments.some((x:Instrument)=>x.category==='fx') ? [pending('eur-usd','欧元 / 美元','fx','EUR/USD','USD / EUR','欧洲中央银行','https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','每日参考汇率，非可成交报价。等待历史数据导入。')] : [])
];
export const retrievedAt = snapshot.retrievedAt;
