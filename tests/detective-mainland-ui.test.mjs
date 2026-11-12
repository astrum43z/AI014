import test from 'node:test';
import assert from 'node:assert/strict';
let sequence=0;
async function setup({decoder=true}={}) {
 const elements=new Map(), images=[], scripts=[], revoked=[];
 function node(id){ return {id, textContent:'', value:'', hidden:true, files:[], children:[], handlers:{}, classList:{toggle(){}}, addEventListener(name,fn){this.handlers[name]=fn;}, append(...nodes){this.children.push(...nodes);}, replaceChildren(...nodes){this.children=nodes;}, click(){return this.handlers.click?.({preventDefault(){}});}, focus(){this.focused=true;}, remove(){this.removed=true;}, getContext(){return {fillRect(){},drawImage(){},getImageData(x,y,width,height){return {width,height,data:new Uint8ClampedArray(width*height*4)};}};} }; }
 const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id);};
 globalThis.document={getElementById:el,createElement:node,head:{append(script){scripts.push(script);}}};
 globalThis.Image=class{constructor(){this.naturalWidth=10;this.naturalHeight=10;images.push(this);}set src(value){this.source=value;}};
 globalThis.jsQR=decoder?()=>({data:'https://example.com/local'}):undefined;
 const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
 URL.createObjectURL=()=>`blob:test-${sequence}-${images.length}`;URL.revokeObjectURL=src=>revoked.push(src);
 await import(`../public/detective/mainland-app.js?test=${sequence++}`);
 const fire=(id,event='click')=>el(id).handlers[event]({preventDefault(){}});
 const choose=(file={name:'fixture.png',type:'image/png',size:4})=>{el('qr-file').files=[file];return fire('qr-file','change');};
 return {el,fire,images,scripts,revoked,choose,restore(){URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}};
}
function allText(node){return node.textContent+' '+node.children.map(allText).join(' ');}
test('shared analysis repeats without duplication, masks credentials and clears stale result on edit/error',async()=>{
 const h=await setup();try{
 h.el('share-input').value='https://example.com/?token=SECRET#PRIVATE';h.fire('share-form','submit');h.fire('share-form','submit');
 assert.equal(h.el('share-results').children.length,1);assert.doesNotMatch(allText(h.el('share-results')),/SECRET|PRIVATE/);
 h.fire('share-input','input');assert.equal(h.el('share-results').children.length,0);
 h.el('share-input').value='javascript:alert(1)';h.fire('share-form','submit');assert.match(h.el('share-status').textContent,/没有找到/);assert.equal(h.el('share-results').children.length,0);
 h.fire('share-clear');assert.equal(h.el('share-input').value,'');
 }finally{h.restore();}
});
test('code checks do not claim registration and invalidate results on edit',async()=>{
 const h=await setup();try{
 h.el('business-code').value='91350211M000100Y46';h.fire('business-form','submit');assert.equal(h.el('business-output').hidden,false);assert.match(allText(h.el('business-output')),/不证明企业存在/);
 h.fire('business-code','input');assert.equal(h.el('business-output').hidden,true);assert.equal(h.el('business-output').children.length,0);
 h.el('business-code').value='123';h.fire('business-form','submit');assert.match(h.el('business-status').textContent,/18 位/);
 h.fire('business-clear');assert.equal(h.el('business-code').value,'');
 }finally{h.restore();}
});
test('manual search has safe external link attributes and rejects private identifiers',async()=>{
 const h=await setup();try{
 h.el('cn-query').value='公开品牌';h.fire('cn-search-form','submit');assert.equal(h.el('cn-search-results').children.length,6);
 for(const link of h.el('cn-search-results').children){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.match(link.href,/^https:\/\/(www\.baidu\.com|cn\.bing\.com)\//);}
 h.fire('cn-query','input');assert.equal(h.el('cn-search-results').children.length,0);
 h.el('cn-query').value='13800138000';h.fire('cn-search-form','submit');assert.equal(h.el('cn-search-results').children.length,0);assert.match(h.el('cn-search-status').textContent,/不要输入手机号/);
 }finally{h.restore();}
});
for(const outcome of ['success','error'])test(`late QR image ${outcome} cannot resurrect cleared result`,async()=>{
 const h=await setup();try{const pending=h.choose();assert.equal(h.images.length,1);h.fire('qr-clear');const before=h.el('qr-status').textContent;
 outcome==='success'?h.images[0].onload():h.images[0].onerror();await pending;
 assert.equal(h.el('qr-output').hidden,true);assert.equal(h.el('qr-text').value,'');assert.equal(h.el('qr-status').textContent,before);assert.equal(h.revoked.length,1);
 }finally{h.restore();}
});
test('new QR wins over old load and supports send to local link analysis',async()=>{
 const h=await setup();try{const first=h.choose();const second=h.choose();h.images[1].onload();await second;
 assert.equal(h.el('qr-output').hidden,false);assert.equal(h.el('qr-text').value,'https://example.com/local');
 globalThis.jsQR=()=>({data:'https://old.example.com/'});h.images[0].onload();await first;assert.equal(h.el('qr-text').value,'https://example.com/local');assert.equal(h.revoked.length,2);
 h.fire('qr-to-share');assert.equal(h.el('share-input').value,'https://example.com/local');assert.equal(h.el('share-results').children.length,1);
 }finally{h.restore();}
});
test('invalid or oversized new QR file clears previous content without decoding',async()=>{
 const h=await setup();try{const p=h.choose();h.images[0].onload();await p;
 await h.choose({name:'bad.svg',type:'image/svg+xml',size:4});assert.equal(h.el('qr-output').hidden,true);assert.equal(h.el('qr-text').value,'');assert.equal(h.images.length,1);
 await h.choose({name:'huge.png',type:'image/png',size:10*1024*1024+1});assert.match(h.el('qr-status').textContent,/超过/);assert.equal(h.images.length,1);
 }finally{h.restore();}
});
test('missing decoder network load failure is shown and next click can retry',async()=>{
 const h=await setup({decoder:false});try{const p=h.fire('qr-demo');assert.equal(h.scripts.length,1);h.scripts[0].onerror();h.images[0].onload();await p;assert.match(h.el('qr-status').textContent,/下载失败/);
 const retry=h.fire('qr-demo');assert.equal(h.scripts.length,2);globalThis.jsQR=()=>({data:'https://example.com/retry'});h.scripts[1].onload();h.images[1].onload();await retry;assert.equal(h.el('qr-output').hidden,false);
 }finally{h.restore();}
});
test('hostname extraction does not turn a suffix or unsupported scheme into a trusted host',async()=>{
 const {analyzeSharedText}=await import('../public/detective/mainland-core.js');
 for(const value of ['evilwww.baidu.com/path','ftp://www.baidu.com/path','user@www.baidu.com','httpss://www.baidu.com','abc-www.baidu.com'])assert.throws(()=>analyzeSharedText(value),/没有找到/);
 for(const value of ['www.baidu.com/path','点击：www.baidu.com/path','看这里 www.baidu.com/path'])assert.equal(analyzeSharedText(value).links[0].hostname,'www.baidu.com');
 assert.equal(analyzeSharedText('https://evilwww.baidu.com/path').links[0].hostname,'evilwww.baidu.com');
});
test('credit check is explicitly checksum only, not business registration or prefix validation',async()=>{
 const {checkBusinessCode}=await import('../public/detective/mainland-core.js');
 const result=checkBusinessCode('000000000000000000');assert.equal(result.valid,true);assert.match(result.message,/字符与校验位/);assert.match(result.disclaimer,/不证明企业存在/);
});
