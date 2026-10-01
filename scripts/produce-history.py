"""One-time, evidence-backed bootstrap of public Wuxi single-item mean history.

Do not call this from the daily collector. Graphs provide dated means only, not
historical quote ranges. Ambiguous same-date values are rejected, never averaged
or selected by position. Requests are discovered from provider table controls.
"""
import copy, datetime, hashlib, html, importlib.util, math, pathlib, re, urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

_spec = importlib.util.spec_from_file_location('produce_current', pathlib.Path(__file__).with_name('produce-trends.py'))
current = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(current)
MARKET_CODES = {1: 'wxcy1026', 2: 'wxxc1216'}


def graph_url(mid, name, market, spec):
    return current.BASE + '/PriceShow.aspx?' + urllib.parse.urlencode(
        {'mid': str(mid), 'sname': name, 'marketname': market, 'sItemSpec': spec})


def discover_routes(raw, table_url, asof):
    """Use only item controls and the route builder observed on the source page."""
    market_type = current.validate_url(table_url)
    source = raw.decode('utf-8-sig') if isinstance(raw, bytes) else raw
    compact = re.sub(r'\s+', '', source)
    builder = '"PriceShow.aspx?mid="+mid+"&sname="+sname+"&marketname="+marketname+"&sItemSpec="+sItemSpec'
    if builder not in compact:
        raise ValueError('Public historical route builder not found')
    quoted = {item['name']:item for item in current.parse_page(raw,table_url,asof)}
    routes = {}
    for mid,name,spec,market in re.findall(r"onclick=\"opdlg\((\d+),'([^']*)','([^']*)','([^']*)'\);\"",source):
        name,spec,market = map(html.unescape,(name,spec,market))
        if name not in quoted:continue
        if mid != '1' or market != MARKET_CODES[market_type]:
            raise ValueError('Unexpected market or historical quote mode')
        item = quoted[name]
        expected_id = 'cn-chaoyang-' + hashlib.sha256((str(market_type)+':'+name+':'+spec).encode()).hexdigest()[:10]
        if expected_id != item['id']:
            raise ValueError('Historical control specification differs from table quote')
        route = dict(id=item['id'],name=name,mid=mid,spec=spec,marketParam=market,
            marketType=market_type,unit='元/公斤',tableUrl=table_url,
            url=graph_url(mid,name,market,spec))
        if name in routes and routes[name] != route:
            raise ValueError('Conflicting item history controls')
        routes[name] = route
    if set(routes) != set(quoted):
        raise ValueError('Missing selected-item history controls')
    return list(routes.values())


class _Graphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.graphs = []
        self.title_parts = []
        self.in_title = False
    def handle_starttag(self,tag,attrs):
        attrs = dict(attrs)
        if tag == 'title':self.in_title=True
        value = attrs.get('value','') if tag == 'param' and attrs.get('name','').lower() == 'flashvars' else attrs.get('flashvars','') if tag == 'embed' else ''
        if value:
            found = re.findall(r'(<graph\b.*?</graph>)',value,re.S)
            if len(found) != 1:raise ValueError('Malformed historical graph container')
            self.graphs.extend(found)
    def handle_endtag(self,tag):
        if tag == 'title':self.in_title=False
    def handle_data(self,data):
        if self.in_title:self.title_parts.append(data)


def parse_history(raw, route, asof):
    """Return genuine dated means after checking both graph representations."""
    source = raw.decode('utf-8-sig') if isinstance(raw,bytes) else raw
    market_type = current.validate_url(route['tableUrl'])
    if route['unit'] != '元/公斤' or route['marketParam'] != MARKET_CODES[market_type] or str(route['mid']) != '1':
        raise ValueError('Unverified historical market or unit')
    if route['url'] != graph_url(route['mid'],route['name'],route['marketParam'],route['spec']):
        raise ValueError('Historical URL differs from observed control')
    parser = _Graphs();parser.feed(source);parser.close()
    if ''.join(parser.title_parts).strip() != '-'+route['name']:
        raise ValueError('Historical item title mismatch')
    if not parser.graphs:raise ValueError('No public historical graph data')
    representations=[];set_count=0
    for graph in parser.graphs:
        if '<!DOCTYPE' in graph.upper() or '<!ENTITY' in graph.upper():raise ValueError('Unsupported historical XML')
        try:root=ET.fromstring(graph)
        except ET.ParseError as error:raise ValueError('Malformed historical XML') from error
        if root.tag != 'graph' or not list(root):raise ValueError('Empty historical graph')
        points={}
        for entry in root:
            if entry.tag != 'set':raise ValueError('Unlabelled multi-series historical graph')
            date,value=entry.get('name',''),entry.get('value','')
            if not re.fullmatch(r'20\d{2}-\d{2}-\d{2}',date):raise ValueError('Invalid historical date')
            datetime.date.fromisoformat(date)
            if date>asof:raise ValueError('Future historical observation')
            if not re.fullmatch(r'\d+(?:\.\d+)?',value):raise ValueError('Invalid historical mean')
            value=float(value)
            if not math.isfinite(value) or value<=0:raise ValueError('Non-positive historical mean')
            if date in points and points[date]!=value:raise ValueError('Ambiguous historical date '+date)
            points[date]=value;set_count+=1
        representations.append(points)
    if any(points!=representations[0] for points in representations[1:]):
        raise ValueError('Historical graph representations disagree')
    points=[dict(date=date,value=value,sourceUrl=route['url']) for date,value in sorted(representations[0].items())]
    return dict(**route,points=points,uniqueDateCount=len(points),firstDate=points[0]['date'],lastDate=points[-1]['date'],
        graphRepresentationCount=len(representations),rawSetCount=set_count,retrievedAt=asof,
        semantics='指定市场单品批发均价；图表仅公布均价，不含历史最低/最高价。单位由同一条目的市场原表核验为元/公斤。')


def merge_history(old, histories):
    """Atomic backfill; preserve overlapping table ranges and provenance intact."""
    result={item['id']:copy.deepcopy(item) for item in old}
    for history in histories:
        item=result.get(history['id'])
        if item is None or item.get('sourceKey')!='chaoyang' or item['name']!=history['name'] or item['unit']!=history['unit']:
            raise ValueError('Historical series identity differs from existing instrument')
        points={point['date']:point for point in item['points']}
        for point in history['points']:
            if 'low' in point or 'high' in point:raise ValueError('History graph cannot supply quote ranges')
            if point['date'] in points:
                if points[point['date']]['value']!=point['value']:
                    raise ValueError('Historical/table mean conflict: '+history['name']+' '+point['date'])
                # Original low/high and sourceUrl remain unchanged.
            else:points[point['date']]=copy.deepcopy(point)
        item['points']=sorted(points.values(),key=lambda point:point['date'])
        item['retrievedAt']=max(item.get('retrievedAt',''),history['retrievedAt'])
        item['historyNote']='已补充原站最近30天曲线的单品日均价历史（'+history['firstDate']+'至'+history['lastDate']+'，'+str(history['uniqueDateCount'])+'个日期）。历史曲线未公布最低/最高价，未推算区间；已核验原表日期的报价区间仍保留。'
        if item['points'][-1]['date']>item['sourceUpdatedAt']:
            item['sourceUpdatedAt']=item['points'][-1]['date']
            item['sourceUrl']=item['points'][-1]['sourceUrl']
    return list(result.values())
