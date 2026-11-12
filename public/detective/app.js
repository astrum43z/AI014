import {buildLeads, sherlockCommand, parseSherlockReport, analyzeUrl, exportReport} from './core.js?v=3';

import {buildDomesticLeads} from './accounts-core.js';

const $ = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role=tab]')];
function selectPanel(tab, focus = false) {
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1;
    $(item.dataset.panel).hidden = !active;
  }
  if (focus) tab.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectPanel(tab));
  tab.addEventListener('keydown', event => {
    const i = tabs.indexOf(tab);
    const next = {ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
    if (next !== undefined) { event.preventDefault(); selectPanel(tabs[next], true); }
  });
}
function status(id, message, error = false) { $(id).textContent = message; $(id).classList.toggle('error', error); }
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function facts(id, entries) {
  const container = $(id); container.replaceChildren();
  for (const [label, value] of entries) {
    const row = element('div'); row.append(element('dt', label), element('dd', String(value))); container.append(row);
  }
}
let leads = [], command = '', importGeneration = 0;
function renderLeads() {
  $('leads').replaceChildren(); $('lead-count').textContent = String(leads.length);
  $('lead-empty').hidden = leads.length > 0; $('export-leads').disabled = !leads.length; $('clear-leads').disabled = !leads.length;
  for (const lead of leads) {
    const card = element('li', undefined, 'lead-card'), top = element('div', undefined, 'lead-top');
    const search = lead.source === 'platform-search';
    top.append(element('strong', lead.site), element('span', search ? '搜索入口' : '待人工核验'));
    const link = element('a', search ? (lead.linkLabel || '到平台查看候选结果 ↗') : '打开外部主页 ↗'); link.href = lead.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
    card.append(top, element('span', search ? `检索词：${lead.username}` : lead.url, 'lead-url'), element('small', search ? lead.note : lead.source === 'sherlock-import' ? '来源：Sherlock 报告声称命中，不代表确认身份' : '来源：用户名拼接入口，尚未检查是否存在'), link);
    $('leads').append(card);
  }
}
function mergeLeads(incoming) {
  const all = new Map(leads.map(lead => [lead.url, lead]));
  for (const lead of incoming) if (!all.has(lead.url) || lead.source === 'sherlock-import') all.set(lead.url, lead);
  if (all.size > 1000) throw new Error('本次最多保留 1,000 条线索，请先导出并清空。');
  const before = leads.length; leads = [...all.values()]; renderLeads(); return leads.length - before;
}
function resetCommand() {
  command = ''; $('copy-command').disabled = true;
  $('command').textContent = $('account-mode').value === 'international' ? '先输入英文用户名，再准备查询入口。' : '中文昵称搜索无需运行命令。切换国际用户名模式后可生成 Sherlock 命令。';
}
$('username-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const input = $('username').value, domestic = $('account-mode').value !== 'international';
    const generated = domestic ? buildDomesticLeads(input) : buildLeads(input);
    const added = mergeLeads(generated);
    resetCommand();
    if (!domestic) { command = sherlockCommand(input); $('command').textContent = command; $('copy-command').disabled = false; }
    status('username-status', domestic ? `准备了 ${generated.length} 个大陆平台搜索入口，本次新增 ${added} 条。尚未搜索，没有确认账号或身份；点击后将昵称交给对应平台或搜索引擎。` : `生成 ${generated.length} 个国际平台主页入口，本次新增 ${added} 条。没有进行在线扫描。`);
  } catch (error) { resetCommand(); status('username-status', error.message, true); }
});
$('username').addEventListener('input', () => { resetCommand(); status('username-status', '输入已修改，请重新准备查询入口；已有线索仍保留原检索词。'); });
$('account-mode').addEventListener('change', () => { resetCommand(); status('username-status', '已切换查询方式。点击“准备查询入口”生成新入口；已有线索不会自动替换。'); });
$('copy-command').addEventListener('click', async () => {
  if (!command) return;
  const captured = command;
  try { await navigator.clipboard.writeText(captured); status('username-status', '命令已复制。请在自己的电脑终端运行，网页不会执行它。'); }
  catch { status('username-status', '浏览器未允许复制。请选中上方命令手动复制。', true); }
});
$('report-file').addEventListener('change', async () => {
  const file = $('report-file').files[0], generation = ++importGeneration; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('报告超过 1 MiB，请缩小后重试。');
    status('import-status', '正在本地读取报告…');
    const report = await file.text(); if (generation !== importGeneration) return;
    const imported = parseSherlockReport(report), count = mergeLeads(imported);
    status('import-status', `读取 ${imported.length} 条报告线索，新增 ${count} 条。均待人工核验；非命中行及不合规网址未导入。`);
  } catch (error) { if (generation === importGeneration) status('import-status', error.message, true); }
  finally { if (generation === importGeneration) $('report-file').value = ''; }
});
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], {type})), link = element('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$('export-leads').addEventListener('click', () => {
  if (!leads.length) return;
  try { download(exportReport(leads), 'ai014-clues.json', 'application/json;charset=utf-8'); $('announcement').textContent = '已发起本次线索 JSON 下载，包含网址和来源；请妥善保管。'; }
  catch (error) { status('username-status', error.message, true); }
});
$('clear-leads').addEventListener('click', () => { importGeneration++; leads = []; renderLeads(); $('report-file').value = ''; status('import-status', ''); status('username-status', '本次线索已清空。'); });

