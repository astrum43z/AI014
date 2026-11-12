import {analyzeSharedText, checkBusinessCode, buildCnSearch} from './mainland-core.js';
import {qrRasterSize, decodeQrPixels} from './qr-core.js';
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
function status(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
async function copy(text, id) {
  try { await navigator.clipboard.writeText(text); status(id, '已复制。请核对接收方后再分享。'); }
  catch { status(id, '浏览器未允许复制。请长按显示的文字手动复制。', true); }
}
function inspectShared() {
  $('share-results').replaceChildren();
  try {
    const result = analyzeSharedText($('share-input').value);
    for (const item of result.links) {
      const card = node('article', undefined, 'inspection-card');
      card.append(node('span', '实际主机名 · 不是安全认证', 'card-label'), node('h3', item.hostname), node('p', item.displayUrl, 'readable-url'));
      if (item.platform) card.append(node('small', `域名规则识别：${item.platform}${item.shortLink ? '分享短链，最终去向未知' : '相关域名'}。不证明页面真实或安全。`));
      if (item.warnings.length) { const list = node('ul'); list.append(...item.warnings.map(text => node('li', text))); card.append(list); }
      else card.append(node('p', '未触发这些有限的结构提示，仍需核对来源和页面内容。', 'small-note'));
      const button = node('button', '复制主机名（不含路径和参数）', 'copy-domain'); button.type = 'button';
      button.addEventListener('click', () => copy(item.hostname, 'share-status')); card.append(button); $('share-results').append(card);
    }
    for (const item of result.rejected) $('share-results').append(node('p', item.reason, 'notice'));
    status('share-status', `提取 ${result.links.length} 个不同网址。${result.truncated ? '只展示前 20 个，请分段检查。' : ''}${result.disclaimer}`, !result.links.length);
  } catch (error) { status('share-status', error.message, true); }
}
$('share-form').addEventListener('submit', event => { event.preventDefault(); inspectShared(); });
$('share-example').addEventListener('click', () => { $('share-input').value = '演示文案（虚构地址，不要打开）：https://weixin.qq.com.example.com/reward?token=DEMO_ONLY；另有短链 https://b23.tv/EXAMPLE。'; inspectShared(); });
$('share-input').addEventListener('input', () => { $('share-results').replaceChildren(); status('share-status', '内容已修改，点击“提取并核查”查看新结果。'); });
$('share-clear').addEventListener('click', () => { $('share-input').value = ''; $('share-results').replaceChildren(); status('share-status', '本次输入和结果已清空。'); });

$('business-form').addEventListener('submit', event => {
  event.preventDefault(); $('business-output').replaceChildren(); $('business-output').hidden = true;
  try {
    const result = checkBusinessCode($('business-code').value);
    status('business-status', result.message, !result.valid);
    $('business-output').append(node('p', `规范化后的代码：${result.code || '（空）'}`), node('p', result.disclaimer)); $('business-output').hidden = false;
  } catch (error) { status('business-status', error.message, true); }
});
function clearBusiness() { $('business-output').replaceChildren(); $('business-output').hidden = true; status('business-status', ''); }
$('business-code').addEventListener('input', clearBusiness);
$('business-clear').addEventListener('click', () => { $('business-code').value = ''; clearBusiness(); });
$('cn-search-form').addEventListener('submit', event => {
  event.preventDefault(); $('cn-search-results').replaceChildren();
  try {
    const links = buildCnSearch($('cn-query').value);
    for (const item of links) {
      const link = node('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
      link.append(node('strong', `${item.name} ↗`), node('span', item.note)); $('cn-search-results').append(link);
    }
    status('cn-search-status', '已准备 6 个手动检索入口，尚未进行搜索。只有点击入口才会把搜索词发送给对应引擎。');
  } catch (error) { status('cn-search-status', error.message, true); }
});
$('cn-query').addEventListener('input', () => { $('cn-search-results').replaceChildren(); status('cn-search-status', '关键词已修改，请重新准备入口。'); });

let qrGeneration = 0, decoderPromise;
function loadDecoder() {
  if (typeof globalThis.jsQR === 'function') return Promise.resolve(globalThis.jsQR);
  if (!decoderPromise) decoderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'vendor/jsQR-1.4.0.js';
    script.onload = () => typeof globalThis.jsQR === 'function' ? resolve(globalThis.jsQR) : reject(new Error('二维码组件加载失败，请刷新重试。'));
    script.onerror = () => { script.remove(); decoderPromise = undefined; reject(new Error('二维码组件下载失败，请检查网络后重试。')); };
    document.head.append(script);
  });
  return decoderPromise;
}
async function imagePixels(src) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('浏览器无法读取这张图片，请转换为 JPG、PNG 或 WebP 后重试。')); image.src = src; });
  const {width, height} = qrRasterSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  if (!context) throw new Error('当前浏览器无法读取图片像素，请改用新版系统浏览器。');
  context.fillStyle = '#fff'; context.fillRect(0,0,width,height); context.drawImage(image,0,0,width,height);
  return context.getImageData(0,0,width,height);
}
function resetQr() { $('qr-output').hidden = true; $('qr-text').value = ''; }
async function readQr(src, generation, revoke = false, demo = false) {
  try {
    const [decoder, pixels] = await Promise.all([loadDecoder(), imagePixels(src)]);
    if (generation !== qrGeneration) return;
    await new Promise(resolve => setTimeout(resolve, 0));
    if (generation !== qrGeneration) return;
    const text = decodeQrPixels(pixels, decoder);
    if (generation !== qrGeneration) return;
    $('qr-text').value = text; $('qr-output').hidden = false;
    status('qr-status', `${demo ? '示例二维码' : '二维码'}已在本机读出，没有打开其内容。每次只识别一个普通二维码。`);
  } catch (error) { if (generation === qrGeneration) status('qr-status', error.message, true); }
  finally { if (revoke) URL.revokeObjectURL(src); }
}
$('qr-file').addEventListener('change', async () => {
  const generation = ++qrGeneration, file = $('qr-file').files[0]; resetQr(); if (!file) { status('qr-status', ''); return; }
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('图片超过 10 MiB，请先在相册裁切二维码或导出小图。');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) && !(file.type === '' && /\.(jpe?g|png|webp)$/i.test(file.name))) throw new Error('请选 JPG、PNG 或 WebP 图片；SVG、PDF、视频和小程序码暂不支持。');
    status('qr-status', '正在本机读取图片和识别二维码…');
    await readQr(URL.createObjectURL(file), generation, true);
  } catch (error) { if (generation === qrGeneration) status('qr-status', error.message, true); }
});
$('qr-demo').addEventListener('click', async () => {
  const generation = ++qrGeneration; resetQr(); $('qr-file').value = '';
  status('qr-status', '正在读取本站自带的无个人信息示例图…');
  await readQr('qr-demo.png', generation, false, true);
});
$('qr-clear').addEventListener('click', () => { qrGeneration++; resetQr(); $('qr-file').value = ''; status('qr-status', '图片和识别结果已从本页清空。'); });
$('qr-copy').addEventListener('click', () => { if ($('qr-text').value) copy($('qr-text').value, 'qr-status'); });
$('qr-to-share').addEventListener('click', () => {
  if (!$('qr-text').value) return;
  $('share-input').value = $('qr-text').value; $('tab-share').click(); inspectShared(); $('share-input').focus();
});
