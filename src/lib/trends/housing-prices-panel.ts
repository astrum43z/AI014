import {validateHousingPrices,priceText,supportsNationalPrice,type HousingPrices} from './housing-prices';
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const data:HousingPrices=validateHousingPrices(JSON.parse(get('housing-price-data').textContent!));
let mode=new URLSearchParams(location.search).get('market'),region={province:'',city:'',district:''};
const slider=get<HTMLInputElement>('housing-price-slider');
function inspect(index:number){
 const point=data.annual[index];if(!point)return;
 get('housing-price-value').textContent=priceText(point);get('housing-price-year').textContent=point.period+'年';
 get<HTMLAnchorElement>('housing-price-source').href=point.sourceUrl;
 slider.value=String(index);slider.setAttribute('aria-valuetext',`${point.period}年，${priceText(point)}元每平方米`);
 document.querySelectorAll<SVGCircleElement>('[data-price-point]').forEach(dot=>dot.classList.toggle('active',Number(dot.dataset.pricePoint)===index));
}
function render(){
 get('housing-price-primary').hidden=mode!=='housing';get('rent-price-primary').hidden=mode!=='rent';
 get('housing-price-results').hidden=!supportsNationalPrice(region);get('housing-price-unavailable').hidden=supportsNationalPrice(region);
}
slider.addEventListener('input',()=>inspect(Number(slider.value)));
document.querySelectorAll<SVGCircleElement>('[data-price-point]').forEach(dot=>{dot.addEventListener('pointerenter',()=>inspect(Number(dot.dataset.pricePoint)));dot.addEventListener('click',()=>inspect(Number(dot.dataset.pricePoint)));});
get('housing-price-clear').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('trends:region-reset')));
document.addEventListener('trends:category-change',((event:CustomEvent<string>)=>{if(mode!==event.detail)get<HTMLDetailsElement>('index-optional').open=false;mode=event.detail;render();}) as EventListener);
document.addEventListener('trends:region-change',((event:CustomEvent<typeof region>)=>{region=event.detail;render();}) as EventListener);
document.addEventListener('trends:region-reset',()=>{region={province:'',city:'',district:''};render();});
render();
