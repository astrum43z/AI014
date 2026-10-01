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
 def test_live_shaped_multiline_html_and_nested_layout(self):
  # Reduced from the downloaded 2026-10-01 provider HTML, including its
  # separate header/data tables and whitespace within every quotation cell.
  page = """<html><body><table><tr><td>
   <h1>朝阳蔬菜市场批发价格</h1>
   <div class="pricetime"><ul>
    <li>发布时间：2026/10/1</li>
    <li id="PriceUnit">单位：元/公斤</li>
   </ul></div>
   <table><tr>
    <td>品名</td><td>产地/规格</td><td>最高价</td>
    <td>最低价</td><td>均价</td><td>曲线图</td>
   </tr></table>
   <table><tr class="tc gray" onclick="opdlg(1,'白萝卜','','wxcy1026');">
    <td height="30" class="tl">白萝卜</td>
    <td class="tl">&nbsp;&nbsp;</td>
    <td style="color:green">&nbsp;25.00&nbsp;</td>
    <td style="color:#ff0000">&nbsp;1.00&nbsp;</td>
    <td style="color:#001b92">&nbsp;1.33&nbsp;</td>
    <td class="tc">详情</td>
   </tr><tr class="tc gray">
    <td><span>菠菜</span></td>
    <td> &nbsp; </td>
    <td>16.00</td>
    <td>1.00</td>
    <td><span>6.43</span></td>
    <td>详情</td>
   </tr></table>
   </td></tr></table></body></html>"""
  rows=m.parse_page(page.encode(),URL,'2026-10-01')
  self.assertEqual([i['name'] for i in rows],['白萝卜','菠菜'])
  self.assertEqual(rows[0]['points'][0]['value'],1.33)
  self.assertEqual(rows[0]['points'][0]['high'],25.0)
  self.assertEqual(rows[1]['points'][0]['value'],6.43)
  self.assertIn('原表产地/规格为空',rows[0]['coverage'])
  with self.assertRaises(ValueError):m.parse_page(page.replace('25.00','--'),URL,'2026-10-01')
  with self.assertRaises(ValueError):m.parse_page(page.replace('<td style="color:green">&nbsp;25.00&nbsp;</td>',''),URL,'2026-10-01')
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
 def test_discover_deduplicates_page_one_and_query_order_aliases(self):
  raw='<a href="Price.aspx">home</a><a href="?Type=1">market</a><a href="?PageNo=1&amp;Type=1">1</a><a href="?PageNo=2&amp;Type=1">2</a><a href="?Type=1&amp;PageNo=2">next</a><a href="/Agri/Price.aspx?Type=1&amp;PageNo=2">alias</a>'
  self.assertEqual(m.discover_pages(raw,URL),[URL,'https://www.chinachaoyang.com/Price.aspx?PageNo=2&Type=1'])
 def test_refresh_prioritizes_published_prior_pages_and_stops_when_complete(self):
  def page(type_,names,date):
   return (('朝阳蔬菜市场' if type_==1 else '锡澄果品市场')+'批发价格\n发布时间：'+date+'\n单位：元/公斤\n品名 产地/规格 最高价 最低价 均价\n'+''.join(name+' 20.00 1.00 5.00 详情\n' for name in names)).encode()
  p2=m.BASE+'/Price.aspx?PageNo=2&Type=1';p4=m.BASE+'/Price.aspx?PageNo=4&Type=1';fruit=m.BASE+'/Price.aspx?Type=2'
  groups=[m.VEGETABLES[:6],('大白菜','冬瓜','长豆'),('黄瓜','韭菜','莲藕')]
  old=[]
  for url,names in zip([URL,p2,p4],groups):old=m.merge(old,m.parse_page(page(1,names,'2026/9/30'),url,'2026-10-01'))
  old=m.merge(old,m.parse_page(page(2,m.FRUITS,'2026/9/30'),fruit,'2026-10-01'))
  # A historical link alone is not permission to synthesize a request; it
  # must also be discovered in this source response.
  old[0]['points'].append(dict(date='2026-09-29',value=5.0,low=1.0,high=20.0,sourceUrl=m.BASE+'/Price.aspx?PageNo=9&Type=1'))
  links=''.join('<a href="?PageNo='+str(n)+'&amp;Type=1">'+str(n)+'</a>' for n in range(1,9))
  responses={URL:page(1,groups[0],'2026/10/1')+links.encode(),p2:page(1,groups[1],'2026/10/1'),p4:page(1,groups[2],'2026/10/1'),fruit:page(2,m.FRUITS,'2026/10/1')}
  requests=[]
  def download(url):
   requests.append(url)
   if url not in responses:raise AssertionError('Unnecessary or undiscovered request: '+url)
   return responses[url]
  out=m.refresh_source(old,'2026-10-01',download)
  self.assertEqual(requests,[URL,p2,p4,fruit])
  self.assertEqual(len(out),20)
  self.assertTrue(all(i['points'][-1]['date']=='2026-10-01' for i in out))
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
