import {aSharePresets,aShareSearch,aShareInstrument,cleanAShareRecents,aShareSourceUrl,aShareWidgetConfig,aShareWidgetScript,type AShareRange,type AShareStyle,type AShareInstrument} from './a-share';

export function initASharePanel(){
  const panel=document.querySelector<HTMLElement>('#a-share-panel');
  if(!panel || panel.dataset.initialized) return;
  panel.dataset.initialized='true';
  const get=<T extends HTMLElement>(id:string)=>panel.querySelector<T>(`#${id}`)!;
  const host=get<HTMLDivElement>('a-share-widget'),status=get<HTMLElement>('a-share-status');
  const input=get<HTMLInputElement>('a-share-query'),resultsPanel=get('a-share-results-panel'),results=get('a-share-results');
  const storageKey='ai014.trends.a-share-recent';
  let recents:string[]=[];
  try{recents=cleanAShareRecents(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch{}
  let symbol=recents[0]||'SSE:000001',mountedKey='',attempt=0,group='指数',range:AShareRange='12M',style:AShareStyle='2';
  if(recents.length)group=aShareInstrument(symbol).type==='代码查询'?'recent':aShareInstrument(symbol).type;
  let searchResults:AShareInstrument[]=[];
  const describe=(item:AShareInstrument)=>`${item.symbol.startsWith('SSE:')?'上海':'深圳'} · ${item.symbol.split(':')[1]} · ${item.type}`;
  const closeSearch=()=>{resultsPanel.hidden=true;};
  const makeChoice=(item:AShareInstrument,detail=false)=>{
    const button=document.createElement('button');button.type='button';button.dataset.aShareSymbol=item.symbol;
    button.setAttribute('aria-pressed',String(item.symbol===symbol));
    const name=document.createElement('span');name.textContent=item.name;button.append(name);
    if(detail){const code=document.createElement('small');code.textContent=describe(item);button.append(code);}
    button.addEventListener('click',()=>choose(item.symbol));return button;
  };
  const renderChoices=()=>{
    const choices=get('a-share-choices');choices.replaceChildren();
    const items=group==='recent'?recents.map(aShareInstrument):aSharePresets.filter(p=>p.type===group);
    items.forEach(item=>choices.append(makeChoice(item)));
    choices.setAttribute('aria-label',group==='recent'?'最近看过':group==='指数'?'大盘指数':'常用个股');
    get('a-share-recent-empty').hidden=group!=='recent'||!!items.length;
    panel.querySelectorAll<HTMLButtonElement>('[data-a-share-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aShareGroup===group)));
  };
  const select=(next:string)=>{
    symbol=next;const item=aShareInstrument(symbol);
    get('a-share-current').textContent=item.name;
    get('a-share-current-code').textContent=describe(item);
    get<HTMLAnchorElement>('a-share-source').href=aShareSourceUrl(symbol);
    panel.querySelectorAll<HTMLButtonElement>('[data-a-share-symbol]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aShareSymbol===symbol)));
  };
  const mount=(force=false)=>{
    const key=[symbol,range,style].join('|');
    if(panel.hidden || (!force&&mountedKey===key))return;
    mountedKey=key;const currentAttempt=++attempt;
    host.replaceChildren();
    // Published embed only. Never fetch quotes or inspect the cross-origin frame.
    const container=document.createElement('div');container.className='tradingview-widget-container';
    container.style.height='100%';container.style.width='100%';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';
    widget.style.height='calc(100% - 32px)';widget.style.width='100%';
    const copyright=document.createElement('div');copyright.className='tradingview-widget-copyright';
    const link=document.createElement('a');link.href=aShareSourceUrl(symbol);link.target='_blank';link.rel='noopener nofollow';
    const title=document.createElement('span');title.className='blue-text';title.textContent=`${symbol.split(':')[1]} chart`;link.append(title);
    const trademark=document.createElement('span');trademark.className='trademark';trademark.textContent='\u00a0by TradingView';copyright.append(link,trademark);
    const script=document.createElement('script');script.type='text/javascript';script.src=aShareWidgetScript;script.async=true;
    script.textContent=JSON.stringify(aShareWidgetConfig(symbol,range,style));
    script.onerror=()=>{if(currentAttempt===attempt)status.textContent='图表组件未能加载。请重新加载，或打开下方 TradingView 来源。';};
    // Script/iframe load does not prove market-data availability; never claim that it does.
    status.textContent=`${aShareInstrument(symbol).name} · 由 TradingView 提供。价格、日期及数据状态以图内为准。`;
    container.append(widget,copyright,script);host.append(container);
  };
  const choose=(next:string)=>{
    select(next);recents=cleanAShareRecents([next,...recents]);
    try{localStorage.setItem(storageKey,JSON.stringify(recents));}catch{}
    input.value='';input.blur();closeSearch();renderChoices();mount();
  };
  const renderSearch=()=>{
    searchResults=aShareSearch(input.value);results.replaceChildren();
    if(!input.value.trim()){closeSearch();return;}
    resultsPanel.hidden=false;searchResults.forEach(item=>results.append(makeChoice(item,true)));
    get('a-share-results-status').textContent=searchResults.length>1&&/^\d{6}$/.test(input.value.normalize('NFKC').trim())?'同一代码可能属于不同交易所，请选择':searchResults.length?`找到 ${searchResults.length} 项，点选查看`:'常用名称表未收录。请改用6位代码，如 600519';
  };
  const setCategory=(category:string)=>{
    panel.hidden=category!=='a';
    panel.closest('.trends')?.classList.toggle('is-a-share',category==='a');
    if(category==='a')mount();
    else{closeSearch();if(mountedKey){attempt++;host.replaceChildren();mountedKey='';}}
  };
  panel.querySelectorAll<HTMLButtonElement>('[data-a-share-group]').forEach(button=>button.addEventListener('click',()=>{group=button.dataset.aShareGroup!;renderChoices();}));
  panel.querySelectorAll<HTMLButtonElement>('[data-a-share-range]').forEach(button=>button.addEventListener('click',()=>{
    range=button.dataset.aShareRange as AShareRange;
    panel.querySelectorAll<HTMLButtonElement>('[data-a-share-range]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));mount();
  }));
  get<HTMLSelectElement>('a-share-view').addEventListener('change',event=>{
    const view=(event.target as HTMLSelectElement).value;
    style=view==='line'?'2':'1';mount();
  });
  input.addEventListener('input',renderSearch);input.addEventListener('focus',()=>{if(input.value.trim())renderSearch();});
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&!resultsPanel.hidden){event.preventDefault();results.querySelector<HTMLButtonElement>('button')?.focus();}});
  get<HTMLFormElement>('a-share-search').addEventListener('submit',event=>{
    event.preventDefault();renderSearch();
    if(searchResults.length===1)choose(searchResults[0].symbol);
    else if(!input.value.trim()){input.focus();}
  });
  get('a-share-search-close').addEventListener('click',()=>{input.value='';closeSearch();input.focus();});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!resultsPanel.hidden){input.value='';closeSearch();input.focus();}});
  document.addEventListener('pointerdown',event=>{if(!(event.target instanceof Node)||!get('a-share-search').parentElement?.contains(event.target))closeSearch();});
  get<HTMLButtonElement>('a-share-retry').addEventListener('click',()=>mount(true));
  get<HTMLButtonElement>('a-share-expand').addEventListener('click',()=>{
    const expanded=panel.classList.toggle('a-share-expanded');
    get('a-share-expand').textContent=expanded?'收起图表':'放大图表';get('a-share-expand').setAttribute('aria-pressed',String(expanded));
    get('a-share-chart').scrollIntoView({behavior:'instant',block:'start'});
  });
  document.addEventListener('trends:category-change',event=>setCategory((event as CustomEvent<string>).detail));
  renderChoices();select(symbol);
  setCategory(document.querySelector<HTMLButtonElement>('[data-category][aria-pressed="true"]')?.dataset.category||'consumer');
}
