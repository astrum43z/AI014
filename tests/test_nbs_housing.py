import importlib.util,pathlib,unittest,copy
R=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('nbs_housing',R/'scripts/nbs-housing.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
H='https://www.stats.gov.cn/sj/zxfb/202609/t20260915_1965304.html'
J='https://www.stats.gov.cn/sj/zxfbhjd/202602/t20260213_1962617.html'
C='https://www.stats.gov.cn/sj/zxfbhjd/202609/t20260909_1965263.html'
CJ='https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202602/t20260211_1962588.html'
def fixture(kind,month):return (R/'tests/fixtures'/('nbs-'+kind+'-'+month+'.html')).read_text()
class NBSHousingTests(unittest.TestCase):
 def test_all_cities_and_both_types_are_parsed_as_original_ratios(self):
  d=m.parse_housing(fixture('housing','2026-08'),H,'2026-10-01')
  self.assertEqual(len(d['new']),70);self.assertEqual(len(d['resale']),70);self.assertEqual(d['new']['北京'],[99.8,97.7,97.8]);self.assertEqual(d['resale']['上海'],[100.3,99.2,95.6]);self.assertEqual(d['publishedAt'],'2026-09-15');self.assertEqual(d['baseYear'],2025)
 def test_january_missing_ytd_stays_null_for_both_families(self):
  d=m.parse_housing(fixture('housing','2026-01'),J,'2026-10-01');self.assertEqual(d['new']['北京'],[99.7,97.6,None]);self.assertEqual(d['resale']['北京'],[99.8,91.3,None])
  d=m.parse_rent(fixture('rent','2026-01'),CJ,'2026-10-01');self.assertEqual((d['mom'],d['yoy'],d['ytd']),(-.1,-.4,None))
 def test_zero_and_negative_rental_percentages_are_preserved(self):
  d=m.parse_rent(fixture('rent','2026-08'),C,'2026-10-01');self.assertEqual((d['mom'],d['yoy'],d['ytd']),(0,-.6,-.5));self.assertEqual(d['publishedAt'],'2026-09-09')
 def test_wrong_type_denominator_duplicates_and_count_are_rejected(self):
  raw=fixture('housing','2026-08')
  for bad in [raw.replace('新建商品住宅销售价格指数','二手住宅销售价格指数',1),raw.replace('上月=100','2025年=100',1),raw.replace('<td>唐山</td>','<td>北京</td>',1),raw.replace('<td>99.8</td>','<td>NaN</td>',1),raw.replace('<td>北京</td>','<td></td>',1)]:
   with self.subTest(bad=bad[:50]),self.assertRaises(ValueError):m.parse_housing(bad,H,'2026-10-01')
 def test_unapproved_host_wrong_period_and_future_publication_are_rejected(self):
  raw=fixture('housing','2026-08')
  for url in [H.replace('www.stats.gov.cn','fake.example'),H.replace('https:','http:')]:
   with self.assertRaises(ValueError):m.parse_housing(raw,url,'2026-10-01')
  with self.assertRaises(ValueError):m.parse_housing(raw,H,'2026-09-01')
  with self.assertRaises(ValueError):m.parse_housing(raw.replace('2026年8月份70个','2024年8月份70个'),H,'2026-10-01')
 def test_missing_rent_row_or_changed_column_count_is_rejected(self):
  raw=fixture('rent','2026-08')
  for bad in [raw.replace('租赁房房租','居住'),raw.replace('<td>-0.5</td>',''),raw.replace('<td>-0.6</td>','<td>100</td>')]:
   with self.assertRaises(ValueError):m.parse_rent(bad,C,'2026-10-01')
if __name__=='__main__':unittest.main()
