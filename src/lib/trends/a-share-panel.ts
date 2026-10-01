import {aSharePresets,aShareSymbol,aShareSourceUrl,aShareWidgetConfig,aShareWidgetScript} from './a-share';

export function initASharePanel(){
  const panel=document.querySelector<HTMLElement>('#a-share-panel');
  if(!panel || panel.dataset.initialized) return;
  panel.dataset.initialized='true';
  const get=<T extends HTMLElement>(id:string)=>panel.querySelector<T>(`#${id}`)!;
  const host=get<HTMLDivElement>('a-share-widget'),status=get<HTMLElement>('a-share-status');
  let symbol='SSE:000001',mountedSymbol='',attempt=0;
  const select=(next:string)=>{
    symbol=next;
    const [exchange,code]=symbol.split(':');
    get<HTMLSelectElement>('a-share-exchange').value=exchange;
    get<HTMLInputElement>('a-share-code').value=code;
    const preset=aSharePresets.find(p=>p.symbol===symbol);
    get('a-share-current').textContent=`${preset?.name || (exchange==='SSE'?'上海':'深圳')+' '+code} · ${symbol}`;
    get<HTMLAnchorElement>('a-share-source').href=aShareSourceUrl(symbol);
    panel.querySelectorAll<HTMLButtonElement>('[data-a-share-symbol]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aShareSymbol===symbol)));
  };
  const mount=(force=false)=>{
    if(panel.hidden || (!force&&mountedSymbol===symbol))return;
    mountedSymbol=symbol;
    const currentAttempt=++attempt;
    host.replaceChildren();
    // Use the provider's published embed contract. No quote API or iframe extraction.
    const container=document.createElement('div');container.className='tradingview-widget-container';
    container.style.height='100%';container.style.width='100%';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';
    widget.style.height='calc(100% - 32px)';widget.style.width='100%';
    const copyright=document.createElement('div');copyright.className='tradingview-widget-copyright';
    const link=document.createElement('a');link.href=aShareSourceUrl(symbol);link.target='_blank';link.rel='noopener nofollow';
    const title=document.createElement('span');title.className='blue-text';title.textContent=`${symbol.split(':')[1]} chart`;link.append(title);
    const trademark=document.createElement('span');trademark.className='trademark';trademark.textContent='\u00a0by TradingView';copyright.append(link,trademark);
    const script=document.createElement('script');script.type='text/javascript';script.src=aShareWidgetScript;script.async=true;
    script.textContent=JSON.stringify(aShareWidgetConfig(symbol));
    script.onerror=()=>{if(currentAttempt===attempt)status.textContent='TradingView 组件未能加载。请重试，或使用下方来源链接查看；没有生成替代价格或曲线。';};
    // Script/iframe load is not proof of market-data availability. Keep the status factual.
    status.textContent='日线图表由 TradingView 直接提供。价格、数据日期及休市状态以图表内标注为准；若未显示，可使用下方来源链接。';
    container.append(widget,copyright,script);host.append(container);
  };
  const setCategory=(category:string)=>{
    panel.hidden=category!=='a';
    if(category==='a')mount();
    else if(mountedSymbol){attempt++;host.replaceChildren();mountedSymbol='';}
  };
  panel.querySelectorAll<HTMLButtonElement>('[data-a-share-symbol]').forEach(button=>button.addEventListener('click',()=>{select(button.dataset.aShareSymbol!);mount();}));
  get<HTMLFormElement>('a-share-search').addEventListener('submit',event=>{
    event.preventDefault();
    const next=aShareSymbol(get<HTMLSelectElement>('a-share-exchange').value,get<HTMLInputElement>('a-share-code').value);
    if(!next){status.textContent='请选择上海或深圳交易所，并输入完整的6位代码。';return;}
    select(next);mount();
  });
  get<HTMLButtonElement>('a-share-retry').addEventListener('click',()=>mount(true));
  document.addEventListener('trends:category-change',event=>setCategory((event as CustomEvent<string>).detail));
  setCategory(document.querySelector<HTMLButtonElement>('[data-category][aria-pressed="true"]')?.dataset.category||'consumer');
}
