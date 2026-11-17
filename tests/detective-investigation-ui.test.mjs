import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCase,updateCaseInfo,createDemoCase,exportCase} from '../public/detective/investigation-core.js';
const KEY='ai014.detective.investigation.v1';let serial=0;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function setup(saved){
 const elements=new Map(),writes=[],removes=[],reads=[],downloads=[],windowHandlers={},store=new Map(saved?[[KEY,saved]]:[]),all=[];
 function node(tag){const n={tag,textContent:'',value:'',hidden:true,children:[],handlers:{},files:[],parentElement:{open:false},classList:{toggle(){}},addEventListener(name,fn){this.handlers[name]=fn;},append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value&&nodes[0])this.value=nodes[0].value;},replaceChildren(...nodes){this.children=nodes;},focus(){this.focused=true;},click(){return this.handlers.click?.({preventDefault(){}});},remove(){this.removed=true;},set innerHTML(_){throw Error('unsafe HTML rendering');}};all.push(n);return n;}
 const el=id=>{if(!elements.has(id)){const n=node(id);n.id=id;elements.set(id,n);}return elements.get(id);};
 el('evidence-kind').value='observation';el('evidence-verification').value='unverified';
 globalThis.document={getElementById:el,createElement:node,body:node('body')};
 globalThis.window={addEventListener(name,fn){windowHandlers[name]=fn;}};
 globalThis.localStorage={getItem(key){reads.push(key);return store.get(key)||null;},setItem(key,value){writes.push([key,value]);store.set(key,value);},removeItem(key){removes.push(key);store.delete(key);}};
 const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldTimer=globalThis.setTimeout;
 URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:case-test';};URL.revokeObjectURL=()=>{};globalThis.setTimeout=fn=>{fn();return 0;};
 await import(`../public/detective/investigation-app.js?ui-review=${serial++}`);
 const fire=(id,event='click')=>el(id).handlers[event]({preventDefault(){}});
 const input=(id,value,event='input')=>{el(id).value=value;return fire(id,event);};
 const beforeUnload=()=>{const e={prevented:false,preventDefault(){this.prevented=true;}};windowHandlers.beforeunload(e);return e.prevented;};
 const exportJSON=async()=>{fire('case-json');return JSON.parse(await downloads.at(-1).text());};
 const addRecord=(observation='直接观察到公告文字',other={})=>{input('evidence-observation',observation);for(const [id,value]of Object.entries(other))input(id,value,['evidence-kind','evidence-verification'].includes(id)?'change':'input');fire('evidence-form','submit');};
 const importJSON=(raw)=>{el('case-import').files=[{size:raw.length,text:async()=>raw}];return fire('case-import','change');};
 return {el,fire,input,all,writes,removes,reads,store,downloads,beforeUnload,exportJSON,addRecord,importJSON,restore(){URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldTimer;}};
}
const text=n=>n.textContent+' '+n.children.map(text).join(' ');
const find=(n,label)=>{if(n.tag==='button'&&n.textContent===label)return n;for(const c of n.children){const got=find(c,label);if(got)return got;}};
test('initialization, typing, submitting and demo never read/write browser storage automatically',async()=>{
 const h=await setup();try{assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);h.addRecord();h.input('case-title','我的核验');h.fire('case-info-form','submit');h.fire('case-demo');h.fire('case-confirm-no');assert.deepEqual(h.writes,[]);assert.deepEqual(h.reads,[]);
 h.fire('case-save');assert.equal(h.writes.length,1);assert.equal(JSON.parse(h.writes[0][1]).evidence.length,1);assert.equal(h.beforeUnload(),false);
 }finally{h.restore();}
});
test('save excludes unsubmitted evidence/hypothesis drafts, clearly warns and retains departure protection',async()=>{
 const h=await setup();try{h.addRecord('已经加入');h.input('evidence-observation','尚未提交的草稿');h.input('hypothesis-statement','尚未提交假设');h.fire('case-save');
 const saved=JSON.parse(h.writes[0][1]);assert.equal(saved.evidence.length,1);assert.equal(saved.hypotheses.length,0);assert.equal(h.el('evidence-observation').value,'尚未提交的草稿');assert.match(h.el('case-status').textContent,/草稿没有保存/);assert.match(h.el('case-save-state').textContent,/草稿/);assert.equal(h.beforeUnload(),true);
 h.fire('case-json');assert.match(h.el('case-status').textContent,/草稿未包含/);
 }finally{h.restore();}
});
test('source-only or kind-only draft also blocks loss and replacement without confirmation',async()=>{
 const h=await setup();try{h.input('evidence-source-name','未提交的来源');h.fire('case-save');assert.equal(h.beforeUnload(),true);h.fire('case-demo');assert.equal(h.el('case-confirm').hidden,false);h.fire('case-confirm-no');h.fire('evidence-cancel');assert.equal(h.beforeUnload(),false);
 h.input('evidence-kind','inference','change');assert.equal(h.beforeUnload(),true);h.fire('case-new');assert.equal(h.el('case-confirm').hidden,false);
 }finally{h.restore();}
});
test('loading, demo and import require confirmation when data exists, cancellation preserves exact records',async()=>{
 const backup=exportCase(updateCaseInfo(createCase(),{title:'已存副本'})),h=await setup(backup);try{h.addRecord('保持这条');const before=await h.exportJSON();
 for(const action of ['case-load','case-demo']){h.fire(action);assert.equal(h.el('case-confirm').hidden,false);h.fire('case-confirm-no');assert.deepEqual(await h.exportJSON(),before);}
 await h.importJSON(backup);assert.equal(h.el('case-confirm').hidden,false);h.fire('case-confirm-no');assert.deepEqual(await h.exportJSON(),before);assert.equal(h.writes.length,0);
 h.fire('case-load');h.fire('case-confirm-yes');assert.equal((await h.exportJSON()).title,'已存副本');assert.equal(h.beforeUnload(),false);
 }finally{h.restore();}
});
test('malformed imported or stored JSON leaves existing records untouched',async()=>{
 const h=await setup('{bad');try{h.addRecord('原记录');const before=await h.exportJSON();await h.importJSON('{invalid');assert.match(h.el('case-status').textContent,/未导入/);assert.deepEqual(await h.exportJSON(),before);
 h.fire('case-load');assert.match(h.el('case-status').textContent,/无法读取/);assert.deepEqual(await h.exportJSON(),before);
 }finally{h.restore();}
});
for(const action of ['edit','cancel','kind','verification'])test(`pending async import cannot overwrite after ${action}`,async()=>{
 const h=await setup();try{h.addRecord('保留记录');const pending=deferred();h.el('case-import').files=[{size:100,text:()=>pending.promise}];const work=h.fire('case-import','change');
 if(action==='edit')h.input('evidence-observation','新的草稿');else if(action==='cancel')h.fire('evidence-cancel');else h.input(action==='kind'?'evidence-kind':'evidence-verification',action==='kind'?'inference':'disputed','change');
 pending.resolve(exportCase(createDemoCase()));await work;assert.equal((await h.exportJSON()).evidence.length,1);assert.equal(h.el('case-confirm').hidden,true);
 }finally{h.restore();}
});
for(const id of ['evidence-kind','evidence-verification'])test(`${id} change invalidates already displayed replacement confirmation`,async()=>{
 const h=await setup();try{h.addRecord('保留');h.fire('case-demo');assert.equal(h.el('case-confirm').hidden,false);h.input(id,id==='evidence-kind'?'inference':'disputed','change');assert.equal(h.el('case-confirm').hidden,true);h.fire('case-confirm-yes');assert.equal((await h.exportJSON()).evidence.length,1);
 }finally{h.restore();}
});
test('canceling a changed evidence editor preserves committed record and saved copy without spurious dirty state',async()=>{
 const h=await setup();try{h.addRecord('原始观察');h.fire('case-save');const saved=h.store.get(KEY);find(h.el('evidence-list'),'修正这条记录').click();h.input('evidence-observation','未提交修改');assert.equal(h.beforeUnload(),true);h.fire('evidence-cancel');
 assert.equal((await h.exportJSON()).evidence[0].observation,'原始观察');assert.equal(h.store.get(KEY),saved);assert.equal(h.beforeUnload(),false);assert.equal(h.el('evidence-id').value,'');
 }finally{h.restore();}
});
test('confirmed evidence deletion removes support/refutation links; cancellation and browser copy remain intact',async()=>{
 const h=await setup();try{h.fire('case-demo');h.fire('case-save');const before=await h.exportJSON(),saved=h.store.get(KEY);const remove=find(h.el('evidence-list').children[0],'移除记录');remove.click();h.fire('case-confirm-no');assert.deepEqual(await h.exportJSON(),before);
 remove.click();h.fire('case-confirm-yes');const after=await h.exportJSON();assert.equal(after.evidence.length,before.evidence.length-1);assert.ok(after.hypotheses.every(x=>x.links.every(l=>l.evidenceId!=='E1')));assert.equal(h.store.get(KEY),saved);
 }finally{h.restore();}
});
test('facts, statements and inference retain labels; hostile strings use text nodes without HTML or executable links',async()=>{
 const h=await setup();try{h.addRecord('<img src=x onerror=alert(1)>',{'evidence-interpretation':'<script>danger()</script>'});h.addRecord('别人说的',{'evidence-kind':'statement'});h.addRecord('我猜的',{'evidence-kind':'inference'});
 const cards=h.el('evidence-list').children;assert.match(text(cards[0]),/直接观察/);assert.match(text(cards[0]),/推测，不是已证事实/);assert.match(text(cards[1]),/他人陈述/);assert.match(text(cards[2]),/个人推测/);assert.match(text(cards[0]),/<img src=x/);assert.equal(h.all.some(n=>n.tag==='img'||n.tag==='script'),false);
 h.addRecord('不合规来源',{'evidence-source-url':'javascript:alert(1)'});assert.equal((await h.exportJSON()).evidence.length,3);assert.match(h.el('evidence-status').textContent,/HTTP/);
 }finally{h.restore();}
});
test('JSON/Markdown export actually creates downloadable content and does not clear unsaved status or auto-store',async()=>{
 const h=await setup();try{h.addRecord('导出用记录');h.fire('case-json');h.fire('case-markdown');assert.equal(h.downloads.length,2);assert.equal(JSON.parse(await h.downloads[0].text()).evidence[0].observation,'导出用记录');assert.match(await h.downloads[1].text(),/导出用记录/);assert.equal(h.writes.length,0);assert.equal(h.beforeUnload(),true);
 const anchors=h.all.filter(n=>n.tag==='a'&&n.download);assert.deepEqual(anchors.map(n=>n.download),['ai014-investigation.json','ai014-investigation-report.md']);
 }finally{h.restore();}
});
test('forget requires explicit confirmation and does not erase active case',async()=>{
 const h=await setup();try{h.addRecord('仍在页面');h.fire('case-save');h.fire('case-forget');assert.equal(h.removes.length,0);h.fire('case-confirm-no');assert.equal(h.store.has(KEY),true);h.fire('case-forget');h.fire('case-confirm-yes');assert.equal(h.store.has(KEY),false);assert.equal((await h.exportJSON()).evidence.length,1);assert.equal(h.beforeUnload(),true);
 }finally{h.restore();}
});
test('investigation markup has all required controls and responsive single-column evidence layout',()=>{
 const html=fs.readFileSync(new URL('../src/pages/detective/index.astro',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../public/detective/investigation-app.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/detective/style.css',import.meta.url),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);for(const [,id]of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),id);
 assert.match(html,/type="module"[^>]*src=\{url\(\'\/detective\/investigation-app\.js/);assert.match(html,/id="case-confirm"[^>]*hidden/);assert.match(css,/@media\s*\(max-width:\s*\d+px\)/);assert.match(css,/overflow-wrap:anywhere/);assert.match(css,/min-height:44px/);
});
test('saving normalized title/question updates form values and removes false unsaved state',async()=>{
 const h=await setup();try{h.input('case-title','  我的核验  ');h.input('case-question','  这个出处是什么？  ');h.fire('case-save');assert.equal(h.el('case-title').value,'我的核验');assert.equal(h.el('case-question').value,'这个出处是什么？');assert.equal(h.beforeUnload(),false);
 }finally{h.restore();}
});
test('switching evidence editor cannot silently discard an unsubmitted draft',async()=>{
 const h=await setup();try{h.addRecord('原记录');h.fire('case-save');h.input('evidence-observation','未加入的草稿');find(h.el('evidence-list'),'修正这条记录').click();assert.equal(h.el('case-confirm').hidden,false);assert.equal(h.el('evidence-observation').value,'未加入的草稿');h.fire('case-confirm-no');assert.equal(h.el('evidence-observation').value,'未加入的草稿');
 find(h.el('evidence-list'),'修正这条记录').click();h.fire('case-confirm-yes');assert.equal(h.el('evidence-observation').value,'原记录');assert.equal((await h.exportJSON()).evidence.length,1);assert.equal(h.beforeUnload(),false);
 }finally{h.restore();}
});
test('a newer replacement request cannot be displaced by an older async import finishing',async()=>{
 const h=await setup();try{h.addRecord('原记录');const pending=deferred();h.el('case-import').files=[{size:100,text:()=>pending.promise}];const work=h.fire('case-import','change');h.fire('case-demo');pending.resolve(exportCase(updateCaseInfo(createCase(),{title:'过时导入'})));await work;h.fire('case-confirm-yes');assert.match((await h.exportJSON()).title,/虚构演示/);
 }finally{h.restore();}
});
test('successful import clears file chooser and storage denial never claims saved state',async()=>{
 const h=await setup();try{h.el('case-import').value='chosen.json';await h.importJSON(exportCase(createDemoCase()));assert.equal(h.el('case-import').value,'');globalThis.localStorage.setItem=()=>{throw Error('storage denied');};h.fire('case-save');assert.match(h.el('case-status').textContent,/未能保存/);assert.equal(h.beforeUnload(),true);
 }finally{h.restore();}
});

const BACKUP_KEY=`${KEY}.previous`;
test('fresh blank page and whitespace/draft-only save never overwrite a prior copy',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{
  for(const action of [()=>{},()=>h.input('case-title','  '),()=>h.input('evidence-observation','未提交草稿')]){
   action();h.fire('case-save');assert.equal(h.store.get(KEY),saved);assert.equal(h.writes.length,0);assert.equal(h.el('case-confirm').hidden,true);assert.match(h.el('case-status').textContent,/空白/);
  }
 }finally{h.restore();}
});
test('different saved case requires confirmation; cancel and double confirmation preserve safety',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{
  h.addRecord('新研判');h.fire('case-save');assert.equal(h.el('case-confirm').hidden,false);assert.equal(h.writes.length,0);
  h.fire('case-confirm-no');assert.equal(h.store.get(KEY),saved);assert(h.beforeUnload());
  h.fire('case-save');h.fire('case-confirm-yes');assert.equal(h.store.get(BACKUP_KEY),saved);assert.equal(JSON.parse(h.store.get(KEY)).evidence[0].observation,'新研判');assert.deepEqual(h.writes.map(x=>x[0]),[BACKUP_KEY,KEY]);assert(!h.beforeUnload());
  h.fire('case-confirm-yes');assert.equal(h.writes.length,2);
 }finally{h.restore();}
});
test('loaded edits also require overwrite confirmation; unchanged save preserves previous backup',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{
  h.store.set(BACKUP_KEY,'older');h.fire('case-load');h.fire('case-save');assert.equal(h.el('case-confirm').hidden,true);assert.equal(h.store.get(BACKUP_KEY),'older');
  h.input('case-title','已修改');h.fire('case-save');assert.equal(h.el('case-confirm').hidden,false);assert.equal(h.store.get(KEY),saved);
  h.fire('case-confirm-yes');assert.equal(h.store.get(BACKUP_KEY),saved);assert.equal(JSON.parse(h.store.get(KEY)).title,'已修改');
 }finally{h.restore();}
});
test('backup downloads use exact stored bytes, not current unsaved case, and can restore via import',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{
  h.addRecord('新研判');h.fire('case-save');h.fire('case-stored-json');assert.equal(await h.downloads.at(-1).text(),saved);assert.equal(h.el('case-confirm').hidden,false);
  h.fire('case-confirm-yes');h.fire('case-previous-json');assert.equal(await h.downloads.at(-1).text(),saved);
  await h.importJSON(await h.downloads.at(-1).text());h.fire('case-confirm-yes');assert.deepEqual(await h.exportJSON(),JSON.parse(saved));
  h.fire('case-save');h.fire('case-confirm-yes');assert.equal(h.store.get(KEY),saved);
 }finally{h.restore();}
});
for(const failedKey of [BACKUP_KEY,KEY])test(`storage failure on ${failedKey} retains old primary and unsaved page`,async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{
  h.addRecord('尚未保存');h.fire('case-save');const set=globalThis.localStorage.setItem;globalThis.localStorage.setItem=(key,value)=>{if(key===failedKey)throw Error('QuotaExceededError');set(key,value);};
  h.fire('case-confirm-yes');assert.equal(h.store.get(KEY),saved);assert(h.beforeUnload());assert.match(h.el('case-status').textContent,/未能保存/);assert.equal((await h.exportJSON()).evidence[0].observation,'尚未保存');
 }finally{h.restore();}
});
test('storage read denial fails closed instead of overwriting',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{h.addRecord('新记录');globalThis.localStorage.getItem=()=>{throw Error('SecurityError');};h.fire('case-save');assert.equal(h.store.get(KEY),saved);assert.equal(h.writes.length,0);assert.match(h.el('case-status').textContent,/未能保存/);}finally{h.restore();}
});
test('other-tab write after prompt aborts confirmation without replacing primary or backup',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{h.addRecord('此页修改');h.fire('case-save');h.store.set(KEY,'changed elsewhere');h.fire('case-confirm-yes');assert.equal(h.store.get(KEY),'changed elsewhere');assert.equal(h.writes.length,0);assert.match(h.el('case-status').textContent,/其他页面/);assert(h.beforeUnload());}finally{h.restore();}
});
test('editing after save prompt cancels pending replacement',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{h.addRecord('此页修改');h.fire('case-save');h.input('case-title','更新');h.fire('case-confirm-yes');assert.equal(h.store.get(KEY),saved);assert.equal(h.writes.length,0);assert.equal(h.el('case-confirm').hidden,true);}finally{h.restore();}
});
test('malformed old saved data can be downloaded and is backed up verbatim before confirmed replacement',async()=>{
 const h=await setup('{bad');try{h.fire('case-stored-json');assert.equal(await h.downloads.at(-1).text(),'{bad');h.addRecord('新记录');h.fire('case-save');assert.equal(h.store.get(KEY),'{bad');h.fire('case-confirm-yes');assert.equal(h.store.get(BACKUP_KEY),'{bad');}finally{h.restore();}
});
test('forget explicitly removes primary and previous backup, but retains active records',async()=>{
 const saved=exportCase(createDemoCase()),h=await setup(saved);try{h.fire('case-load');h.store.set(BACKUP_KEY,'older');h.fire('case-forget');assert.match(h.el('case-confirm-text').textContent,/上一版/);h.fire('case-confirm-no');assert(h.store.has(BACKUP_KEY));h.fire('case-forget');h.fire('case-confirm-yes');assert(!h.store.has(KEY));assert(!h.store.has(BACKUP_KEY));assert.deepEqual(await h.exportJSON(),JSON.parse(saved));}finally{h.restore();}
});
