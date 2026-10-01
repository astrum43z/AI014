export type AShareExchange = 'SSE' | 'SZSE';
export type AShareInstrument = {symbol:string;name:string;type:string;aliases?:string};
// A small, verified navigation directory, not a full-market security master or quote feed.
// Name/code mapping sources are recorded in docs/a-share-widgets.md.
export const aSharePresets:AShareInstrument[] = [
  {symbol:'SSE:000001',name:'上证指数',type:'指数',aliases:'上证 大盘 沪指 shangzheng szzs'},
  {symbol:'SZSE:399001',name:'深证成指',type:'指数',aliases:'深成指 深证 shenzheng szcz'},
  {symbol:'SZSE:399006',name:'创业板指',type:'指数',aliases:'创业板 chuangyeban cyb'},
  {symbol:'SSE:000300',name:'沪深300',type:'指数',aliases:'沪深300指数 hs300 hushen300'},
  {symbol:'SSE:000016',name:'上证50',type:'指数',aliases:'上证50指数 sz50 shangzheng50'},
  {symbol:'SSE:600519',name:'贵州茅台',type:'个股',aliases:'茅台 maotai gzmt'},
  {symbol:'SZSE:300750',name:'宁德时代',type:'个股',aliases:'宁德 ningde ndsd catl'},
  {symbol:'SZSE:002594',name:'比亚迪',type:'个股',aliases:'biyadi byd'},
  {symbol:'SZSE:000001',name:'平安银行',type:'个股',aliases:'平安 pinganyinhang payh'},
  {symbol:'SSE:601318',name:'中国平安',type:'个股',aliases:'平安 zhongguopingan zgpa'},
  {symbol:'SSE:600036',name:'招商银行',type:'个股',aliases:'招商 招行 zhaoshangyinhang zsyh'},
  {symbol:'SZSE:000858',name:'五粮液',type:'个股',aliases:'wuliangye wly'},
  {symbol:'SZSE:000333',name:'美的集团',type:'个股',aliases:'美的 meidi mdjt'},
];
// The provider maps 3M to intraday bars, which EOD symbols cannot serve.
export const aShareRanges = [['12M','近1年'],['60M','近5年'],['ALL','全部']] as const;
export type AShareRange = typeof aShareRanges[number][0];
export type AShareStyle = '2' | '1';
export const aShareWidgetScript = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
export function aShareSymbol(exchange:string,code:string):string|null {
  if (!['SSE','SZSE'].includes(exchange) || !/^\d{6}$/.test(code.trim())) return null;
  return `${exchange}:${code.trim()}`;
}
export function validAShareSymbol(value:unknown):value is string {
  return typeof value==='string' && /^(SSE|SZSE):\d{6}$/.test(value);
}
export function aShareInstrument(symbol:string):AShareInstrument {
  if(!validAShareSymbol(symbol))throw new Error('Invalid A-share symbol');
  return aSharePresets.find(p=>p.symbol===symbol)||{symbol,name:`${symbol.startsWith('SSE:')?'上海':'深圳'} ${symbol.split(':')[1]}`,type:'代码查询'};
}
export function aShareSearch(query:string):AShareInstrument[] {
  const q=query.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'');
  if(!q)return [];
  const prefix=q.match(/^(sse|szse|sh|sz|沪|深):?(\d{6})$/),suffix=q.match(/^(\d{6})\.(sh|sz)$/);
  if(prefix||suffix){const market=prefix?prefix[1]:suffix![2],code=prefix?prefix[2]:suffix![1];const exchange=['sse','sh','沪'].includes(market)?'SSE':'SZSE';return [aShareInstrument(`${exchange}:${code}`)];}
  if(/^\d{6}$/.test(q)){
    const known=aSharePresets.filter(p=>p.symbol.endsWith(`:${q}`));
    // A bare 000xxx may mean a Shanghai index or a Shenzhen stock. Never guess.
    if(known.length===1&&!q.startsWith('000'))return known;
    return ['SSE','SZSE'].map(exchange=>aShareInstrument(`${exchange}:${q}`));
  }
  return aSharePresets.filter(p=>`${p.name}${p.symbol}${p.aliases||''}`.toLowerCase().replace(/\s+/g,'').includes(q)).slice(0,8);
}
export function cleanAShareRecents(value:unknown):string[] {
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter(validAShareSymbol))].slice(0,5);
}
export function aShareSourceUrl(symbol:string):string {
  if (!validAShareSymbol(symbol)) throw new Error('Invalid A-share symbol');
  return `https://www.tradingview.com/symbols/${symbol.replace(':','-')}/`;
}
export function aShareWidgetConfig(symbol:string,range:AShareRange='12M',style:AShareStyle='2') {
  aShareSourceUrl(symbol);
  if(!aShareRanges.some(([value])=>value===range)||!['1','2'].includes(style))throw new Error('Invalid A-share chart setting');
  return {allow_symbol_change:false,calendar:false,details:false,hide_side_toolbar:true,
    hide_top_toolbar:true,hide_legend:false,hide_volume:true,hotlist:false,interval:'D',range,
    locale:'zh_CN',save_image:false,style,symbol,theme:'dark',timezone:'Asia/Shanghai',
    backgroundColor:'#1b1c1b',gridColor:'rgba(165, 170, 163, 0.12)',watchlist:[],
    withdateranges:false,compareSymbols:[],support_host:'https://www.tradingview.com',studies:[],autosize:true};
}
