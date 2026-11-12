/** Local-only helpers. No request is made and no account ownership is inferred. */
const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;
const CONTROL = /[\u0000-\u001f\u007f]/;
const DISCLAIMER = '所有链接均为未核实线索；同名账号不代表同一人。导入结果仅表示原报告声称存在，不证明身份、内容真实性或链接安全。仅用于合法、获授权的公开信息核查。';

export function validateUsername(raw) {
  if (typeof raw !== 'string') throw new Error('请输入用户名。');
  const name = raw.trim();
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(name)) {
    throw new Error('用户名须为 1–64 个英文字母、数字、下划线、点或连字符，且以字母、数字或下划线开头。');
  }
  return name;
}

const TEMPLATES = [
  ['GitHub', 'https://github.com/'], ['GitLab', 'https://gitlab.com/'],
  ['Reddit', 'https://www.reddit.com/user/'], ['Instagram', 'https://www.instagram.com/'],
  ['X', 'https://x.com/'], ['YouTube', 'https://www.youtube.com/@'],
  ['TikTok', 'https://www.tiktok.com/@'], ['Twitch', 'https://www.twitch.tv/'],
  ['Pinterest', 'https://www.pinterest.com/'], ['Medium', 'https://medium.com/@'],
];
export function buildLeads(raw) {
  const username = validateUsername(raw);
  return TEMPLATES.map(([site, prefix]) => ({ site, url: prefix + encodeURIComponent(username), username, status: 'unverified', source: 'manual' }));
}
export function sherlockCommand(raw) {
  return `sherlock ${validateUsername(raw)} --csv`;
}

function parsedUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 8192 || CONTROL.test(raw)) throw new Error('网址为空、过长或包含控制字符。');
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value) || /[\\\s]/.test(value)) throw new Error('请输入完整的 http:// 或 https:// 网址，不含空白或反斜线。');
  let url;
  try { url = new URL(value); } catch { throw new Error('网址格式无效。'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || /@/.test(value.split('/')[2])) throw new Error('不接受带用户名或密码的网址。');
  return url;
}
function ipv4Public(host) {
  const p = host.split('.').map(Number);
  return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 168 || p[1] === 0)) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51 && p[2] === 100)) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113));
}
function publicUrl(raw) {
  const url = parsedUrl(raw);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[')) {
    const h = host.slice(1, -1);
    if (h.startsWith('::ffff:')) {
      const parts = h.slice(7).split(':');
      if (parts.length !== 2) throw new Error('不能导入本地或非公网网址。');
      const a = parseInt(parts[0], 16), b = parseInt(parts[1], 16);
      if (!ipv4Public(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`)) throw new Error('不能导入本地或非公网网址。');
    } else if (!/^[23][\da-f]{3}:/.test(h) || h.startsWith('2001::') || /^2001:(?:db8|0|10|20):/.test(h) || h.startsWith('2002:')) {
      throw new Error('不能导入本地或非公网网址。');
    }
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (!ipv4Public(host)) throw new Error('不能导入本地或非公网网址。');
  } else if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)) {
    throw new Error('不能导入本地或非公网网址。');
  }
  return url;
}

export function analyzeUrl(raw) {
  const url = parsedUrl(raw);
  const query = [...url.searchParams].map(([key, value]) => ({ key, value }));
  const warnings = [];
  if (url.protocol === 'http:') warnings.push('使用 HTTP，传输未加密。');
  if (url.hostname.split('.').some(part => part.startsWith('xn--'))) warnings.push('域名包含国际化编码，请核对拼写及相似字符。');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.startsWith('[')) warnings.push('网址使用 IP 地址而非域名。');
  if (query.some(({ key }) => /(?:token|secret|password|passwd|api.?key|auth|session|code|email|phone)/i.test(key))) warnings.push('查询参数可能含敏感信息，分享前请检查。');
  return { url: url.href, protocol: url.protocol, hostname: url.hostname, port: url.port, path: url.pathname, query, fragment: url.hash, warnings };
}

// RFC 4180-style parsing with strict quote placement and bounded row count.
function csvRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const cell = () => { row.push(field); field = ''; closed = false; };
  const line = () => { cell(); rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error('报告最多支持 1000 行数据。'); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += ch;
    } else if (ch === ',') cell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; line(); }
    else if (ch === '"' && !field && !closed) quoted = true;
    else { if (closed || ch === '"') throw new Error('CSV 引号格式无效。'); field += ch; }
  }
  if (quoted) throw new Error('CSV 引号未闭合。');
  if (field || row.length || closed) line();
  return rows;
}
function safeLabel(value, fallback = '') {
  return typeof value === 'string' && value.length <= 128 && !CONTROL.test(value) ? value : fallback;
}
export function parseSherlockReport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('报告须为不超过 1 MiB 的文本。');
  text = text.replace(/^\uFEFF/, '');
  const leads = [], seen = new Set();
  const add = (raw, site, username) => {
    try {
      const url = publicUrl(raw);
      if (seen.has(url.href)) return;
      seen.add(url.href);
      leads.push({ site: safeLabel(site, url.hostname), url: url.href, username: safeLabel(username), status: 'unverified', source: 'sherlock-import', reported: true });
    } catch { /* Invalid or private URLs are not imported. */ }
  };
  // A CSV has a header, never infer columns from arbitrary URL-containing text.
  const first = text.split(/\r?\n/, 1)[0];
  if (!/^https?:\/\//i.test(first.trim()) && /,/.test(first)) {
    const rows = csvRows(text);
    const header = rows.shift().map(v => v.trim().toLowerCase());
    const required = ['username', 'name', 'url_main', 'url_user', 'exists', 'http_status', 'response_time_s'];
    if (header.length !== required.length || new Set(header).size !== header.length || required.some(h => !header.includes(h))) throw new Error('请导入 Sherlock --csv 原始报告，列名必须完整且不重复。');
    const indexes = Object.fromEntries(header.map((h, i) => [h, i]));
    for (const row of rows) {
      if (row.length !== header.length) throw new Error('CSV 数据列数与表头不一致。');
      if (/^(claimed|true|yes)$/i.test(row[indexes.exists].trim())) add(row[indexes.url_user], row[indexes.name], row[indexes.username]);
    }
  } else {
    const lines = text.split(/\r\n|\n|\r/);
    if (lines.at(-1) === '') lines.pop();
    if (lines.length > MAX_ROWS) throw new Error('报告最多支持 1000 行数据。');
    for (const line of lines) if (/^https?:\/\/\S+$/i.test(line.trim())) add(line.trim());
  }
  if (!leads.length) throw new Error('未找到有效报告线索。请导入 Sherlock 原始 CSV，或每行一个公网 HTTP(S) 网址的 TXT；CSV 仅导入 exists 为 Claimed、true 或 yes 的行。');
  return leads;
}

export function exportReport(leads, now = new Date()) {
  if (!Array.isArray(leads) || leads.length > MAX_ROWS) throw new Error('导出线索须为数组，且不超过 1000 条。');
  const generatedAt = new Date(now).toISOString();
  const clean = leads.map(lead => {
    const url = publicUrl(lead.url).href;
    return { site: safeLabel(lead.site, new URL(url).hostname), url, username: safeLabel(lead.username), status: 'unverified', source: ['sherlock-import', 'platform-search'].includes(lead.source) ? lead.source : 'manual', ...(lead.source === 'platform-search' ? {searchType:['users','content','index','mixed'].includes(lead.searchType) ? lead.searchType : 'mixed'} : {}), ...(lead.source === 'sherlock-import' && lead.reported === true ? { reported: true } : {}) };
  });
  return JSON.stringify({ schemaVersion: 1, generatedAt, disclaimer: DISCLAIMER, leads: clean }, null, 2)
    .replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
