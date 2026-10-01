"""Refresh public reference data independently; preserve each source's last good snapshot.
No credentials. Workbook URLs are discovered only on the official World Bank page.
"""
import datetime, hashlib, html, importlib.util, json, pathlib, re, tempfile, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('trends_import', ROOT/'scripts/import-trends.py')
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
mainland_spec=importlib.util.spec_from_file_location('mainland',ROOT/'scripts/mainland-trends.py')
mainland=importlib.util.module_from_spec(mainland_spec);mainland_spec.loader.exec_module(mainland)
mofcom_spec=importlib.util.spec_from_file_location('mofcom',ROOT/'scripts/mofcom-produce-trends.py')
mofcom=importlib.util.module_from_spec(mofcom_spec);mofcom_spec.loader.exec_module(mofcom)
LANDING='https://www.worldbank.org/en/research/commodity-markets'

def fetch(url):
 request=urllib.request.Request(url,headers={'User-Agent':'AI014-reference-data/1.0'})
 with urllib.request.urlopen(request,timeout=90) as response:
  final=urllib.parse.urlparse(response.url)
  assert final.scheme=='https' and final.hostname==urllib.parse.urlparse(url).hostname, 'Unexpected download redirect'
  data=response.read(15_000_001)
  assert len(data)<=15_000_000, 'Source download too large'
  return data

def workbook_url(page):
 links=re.findall(r'href\s*=\s*[\"\']([^\"\']+)[\"\']',page,re.I)
 for link in links:
  url=urllib.parse.urljoin(LANDING,html.unescape(link))
  parts=urllib.parse.urlparse(url)
  if parts.scheme=='https' and parts.hostname=='thedocs.worldbank.org' and parts.path.endswith('/CMO-Historical-Data-Monthly.xlsx'):
   return url
 raise ValueError('Official monthly workbook link not found; keeping last good data')

def no_regression(old,new):
 assert {i['id'] for i in old}=={i['id'] for i in new}, 'Unexpected instrument coverage'
 for item in new:
  before=next(i for i in old if i['id']==item['id'])
  assert len(item['points'])>=len(before['points']), 'Source history shrank'
  assert item['points'][-1]['date']>=before['points'][-1]['date'], 'Source vintage regressed'

