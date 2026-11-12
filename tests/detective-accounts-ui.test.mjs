import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exportReport,buildLeads} from '../public/detective/core.js';
let serial=0;
async function setup(){
 const elements=new Map(),copied=[],downloads=[];
 function node(id){return {id,textContent:'',value:'',hidden:true,disabled:false,checked:false,files:[],children:[],handlers:{},classList:{toggle(){}},addEventListener(name,fn){this.handlers[name]=fn;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){},focus(){},click(){return this.handlers.click?.({preventDefault(){}});},remove(){}};}
 const el=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id);};
 el('account-mode').value='domestic';el('copy-command').disabled=true;
 globalThis.document={getElementById:el,querySelectorAll:()=>[],createElement:node,body:node('body')};
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{value:{clipboard:{async writeText(value){copied.push(value);}}},configurable:true});
 const oldURL=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldTimer=globalThis.setTimeout;
 URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:download';};URL.revokeObjectURL=()=>{};
 globalThis.setTimeout=(fn)=>{fn();return 0;};
 await import(`../public/detective/app.js?accounts-test=${serial++}`);
 const fire=(id,event='click')=>el(id).handlers[event]({preventDefault(){}});
 const submit=name=>{el('username').value=name;return fire('username-form','submit');};
 return {el,fire,submit,copied,downloads,restore(){URL.createObjectURL=oldURL;URL.revokeObjectURL=oldRevoke;globalThis.setTimeout=oldTimer;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}};
}
const text=n=>n.textContent+' '+n.children.map(text).join(' ');
test('Chinese and emoji domestic nickname builds search cards, not confirmed profiles or shell commands',async()=>{
 const h=await setup();try{h.submit('小明的旅行日记 🍵');const cards=h.el('leads').children;assert.ok(cards.length>=4);assert.equal(Number(h.el('lead-count').textContent),cards.length);
 for(const card of cards){assert.match(text(card),/搜索入口/);assert.match(text(card),/小明的旅行日记 🍵/);const link=card.children.at(-1);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.referrerPolicy,'no-referrer');assert.match(link.href,/^https:\/\//);assert.ok(decodeURIComponent(link.href.replace(/\+/g,'%20')).includes('小明的旅行日记 🍵'));}
 assert.equal(h.el('copy-command').disabled,true);assert.doesNotMatch(h.el('command').textContent,/sherlock 小明/);await h.fire('copy-command');assert.deepEqual(h.copied,[]);assert.match(h.el('username-status').textContent,/尚未搜索|没有确认/);
 }finally{h.restore();}
});
test('repeat nickname deduplicates and different nickname retains its original cards',async()=>{
 const h=await setup();try{h.submit('中文昵称');const count=h.el('leads').children.length;h.submit('中文昵称');assert.equal(h.el('leads').children.length,count);assert.match(h.el('username-status').textContent,/新增 0 条/);
 h.submit('另一个昵称');assert.equal(h.el('leads').children.length,count*2);assert.match(text(h.el('leads').children[0]),/中文昵称/);assert.match(text(h.el('leads').children.at(-1)),/另一个昵称/);
 h.fire('clear-leads');assert.equal(h.el('leads').children.length,0);assert.equal(h.el('export-leads').disabled,true);
 }finally{h.restore();}
});
test('switching away from international mode immediately invalidates a previous Sherlock command',async()=>{
 const h=await setup();try{h.el('account-mode').value='international';h.fire('account-mode','change');h.submit('example_user');assert.equal(h.el('copy-command').disabled,false);assert.equal(h.el('command').textContent,'sherlock example_user --csv');await h.fire('copy-command');assert.deepEqual(h.copied,['sherlock example_user --csv']);
 h.el('account-mode').value='domestic';h.fire('account-mode','change');assert.equal(h.el('copy-command').disabled,true);assert.notEqual(h.el('command').textContent,'sherlock example_user --csv');await h.fire('copy-command');assert.equal(h.copied.length,1);
 h.submit('中文昵称');assert.equal(h.el('copy-command').disabled,true);
 }finally{h.restore();}
});
test('editing international username and rejecting Chinese cannot leave a stale runnable command',async()=>{
 const h=await setup();try{h.el('account-mode').value='international';h.submit('example_user');assert.equal(h.el('leads').children.length,10);
 h.el('username').value='其他输入';h.fire('username','input');assert.equal(h.el('copy-command').disabled,true);await h.fire('copy-command');assert.equal(h.copied.length,0);
 h.submit('中文昵称');assert.equal(h.el('leads').children.length,10);assert.equal(h.el('copy-command').disabled,true);assert.match(h.el('username-status').textContent,/英文字母/);
 }finally{h.restore();}
});
test('domestic JSON export preserves search semantics and cannot manufacture account hits',async()=>{
 const h=await setup();try{h.submit('中文昵称');h.fire('export-leads');assert.equal(h.downloads.length,1);const json=JSON.parse(await h.downloads[0].text());assert.ok(json.leads.length>=4);
 for(const lead of json.leads){assert.equal(lead.source,'platform-search');assert.equal(lead.status,'unverified');assert.equal(lead.username,'中文昵称');assert.ok(['users','content','index','mixed'].includes(lead.searchType));assert.equal(lead.reported,undefined);}
 const forged=JSON.parse(exportReport([{...json.leads[0],status:'verified',reported:true,searchType:'confirmed-account'}]));assert.equal(forged.leads[0].status,'unverified');assert.equal(forged.leads[0].reported,undefined);assert.equal(forged.leads[0].searchType,'mixed');
 const international=JSON.parse(exportReport(buildLeads('example_user')));assert.equal(international.leads[0].source,'manual');assert.equal(international.leads[0].searchType,undefined);
 }finally{h.restore();}
});
test('UI contains a labeled domestic-default select while retaining strict international mode and privacy wording',()=>{
 const html=fs.readFileSync(new URL('../src/pages/detective/index.astro',import.meta.url),'utf8');
 assert.match(html,/<label for="account-mode">/);assert.match(html,/<select id="account-mode"[^>]*><option value="domestic">/);assert.match(html,/<option value="international">/);assert.match(html,/不会自动查号/);assert.match(html,/不把同名账号认作同一人/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 const app=fs.readFileSync(new URL('../public/detective/app.js',import.meta.url),'utf8');for(const [,id] of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),id);
});
test('nickname validation preserves Chinese/emoji, normalizes accents and bounds Unicode code points',async()=>{
 const {validatePublicNickname}=await import('../public/detective/accounts-core.js');
 assert.equal(validatePublicNickname('  小明 旅行 🍵  '),'小明 旅行 🍵');assert.equal(validatePublicNickname('cafe\u0301'),'café');assert.equal(validatePublicNickname('😀'.repeat(64)),'😀'.repeat(64));assert.throws(()=>validatePublicNickname('😀'.repeat(65)));
 for(const input of ['',null,'\ud800','\udc00','昵称\n另行','昵称\u202e伪装','昵称\u2066伪装'])assert.throws(()=>validatePublicNickname(input));
});
test('nickname privacy checks recognize fullwidth identifiers, secret labels and URL text',async()=>{
 const {validatePublicNickname}=await import('../public/detective/accounts-core.js');
 for(const input of ['13800138000','１３８００１３８０００','name@example.com','token=SECRET','ｔｏｋｅｎ＝SECRET','ｈｔｔｐｓ：／／example.com','密码：SECRET'])assert.throws(()=>validatePublicNickname(input),input);
});
test('nickname query syntax is encoded rather than becoming extra URL parameters',async()=>{
 const {buildDomesticLeads}=await import('../public/detective/accounts-core.js');
 const query='小明 &next=evil #旅行/🍵',leads=buildDomesticLeads(query);assert.ok(leads.length>=4);
 for(const lead of leads){const url=new URL(lead.url);assert.equal(url.hash,'');assert.equal(url.searchParams.has('next'),false);assert.ok(decodeURIComponent(lead.url.replace(/\+/g,'%20')).includes(query));assert.equal(lead.username,query);assert.equal(lead.status,'unverified');}
});
test('all eight verified templates preserve exact nickname, destination and user/content/index distinction',async()=>{
 const {buildDomesticLeads}=await import('../public/detective/accounts-core.js');
 const nickname='中文旅行 🍵 &小站/日记',leads=buildDomesticLeads(nickname);
 assert.equal(leads.length,8);
 const expected=[
  ['search.bilibili.com','users','keyword','/zh-Hans/upuser'],
  ['s.weibo.com','users','q','/user'],
  ['www.douyin.com','mixed',null,null],
  ['www.xiaohongshu.com','mixed','keyword','/search_result'],
  ['weixin.sogou.com','content','query','/weixin'],
  ['www.baidu.com','index','wd','/s','zhihu.com'],
  ['www.baidu.com','index','wd','/s','kuaishou.com'],
  ['www.baidu.com','index','wd','/s','tieba.baidu.com'],
 ];
 leads.forEach((lead,i)=>{
  const [host,type,param,path,domain]=expected[i],url=new URL(lead.url);
  assert.equal(url.protocol,'https:');assert.equal(url.hostname,host);assert.equal(lead.searchType,type);assert.equal(lead.status,'unverified');assert.equal(lead.source,'platform-search');assert.equal(lead.username,nickname);
  if(path)assert.equal(url.pathname,path);
  if(param)assert.equal(url.searchParams.get(param),domain?`${nickname} site:${domain}`:nickname);
  else assert.equal(decodeURIComponent(url.pathname.slice('/search/'.length)),nickname);
  if(type==='index'){assert.match(lead.site,/百度收录页/);assert.match(lead.note,/不是平台用户搜索/);assert.match(lead.linkLabel,/百度收录/);}
 });
 const wechat=leads[4],url=new URL(wechat.url);
 assert.equal(url.searchParams.get('type'),'2');assert.equal(url.searchParams.get('ie'),'utf8');assert.match(wechat.note,/不是个人微信账号/);assert.match(wechat.note,/不是公众号身份匹配/);assert.match(wechat.site,/文章/);
});
