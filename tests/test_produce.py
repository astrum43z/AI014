import importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('produce',ROOT/'scripts/produce-trends.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
URL='https://www.chinachaoyang.com/Price.aspx?Type=1'
TEXT='''朝阳蔬菜市场批发价格
发布时间：2026/9/30
单位：元/公斤
品名 产地/规格 最高价 最低价 均价 曲线图
白萝卜  5.50 1.00 1.31 详情
菠菜 18.00 1.00 7.02 详情
'''
class ProduceTests(unittest.TestCase):
 def test_exact_original_mean_and_range(self):
  rows=m.parse_page(TEXT,URL,'2026-10-01')
  self.assertEqual(len(rows),2)
  self.assertEqual(rows[0]['points'],[dict(date='2026-09-30',value=1.31,low=1.0,high=5.5,sourceUrl=URL)])
  self.assertNotEqual(rows[0]['points'][0]['value'],(5.5+1)/2)
  self.assertEqual(rows[0]['unit'],'元/公斤')
  self.assertIn('原表产地/规格为空',rows[0]['coverage'])
  self.assertIn('指定市场单品均价',rows[0]['frequency'])
 def test_html_table_and_indexed_text(self):
  page='<h1>朝阳蔬菜市场批发价格</h1><p>发布时间：2026/9/30</p><p>单位：元/公斤</p><table><tr><td>品名</td><td>产地/规格</td><td>最高价</td><td>最低价</td><td>均价</td></tr><tr><td>白萝卜</td><td>&nbsp;</td><td>5.50</td><td>1.00</td><td>1.31</td><td>详情</td></tr></table>'
  self.assertEqual(m.parse_page(page,URL,'2026-10-01')[0]['points'][0]['value'],1.31)
  indexed='\n'.join('L'+str(n)+': '+line for n,line in enumerate(TEXT.splitlines()))
  self.assertEqual(m.parse_page(indexed,URL,'2026-10-01'),m.parse_page(TEXT,URL,'2026-10-01'))
 def test_spec_not_silently_dropped(self):
  row=m.parse_page(TEXT.replace('白萝卜  ','白萝卜 山东/一级 '),URL,'2026-10-01')[0]
  self.assertIn('山东/一级',row['coverage'])
  self.assertNotEqual(row['id'],m.parse_page(TEXT,URL,'2026-10-01')[0]['id'])
 def test_reject_wrong_source_unit_date_range_or_table(self):
  bad=[TEXT.replace('元/公斤','元/斤'),TEXT.replace('2026/9/30','2026/10/2'),TEXT.replace('5.50 1.00 1.31','5.50 2.00 1.31'),TEXT.replace('最高价 最低价','最低价 最高价'),TEXT+'白萝卜 5.50 1.00 1.31 详情\n']
  for page in bad:
   with self.subTest(page=page),self.assertRaises(ValueError):m.parse_page(page,URL,'2026-10-01')
  for url in ['https://evil.example/Price.aspx','http://www.chinachaoyang.com/Price.aspx','https://www.chinachaoyang.com/Retail.aspx',URL.replace('Type=1','Type=2')]:
   with self.subTest(url=url),self.assertRaises(ValueError):m.parse_page(TEXT,url,'2026-10-01')
 def test_merge_sparse_dates_preserves_history_and_missing_items(self):
  old=m.parse_page(TEXT,URL,'2026-10-01')
  new=m.parse_page(TEXT.replace('2026/9/30','2026/10/1').replace('1.31','1.32').replace('菠菜 18.00 1.00 7.02 详情',''),URL,'2026-10-01')
  out=m.merge(old,new)
  self.assertEqual(len(out),2);self.assertEqual([p['date'] for p in out[0]['points']],['2026-09-30','2026-10-01'])
  self.assertEqual(len(out[1]['points']),1)
  self.assertEqual(len(old[0]['points']),1)
  with self.assertRaises(ValueError):m.merge(old,m.parse_page(TEXT.replace('1.31','1.32'),URL,'2026-10-01'))
 def test_discover_only_same_market_links(self):
  raw='<a href="?PageNo=2&amp;Type=1">2</a><a href="?Type=2">水果</a><a href="https://evil.example/Price.aspx?Type=1">x</a><a href="?PageNo=999&Type=1">x</a>'
  self.assertEqual(m.discover_pages(raw,URL),[URL,'https://www.chinachaoyang.com/Price.aspx?PageNo=2&Type=1'])
 def test_refresh_two_markets_and_failed_fetch_is_atomic(self):
  old=m.parse_page(TEXT,URL,'2026-10-01')
  vegetable=TEXT.replace('2026/9/30','2026/10/1').replace('1.31','1.32')
  fruit='锡澄果品市场批发价格\n发布时间：2026/10/1\n单位：元/公斤\n品名 产地/规格 最高价 最低价 均价\n嘎啦苹果 16.00 2.20 4.69 详情\n'
  out=m.refresh_source(old,'2026-10-01',lambda url: (fruit if 'Type=2' in url else vegetable).encode())
  self.assertEqual(len(out),3)
  self.assertEqual(len(out[0]['points']),2)
  def failed(url):
   if 'Type=2' in url:raise TimeoutError('upstream unavailable')
   return vegetable.encode()
  with self.assertRaises(TimeoutError):m.refresh_source(old,'2026-10-01',failed)
  self.assertEqual(len(old[0]['points']),1)
 def test_archived_primary_evidence_reproduces_seed(self):
  path=ROOT/'docs/produce-source-evidence.json'
  if not path.exists():self.fail('Missing reproducible source evidence')
  observations=[]
  for source in json.loads(path.read_text()):observations=m.merge(observations,m.parse_page(source['excerpt'],source['url'],'2026-10-01'))
  self.assertEqual(len(observations),20)
  self.assertEqual(sum(len(i['points']) for i in observations),75)
  self.assertTrue(all(p['low']<=p['value']<=p['high'] for i in observations for p in i['points']))
if __name__=='__main__':unittest.main()
