export type AShareExchange = 'SSE' | 'SZSE';
export const aSharePresets = [
  {symbol:'SSE:000001',name:'上证指数',type:'指数'},
  {symbol:'SZSE:399001',name:'深证成指',type:'指数'},
  {symbol:'SSE:600519',name:'贵州茅台',type:'个股'},
  {symbol:'SZSE:300750',name:'宁德时代',type:'个股'},
] as const;
export const aShareWidgetScript = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
export function aShareSymbol(exchange:string,code:string):string|null {
  if (!['SSE','SZSE'].includes(exchange) || !/^\d{6}$/.test(code.trim())) return null;
  return `${exchange}:${code.trim()}`;
}
export function aShareSourceUrl(symbol:string):string {
  if (!/^(SSE|SZSE):\d{6}$/.test(symbol)) throw new Error('Invalid A-share symbol');
  return `https://www.tradingview.com/symbols/${symbol.replace(':','-')}/`;
}
export function aShareWidgetConfig(symbol:string) {
  aShareSourceUrl(symbol);
  return {allow_symbol_change:false,calendar:false,details:false,hide_side_toolbar:true,
    hide_top_toolbar:false,hide_legend:false,hide_volume:false,hotlist:false,interval:'D',
    locale:'zh_CN',save_image:true,style:'1',symbol,theme:'dark',timezone:'Asia/Shanghai',
    backgroundColor:'#1b1c1b',gridColor:'rgba(165, 170, 163, 0.12)',watchlist:[],
    withdateranges:true,compareSymbols:[],support_host:'https://www.tradingview.com',studies:[],autosize:true};
}
