"""Official MOFCOM national single-produce weekly wholesale reference prices.
Read-only public endpoint used by the official data-centre client. No API key,
login, basket disaggregation, interpolation, or locally-computed national mean.
"""
import datetime, hashlib, json, math, pathlib, time, urllib.parse, urllib.request
SOURCE_KEY='mofcom'
ENDPOINT='https://cif.mofcom.gov.cn/cif/getWeekLineChart2021.fhtml'
LANDING='https://cif.mofcom.gov.cn/cif/html/dataCenter/'
RIGHTS_URL='https://cif.mofcom.gov.cn/cif/html/indexCenter2024/index.html'
CATALOG_URL='https://cif.mofcom.gov.cn/cif/resDataIndex/js/zhouduData.js'
CATALOG={
 '224058':'油菜','224059':'芹菜','224060':'生菜','224061':'大白菜',
 '16305946':'菠菜','224057':'圆白菜','16305959':'西兰花','16305971':'菜花',
 '224062':'白萝卜','224063':'土豆','224066':'生姜','16305978':'胡萝卜',
 '16305983':'莲藕','16306008':'莴笋','16306013':'山药','224068':'黄瓜',
 '224073':'冬瓜','224074':'苦瓜','16306016':'西葫芦','16306028':'南瓜',
 '224072':'豆角','16306033':'豆芽','224067':'西红柿','224069':'茄子',
 '224070':'辣椒','224071':'青椒','224064':'洋葱','224065':'蒜头',
 '16306035':'韭菜','16306037':'大葱','224089':'苹果','224090':'香蕉',
 '224091':'葡萄','224093':'梨','224094':'西瓜','23543271':'柑橘',
}
FIRST_DATE='2025-01-01'

def instrument_id(source_id):
 return 'cn-mofcom-'+source_id

def request_body(ids,start,end):
 assert 1<=len(ids)<=3 and all(x in CATALOG for x in ids)
 return urllib.parse.urlencode({'indexIds':','.join(ids),'startDate':start,'endDate':end}).encode('ascii')

def fetch_post(url,body):
 request=urllib.request.Request(url,data=body,method='POST',headers={
  'User-Agent':'AI014-reference-data/1.0',
  'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
  'Accept':'application/json',
 })
 with urllib.request.urlopen(request,timeout=90) as response:
  final=urllib.parse.urlparse(response.url)
  assert final.scheme=='https' and final.hostname=='cif.mofcom.gov.cn','Unexpected source redirect'
  raw=response.read(5_000_001)
  assert len(raw)<=5_000_000,'Source response too large'
  return raw

def parse_response(raw,ids,asof,start=FIRST_DATE):
 payload=json.loads(raw)
 assert isinstance(payload,list) and len(payload)==len(ids),'Unexpected response item count'
 expected={CATALOG[x]:x for x in ids}; found={}
 for series in payload:
  rows=series.get('datas',[])
  assert isinstance(rows,list) and rows,'Empty source series'
  name=rows[0].get('NAME'); assert name in expected and name not in found,'Unexpected or duplicate source series'
  assert series.get('title')=='全国'+name+'批发价格走势','Missing explicit national wholesale title'
  assert series.get('unit')=='元/公斤','Unexpected source unit'
  points={}
  for row in rows:
   assert row.get('NAME')==name and row.get('UNIT')=='元/公斤','Mixed name or unit'
   date=row.get('DATADATE'); assert isinstance(date,str)
   assert datetime.date.fromisoformat(date).isoformat()==date and start<=date<=asof,'Invalid observation date'
   value=float(row['DATA']); assert math.isfinite(value) and value>0,'Invalid observation value'
   assert date not in points,'Duplicate source date'
   points[date]={'date':date,'value':value}
  ordered=[points[k] for k in sorted(points)]
  # This is the actual upstream weekly record label; do not shift to Monday/Sunday.
  source_id=expected[name]
  found[name]={
   'id':instrument_id(source_id),'name':name,'category':'consumer',
   'symbol':'全国 · 单品批发周价','unit':'元/公斤',
   'source':'信息来源：商务预报 · 商务部市场运行监测系统',
   'sourceKey':SOURCE_KEY,'sourceUrl':LANDING,
   'frequency':'周度 · 全国单品批发价格','retrievedAt':asof,
   'sourceUpdatedAt':ordered[-1]['date'],
   'market':'全国（商务部监测口径）',
   'specification':'官方发布单品；未细分产地、等级、包装及品牌',
   'coverage':'商务部商务预报直接发布的全国单品批发价格，保留官方周度观测值与元/公斤单位。并非政府统一定价、全国零售价或指定SKU成交价。单品权重、每期样本量和品级口径未在此数据接口披露，不自行推算。日期沿用源站DATADATE周度标签，不代表当日现货报价。',
   'historyNote':'仅收录已核验官方周度观测值，不插值、不补齐每日价格；缺失期留空。公开历史接口可能调整，更新失败时保留最后核验快照。',
   'points':ordered,
  }
 return [found[CATALOG[source_id]] for source_id in ids]

