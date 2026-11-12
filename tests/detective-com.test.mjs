import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const page=fs.readFileSync('src/pages/detective/index.astro','utf8');
test('COM route keeps a standalone local-only document with base-aware assets and canonical URL',()=>{
 assert.match(page,/connect-src 'none'/);assert.match(page,/script-src 'self'/);assert.doesNotMatch(page,/unsafe-inline|<iframe|Layout from/);
 assert.match(page,/new URL\(url\('\/detective\/'\), Astro.site\)/);
 const scripts=[...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,5);
 for(const [,attrs,body]of scripts){assert.match(attrs,/is:inline/);assert.match(attrs,/src=\{url\('\/detective\//);assert.equal(body,'');}
 for(const [,value]of page.matchAll(/(?:src|href)="([^"]+)"/g))assert.match(value,/^(?:https?:|#)/);
 assert.match(page,/url\('\/favicon.svg'\)/);assert.match(page,/url\('\/'\)/);
});
test('COM has a discoverable navigation entry and sitemap route without fabricated product records',()=>{
 assert.match(fs.readFileSync('src/layouts/Layout.astro','utf8'),/\['线索研判','\/detective\/'\]/);
 assert.match(fs.readFileSync('src/pages/sitemap.xml.ts','utf8'),/'\/detective\/'/);
 for(const name of ['products','projects','labs','releases'])assert.deepEqual(JSON.parse(fs.readFileSync(`src/data/${name}.json`)),[]);
});
test('COM explains cross-origin storage and preserves local safety and licensing notices',()=>{
 assert.match(page,/ai014.com 与 ai014.cn 的浏览器保存互不相通/);assert.match(page,/不会自动迁移/);
 assert.match(page,/AI014.COM · 线索核查/);
 assert.match(fs.readFileSync('public/detective/README.md','utf8'),/de8d7251e01fb2c1908d3639dd68f3d65d2c541a/);
 assert.match(fs.readFileSync('public/detective/vendor/jsQR-LICENSE.txt','utf8'),/Apache License/);
 assert.match(fs.readFileSync('public/detective/vendor/exifr-LICENSE.txt','utf8'),/MIT License/);
 for(const id of ['wechat-contact','copy-wechat','copy-wechat-status'])assert.equal(page.split(`id="${id}"`).length,2);
});
function contact(clipboard){
 const handlers={},written=[],status={textContent:''},contact={},selected=[];
 const document={querySelector:s=>({'#copy-wechat':{addEventListener:(e,f)=>handlers[e]=f},'#copy-wechat-status':status,'#wechat-contact':contact}[s]),createRange:()=>({selectNodeContents:e=>selected.push(e)})};
 const context={document,navigator:clipboard?{clipboard:{writeText:async v=>written.push(v)}}:{},window:{getSelection:()=>({removeAllRanges(){},addRange(){}})}};
 vm.runInNewContext(fs.readFileSync('public/detective/contact.js','utf8'),context);return {handlers,written,status,contact,selected};
}
test('standalone contact preserves explicit click-only copy, including repeated clicks',async()=>{
 const h=contact(true);assert.deepEqual(h.written,[]);await h.handlers.click();await h.handlers.click();assert.deepEqual(h.written,['goodmorning2you','goodmorning2you']);assert.equal(h.status.textContent,'已复制微信号');
});
test('standalone contact has manual fallback when clipboard permission is unavailable',async()=>{
 const h=contact(false);await h.handlers.click();assert.deepEqual(h.selected,[h.contact]);assert.match(h.status.textContent,/Ctrl\/Cmd\+C/);
});
