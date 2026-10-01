"""Import NBS published rolling indexes, never absolute home/rental prices.
Bootstrap is explicit and offline: read the listed official HTML files, verify each
period and denominator, and retain publication dates and source-byte checksums.
"""
from html.parser import HTMLParser
import datetime, hashlib, html, json, math, pathlib, re, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
TERMS='https://www.stats.gov.cn/wzgl/202302/t20230217_1912857.html'
BASE_2020='https://www.stats.gov.cn/sj/sjjd/202302/t20230202_1896451.html'
BASE_2025='https://www.stats.gov.cn/sj/zxfbhjd/202602/t20260211_1962589.html'

class Tables(HTMLParser):
 def __init__(self):
  super().__init__();self.tables=[];self.contexts=[];self.depth=0;self.rows=[];self.row=[];self.cell=None;self.meta={};self.text=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='meta' and 'name' in attrs:self.meta[attrs['name']]=attrs.get('content','')
  if tag=='table':
   if self.depth==0:self.rows=[];self.contexts.append(''.join(''.join(self.text[-10:]).split()))
   self.depth+=1
  if tag=='tr' and self.depth==1:self.row=[]
  if tag in ('td','th') and self.depth==1:self.cell=''
 def handle_data(self,s):
  self.text.append(s)
  if self.cell is not None:self.cell+=s
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.depth==1 and self.cell is not None:self.row.append(''.join(self.cell.split()));self.cell=None
  if tag=='tr' and self.depth==1:self.rows.append(self.row)
  if tag=='table':
   self.depth-=1
   if self.depth==0:self.tables.append(self.rows)

def metadata(raw,url,kind,asof):
 u=urllib.parse.urlparse(url)
 if u.scheme!='https' or u.hostname!='www.stats.gov.cn' or not re.fullmatch(r'/(?:sj/(?:zxfb|zxfbhjd)|xxgk/sjfb/zxfb2020|zwfwck/sjfb)/\d{6}/t\d{8}_\d+\.html',u.path):raise ValueError('Not an official publication URL')
 source=raw.decode('utf-8') if isinstance(raw,bytes) else raw
 p=Tables();p.feed(source)
 title=p.meta.get('ArticleTitle','')
 if not title:
  match=re.search(r'<title[^>]*>(.*?)</title>',source,re.S|re.I)
  title=''.join(html.unescape(match[1]).split()) if match else ''
 suffix='70个大中城市商品住宅销售价格变动情况' if kind=='housing' else '居民消费价格'
 match=re.search(r'(20\d{2})年(\d{1,2})月份'+suffix,title)
 if not match:raise ValueError('Wrong release title')
 month=f'{match[1]}-{int(match[2]):02d}';datetime.date.fromisoformat(month+'-01')
 pub=p.meta.get('PubDate','')[:10].replace('/','-')
 if not pub:
  match=re.search(r'发布时间[：:]\s*(20\d{2}-\d{2}-\d{2})',html.unescape(re.sub('<[^>]+>','',source)))
  pub=match[1] if match else ''
 datetime.date.fromisoformat(pub)
 if month>asof[:7] or pub>asof or pub[:7]<=month:raise ValueError('Future or inconsistent period/publication')
 base=2025 if month>='2026-01' else 2020
 if not ('2025-09'<=month<='2026-08'):raise ValueError('Outside verified bootstrap window')
 text=''.join(''.join(p.text).split())
 if base==2025 and ('2025年' not in text or '基期' not in text):raise ValueError('Missing new-base disclosure')
 return p,dict(month=month,publishedAt=pub,sourceUrl=url,baseYear=base)

def number(s,index):
 if not re.fullmatch(r'-?\d+(?:\.\d+)?',s):raise ValueError('Invalid numeric cell')
 n=float(s)
 if not math.isfinite(n) or (index and not 0<n<1000) or (not index and not -100<n<100):raise ValueError('Out-of-range value')
 return n

