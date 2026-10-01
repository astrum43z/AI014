import importlib.util, pathlib, unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('refresh',ROOT/'scripts/refresh-trends.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class RefreshTests(unittest.TestCase):
 def test_official_discovery(self):
  self.assertEqual(r.workbook_url('<a href="https://evil.example/CMO-Historical-Data-Monthly.xlsx">bad</a><a href="'+r.parser.WB_URL+'">Monthly</a>'),r.parser.WB_URL)
  with self.assertRaises(ValueError):r.workbook_url('<a href="https://evil.example/CMO-Historical-Data-Monthly.xlsx">')
 def test_regression(self):
  old=[{'id':'x','points':[{'date':'2026-08-01','value':1}]}]
  with self.assertRaises(AssertionError):r.no_regression(old,[{'id':'x','points':[{'date':'2024-12-01','value':2}]}])
 def test_failure_retains_snapshot_and_hash(self):
  snapshot={'retrievedAt':'2026-09-30','instruments':[{'id':'fx','category':'fx','points':[{'date':'2026-09-30','value':7}]},{'id':'gold','category':'metal','sourceUpdatedAt':'2026-09-02','points':[{'date':'2026-08-01','value':4411}]}]}
  def fail(url):raise OSError('offline')
  updated,hashes=r.refresh(snapshot,{'ecb.xml':'same','wb.xlsx':'same'},'2026-10-02',fail)
  self.assertEqual(updated['instruments'],snapshot['instruments'])
  self.assertEqual(updated['retrievedAt'],'2026-09-30')
  self.assertEqual(hashes,{'ecb.xml':'same','wb.xlsx':'same'})
  self.assertEqual(updated['refreshStatus']['worldbank']['status'],'error')
 def test_one_source_failure_does_not_block_other(self):
  old_fx={'id':'fx','category':'fx','points':[{'date':'2026-09-29','value':7}]}
  new_fx={'id':'fx','category':'fx','points':[{'date':'2026-09-30','value':8}]}
  gold={'id':'gold','category':'metal','sourceUpdatedAt':'2026-08-02','points':[{'date':'2026-07-01','value':1}]}
  snapshot={'retrievedAt':'2026-09-29','instruments':[old_fx,gold]}
  def download(url):
   if url==r.LANDING:raise OSError('offline')
   return b'fixture'
  with patch.object(r.parser,'import_fx',return_value=[new_fx]):
   updated,hashes=r.refresh(snapshot,{'wb.xlsx':'unchanged'},'2026-09-30',download)
  self.assertEqual(updated['instruments'][0]['points'],new_fx['points'])
  self.assertEqual(updated['instruments'][1],gold)
  self.assertEqual(updated['refreshStatus']['ecb']['status'],'ok')
  self.assertEqual(updated['refreshStatus']['worldbank']['status'],'error')
  self.assertEqual(hashes['wb.xlsx'],'unchanged')
  self.assertEqual(updated['retrievedAt'],'2026-09-30')
 def test_monthly_release_is_not_downloaded_daily(self):
  snapshot={'retrievedAt':'2026-09-30','instruments':[{'id':'gold','category':'metal','sourceUpdatedAt':'2026-09-02','points':[{'date':'2026-08-01','value':4411}]}]}
  calls=[]
  def fail(url):calls.append(url);raise OSError('offline')
  updated,_=r.refresh(snapshot,{},'2026-09-30',fail)
  self.assertEqual(calls,[r.parser.ECB_URL])
  self.assertNotIn('worldbank',updated['refreshStatus'])
 def test_retired_source_cannot_return_from_old_cache_or_network(self):
  original={'retrievedAt':'2026-10-01','refreshStatus':{'chaoyang':{'lastSuccessAt':'2026-10-01','status':'ok'}},'instruments':[{'id':'cn-chaoyang-test','category':'consumer','sourceKey':'chaoyang','points':[{'date':'2026-09-30','value':1.31}]}]}
  calls=[]
  def fail(url):calls.append(url);raise TimeoutError('Other official source offline')
  updated,hashes=r.refresh(original,{'chaoyang/old.html':'old','keep':'same'},'2026-10-01',fail,bootstrap=ROOT/'src/data/mofcom-produce.json',download_post=lambda u,b: (_ for _ in ()).throw(TimeoutError('offline')))
  self.assertTrue(all(i.get('sourceKey')=='mofcom' for i in updated['instruments']))
  self.assertEqual(len(updated['instruments']),36)
  self.assertEqual(sum(len(i['points']) for i in updated['instruments']),3276)
  self.assertNotIn('chaoyang',updated['refreshStatus'])
  self.assertEqual(hashes,{'keep':'same'})
  self.assertTrue(all('chinachaoyang' not in url for url in calls))
  self.assertEqual(len(original['instruments']),1)
if __name__=='__main__':unittest.main()
