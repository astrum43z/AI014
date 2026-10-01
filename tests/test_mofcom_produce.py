import copy, importlib.util, json, math, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mofcom',ROOT/'scripts/mofcom-produce-trends.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
IDS=['224068','224067','224089']; ASOF='2026-10-01'
RAW=(ROOT/'tests/fixtures/mofcom-weekly-three.json').read_bytes()
class MofcomTests(unittest.TestCase):
 def test_verified_sample_91_points(self):
  result=m.parse_response(RAW,IDS,ASOF)
  self.assertEqual([x['name'] for x in result],['黄瓜','西红柿','苹果'])
  self.assertEqual([len(x['points']) for x in result],[91]*3)
  self.assertEqual([x['points'][-1]['value'] for x in result],[4.21,3.83,9.25])
  for x in result:
   self.assertEqual(x['sourceKey'],'mofcom');self.assertEqual(x['points'][0]['date'],'2025-01-03');self.assertEqual(x['points'][-1]['date'],'2026-09-25');self.assertEqual(x['unit'],'元/公斤')
   self.assertFalse(any('low' in p or 'high' in p for p in x['points']))
 def test_reject_unverified_or_mislabelled_data(self):
  changes=[lambda p:p[0].update(title='无锡黄瓜价格'),lambda p:p[0].update(unit='元/斤'),lambda p:p[0]['datas'][0].update(NAME='西瓜'),lambda p:p[0]['datas'][0].update(DATA='NaN'),lambda p:p[0]['datas'][0].update(DATA='0'),lambda p:p[0]['datas'][0].update(DATADATE='2027-01-01'),lambda p:p[0]['datas'].append(p[0]['datas'][0]),lambda p:p.pop()]
  for change in changes:
   value=json.loads(RAW);change(value)
   with self.assertRaises((AssertionError,ValueError)):m.parse_response(json.dumps(value).encode(),IDS,ASOF)
 def test_refresh_preserves_input_and_existing_dates(self):
  old=m.parse_response(RAW,IDS,ASOF);before=copy.deepcopy(old)
  new=m.refresh_source(old,ASOF,lambda url,body:RAW,pause=lambda _:None)
  self.assertEqual(old,before);self.assertEqual(new,old)
  reduced=json.loads(RAW);reduced[0]['datas'].pop()
  with self.assertRaises(AssertionError):m.refresh_source(old,ASOF,lambda u,b:json.dumps(reduced).encode(),pause=lambda _:None)
  self.assertEqual(old,before)
 def test_catalog_excludes_basket(self):
  self.assertEqual(len(m.CATALOG),36);self.assertNotIn('18055947',m.CATALOG);self.assertNotIn('蔬菜',m.CATALOG.values())
 def test_request_matches_official_limit(self):
  body=m.request_body(IDS,'2025-01-01',ASOF).decode();self.assertIn('indexIds=224068%2C224067%2C224089',body)
  with self.assertRaises(AssertionError):m.request_body(list(m.CATALOG)[:4],'2025-01-01',ASOF)
if __name__=='__main__':unittest.main()