def parse_housing(raw,url,asof):
 p,out=metadata(raw,url,'housing',asof)
 tables=[];contexts=[]
 for context,t in zip(p.contexts,p.tables):
  if t and t[0] in [['城市','环比','同比','城市','环比','同比'],['城市','环比','同比',f"1-{int(out['month'][5:])}月平均",'城市','环比','同比',f"1-{int(out['month'][5:])}月平均"]]:tables.append(t);contexts.append(context)
 if contexts and ('新建商品住宅销售价格指数' not in contexts[0] or len(contexts)>1 and '二手住宅销售价格指数' not in contexts[1]):raise ValueError('Wrong housing-type table order')
 if len(tables) not in (2,4):raise ValueError('Expected two headline tables with optional identical mobile copies')
 if len(tables)==4 and tables[:2]!=tables[2:]:raise ValueError('Desktop/mobile tables disagree')
 parsed=[]
 for table in tables[:2]:
  per=3 if len(table[0])==6 else 4
  expected=['上月=100','上年同月=100']+(['上年同期=100'] if per==4 else [])
  if table[1]!=expected*2:raise ValueError('Unexpected index denominator')
  cities={}
  for row in table[2:]:
   if len(row)!=per*2:raise ValueError('Malformed housing row')
   for pos in (0,per):
    city=row[pos]
    if not re.fullmatch('[\u4e00-\u9fff]{2,5}',city) or city in cities:raise ValueError('Duplicate or invalid city')
    values=[number(v,True) for v in row[pos+1:pos+per]]
    cities[city]=values+([None] if per==3 else [])
  if len(cities)!=70:raise ValueError(f'Expected 70 cities, got {len(cities)}')
  parsed.append(cities)
 if set(parsed[0])!=set(parsed[1]):raise ValueError('Housing-type coverage mismatch')
 out['new']=parsed[0];out['resale']=parsed[1]
 return out

def parse_rent(raw,url,asof):
 p,out=metadata(raw,url,'rent',asof);rows=[]
 for table in p.tables:
  heads=''.join(table[0]) if table else ''
  if '环比涨跌幅' not in heads or '同比涨跌幅' not in heads:continue
  for row in table:
   if row and row[0]=='租赁房房租':rows.append(row)
 if not rows or any(row!=rows[0] for row in rows):raise ValueError('Missing or conflicting rent rows')
 vals=[number(v,False) for v in rows[0][1:]]
 if len(vals)!=(2 if out['month'].endswith('-01') else 3):raise ValueError('Unexpected rent columns')
 out.update(mom=vals[0],yoy=vals[1],ytd=vals[2] if len(vals)==3 else None)
 return out

def build(folder,asof='2026-10-01'):
 folder=pathlib.Path(folder);urls=json.loads((folder/'source-urls.json').read_text());output={'schemaVersion':1,'retrievedAt':asof,'updateMode':'verified-history-snapshot','termsUrl':TERMS,'baseMethodUrls':[BASE_2020,BASE_2025],'housing':[],'rent':[]};evidence=[]
 required=[f'2025-{m:02}' for m in range(9,13)]+[f'2026-{m:02}' for m in range(1,9)]
 for kind in ['housing','rent']:
  if sorted(urls[kind])!=required:raise ValueError('Need exactly twelve verified consecutive months')
  for month,url in sorted(urls[kind].items()):
   raw=(folder/(kind+'-'+month+'.html')).read_bytes();item=(parse_housing if kind=='housing' else parse_rent)(raw,url,asof)
   if item['month']!=month:raise ValueError('Requested/parsed month mismatch')
   output[kind].append(item);evidence.append({'kind':kind,'month':month,'sourceUrl':url,'publishedAt':item['publishedAt'],'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
 cities=list(output['housing'][0]['new'])
 for item in output['housing']:
  for kind in ['new','resale']:
   if set(item[kind])!=set(cities):raise ValueError('City set changed')
   item[kind]=[item[kind][city] for city in cities]
 output['cities']=cities
 return output,{'retrievedAt':asof,'method':'Parsed source HTML tables and publication metadata, with all duplicate mobile tables checked for equality. No interpolation or compounding.','rightsUrl':TERMS,'sources':evidence}

if __name__=='__main__':
 import sys
 data,manifest=build(sys.argv[1])
 (ROOT/'src/data/nbs-housing.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 (ROOT/'docs/nbs-housing-source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('Housing city-month/type observations',len(data['cities'])*len(data['housing'])*2,'rent months',len(data['rent']))
