import copy,importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('produce_history',ROOT/'scripts/produce-history.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
URL='https://www.chinachaoyang.com/Price.aspx?Type=1'
TABLE='''<h1>朝阳蔬菜市场批发价格</h1><p>发布时间：2026/10/1</p><p>单位：元/公斤</p>
<table><tr><td>品名</td><td>产地/规格</td><td>最高价</td><td>最低价</td><td>均价</td><td>曲线图</td></tr>
<tr onclick="opdlg(1,'白萝卜','','wxcy1026');"><td>白萝卜</td><td>&nbsp;</td><td>25.00</td><td>1.00</td><td>1.33</td><td>详情</td></tr></table>
<script>function opdlg(mid,sname,sItemSpec,marketname) { var URL = "PriceShow.aspx?mid=" + mid + "&sname=" + sname + "&marketname=" + marketname + "&sItemSpec=" + sItemSpec; }</script>'''

def graph(sets,second=None,title='白萝卜'):
 def xml(rows):return '<graph>'+''.join("<set name='"+d+"' value='"+str(v)+"'/>" for d,v in rows)+'</graph>'
 first=xml(sets);other=first if second is None else xml(second)
 return '<html><head><title> -'+title+' </title></head><body><param NAME="flashvars" VALUE="&dataXML='+first+'&chartWidth=590"/><embed flashvars="&dataXML='+other+'&chartWidth=590"/></body></html>'

class ProduceHistoryTests(unittest.TestCase):
 def setUp(self):
  self.route=m.discover_routes(TABLE,URL,'2026-10-01')[0]
  self.old=m.current.parse_page(TABLE,URL,'2026-10-01')
 def test_routes_only_from_observed_exact_controls_and_builder(self):
  self.assertEqual(self.route['url'],m.graph_url('1','白萝卜','wxcy1026',''))
  self.assertEqual(self.route['id'],self.old[0]['id'])
  for bad in [TABLE.replace('PriceShow.aspx','HiddenApi.aspx'),TABLE.replace('wxcy1026','other'),TABLE.replace("白萝卜','','wxcy1026","白萝卜','一级','wxcy1026"),TABLE.replace('元/公斤','元/斤')]:
   with self.subTest(bad=bad),self.assertRaises(ValueError):m.discover_routes(bad,URL,'2026-10-01')
 def test_real_dated_values_and_duplicate_graph_representations(self):
  parsed=m.parse_history(graph([('2026-09-01','1.05'),('2026-09-02','1.14'),('2026-10-01','1.33')]),self.route,'2026-10-01')
  self.assertEqual(parsed['uniqueDateCount'],3)
  self.assertEqual(parsed['rawSetCount'],6)
  self.assertEqual(parsed['graphRepresentationCount'],2)
  self.assertEqual([p['date'] for p in parsed['points']],['2026-09-01','2026-09-02','2026-10-01'])
  self.assertTrue(all('low' not in p and 'high' not in p for p in parsed['points']))
 def test_ambiguous_same_date_rejected_not_averaged_or_last_selected(self):
  with self.assertRaisesRegex(ValueError,'Ambiguous historical date'):
   m.parse_history(graph([('2026-09-01','2.82'),('2026-09-01','3.11')]),self.route,'2026-10-01')
  with self.assertRaisesRegex(ValueError,'representations disagree'):
   m.parse_history(graph([('2026-09-01','1.05')],[('2026-09-01','1.06')]),self.route,'2026-10-01')
 def test_invalid_future_or_nonpositive_history_is_rejected(self):
  cases=[[('2026-10-02','1')],[('2026-02-30','1')],[('2026-9-1','1')],[('2026-09-01','0')],[('2026-09-01','-1')],[('2026-09-01','nan')]]
  for rows in cases:
   with self.subTest(rows=rows),self.assertRaises(ValueError):m.parse_history(graph(rows),self.route,'2026-10-01')
  with self.assertRaises(ValueError):m.parse_history(graph([('2026-09-01','1')],title='黄瓜'),self.route,'2026-10-01')
  with self.assertRaises(ValueError):m.parse_history('<title>-白萝卜</title>',self.route,'2026-10-01')
 def test_route_market_url_and_unit_identity_checked(self):
  raw=graph([('2026-09-01','1.05')])
  for change in [dict(url=self.route['url']+'&extra=1'),dict(unit='元/斤'),dict(marketParam='wxxc1216'),dict(mid='2')]:
   with self.subTest(change=change),self.assertRaises(ValueError):m.parse_history(raw,{**self.route,**change},'2026-10-01')
 def test_merge_preserves_quote_range_and_source_and_adds_no_ranges(self):
  history=m.parse_history(graph([('2026-09-01','1.05'),('2026-10-01','1.33')]),self.route,'2026-10-01')
  before=copy.deepcopy(self.old)
  merged=m.merge_history(self.old,[history])
  self.assertEqual(self.old,before)
  self.assertEqual(merged[0]['points'][-1],before[0]['points'][0])
  self.assertEqual(merged[0]['points'][0],dict(date='2026-09-01',value=1.05,sourceUrl=self.route['url']))
  self.assertIn('历史曲线未公布最低/最高价',merged[0]['historyNote'])
 def test_merge_conflict_is_atomic_and_invalid_identity_fails(self):
  history=m.parse_history(graph([('2026-09-01','1.05'),('2026-10-01','1.34')]),self.route,'2026-10-01')
  before=copy.deepcopy(self.old)
  with self.assertRaisesRegex(ValueError,'mean conflict'):m.merge_history(self.old,[history])
  self.assertEqual(self.old,before)
  with self.assertRaises(ValueError):m.merge_history(self.old,[{**history,'id':'unknown'}])
  history['points']=[dict(date='2026-09-01',value=1.05,low=1.0,sourceUrl=self.route['url'])]
  with self.assertRaisesRegex(ValueError,'cannot supply quote ranges'):m.merge_history(self.old,[history])
if __name__=='__main__':unittest.main()
