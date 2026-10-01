"""Import public, named-market single-produce quotes without inventing missing dates.

The primary provider is Wuxi Chaoyang Group. value is the provider's published
single-item mean, not the midpoint, a national mean, or a retail/SKU price.
Only specifically selected items are imported. No proprietary API is used.
"""
import copy, datetime, hashlib, html, math, re, urllib.parse

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
    for line in text.splitlines():
        line = re.sub(r'\s+', ' ', line.replace('|', ' ')).strip()
        match = re.fullmatch(r'(' + '|'.join(map(re.escape,names)) + r')\s+(.*?)\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(?:详情)?', line)
        if not match:
            continue
        name, spec, high, low, value = match.groups()
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
                if p['date'] in points and any(points[p['date']].get(k) != p.get(k) for k in ('value','low','high')):
                    raise ValueError('Conflicting published quotation for same date')
                points[p['date']] = p
            latest = item if item['sourceUpdatedAt'] >= before['sourceUpdatedAt'] else before
            combined = {**latest, 'points': sorted(points.values(),key=lambda p:p['date'])}
            combined['retrievedAt'] = max(item.get('retrievedAt',''),before.get('retrievedAt',''))
            result[item['id']] = combined
        else:
            result[item['id']] = copy.deepcopy(item)
    return list(result.values())


def discover_pages(raw,url):
    """Follow only same-market numbered page links actually published by provider."""
    type_ = validate_url(url)
    raw = raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw
    found = [url]
    for href in re.findall(r'<a\b[^>]*href=[\"\']([^\"\']+)[\"\']',raw,re.I):
        target = urllib.parse.urljoin(url,html.unescape(href))
        try:
            if validate_url(target) != type_:continue
        except (ValueError,TypeError):continue
        query = urllib.parse.parse_qs(urllib.parse.urlparse(target).query)
        page = query.get('PageNo',['1'])[0]
        if page.isdigit() and 1 <= int(page) <= 20 and target not in found:
            found.append(target)
    return found


def refresh_source(old, asof, download, archive=None):
    result = copy.deepcopy(old)
    observed = set()
    for type_ in MARKETS:
        url = BASE + '/Price.aspx?Type=' + str(type_)
        raw = download(url)
        pages = discover_pages(raw,url)
        for page_url in pages:
            page_raw = raw if page_url == url else download(page_url)
            try:
                items = parse_page(page_raw,page_url,asof)
            except ValueError as error:
                # Numbered pages legitimately may have none of the small selection.
                if str(error) == 'No selected produce quotes in page':continue
                raise
            observed.update(i['id'] for i in items)
            result = merge(result,items)
            if archive is not None:
                archive.mkdir(parents=True,exist_ok=True)
                (archive/('chaoyang-'+hashlib.sha256(page_raw).hexdigest()+'.html')).write_bytes(page_raw)
    if not observed:
        raise ValueError('No market observations verified')
    return result
