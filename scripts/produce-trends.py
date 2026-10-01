"""Import public, named-market single-produce quotes without inventing missing dates.

The primary provider is Wuxi Chaoyang Group. value is the provider's published
single-item mean, not the midpoint, a national mean, or a retail/SKU price.
Only specifically selected items are imported. No proprietary API is used.
"""
import copy, datetime, hashlib, html, math, re, urllib.parse
from html.parser import HTMLParser

SOURCE_KEY = 'chaoyang'
HOST = 'www.chinachaoyang.com'
BASE = 'https://' + HOST
VEGETABLES = ('白萝卜','菠菜','包菜','贝贝南瓜','扁豆','菜心','大白菜','冬瓜','黄瓜','韭菜','莲藕','长豆')
FRUITS = ('嘎啦苹果','菠萝','草莓','翠冠梨','砀山梨','冬枣','国产火龙果','哈密瓜')
MARKETS = {1: '无锡朝阳蔬菜市场', 2: '无锡锡澄果品市场'}


def validate_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme != 'https' or p.hostname not in (HOST, 'chinachaoyang.com') or p.path not in ('/Price.aspx','/Agri/Price.aspx'):
        raise ValueError('Untrusted produce quotation URL')
    type_ = int(urllib.parse.parse_qs(p.query).get('Type', ['1'])[0])
    if type_ not in MARKETS:
        raise ValueError('Unsupported wholesale market')
    return type_


def plain(raw):
    text = raw.decode('utf-8-sig') if isinstance(raw, bytes) else raw
    text = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', text, flags=re.S|re.I)
    text = re.sub(r'</(?:td|th)>', ' | ', text, flags=re.I)
    text = re.sub(r'</(?:tr|p|div|li|h[1-6])>|<br\s*/?>', '\n', text, flags=re.I)
    text = html.unescape(re.sub(r'<[^>]+>', '', text))
    # Archived search-rendered source pages contain line prefixes; dates remain
    # source publication dates, never the search crawl or retrieval dates.
    return re.sub(r'^L\d+:\s*', '', text, flags=re.M)



