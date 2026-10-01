"""Parse only official mainland public statistical bulletins. No price conversion or interpolation."""
import calendar, datetime, hashlib, html, json, math, re, urllib.parse
NBS_INDEX='https://www.stats.gov.cn/sj/zxfb/'
MARA_INDEX='https://scs.moa.gov.cn/jcyj/index.htm'
FOODS=['猪肉','牛肉','羊肉','鸡蛋','白条鸡','28种蔬菜','6种水果','鲫鱼','鲤鱼','白鲢鱼','大带鱼']

def plain(raw):
 text=raw.decode('utf-8') if isinstance(raw,bytes) else raw
 return html.unescape(re.sub('<[^>]+>','',text))

def parse_nbs(raw,url,asof):
 text=plain(raw)
 match=re.search(r'(20\d{2})年(\d{1,2})月([上中下])旬流通领域重要生产资料市场价格变动情况',text)
 if not match: raise ValueError('Missing NBS period')
 year,month,period=match.groups();day={'上':10,'中':20,'下':calendar.monthrange(int(year),int(month))[1]}[period]
 date=f'{year}-{int(month):02d}-{day:02d}'
 if date>asof: raise ValueError('Future period')
 published=re.search(r'(20\d{2})/(\d{2})/(\d{2})',text)
 if not published:raise ValueError('Missing NBS publication date')
 published='-'.join(published.groups())
 if published>asof:raise ValueError('Future publication')
 rows=re.findall(r'<tr\b[^>]*>(.*?)</tr>',raw.decode('utf-8') if isinstance(raw,bytes) else raw,re.S|re.I)
 result=[];seen=set()
 for row in rows:
  cells=[re.sub(r'\s+','',plain(x)) for x in re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S|re.I)]
  if len(cells)!=5 or cells[1] not in ('吨','千克') or not re.fullmatch(r'\d+(?:\.\d+)?',cells[2]):continue
  name,unit,value=cells[:3]
  if name in seen:continue
  seen.add(name);id='cn-nbs-'+hashlib.sha256(name.encode()).hexdigest()[:10]
  result.append(dict(id=id,name=name,category='commodity',symbol='中国大陆 · '+name.split('（')[0],unit='元/'+unit,source='国家统计局 · 流通领域',sourceKey='nbs',sourceUrl=url,sourceUpdatedAt=published,frequency='旬度 · 流通领域市场均价',coverage='中国大陆31省区市流通领域监测。经营企业批发和销售价格，含流通费用、利润及税费；不是期货价、出厂价或零售价。规格见品种名称。每点日期为该旬末日，代表整旬均价；仅显示已核实公告，未补齐的历史不插值。',points=[dict(date=date,value=float(value),sourceUrl=url)],retrievedAt=asof))
 if len(result)!=50:raise ValueError(f'Expected 50 NBS products, got {len(result)}')
 return result

def parse_mara(raw,url,asof):
 text=re.sub(r'\s+','',plain(raw))
 match=re.search(r'日期[：:](20\d{2}-\d{2}-\d{2})',text)
 if not match:raise ValueError('Missing MARA date')
 date=match[1]
 if date>asof:raise ValueError('Future report')
 result=[]
 for n,name in enumerate(FOODS):
  match=re.search(re.escape(name)+r'(?:平均价格为)?(\d+(?:\.\d+)?)元/公斤',text)
  if not match:raise ValueError('Missing food '+name)
  result.append(dict(id='cn-mara-'+str(n+1),name=name+('均价' if '种' in name else ''),category='consumer',symbol='中国大陆 · 农产品批发',unit='元/公斤',source='农业农村部 · 全国农产品批发市场',sourceKey='mara',sourceUrl=url,sourceUpdatedAt=date,frequency='工作日 · 14:00批发均价',coverage='中国大陆全国农产品批发市场监测均价。截至公告日14:00；不是超市零售价或指定品牌、等级、包装的SKU报价。蔬菜与水果为监测篮子均价，其他为公告品类均价。仅显示已核实公告，缺失日期不插值。',points=[dict(date=date,value=float(match[1]),sourceUrl=url)],retrievedAt=asof))
 return result

def merge(old,new):
 previous={i['id']:i for i in old};out=[]
 for item in new:
  before=previous.get(item['id'])
  if before:
   if before['unit']!=item['unit']:raise ValueError('Unit changed')
   points={p['date']:p for p in before['points']};points.update({p['date']:p for p in item['points']})
   item={**item,'points':sorted(points.values(),key=lambda p:p['date'])}
   if item['points'][-1]['date']<before['points'][-1]['date']:raise ValueError('Vintage regressed')
  if not all(math.isfinite(p['value']) and p['value']>0 for p in item['points']):raise ValueError('Invalid value')
  out.append(item)
 if previous and set(previous)!={i['id'] for i in out}:raise ValueError('Coverage changed')
 return out

def discover(raw,index,source):
 allowed=urllib.parse.urlparse(index).hostname;found=[]
 text=raw.decode('utf-8') if isinstance(raw,bytes) else raw
 for href,title in re.findall(r'<a\b[^>]*href=[\"\']([^\"\']+)[\"\'][^>]*>(.*?)</a>',text,re.S|re.I):
  title=plain(title);url=urllib.parse.urljoin(index,html.unescape(href));p=urllib.parse.urlparse(url)
  if p.scheme!='https' or p.hostname!=allowed:continue
  if (source=='nbs' and '流通领域重要生产资料市场价格变动情况' in title) or (source=='mara' and '农产品批发价格200指数' in title):
   if url not in found:found.append(url)
 return found[:6]

def refresh_source(old,source,asof,download,archive=None):
 index=NBS_INDEX if source=='nbs' else MARA_INDEX
 urls=discover(download(index),index,source)
 if not urls:raise ValueError('No official bulletin links')
 result=old
 for url in reversed(urls):
  stamp=re.search(r'/t(20\d{6})_',url)
  if old and stamp:
   published='-'.join((stamp[1][:4],stamp[1][4:6],stamp[1][6:]))
   if published<=max(i.get('sourceUpdatedAt','') for i in old):continue
  raw=download(url);items=(parse_nbs if source=='nbs' else parse_mara)(raw,url,asof)
  if old and items[0]['points'][-1]['date']<old[0]['points'][0]['date']:continue
  result=merge(result,items)
  if archive is not None:
   archive.mkdir(parents=True,exist_ok=True)
   (archive/(source+'-'+hashlib.sha256(raw).hexdigest()+'.html')).write_bytes(raw)
 return result
