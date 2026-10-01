"""Import downloaded official snapshots only: python scripts/import-trends.py ECB_XML WB_XLSX.
Requires Python openpyxl. Downloads/authentication/deployment are intentionally separate.
"""
import sys,json,xml.etree.ElementTree as E,datetime,hashlib,pathlib,re,math
import openpyxl
ECB_URL='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml'
WB_URL='https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx'

def import_fx(path, asof):
 rows=[]
 for e in E.parse(path).iter():
  if 'time' in e.attrib and '2019-01-01'<=e.attrib['time']<=asof:
   rows.append((e.attrib['time'],{n.attrib['currency']:float(n.attrib['rate']) for n in e}))
 rows.sort(); instruments=[]
 for code,name in [('USD','欧元 / 美元'),('CNY','欧元 / 人民币'),('JPY','欧元 / 日元'),('GBP','欧元 / 英镑'),('HKD','欧元 / 港币')]:
  instruments.append(dict(id='eur-'+code.lower(),name=name,category='fx',symbol='EUR/'+code,unit=code+' / EUR',source='欧洲中央银行 ECB',sourceUrl='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml',coverage='ECB 工作日参考汇率；1 欧元折合的报价货币数量。不是实时行情或可成交价格。',frequency='工作日',points=[dict(date=d,value=v[code]) for d,v in rows if code in v]))
 instruments.insert(0,dict(id='usd-cny',name='美元 / 人民币',category='fx',symbol='USD/CNY',unit='CNY / USD',source='欧洲中央银行 ECB · 交叉汇率计算',sourceUrl='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml',coverage='由同日 ECB EUR/CNY ÷ EUR/USD 计算，表示 1 美元折合人民币。此为推导参考汇率，不是央行人民币中间价或实时可成交报价。',frequency='工作日 · 推导值',points=[dict(date=d,value=v['CNY']/v['USD']) for d,v in rows if 'CNY' in v and 'USD' in v]))
 return validate(instruments, asof)

def import_wb(path, asof, wb_url=WB_URL):
 instruments=[]
 # Select by name: newer workbooks include a hidden diagnostic sheet first.
 w=openpyxl.load_workbook(path,data_only=True);sheet=list(w['Monthly Prices'].values);headers=sheet[4]
 updated=datetime.datetime.strptime(sheet[3][0], 'Updated on %B %d, %Y').date().isoformat()
 assert updated<=asof, 'Workbook publication date is later than retrieval date'

 for key,name,symbol,category,unit in [('Gold','黄金','XAU','metal','美元/金衡盎司'),('Silver','白银','XAG','metal','美元/金衡盎司'),('Crude oil, Brent','布伦特原油','BRENT','commodity','美元/桶'),('Copper','铜','COPPER','commodity','美元/公吨'),('Aluminum','铝','ALUMINUM','commodity','美元/公吨'),('Wheat, US HRW','美国硬红冬小麦','WHEAT','commodity','美元/公吨')]:
  col=headers.index(key);points=[]
  for row in sheet[6:]:
   period=row[0]
   if not isinstance(period,str) or not re.fullmatch(r'\d{4}M(0[1-9]|1[0-2])',period) or period<'2019M01' or not isinstance(row[col],(int,float)):continue
   date=period[:4]+'-'+period[-2:]+'-01'
   if date>asof:continue
   points.append(dict(date=date,value=row[col]))
  assert points and all(a['date']<b['date'] for a,b in zip(points,points[1:])), 'Missing or unsorted monthly observations'
  instruments.append(dict(id=symbol.lower(),name=name,category=category,symbol=symbol,unit=unit,source='世界银行 Pink Sheet',sourceUrl=wb_url,sourceUpdatedAt=updated,coverage=f'世界银行月度名义美元参考价。工作簿更新于 {updated}，序列截至 {points[-1]["date"][:7]}；不是今日现价或实时行情。每个点代表整月均价，日期中的 01 仅标识月份。',frequency='月度 · 历史均价',points=points))
 return validate([i for i in instruments if i['category']=='metal'], asof)

def validate(instruments, asof):
 for item in instruments:
  points=item['points']
  assert len(points)>=20, 'Incomplete source history'
  assert all(math.isfinite(p['value']) and p['value']>0 and p['date']<=asof for p in points), 'Invalid observations'
  assert all(a['date']<b['date'] for a,b in zip(points,points[1:])), 'Unsorted observations'
 return instruments

if __name__=='__main__':
 root=pathlib.Path(__file__).resolve().parents[1]
 asof=sys.argv[3] if len(sys.argv)>3 else datetime.date.today().isoformat()
 instruments=import_fx(sys.argv[1],asof)+import_wb(sys.argv[2],asof)
 for i in instruments:i['retrievedAt']=asof
 payload=dict(retrievedAt=asof,instruments=instruments)
 (root/'src/data/trends.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 manifest={str(pathlib.Path(p).name):hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in sys.argv[1:3]}
 (root/'docs/trends-source-checksums.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print([(i['symbol'],len(i['points']),i['points'][-1]['date']) for i in instruments])