let fileGeneration = 0, metadata = {};
const metadataLabels = {Make:'相机厂商', Model:'相机型号', LensModel:'镜头型号', DateTimeOriginal:'拍摄时间（字段原值）', CreateDate:'创建时间（字段原值）', Software:'处理软件', ImageWidth:'图像宽度', ImageHeight:'图像高度', ExifImageWidth:'EXIF 宽度', ExifImageHeight:'EXIF 高度', Orientation:'方向'};
function renderMetadata() {
  const entries = Object.entries(metadataLabels).filter(([key]) => metadata[key] !== undefined).map(([key, label]) => [label, String(metadata[key])]);
  if ($('show-gps').checked) {
    if (Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)) entries.push(['纬度 / 经度', `${metadata.latitude.toFixed(6)} / ${metadata.longitude.toFixed(6)}`]);
    else entries.push(['位置字段', '未读取到经纬度，可能不存在或已移除']);
  }
  if (!entries.length) entries.push(['照片元数据', '没有读取到支持的非位置字段。']);
  facts('metadata', entries);
}
$('show-gps').addEventListener('change', renderMetadata);
$('inspect-file').addEventListener('change', async () => {
  const file = $('inspect-file').files[0], generation = ++fileGeneration;
  metadata = {}; $('file-output').hidden = true; $('file-facts').replaceChildren(); $('metadata').replaceChildren(); $('show-gps').checked = false;
  if (!file) return;
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('文件超过 25 MiB，请选择较小的文件。');
    status('file-status', '正在本地计算 SHA-256…');
    if (!globalThis.crypto?.subtle) throw new Error('当前浏览器不支持安全的 SHA-256 计算，请使用新版浏览器通过 HTTPS 打开。');
    const bytes = await file.arrayBuffer(), digest = await crypto.subtle.digest('SHA-256', bytes);
    if (generation !== fileGeneration) return;
    const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    facts('file-facts', [['文件名', file.name], ['大小', `${file.size.toLocaleString('zh-CN')} 字节`], ['SHA-256', hash]]);
    let note = 'SHA-256 已计算。非 JPEG / TIFF 文件仅计算指纹。';
    if (/\.(jpe?g|tiff?)$/i.test(file.name) || ['image/jpeg','image/tiff'].includes(file.type)) {
      try {
        if (!globalThis.exifr?.parse) throw new Error('解析库尚未加载，请刷新页面重试。');
        const parsed = await globalThis.exifr.parse(bytes, {pick:[...Object.keys(metadataLabels), 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'], reviveValues:false});
        if (generation !== fileGeneration) return;
        metadata = parsed || {};
        note = parsed?.errors?.length ? 'SHA-256 已计算；照片部分元数据解析失败，以下字段可能不完整，不能用于认定真实性。' : '本地读取完成。时间字段可能没有时区；元数据可修改，不是真实性证明。';
      } catch (error) { note = `SHA-256 已计算；未能解析照片元数据（格式不受支持、文件损坏或库加载失败）。`; }
    }
    if (generation !== fileGeneration) return;
    renderMetadata(); $('file-output').hidden = false; status('file-status', note);
  } catch (error) { if (generation === fileGeneration) status('file-status', error.message, true); }
});
$('clear-file').addEventListener('click', () => { fileGeneration++; metadata = {}; $('inspect-file').value = ''; $('show-gps').checked = false; $('file-output').hidden = true; $('file-facts').replaceChildren(); $('metadata').replaceChildren(); status('file-status', '文件结果已从本页清空。'); });

function inspectUrl() {
  try {
    const parsed = analyzeUrl($('url-input').value);
    facts('url-facts', [['协议', parsed.protocol], ['域名', parsed.hostname], ['端口', parsed.port || '默认'], ['路径', parsed.path], ['片段', parsed.fragment || '无']]);
    facts('url-params', parsed.query.length ? parsed.query.map(({key, value}) => [key || '（空参数名）', value || '（空值）']) : [['查询参数','无']]);
    $('url-warnings').replaceChildren(...parsed.warnings.map(w => element('li', w))); $('url-output').hidden = false;
    status('url-status', '已在本地拆解，没有访问该网址。没有提示也不代表安全。');
  } catch (error) { $('url-output').hidden = true; $('url-facts').replaceChildren(); $('url-params').replaceChildren(); status('url-status', error.message, true); }
}
$('url-form').addEventListener('submit', event => { event.preventDefault(); inspectUrl(); });
$('url-example').addEventListener('click', () => { $('url-input').value = 'https://example.com/article?source=note&lang=zh#section'; inspectUrl(); });
$('url-input').addEventListener('input', () => { $('url-output').hidden = true; status('url-status', '内容已修改，点击“本地拆解”查看新结果。'); });
$('clear-url').addEventListener('click', () => { $('url-input').value = ''; $('url-output').hidden = true; $('url-facts').replaceChildren(); $('url-params').replaceChildren(); $('url-warnings').replaceChildren(); status('url-status', '已清空。'); });