def refresh_source(old,asof,download_post=fetch_post,archive=None,pause=time.sleep):
 """Refresh existing MOFCOM series; entire source succeeds or raises safely.
 Caller must catch errors and retain old snapshot, as for other source adapters.
 """
 assert old and all(x.get('sourceKey')==SOURCE_KEY for x in old),'Unexpected source input'
 ids=[x['id'].removeprefix('cn-mofcom-') for x in old]
 assert len(set(ids))==len(ids) and all(x in CATALOG for x in ids),'Unexpected item IDs'
 before={x['id']:x for x in old}; new=[]
 for offset in range(0,len(ids),3):
  group=ids[offset:offset+3]
  start=min([p['date'] for x in old if x['id'] in {instrument_id(i) for i in group} for p in x['points']]+[FIRST_DATE])
  raw=download_post(ENDPOINT,request_body(group,start,asof))
  batch=parse_response(raw,group,asof,start)
  for item in batch:
   previous=before[item['id']]
   # Require all old dates; never silently shrink history. Upstream revisions on
   # retained dates are permitted, but are archived with the raw source hash.
   assert {p['date'] for p in previous['points']}<={p['date'] for p in item['points']},'Source history shrank'
   assert item['points'][-1]['date']>=previous['points'][-1]['date'],'Source vintage regressed'
  if archive is not None:
   archive=pathlib.Path(archive); archive.mkdir(parents=True,exist_ok=True)
   (archive/('mofcom-'+asof+'-'+hashlib.sha256(raw).hexdigest()+'.json')).write_bytes(raw)
  new.extend(batch)
  if offset+3<len(ids):pause(1)
 return new


def load_bootstrap(path):
 """Expand the compact committed source baseline without manufacturing points."""
 compact=json.loads(pathlib.Path(path).read_text())
 assert compact['metadata']['sourceKey']==SOURCE_KEY and compact['metadata']['unit']=='元/公斤'
 dates=compact['dates'];assert dates and dates==sorted(set(dates))
 payload=[];ids=[]
 for item in compact['items']:
  source_id=item['id'].removeprefix('cn-mofcom-')
  assert source_id in CATALOG and item['name']==CATALOG[source_id]
  assert len(item['values'])==len(dates),'Unequal weekly date/value dimensions'
  ids.append(source_id)
  payload.append({'title':'全国'+item['name']+'批发价格走势','unit':'元/公斤','datas':[{'NAME':item['name'],'UNIT':'元/公斤','DATADATE':date,'DATA':value} for date,value in zip(dates,item['values'])]})
 assert len(ids)==36 and set(ids)==set(CATALOG),'Incomplete national bootstrap'
 return parse_response(json.dumps(payload).encode(),ids,compact['retrievedAt'])
