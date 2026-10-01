import importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mainland',ROOT/'scripts/mainland-trends.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MainlandTests(unittest.TestCase):
 def test_mara_exact_values_and_date(self):
  text='日期：2026-09-30 '+''.join(n+'平均价格为'+str(j+1)+'.25元/公斤；' for j,n in enumerate(m.FOODS))
  rows=m.parse_mara(text,'https://scs.moa.gov.cn/report','2026-10-01')
  self.assertEqual(len(rows),11);self.assertEqual(rows[0]['points'][0]['value'],1.25)
  self.assertEqual(rows[0]['points'][0]['date'],'2026-09-30')
  with self.assertRaises(ValueError):m.parse_mara(text,'url','2026-09-29')
  with self.assertRaises(ValueError):m.parse_mara('<h1>Error</h1>','url','2026-10-01')
 def test_discovery_rejects_external(self):
  source='<a href="https://evil.example/x">农产品批发价格200指数</a><a href="./202609/test.htm">农产品批发价格200指数</a>'
  self.assertEqual(m.discover(source,m.MARA_INDEX,'mara'),['https://scs.moa.gov.cn/jcyj/202609/test.htm'])
 def test_merge_never_interpolates_or_changes_units(self):
  old=[{'id':'x','unit':'元/吨','points':[{'date':'2026-09-10','value':2}]}]
  new=[{'id':'x','unit':'元/吨','points':[{'date':'2026-09-20','value':3}]}]
  self.assertEqual(len(m.merge(old,new)[0]['points']),2)
  with self.assertRaises(ValueError):m.merge(old,[{**new[0],'unit':'美元/吨'}])
 def test_nbs_rejects_incomplete_bulletin(self):
  with self.assertRaises(ValueError):m.parse_nbs('2026年9月中旬流通领域重要生产资料市场价格变动情况 2026/09/24','url','2026-10-01')
if __name__=='__main__':unittest.main()
