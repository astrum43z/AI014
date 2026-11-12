/** Mainland-friendly, local-only helpers. Never fetch, scan, or identify people. */
const LIMIT = 12000;
const MAX_LINKS = 20;
const SENSITIVE_KEY = /(?:token|secret|password|passwd|api.?key|auth|session|code|ticket|email|phone|mobile|身份证|密码|验证码)/i;
const LINK_DISCLAIMER = '仅拆解你提供的文本，没有访问目标网站或查询安全数据库。没有提示不代表安全，短链接的最终去向仍未知。';
const BUSINESS_DISCLAIMER = '仅检查统一社会信用代码的字符与校验位，不查询登记数据库，不证明企业存在、存续、资质或信用。请以官方登记信息为准。';
const SHORT_HOSTS = ['xhslink.com', 'b23.tv', 'v.douyin.com', 't.cn'];
const PLATFORMS = [
  ['小红书', ['xiaohongshu.com', 'xhslink.com']], ['哔哩哔哩', ['bilibili.com', 'b23.tv']],
  ['抖音', ['douyin.com']], ['微博', ['weibo.com', 'weibo.cn', 't.cn']],
  ['微信', ['weixin.qq.com']], ['知乎', ['zhihu.com']], ['百度', ['baidu.com']],
];
const isDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);
const asciiWidth = value => value.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
function trimEndPunctuation(value) {
  value = value.replace(/[.,;:!?]+$/, '');
  // Preserve balanced parentheses in legitimate paths. Remove closing prose wrappers.
  while (value.endsWith(')') && (value.match(/\)/g) || []).length > (value.match(/\(/g) || []).length) value = value.slice(0, -1);
  while (value.endsWith(']') && (value.match(/\]/g) || []).length > (value.match(/\[/g) || []).length) value = value.slice(0, -1);
  return value.replace(/[.,;:!?]+$/, '');
}
export function analyzeSharedText(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('请粘贴分享文案或网址。');
  if ([...raw].length > LIMIT) throw new Error('文本最多支持 12,000 个字符，请分段检查。');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(raw)) throw new Error('文本包含不可见控制字符，请清理后重试。');
  // A protocol-less www token must not be a suffix of another hostname or scheme.
  const candidates = [...raw.matchAll(/https?:\/\/[^\s<>"'`，。！？；、（）【】《》“”‘’]+|(?:^|[^A-Za-z0-9_./:@-])(www\.[^\s<>"'`，。！？；、（）【】《》“”‘’]+)/gi)].map(match => match[1] || match[0]);
  const links = [], rejected = [], seen = new Set();
  let truncated = false;
  for (const candidate of candidates) {
    const value = trimEndPunctuation(candidate);
    const assumedHttps = /^www\./i.test(value);
    let parsed;
    try {
      if (value.includes('\\')) throw new Error('网址含反斜线，容易造成歧义，未纳入结果。');
      parsed = new URL(assumedHttps ? `https://${value}` : value);
      if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('网址格式无效，未纳入结果。');
      if (parsed.username || parsed.password || /@/.test(value.split('/')[2] || '')) throw new Error('网址带有用户名或密码部分，可能混淆真正域名，未纳入结果。');
    } catch (error) {
      rejected.push({ reason: error instanceof TypeError ? '发现无法解析的网址，未纳入结果。' : error.message });
      continue;
    }
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    if (links.length >= MAX_LINKS) { truncated = true; continue; }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const shortLink = SHORT_HOSTS.some(domain => isDomain(hostname, domain));
    const platform = PLATFORMS.find(([, domains]) => domains.some(domain => isDomain(hostname, domain)))?.[0] || '';
    const warnings = [];
    if (value !== candidate) warnings.push('已去掉末尾疑似文案标点；如标点属于原网址，请回原应用核对完整链接。');
    if (/[\u202A-\u202E\u2066-\u2069]/.test(candidate)) warnings.push('网址含改变文字显示方向的不可见字符，请勿根据显示顺序判断域名。');
    if (assumedHttps) warnings.push('原文没有协议，暂按 HTTPS 拆解；未验证该网址是否可用。');
    if (parsed.protocol === 'http:') warnings.push('使用 HTTP，传输未加密。');
    if (shortLink) warnings.push('这是常见短链接域名；本地无法展开，不能从短链判断最终网站。');
    if (hostname.split('.').some(label => label.startsWith('xn--'))) warnings.push('包含国际化编码域名，请核对拼写及相似字符。');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith('[')) warnings.push('网址使用 IP 地址，不是可直接辨认的网站域名。');
    if (!hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(hostname)) warnings.push('这可能是本地或保留域名，不能据此判断公开网站身份。');
    const impersonated = PLATFORMS.filter(([, domains]) => domains.some(domain => hostname.includes(domain) && !isDomain(hostname, domain))).map(([name]) => name);
    if (impersonated.length) warnings.push(`域名中虽然出现${impersonated.join('、')}相关字样，但不属于这里识别的对应域名；请核对完整主机名。`);
    if ([...parsed.searchParams.keys()].some(key => /^(?:url|u|target|redirect|redirect_uri|redirect_url|next|return|returnurl|return_url)$/i.test(key))) warnings.push('包含可能用于跳转的参数；当前域名不一定是最终到达的网站。');
    const sensitive = [...parsed.searchParams.keys()].filter(key => SENSITIVE_KEY.test(key));
    const display = new URL(parsed.href);
    if (sensitive.length) {
      warnings.push('查询参数可能含登录凭证或个人信息，显示时已遮盖相关值；不要将原链接转发给他人。');
      for (const key of new Set(sensitive)) display.searchParams.set(key, '已隐藏');
    }
    if (parsed.hash) {
      warnings.push('网址含 # 后的片段，可能也包含私密信息，展示时已隐藏；不要据此认为原链接可安全分享。');
      display.hash = '已隐藏';
    }
    links.push({ url: parsed.href, displayUrl: display.href, hostname, protocol: parsed.protocol, path: parsed.pathname, shortLink, platform, warnings, queryKeys: [...parsed.searchParams.keys()], assumedHttps });
  }
  if (!links.length && !rejected.length) throw new Error('没有找到 HTTP(S) 或 www 开头的网址。请在原应用里复制链接，再粘贴到这里。');
  return { links, rejected, truncated, disclaimer: LINK_DISCLAIMER };
}

const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const CODE_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
export function checkBusinessCode(raw) {
  if (typeof raw !== 'string') throw new Error('请输入 18 位统一社会信用代码。');
  const code = asciiWidth(raw).replace(/\s/g, '').toUpperCase();
  const base = { code, valid: false, formatValid: false, disclaimer: BUSINESS_DISCLAIMER };
  if (code.length !== 18) return { ...base, message: '统一社会信用代码应为 18 位；本工具不检查个人身份证号或旧版注册号。' };
  if ([...code].some(char => !CODE_ALPHABET.includes(char))) return { ...base, message: '含有不允许的字符。统一社会信用代码不使用 I、O、S、V、Z，请对照原件检查。' };
  const sum = [...code.slice(0, 17)].reduce((total, char, index) => total + CODE_ALPHABET.indexOf(char) * CODE_WEIGHTS[index], 0);
  const valid = CODE_ALPHABET[(31 - sum % 31) % 31] === code[17];
  return { ...base, formatValid: true, valid, message: valid ? '字符与校验位匹配。下一步请到官方登记系统核对名称及登记状态。' : '校验位不匹配，可能存在抄写错误。请对照原件核对，不要据此认定企业有问题。' };
}

export function buildCnSearch(raw) {
  if (typeof raw !== 'string') throw new Error('请输入公司名、品牌或公开昵称。');
  const query = asciiWidth(raw).trim().replace(/\s+/g, ' ');
  if (!query || [...query].length > 80) throw new Error('请输入 1–80 个字符的公司名、品牌或公开昵称。');
  if (/[\u0000-\u001F\u007F]/.test(raw)) throw new Error('搜索词不能包含控制字符或换行。');
  const compact = query.replace(/[\s()+.-]/g, '');
  if (/(?:^|\D)(?:86)?1[3-9]\d{9}(?:\D|$)/.test(compact) || /(?:^|\D)(?:\d{17}[\dXx]|\d{15})(?:\D|$)/.test(compact) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(query)) throw new Error('请不要输入手机号、身份证号或邮箱。这里只整理公司名、品牌和公开昵称的检索入口。');
  if (/(?:密码|验证码|口令|令牌|password|passwd|token|secret|api[_ -]?key)\s*[:：=]|https?:\/\//i.test(query)) throw new Error('请移除密码、凭证和网址，只输入要核验的公开名称。');
  const note = '外部手动检索；点击后搜索词会发送给搜索引擎。结果可能不完整，不能证明身份或真实性。';
  const baidu = q => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`;
  return [
    { name: '百度 · 综合搜索', url: baidu(query), note },
    { name: '必应 · 交叉核验', url: `https://cn.bing.com/search?q=${encodeURIComponent(query)}`, note },
    ...[['知乎', 'zhihu.com'], ['哔哩哔哩', 'bilibili.com'], ['小红书', 'xiaohongshu.com'], ['抖音', 'douyin.com']].map(([name, domain]) => ({ name: `${name} · 百度收录页`, url: baidu(`${query} site:${domain}`), note: `${note} 这是搜索引擎已收录页面，不是平台完整站内搜索。` })),
  ];
}
