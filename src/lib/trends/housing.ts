export type IndexMetric='mom'|'yoy';
export type HousingKind='new'|'resale';
export type IndexMode='housing'|'rent';
export type IndexRange='all'|'3'|'2025'|'2026';
export type MonthlySource={month:string;publishedAt:string;sourceUrl:string;baseYear:number};
export type HousingMonth=MonthlySource & {new:(number|null)[][];resale:(number|null)[][]};
export type RentMonth=MonthlySource & {mom:number;yoy:number;ytd:number|null};
export type HousingSnapshot={schemaVersion:number;retrievedAt:string;updateMode:string;termsUrl:string;baseMethodUrls:string[];cities:string[];housing:HousingMonth[];rent:RentMonth[]};
export type IndexPoint=MonthlySource & {value:number;mom:number;yoy:number;ytd:number|null};
export type Region={province:string;city:string;district:string};
const groups:Record<string,string>={北京:'北京',天津:'天津',河北:'石家庄 唐山 秦皇岛',山西:'太原',内蒙古:'呼和浩特 包头',辽宁:'沈阳 大连 丹东 锦州',吉林:'长春 吉林',黑龙江:'哈尔滨 牡丹江',上海:'上海',江苏:'南京 无锡 徐州 扬州',浙江:'杭州 宁波 温州 金华',安徽:'合肥 蚌埠 安庆',福建:'福州 厦门 泉州',江西:'南昌 九江 赣州',山东:'济南 青岛 烟台 济宁',河南:'郑州 洛阳 平顶山',湖北:'武汉 宜昌 襄阳',湖南:'长沙 岳阳 常德',广东:'广州 深圳 韶关 湛江 惠州',广西:'南宁 桂林 北海',海南:'海口 三亚',重庆:'重庆',四川:'成都 泸州 南充',贵州:'贵阳 遵义',云南:'昆明 大理',陕西:'西安',甘肃:'兰州',青海:'西宁',宁夏:'银川',新疆:'乌鲁木齐'};
export const provinceForCity=Object.fromEntries(Object.entries(groups).flatMap(([province,names])=>names.split(' ').map(city=>[city,province])));
export function resolveRegion(cities:string[],mode:IndexMode,region:Region):{supported:boolean;city?:string;reason?:string}{
 const label=[region.province,region.city,region.district].filter(Boolean).join(' / ');
 if(!label)return {supported:true};
 if(mode==='rent')return {supported:false,reason:`所选地区：${label}。目前只有全国租赁房房租 CPI 分项，没有该地区的租金序列；全国值不会充当当地租金。`};
 if(region.district)return {supported:false,reason:`所选地区：${label}。区县级数据尚未接入；70城数据是各城市市辖区的整体指数，不是单个区县数据。`};
 const city=region.city.replace(/市$/,'');
 if(!city)return {supported:false,reason:`所选地区：${label}。没有省级汇总指数，请选择已覆盖的70个城市之一。`};
 if(!cities.includes(city))return {supported:false,reason:`所选地区：${label}。该城市不在当前已核验的70城序列中。`};
 const province=region.province.replace(/(?:壮族|回族|维吾尔)?自治区$|省$|市$/g,'');
 if(province&&provinceForCity[city]!==province)return {supported:false,reason:`所选地区：${label}。省市名称不匹配，请重新选择；不会用其他地区的数据替代。`};
 return {supported:true,city};
}
const official=(url:string)=>/^https:\/\/www\.stats\.gov\.cn\/(?:sj\/(?:zxfb|zxfbhjd)|xxgk\/sjfb\/zxfb2020|zwfwck\/sjfb)\/\d{6}\/t\d{8}_\d+\.html$/.test(url);
export function validateHousing(data:HousingSnapshot):void{
 if(data.schemaVersion!==1||data.cities.length!==70||new Set(data.cities).size!==70||data.cities.some(c=>!provinceForCity[c]))throw Error('Invalid 70-city coverage');
 for(const mode of ['housing','rent'] as const){
  const months=data[mode];if(months.length!==12)throw Error('Need twelve observed months');
  months.forEach((m,index)=>{
   const expected=new Date(Date.UTC(2025,8+index,1)).toISOString().slice(0,7);
   if(m.month!==expected||m.publishedAt.slice(0,7)<=m.month||m.publishedAt>data.retrievedAt||!official(m.sourceUrl))throw Error('Invalid period or provenance');
   if(m.baseYear!==(m.month<'2026-01'?2020:2025))throw Error('Incorrect base regime');
   const rows=mode==='housing'?[...(m as HousingMonth).new,...(m as HousingMonth).resale]:[[(m as RentMonth).mom,(m as RentMonth).yoy,(m as RentMonth).ytd]];
   if(mode==='housing'&&((m as HousingMonth).new.length!==70||(m as HousingMonth).resale.length!==70))throw Error('Incomplete city table');
   for(const row of rows){if(row.length!==3||row.slice(0,2).some(n=>typeof n!=='number'||!Number.isFinite(n)||(mode==='housing'&&n<=0)))throw Error('Invalid index values');if(m.month.endsWith('-01')?row[2]!==null:typeof row[2]!=='number'||!Number.isFinite(row[2]))throw Error('Invalid year-to-date field');}
  });
 }
}
export function indexSeries(data:HousingSnapshot,mode:IndexMode,city:string,kind:HousingKind,metric:IndexMetric,range:IndexRange='all'):IndexPoint[]{
 const cityIndex=data.cities.indexOf(city);if(mode==='housing'&&cityIndex<0)return [];
 const rows:IndexPoint[]=mode==='housing'?data.housing.map(m=>{const [mom,yoy,ytd]=m[kind][cityIndex];return {...m,value:(metric==='mom'?mom:yoy)!,mom:mom!,yoy:yoy!,ytd};}):data.rent.map(m=>({...m,value:m[metric]}));
 return range==='all'?rows:range==='3'?rows.slice(-3):rows.filter(p=>p.month.startsWith(range));
}
export function nativeRate(point:IndexPoint,mode:IndexMode,metric:IndexMetric):number{return mode==='housing'?Math.round((point[metric]-100)*10)/10:point[metric];}
export function indexGeometry(points:IndexPoint[],baseline:number,width=650,height=180){
 if(!points.length)return {paths:[] as string[],dots:[] as {x:number;y:number}[],breakX:null as number|null,min:baseline-1,max:baseline+1,baselineY:height/2};
 const rawMin=Math.min(baseline,...points.map(p=>p.value)),rawMax=Math.max(baseline,...points.map(p=>p.value)),pad=(rawMax-rawMin||1)*.12;
 const min=rawMin-pad,max=rawMax+pad;const time=(s:string)=>Date.parse(s+'-01T00:00:00Z');const start=time(points[0].month),elapsed=time(points.at(-1)!.month)-start;
 const dots=points.map(p=>({x:elapsed?(time(p.month)-start)/elapsed*width:width/2,y:height-(p.value-min)/(max-min)*height}));
 const paths:string[]=[];let current='';let breakX:number|null=null;
 points.forEach((p,i)=>{const split=i===0||p.baseYear!==points[i-1].baseYear;if(split&&current){paths.push(current);current='';breakX=(dots[i-1].x+dots[i].x)/2;}current+=`${split?'M':'L'}${dots[i].x.toFixed(2)},${dots[i].y.toFixed(2)} `;});if(current)paths.push(current.trim());
 return {paths,dots,breakX,min,max,baselineY:height-(baseline-min)/(max-min)*height};
}
