/** Public nickname search entrances, never account existence or identity matching. */
export function validatePublicNickname(raw) {
  if (typeof raw !== 'string') throw new Error('请输入公开昵称。');
  if (/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(raw)) throw new Error('昵称不能包含换行、控制字符或改变显示方向的字符。');
  // Reject unpaired UTF-16 before URL encoding; preserve legitimate emoji pairs.
  if (/\p{Surrogate}/u.test(raw)) throw new Error('昵称中含有不完整字符，请重新输入。');
  const value = raw.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!value || [...value].length > 64) throw new Error('公开昵称须为 1–64 个字符，支持中文、英文、数字和常用昵称符号。');
  const privacyValue = value.normalize('NFKC');
  const compact = privacyValue.replace(/[\s()+.\-]/g, '');
  if (/(?:^|\D)(?:86)?1[3-9]\d{9}(?:\D|$)/.test(compact) || /(?:^|\D)(?:\d{17}[\dXx]|\d{15})(?:\D|$)/.test(compact) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(privacyValue)) throw new Error('请只输入公开昵称，不要输入手机号、身份证号或邮箱。');
  if (/https?:\/\/|(?:密码|验证码|口令|令牌|password|passwd|token|secret|api[_ -]?key)\s*[:：=]/i.test(privacyValue)) throw new Error('请移除网址、密码和凭证，只输入公开昵称。');
  return value;
}
// Exact public templates and current limitations are documented in README.md.
const encoded = encodeURIComponent;
const indexed = (name, domain) => ({site:`${name} · 百度收录页`, template:q=>`https://www.baidu.com/s?wd=${encoded(`${q} site:${domain}`)}`, searchType:'index', note:'仅搜索百度已收录的公开页面，不是平台用户搜索，也不覆盖全部内容。点击后将检索词发送给百度。', linkLabel:'查看百度收录候选页 ↗'});
const PLATFORMS = [
  {site:'哔哩哔哩 · 用户', template:q=>`https://search.bilibili.com/zh-Hans/upuser?keyword=${encoded(q)}`, searchType:'users', note:'官方用户搜索入口。结果仅是昵称候选，同名不代表同一人；可能需要登录或验证。', linkLabel:'到 B 站查看用户候选 ↗'},
  {site:'微博 · 用户', template:q=>`https://s.weibo.com/user?q=${encoded(q)}`, searchType:'users', note:'官方用户搜索入口，查看更多结果可能需登录；昵称相同不证明身份。', linkLabel:'到微博查看用户候选 ↗'},
  {site:'抖音 · 综合搜索', template:q=>`https://www.douyin.com/search/${encoded(q)}`, searchType:'mixed', note:'官方综合搜索，通常需登录；可在平台内切换“用户”。未替你查询账号。', linkLabel:'打开抖音搜索 ↗'},
  {site:'小红书 · 综合搜索', template:q=>`https://www.xiaohongshu.com/search_result?keyword=${encoded(q)}`, searchType:'mixed', note:'官方综合搜索，需登录后查看结果；可在平台内切换“用户”。未替你查询账号。', linkLabel:'打开小红书搜索 ↗'},
  {site:'微信公众号文章 · 搜狗', template:q=>`https://weixin.sogou.com/weixin?type=2&query=${encoded(q)}&ie=utf8`, searchType:'content', note:'检索公开微信公众号文章，不是个人微信账号，也不是公众号身份匹配；可能需要验证。', linkLabel:'查看公开微信文章候选 ↗'},
  indexed('知乎','zhihu.com'), indexed('快手','kuaishou.com'), indexed('百度贴吧','tieba.baidu.com'),
];
export function buildDomesticLeads(raw) {
  const username = validatePublicNickname(raw);
  return PLATFORMS.map(({site, template, searchType, note, linkLabel}) => ({site, url:template(username), username, source:'platform-search', status:'unverified', searchType, note, linkLabel}));
}
