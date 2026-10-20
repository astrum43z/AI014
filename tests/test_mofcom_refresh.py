import socket, ssl, urllib.error
from unittest.mock import patch
import copy, importlib.util, json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('refresh',ROOT/'scripts/refresh-trends.py'); r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
RAW=(ROOT/'tests/fixtures/mofcom-weekly-three.json').read_bytes()
IDS=['224068','224067','224089']
def offline(_):raise OSError('Other source offline in fixture')
def snapshot(status='ok',date='2026-10-01'):
 return {'retrievedAt':date,'refreshStatus':{'mofcom':{'checkedAt':date,'lastSuccessAt':date,'status':status}},'instruments':r.mofcom.parse_response(RAW,IDS,date)}
class MofcomRefreshTests(unittest.TestCase):
 def test_success_refresh_records_hashes_and_preserves_original_input(self):
  old=snapshot('verified-snapshot');before=copy.deepcopy(old);calls=[]
  def post(url,body):calls.append((url,body));return RAW
  new,hashes=r.refresh(old,{'keep':'same'},'2026-10-01',offline,download_post=post)
  self.assertEqual(len(calls),1);self.assertEqual(old,before)
  self.assertEqual(new['refreshStatus']['mofcom']['status'],'ok')
  self.assertEqual(new['refreshStatus']['mofcom']['lastSuccessAt'],'2026-10-01')
  self.assertEqual(hashes['keep'],'same');self.assertEqual(len(hashes),2)
  self.assertEqual(new['instruments'],old['instruments'])
 def test_weekly_cache_skips_only_same_day(self):
  for asof in ['2026-10-01']:
   calls=[]
   def post(u,b):calls.append(u);raise AssertionError('Should use cached weekly series')
   old=snapshot();new,hashes=r.refresh(old,{'mofcom/existing':'same'},asof,offline,download_post=post)
   self.assertEqual(calls,[]);self.assertEqual(new['instruments'],old['instruments']);self.assertEqual(hashes,{'mofcom/existing':'same'});self.assertEqual(new['refreshStatus']['mofcom'],old['refreshStatus']['mofcom'])
 def test_next_day_rechecks_even_when_previous_fetch_returned_unchanged_observations(self):
  calls=[]
  def post(u,b):calls.append(u);return RAW
  result,_=r.refresh(snapshot(),{},'2026-10-02',offline,download_post=post)
  self.assertEqual(len(calls),1)
  self.assertEqual(result['instruments'][0]['points'][-1]['date'],'2026-09-25')
  self.assertEqual(result['refreshStatus']['mofcom']['lastSuccessAt'],'2026-10-02')
 def test_retry_only_known_transient_failures_and_never_access_restrictions(self):
  for error in [TimeoutError(),ConnectionResetError(),urllib.error.HTTPError('https://example.com',503,'fixture',{},None),urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN,'fixture'))]:
   calls=[];sleeps=[]
   def post(u,b):
    calls.append(1)
    if len(calls)==1:raise error
    return b'fixture'
   self.assertEqual(r.fetch_weekly_with_retry(post,'url',b'body',sleeps.append),b'fixture');self.assertEqual(len(calls),2);self.assertEqual(sleeps,[2])
  for error in [urllib.error.HTTPError('https://example.com',403,'fixture',{},None),urllib.error.HTTPError('https://example.com',429,'fixture',{},None),urllib.error.URLError(ssl.SSLCertVerificationError('fixture')),urllib.error.URLError('private URL or secret'),ValueError('fixture')]:
   calls=[]
   def post(u,b):calls.append(1);raise error
   with self.assertRaises(Exception):r.fetch_weekly_with_retry(post,'url',b'body',lambda _:self.fail('must not retry'))
   self.assertEqual(len(calls),1);self.assertNotIn('private',r.failure_code(error))
 def test_retry_stops_after_second_failure(self):
  calls=[]
  def post(u,b):calls.append(1);raise TimeoutError()
  with self.assertRaises(TimeoutError):r.fetch_weekly_with_retry(post,'url',b'body',lambda _:None)
  self.assertEqual(len(calls),2)
 def test_seventh_day_requests_new_series(self):
  calls=[]
  def post(u,b):calls.append(u);return RAW
  new,_=r.refresh(snapshot(),{},'2026-10-08',offline,download_post=post)
  self.assertEqual(len(calls),1);self.assertEqual(new['refreshStatus']['mofcom']['lastSuccessAt'],'2026-10-08')
 def test_failure_preserves_entire_source_prices_dates_hashes_and_last_success(self):
  old=snapshot();before=copy.deepcopy(old)
  def post(u,b):raise TimeoutError('Official source timed out')
  new,hashes=r.refresh(old,{'mofcom/existing':'same'},'2026-10-08',offline,download_post=post)
  self.assertEqual(old,before);self.assertEqual(new['instruments'],old['instruments']);self.assertEqual(new['retrievedAt'],old['retrievedAt']);self.assertEqual(hashes,{'mofcom/existing':'same'})
  self.assertEqual(new['refreshStatus']['mofcom'],{'checkedAt':'2026-10-08','lastSuccessAt':'2026-10-01','status':'error','errorCode':'timeout','latestObservationAt':'2026-09-25'})
 def test_recent_failure_and_unverified_pipeline_are_not_cached(self):
  for status in ['error','verified-snapshot']:
   calls=[]
   def post(u,b):calls.append(u);return RAW
   new,_=r.refresh(snapshot(status),{},'2026-10-02',offline,download_post=post)
   self.assertEqual(len(calls),1);self.assertEqual(new['refreshStatus']['mofcom']['status'],'ok')
 def test_invalid_national_payload_cannot_replace_verified_values_or_hashes(self):
  raw=json.loads(RAW);raw[0]['title']='全国蔬菜篮子平均价';old=snapshot()
  new,hashes=r.refresh(old,{'mofcom/existing':'same'},'2026-10-08',offline,download_post=lambda u,b:json.dumps(raw).encode())
  self.assertEqual(new['instruments'],old['instruments']);self.assertEqual(hashes,{'mofcom/existing':'same'});self.assertEqual(new['refreshStatus']['mofcom']['status'],'error')
 def test_compact_bootstrap_roundtrip_matches_verified_input(self):
  compact=r.mofcom.load_bootstrap(ROOT/'src/data/mofcom-produce.json')
  self.assertEqual(len(compact),36);self.assertEqual(sum(len(i['points']) for i in compact),3276)
  known={i['id']:i for i in r.mofcom.parse_response(RAW,IDS,'2026-10-01')}
  for item in compact:
   if item['id'] in known:self.assertEqual(item,known[item['id']])
 def test_first_cached_run_keeps_committed_bootstrap_on_network_failure_without_duplicates(self):
  old={'retrievedAt':'2026-10-01','instruments':[{'id':'other','category':'commodity','points':[{'date':'2026-10-01','value':5}]}]}
  def fail(u,b):raise TimeoutError('Official source offline')
  new,_=r.refresh(old,{},'2026-10-01',offline,download_post=fail,bootstrap=ROOT/'src/data/mofcom-produce.json')
  self.assertEqual(len(new['instruments']),37);self.assertEqual(new['instruments'][0],old['instruments'][0]);self.assertEqual(new['refreshStatus']['mofcom']['status'],'error')
  again,_=r.refresh(new,{},'2026-10-02',offline,download_post=fail,bootstrap=ROOT/'src/data/mofcom-produce.json')
  self.assertEqual(len(again['instruments']),37);self.assertEqual(again['instruments'],new['instruments']);self.assertEqual(len({i['id'] for i in again['instruments']}),37)
 def test_workflow_cache_versions_include_compact_source_and_adapter(self):
  workflow=next((ROOT/'.github/workflows').glob('*.yml')).read_text()
  key="hashFiles('scripts/import-trends.py', 'src/data/trends.json', 'scripts/mofcom-produce-trends.py', 'src/data/mofcom-produce.json')"
  self.assertEqual(workflow.count(key),2)
if __name__=='__main__':unittest.main()