class _TableRows(HTMLParser):
    """Read cell boundaries; indentation/newlines are not quotation boundaries."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.rows = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.ignored += 1
        if self.ignored:
            return
        if tag == 'tr':
            if self.stack:
                self.stack[-1]['nested'] = True
            self.stack.append(dict(cells=[], cell=None, nested=False))
        elif tag in ('td', 'th') and self.stack:
            cell = []
            self.stack[-1]['cells'].append(cell)
            self.stack[-1]['cell'] = cell
        elif tag == 'br' and self.stack and self.stack[-1]['cell'] is not None:
            self.stack[-1]['cell'].append(' ')

    def handle_data(self, data):
        if not self.ignored and self.stack and self.stack[-1]['cell'] is not None:
            self.stack[-1]['cell'].append(data)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.ignored = max(0, self.ignored - 1)
            return
        if self.ignored:
            return
        if tag in ('td', 'th') and self.stack:
            self.stack[-1]['cell'] = None
        elif tag == 'tr' and self.stack:
            row = self.stack.pop()
            # Outer layout rows contain nested tables; never concatenate their
            # unrelated cells into a quote or emit duplicate inner-table data.
            if not row['nested']:
                self.rows.append([re.sub(r'\s+', ' ', ''.join(c)).strip() for c in row['cells']])


def quotation_rows(raw, names):
    source = raw.decode('utf-8-sig') if isinstance(raw, bytes) else raw
    if re.search(r'<tr\b', source, re.I):
        parser = _TableRows()
        parser.feed(source)
        parser.close()
        for cells in parser.rows:
            if not cells or cells[0] not in names:
                continue
            if len(cells) not in (5, 6) or (len(cells) == 6 and cells[5] not in ('', '详情')):
                raise ValueError('Malformed selected quotation row')
            if not all(re.fullmatch(r'\d+(?:\.\d+)?', value) for value in cells[2:5]):
                raise ValueError('Non-numeric selected quotation')
            yield tuple(cells[:5])
    else:
        # Source-indexed text evidence has one complete row per line.
        pattern = r'(' + '|'.join(map(re.escape, names)) + r')\s+(.*?)\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(?:详情)?'
        for line in plain(source).splitlines():
            match = re.fullmatch(pattern, re.sub(r'\s+', ' ', line.replace('|', ' ')).strip())
            if match:
                yield match.groups()


def parse_page(raw, url, asof):
    type_ = validate_url(url)
    text = plain(raw)
    expected = ('朝阳蔬菜市场' if type_ == 1 else '锡澄果品市场') + '批发价格'
    if expected not in re.sub(r'\s+', '', text) or '单位：元/公斤' not in re.sub(r'\s+', '', text):
        raise ValueError('Missing market heading or original quotation unit')
    header = re.sub(r'[\s|]+', '', text)
    if '品名产地/规格最高价最低价均价' not in header:
        raise ValueError('Unknown quotation table columns')
    match = re.search(r'发布时间[：:]\s*(20\d{2})/(\d{1,2})/(\d{1,2})', text)
    if not match:
        raise ValueError('Missing source publication date')
    date = datetime.date(*map(int, match.groups())).isoformat()
    if date > asof:
        raise ValueError('Future source quotation')
    names = VEGETABLES if type_ == 1 else FRUITS
    result = []
    seen = set()
    for name, spec, high, low, value in quotation_rows(raw, names):
        high, low, value = map(float, (high, low, value))
        if not all(math.isfinite(v) and v > 0 for v in (high,low,value)) or not low <= value <= high:
            raise ValueError('Invalid quote range for ' + name)
        if name in seen:
            raise ValueError('Ambiguous duplicate quote for ' + name)
        seen.add(name)
        market = MARKETS[type_]
        id_ = 'cn-chaoyang-' + hashlib.sha256((str(type_) + ':' + name + ':' + spec).encode()).hexdigest()[:10]
        coverage = (market + '公布的单品批发均价；区间为该日原表最低价至最高价，均价直接取原表，非区间中点。'
                    + ('原表产地/规格：' + spec + '。' if spec else '原表产地/规格为空，未细分产地、等级及包装。')
                    + '不代表全国价格、超市零售价或指定SKU成交价。仅含已核验日期的公开报价，缺失日期不插值。')
        result.append(dict(id=id_,name=name,category='consumer',symbol=market+' · 单品批发',unit='元/公斤',
            source='无锡朝阳集团 · '+market,sourceKey=SOURCE_KEY,sourceUrl=url,sourceUpdatedAt=date,
            frequency='日度公布 · 指定市场单品均价',coverage=coverage,
            points=[dict(date=date,value=value,low=low,high=high,sourceUrl=url)],retrievedAt=asof))
    if not result:
        raise ValueError('No selected produce quotes in page')
    return result


def merge(old, new):
    """Union genuine dated observations, preserving absent seasonal items."""
    result = {i['id']: copy.deepcopy(i) for i in old}
    for item in new:
        before = result.get(item['id'])
        if before:
            if (before['unit'],before['sourceKey'],before['name']) != (item['unit'],item['sourceKey'],item['name']):
                raise ValueError('Produce series identity or unit changed')
            points = {p['date']:p for p in before['points']}
            for p in item['points']:
                if p['date'] in points and any(points[p['date']].get(k) is not None and p.get(k) is not None and points[p['date']][k] != p[k] for k in ('value','low','high')):
                    raise ValueError('Conflicting published quotation for same date')
                points[p['date']] = {**points.get(p['date'], {}), **p}
            latest = item if item['sourceUpdatedAt'] >= before['sourceUpdatedAt'] else before
            combined = {**before, **latest, 'points': sorted(points.values(),key=lambda p:p['date'])}
            combined['retrievedAt'] = max(item.get('retrievedAt',''),before.get('retrievedAt',''))
            result[item['id']] = combined
        else:
            result[item['id']] = copy.deepcopy(item)
    return list(result.values())


def page_number(url):
    validate_url(url)
    page = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('PageNo', ['1'])[0]
    if not page.isdigit() or not 1 <= int(page) <= 20:
        raise ValueError('Invalid quotation page number')
    return int(page)


def discover_pages(raw,url):
    """Follow published same-market links, deduplicating numbered page aliases."""
    type_ = validate_url(url)
    raw = raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw
    found = [url]
    seen = {page_number(url)}
    for href in re.findall(r'<a\b[^>]*href=[\"\']([^\"\']+)[\"\']',raw,re.I):
        target = urllib.parse.urljoin(url,html.unescape(href))
        try:
            if validate_url(target) != type_:continue
            page = page_number(target)
        except (ValueError,TypeError):continue
        if page not in seen:
            seen.add(page)
            found.append(target)
    return found


def refresh_source(old, asof, download, archive=None):
    result = copy.deepcopy(old)
    observed = set()
    for type_ in MARKETS:
        url = BASE + '/Price.aspx?Type=' + str(type_)
        raw = download(url)
        pages = discover_pages(raw,url)
        wanted = set(VEGETABLES if type_ == 1 else FRUITS)
        # Prior observations are hints only: request those page numbers only if
        # the current first page actually links to them. Never invent a URL.
        priority = set()
        for item in old:
            if item.get('name') not in wanted:continue
            for prior_url in [item.get('sourceUrl')] + [p.get('sourceUrl') for p in item.get('points',[])]:
                try:
                    if validate_url(prior_url) == type_:priority.add(page_number(prior_url))
                except (ValueError,TypeError,AttributeError):continue
        pages.sort(key=lambda page: (page_number(page) != 1, page_number(page) not in priority, page_number(page)))
        found_names = set()
        for page_url in pages:
            page_raw = raw if page_url == url else download(page_url)
            try:
                items = parse_page(page_raw,page_url,asof)
            except ValueError as error:
                # Numbered pages legitimately may have none of the selection.
                if str(error) == 'No selected produce quotes in page':continue
                raise
            observed.update(i['id'] for i in items)
            found_names.update(i['name'] for i in items)
            result = merge(result,items)
            if archive is not None:
                archive.mkdir(parents=True,exist_ok=True)
                (archive/('chaoyang-'+hashlib.sha256(page_raw).hexdigest()+'.html')).write_bytes(page_raw)
            if wanted <= found_names:
                break
    if not observed:
        raise ValueError('No market observations verified')
    return result