def refresh(snapshot,checksums,asof,download=fetch,archive=None,download_post=None,bootstrap=None):
 snapshot=json.loads(json.dumps(snapshot));checksums=dict(checksums)
 # Drop retired local-market records before cache merge or any refresh.
 snapshot['instruments']=[i for i in snapshot['instruments'] if i.get('sourceKey')!='chaoyang' and not i.get('id','').startswith('cn-chaoyang-')]
 checksums={k:v for k,v in checksums.items() if 'chaoyang' not in k}
 statuses=snapshot.setdefault('refreshStatus',{})
 statuses.pop('chaoyang',None)
 if bootstrap is not None:
  existing={i['id'] for i in snapshot['instruments']}
  additions=[i for i in mofcom.load_bootstrap(bootstrap) if i['id'] not in existing]
  if additions:
   snapshot['instruments'].extend(additions)
   statuses['mofcom']={'checkedAt':additions[0]['retrievedAt'],'lastSuccessAt':additions[0]['retrievedAt'],'status':'verified-snapshot'}
 for source in ['ecb','worldbank']:
  old=[i for i in snapshot['instruments'] if i['category']==('fx' if source=='ecb' else 'metal')]
  # Pink Sheet is monthly. Once this month's release is present, do not redownload it daily.
  if source=='worldbank' and old and all(i.get('sourceUpdatedAt','').startswith(asof[:7]) for i in old):
   continue
  try:
   url=parser.ECB_URL if source=='ecb' else workbook_url(download(LANDING).decode('utf-8'))
   raw=download(url)
   with tempfile.NamedTemporaryFile(suffix='.xml' if source=='ecb' else '.xlsx') as handle:
    handle.write(raw);handle.flush()
    new=parser.import_fx(handle.name,asof) if source=='ecb' else parser.import_wb(handle.name,asof,url)
   no_regression(old,new)
   if archive is not None:
    archive.mkdir(parents=True,exist_ok=True)
    suffix='.xml' if source=='ecb' else '.xlsx'
    (archive/(source+'-'+asof+'-'+hashlib.sha256(raw).hexdigest()+suffix)).write_bytes(raw)
   for item in new:item['retrievedAt']=asof
   replacement={i['id']:i for i in new}
   snapshot['instruments']=[replacement.get(i['id'],i) for i in snapshot['instruments']]
   checksums['ecb.xml' if source=='ecb' else 'wb.xlsx']=hashlib.sha256(raw).hexdigest()
   statuses[source]={'checkedAt':asof,'lastSuccessAt':asof,'status':'ok'}
  except Exception as error:
   previous=statuses.get(source,{})
   statuses[source]={'checkedAt':asof,'lastSuccessAt':previous.get('lastSuccessAt',old[0].get('retrievedAt',snapshot['retrievedAt']) if old else None),'status':'error'}
   print(f'::warning::{source} refresh failed ({type(error).__name__}); retained last good data')
 for source in ['nbs','mara']:
  old=[i for i in snapshot['instruments'] if i.get('sourceKey')==source]
  if not old:continue
  try:
   new=mainland.refresh_source(old,source,asof,download,archive)
   no_regression(old,new)
   replacement={i['id']:i for i in new}
   snapshot['instruments']=[replacement.get(i['id'],i) for i in snapshot['instruments']]
   statuses[source]={'checkedAt':asof,'lastSuccessAt':asof,'status':'ok'}
  except Exception as error:
   statuses[source]={'checkedAt':asof,'lastSuccessAt':statuses.get(source,{}).get('lastSuccessAt',old[0].get('retrievedAt')),'status':'error'}
   print(f'::warning::{source} refresh failed ({type(error).__name__}); retained last good data')
 old=[i for i in snapshot['instruments'] if i.get('sourceKey')=='mofcom']
 if old:
  previous=statuses.get('mofcom',{})
  last_success=previous.get('lastSuccessAt')
  # Public weekly series: at most one successful request cycle every seven days.
  # A failed cycle remains eligible on the next scheduled run; no values are lost.
  cached=previous.get('status')=='ok' and last_success and 0<=(datetime.date.fromisoformat(asof)-datetime.date.fromisoformat(last_success)).days<7
  if not cached:
   source_hashes={}
   def post(url,body):
    raw=(download_post or mofcom.fetch_post)(url,body)
    ids=urllib.parse.parse_qs(body.decode('ascii'))['indexIds'][0]
    source_hashes['mofcom/'+ids+'.json']=hashlib.sha256(raw).hexdigest()
    return raw
   try:
    new=mofcom.refresh_source(old,asof,post,archive)
    no_regression(old,new)
    replacement={i['id']:i for i in new}
    snapshot['instruments']=[replacement.get(i['id'],i) for i in snapshot['instruments']]
    checksums.update(source_hashes)
    statuses['mofcom']={'checkedAt':asof,'lastSuccessAt':asof,'status':'ok'}
   except Exception as error:
    statuses['mofcom']={'checkedAt':asof,'lastSuccessAt':last_success or old[0].get('retrievedAt'),'status':'error'}
    print(f'::warning::mofcom refresh failed ({type(error).__name__}); retained last good data')
 snapshot['retrievedAt']=max((i.get('retrievedAt',snapshot['retrievedAt']) for i in snapshot['instruments']),default=snapshot['retrievedAt'])
 return snapshot,checksums

if __name__=='__main__':
 asof=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
 path=ROOT/'src/data/trends.json';manifest=ROOT/'docs/trends-source-checksums.json'
 snapshot,checksums=refresh(json.loads(path.read_text()),json.loads(manifest.read_text()),asof,archive=ROOT/'.trends-sources',bootstrap=ROOT/'src/data/mofcom-produce.json')
 path.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n')
 manifest.write_text(json.dumps(checksums,indent=2)+'\n')
 print(json.dumps(snapshot.get('refreshStatus',{})))
