/** Local evidence bookkeeping. No network, automatic truth judgment, or identity matching. */
const MAX_BYTES = 1024 * 1024;
const KINDS = ['observation', 'statement', 'inference'];
const STATES = ['unverified', 'corroborated', 'disputed'];
const KIND_LABEL = {observation:'直接观察（仍需核验）',statement:'他人陈述',inference:'个人推测'};
const STATE_LABEL = {unverified:'待核验',corroborated:'已人工交叉核验（用户标注）',disputed:'有争议'};
const DISCLAIMER = '本报告仅整理用户记录与判断，不验证来源真实性，不自动认定事实、身份、违法或责任。支持和反证关系均由用户标注，数量不代表可信概率。仅用于合法、已获授权的公开信息核验。';
const field = (obj,key,fallback) => Object.hasOwn(obj,key) ? obj[key] : fallback;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
function jsonShape(value) {
  const seen = new Set(); let nodes = 0;
  function inspect(v, depth) {
    if (++nodes > 10000 || depth > 12) throw new Error('资料结构过于复杂。');
    if (v === null || ['string','boolean'].includes(typeof v)) return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (typeof v !== 'object') throw new Error('资料必须是普通 JSON 数据。');
    if (seen.has(v)) throw new Error('资料不能包含循环引用。');
    if (!Array.isArray(v) && ![Object.prototype,null].includes(Object.getPrototypeOf(v))) throw new Error('资料必须是普通 JSON 对象。');
    seen.add(v);
    for (const key of Object.keys(v)) {
      const d = Object.getOwnPropertyDescriptor(v,key);
      if (!d || !('value' in d)) throw new Error('资料不能包含动态属性。');
      inspect(d.value,depth+1);
    }
    seen.delete(v);
  }
  inspect(value,0);
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BYTES) throw new Error('资料不能超过 1 MiB。');
}
function safeJSON(value,space) {return JSON.stringify(value,null,space).replace(/[<>&\u2028\u2029]/g,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);}
function record(v,label) { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label}格式无效。`); }
function text(v,max,label,required=false) {
  if (typeof v !== 'string' || [...v].length > max || CONTROL.test(v) || /\p{Surrogate}/u.test(v)) throw new Error(`${label}须为不超过 ${max} 个字符的有效文本。`);
  if (required && !v.trim()) throw new Error(`请填写${label}。`);
  return v.trim();
}
function choice(v,allowed,label) { if (!allowed.includes(v)) throw new Error(`${label}无效。`); return v; }
function date(v,label) {
  if (v === '') return '';
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) throw new Error(`${label}须为 YYYY-MM-DD，未知可留空。`);
  const d = new Date(v+'T00:00:00.000Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== v) throw new Error(`${label}不是有效日期。`);
  return v;
}
function iso(v,label) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) throw new Error(`${label}须为完整 UTC 时间。`);
  const d = new Date(v); if (!Number.isFinite(d.getTime()) || d.toISOString() !== v) throw new Error(`${label}无效。`); return v;
}
function timestamp(now = new Date()) { const d = new Date(now); if (!Number.isFinite(d.getTime())) throw new Error('记录时间无效。'); return iso(d.toISOString(),'记录时间'); }
function sourceUrl(v) {
  const s = text(v,2048,'来源网址'); if (!s) return '';
  if (!/^https?:\/\//i.test(s) || /[\s\\]/.test(s)) throw new Error('来源网址须为完整 HTTP(S) 网址，不含空白或反斜线。');
  let u; try { u = new URL(s); } catch { throw new Error('来源网址格式无效。'); }
  if (u.username || u.password || /@/.test(s.split('/')[2]) || !u.hostname) throw new Error('来源网址不能带用户名或密码。');
  if (u.href.length > 2048) throw new Error('编码后的来源网址过长。');
  return u.href;
}
function id(v,prefix) { if (typeof v !== 'string' || !new RegExp(`^${prefix}[1-9]\\d{0,8}$`).test(v)) throw new Error('记录编号无效。'); return v; }
function evidence(v) {
  record(v,'证据');
  return {id:id(v.id,'E'),observation:text(v.observation,1500,'观察或陈述内容',true),kind:choice(v.kind,KINDS,'记录类型'),sourceName:text(v.sourceName,120,'来源名称'),sourceUrl:sourceUrl(v.sourceUrl),eventDate:date(v.eventDate,'事件日期'),publishedDate:date(v.publishedDate,'来源发布日期'),interpretation:text(v.interpretation,1000,'个人解释'),verification:choice(v.verification,STATES,'核验状态'),capturedAt:iso(v.capturedAt,'记录时间')};
}
function sequence(value,minimum) {
  if (value === undefined) return minimum;
  if (!Number.isSafeInteger(value) || value < minimum || value > 999999999) throw new Error('记录编号计数器无效。'); return value;
}
export function createCase(now) {return {schemaVersion:1,title:'',question:'',evidence:[],hypotheses:[],updatedAt:timestamp(now),nextEvidenceNumber:1,nextHypothesisNumber:1};}
export function validateCase(value) {
  jsonShape(value); record(value,'调查资料');
  if (value.schemaVersion !== 1) throw new Error('不支持此资料版本。');
  if (!Array.isArray(value.evidence) || value.evidence.length > 100) throw new Error('最多保留 100 条证据记录。');
  if (!Array.isArray(value.hypotheses) || value.hypotheses.length > 20) throw new Error('最多保留 20 个假设。');
  const items = value.evidence.map(evidence), eids = new Set(items.map(e=>e.id));
  if (eids.size !== items.length) throw new Error('证据编号重复。');
  const hypotheses = value.hypotheses.map(h=>{
    record(h,'假设'); if (!Array.isArray(h.links) || h.links.length > 100) throw new Error('证据关联格式无效。');
    const linked = new Set();
    const links = h.links.map(l=>{
      record(l,'关联'); const evidenceId = id(l.evidenceId,'E');
      if (!eids.has(evidenceId)) throw new Error('关联指向不存在的证据。');
      if (linked.has(evidenceId)) throw new Error('同一假设不能重复关联同一证据。'); linked.add(evidenceId);
      return {evidenceId,relation:choice(l.relation,['supports','refutes'],'关联类型')};
    });
    return {id:id(h.id,'H'),statement:text(h.statement,600,'假设内容',true),links};
  });
  if (new Set(hypotheses.map(h=>h.id)).size !== hypotheses.length) throw new Error('假设编号重复。');
  const clean = {schemaVersion:1,title:text(value.title,120,'调查标题'),question:text(value.question,1000,'核验问题'),evidence:items,hypotheses,updatedAt:iso(value.updatedAt,'更新时间'),nextEvidenceNumber:sequence(value.nextEvidenceNumber,Math.max(0,...items.map(e=>Number(e.id.slice(1))))+1),nextHypothesisNumber:sequence(value.nextHypothesisNumber,Math.max(0,...hypotheses.map(h=>Number(h.id.slice(1))))+1)};
  if(new TextEncoder().encode(safeJSON(clean)).length>MAX_BYTES)throw new Error('可导出的资料超过 1 MiB，请减少内容或拆分调查。');
  return clean;
}
export function updateCaseInfo(value,patch,now) {jsonShape(patch);record(patch,'调查信息');const c=validateCase(value);return validateCase({...c,title:field(patch,'title',c.title),question:field(patch,'question',c.question),updatedAt:timestamp(now)});}
export function addEvidence(value,draft,now) {
  jsonShape(draft);record(draft,'证据'); const c=validateCase(value); if(c.evidence.length>=100)throw new Error('最多保留 100 条证据记录。');
  const at=timestamp(now), e=evidence({id:`E${c.nextEvidenceNumber}`,observation:draft.observation,kind:field(draft,'kind','observation'),sourceName:field(draft,'sourceName',''),sourceUrl:field(draft,'sourceUrl',''),eventDate:field(draft,'eventDate',''),publishedDate:field(draft,'publishedDate',''),interpretation:field(draft,'interpretation',''),verification:field(draft,'verification','unverified'),capturedAt:at});
  return validateCase({...c,evidence:[...c.evidence,e],nextEvidenceNumber:c.nextEvidenceNumber+1,updatedAt:at});
}
export function updateEvidence(value,evidenceId,draft,now) {
  jsonShape(draft); record(draft,'证据'); const c=validateCase(value), old=c.evidence.find(e=>e.id===evidenceId);
  if(!old)throw new Error('找不到该证据。');
  const updated=evidence({...old,...draft,id:old.id,capturedAt:old.capturedAt});
  return validateCase({...c,evidence:c.evidence.map(e=>e.id===evidenceId?updated:e),updatedAt:timestamp(now)});
}
export function addHypothesis(value,statement,now) {const c=validateCase(value);if(c.hypotheses.length>=20)throw new Error('最多保留 20 个假设。');return validateCase({...c,hypotheses:[...c.hypotheses,{id:`H${c.nextHypothesisNumber}`,statement,links:[]}],nextHypothesisNumber:c.nextHypothesisNumber+1,updatedAt:timestamp(now)});}
export function linkEvidence(value,hypothesisId,evidenceId,relation,now) {
  const c=validateCase(value);choice(relation,['supports','refutes','none'],'关联类型');
  if(!c.hypotheses.some(h=>h.id===hypothesisId)||!c.evidence.some(e=>e.id===evidenceId))throw new Error('找不到要关联的假设或证据。');
  return validateCase({...c,hypotheses:c.hypotheses.map(h=>h.id!==hypothesisId?h:{...h,links:[...h.links.filter(l=>l.evidenceId!==evidenceId),...(relation==='none'?[]:[{evidenceId,relation}])]}),updatedAt:timestamp(now)});
}
export function removeEvidence(value,evidenceId,now) {const c=validateCase(value);if(!c.evidence.some(e=>e.id===evidenceId))throw new Error('找不到该证据。');return validateCase({...c,evidence:c.evidence.filter(e=>e.id!==evidenceId),hypotheses:c.hypotheses.map(h=>({...h,links:h.links.filter(l=>l.evidenceId!==evidenceId)})),updatedAt:timestamp(now)});}
export function removeHypothesis(value,hypothesisId,now) {const c=validateCase(value);if(!c.hypotheses.some(h=>h.id===hypothesisId))throw new Error('找不到该假设。');return validateCase({...c,hypotheses:c.hypotheses.filter(h=>h.id!==hypothesisId),updatedAt:timestamp(now)});}
export function parseCase(raw) {if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw new Error('请导入不超过 1 MiB 的 JSON 资料。');let v;try{v=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{throw new Error('无法解析 JSON 资料。');}return validateCase(v);}
export function exportCase(value) {const c=validateCase(value), pretty=safeJSON(c,2);return new TextEncoder().encode(pretty).length<=MAX_BYTES?pretty:safeJSON(c);}
export function summarizeCase(value) {
  const c=validateCase(value), nextSteps=[], groups=new Map(), byId=new Map(c.evidence.map(e=>[e.id,e]));
  const add=(code,message,evidenceIds=[],hypothesisId)=>nextSteps.push({code,message,evidenceIds,...(hypothesisId?{hypothesisId}:{})});
  if(!c.question)add('missing-question','先写清楚要核验的具体问题，避免为了已有判断挑选材料。');
  if(!c.evidence.length)add('no-evidence','先记录一条可核对出处的原始材料，把原话与自己的解释分开。');
  for(const e of c.evidence){
    if(!e.sourceName&&!e.sourceUrl)add('missing-source',`${e.id} 缺少出处：补来源名称、原始链接或材料获取方式。`,[e.id]);
    if(!e.eventDate)add('missing-date',`${e.id} 未知事件日期：核对发生时间，不要用记录时间代替。`,[e.id]);
    if(e.verification==='disputed')add('disputed',`${e.id} 被标为有争议：回到原件核对时间、上下文及是否有不同版本。`,[e.id]);
    if(e.verification==='unverified')add('unverified',`${e.id} 尚待核验：寻找独立原始来源，记录具体核对过程。`,[e.id]);
    if(e.sourceUrl){const u=new URL(e.sourceUrl);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key))u.searchParams.delete(key);const key=u.href;const ids=groups.get(key)||[];ids.push(e.id);groups.set(key,ids);}
  }
  const duplicateSources=[...groups].filter(([,ids])=>ids.length>1).map(([url,evidenceIds])=>({url,evidenceIds}));
  for(const d of duplicateSources)add('duplicate-source',`${d.evidenceIds.join('、')} 指向同一页面（忽略锚点和 utm 跟踪参数），不能当作多个独立来源；还要检查不同网址是否转述同一出处。`,d.evidenceIds);
  if(!c.hypotheses.length)add('no-hypotheses','至少提出两个可区分的解释，并写出什么证据会推翻各自解释。');
  else if(c.hypotheses.length===1)add('single-hypothesis','再写一个竞争解释，避免只寻找支持现有假设的材料。');
  const hypotheses=c.hypotheses.map(h=>{
    const supports=h.links.filter(l=>l.relation==='supports').map(l=>byId.get(l.evidenceId));
    const refutes=h.links.filter(l=>l.relation==='refutes').map(l=>byId.get(l.evidenceId));
    const gaps=[];
    const gap=(code,message,ids=[])=>{gaps.push(message);add(code,`${h.id}：${message}`,ids,h.id);};
    if(!supports.length)gap('no-support','尚未关联支持材料。');
    else if(supports.every(e=>e.kind==='inference'))gap('inference-only-support','支持项全部是个人推测，不能替代原始证据。',supports.map(e=>e.id));
    else if(!supports.some(e=>e.kind==='observation'))gap('no-observation-support','支持项尚无直接观察记录，请核对转述的原始出处。',supports.map(e=>e.id));
    if(!refutes.length)gap('no-counterevidence','主动寻找一条可能推翻此假设的材料；没有反证不等于假设成立。');
    if(supports.length&&refutes.length)gap('competing-evidence','同时存在支持和反对材料，先核对出处、时间与解释差异，不按票数下结论。',[...supports,...refutes].map(e=>e.id));
    return {id:h.id,statement:h.statement,supports,refutes,gaps};
  });
  const counts={total:c.evidence.length};for(const k of KINDS)counts[k]=c.evidence.filter(e=>e.kind===k).length;for(const k of STATES)counts[k]=c.evidence.filter(e=>e.verification===k).length;
  return {timeline:c.evidence.filter(e=>e.eventDate).sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||Number(a.id.slice(1))-Number(b.id.slice(1))),undated:c.evidence.filter(e=>!e.eventDate),hypotheses,nextSteps,duplicateSources,counts,disclaimer:DISCLAIMER};
}
const md = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g,'\\$1').replace(/\r?\n/g,'\n    ');
export function exportMarkdown(value) {
  const c=validateCase(value),s=summarizeCase(c),lines=['# 线索研判记录',`标题：${md(c.title||'未命名')}`,`核验问题：${md(c.question||'未填写')}`,`更新时间（UTC）：${c.updatedAt}`,'',DISCLAIMER,'','## 事件时间线'];
  for(const e of s.timeline)lines.push(`- ${e.eventDate} · ${e.id} · ${md(e.observation)}（${KIND_LABEL[e.kind]}）`);
  if(!s.timeline.length)lines.push('暂无已知事件日期；记录时间不等于事件发生时间。');
  if(s.undated.length)lines.push('','事件日期未知：'+s.undated.map(e=>e.id).join('、'));
  lines.push('','## 原始记录与个人解释');
  for(const e of c.evidence)lines.push('',`### ${e.id} · ${KIND_LABEL[e.kind]}`,`记录：${md(e.observation)}`,`来源名称：${md(e.sourceName||'待补')}`,`来源网址（文本）：${md(e.sourceUrl||'无')}`,`事件日期：${e.eventDate||'未知'}；来源发布日期：${e.publishedDate||'未知'}`,`本条录入时间（UTC）：${e.capturedAt}`,`核验状态：${STATE_LABEL[e.verification]}`,`个人解释（推测，不是事实）：${md(e.interpretation||'未填写')}`);
  lines.push('','## 竞争假设与反证');
  for(const h of s.hypotheses){lines.push('',`### ${h.id} · ${md(h.statement)}`,`支持记录（用户关联）：${h.supports.map(e=>e.id).join('、')||'无'}`,`反对记录（用户关联）：${h.refutes.map(e=>e.id).join('、')||'无'}`,...h.gaps.map(g=>`- ${md(g)}`));}
  lines.push('','## 下一步核验',...s.nextSteps.map(step=>`- ${md(step.message)}`),'','## 结论边界','尚未自动得出真假、身份或责任结论。用户标记“已交叉核验”只表示自己的核验记录，不是网站认证。');
  return lines.join('\n\n');
}
export function createDemoCase() {
  const now='2026-01-10T10:00:00.000Z';let c=updateCaseInfo(createCase(now),{title:'虚构演示：海风书店营业日期',question:'原公告与转发日期不同：截至 1 月 10 日，商家是否已正式改期，还是转发引用旧稿或记错日期？所有人物、机构和材料均为虚构演示。'},now);
  c=addEvidence(c,{observation:'1 月 10 日的最新虚构原公告写着“当前仍计划 1 月 12 日恢复营业，未发布其他日期安排”。',kind:'observation',sourceName:'虚构演示公告 A',sourceUrl:'https://example.com/demo/notice-a',eventDate:'2026-01-10',publishedDate:'2026-01-10',interpretation:'这是 1 月 10 日的计划表述，与此前转发的正式改期说法冲突；仍需核验原文，且不能证明未来实际营业。'},now);
  c=addEvidence(c,{observation:'演示转发称“书店要到 1 月 15 日才能营业”，未附原公告。',kind:'statement',sourceName:'虚构演示转发',eventDate:'2026-01-09',publishedDate:'2026-01-09',verification:'disputed',interpretation:'可能转述了另一版计划，也可能引用有误，需要找原文。'},now);
  c=addEvidence(c,{observation:'我猜测转发可能用了旧稿或记错日期。',kind:'inference',interpretation:'这里只是竞争解释，没有旧稿或转发者更正可佐证；与材料相容不等于已证明。'},now);
  c=addHypothesis(c,'虚构假设 A：截至 1 月 10 日，商家已正式把营业计划改为 1 月 15 日。',now);
  c=addHypothesis(c,'虚构假设 B：转发内容引用了旧版本或记错日期。',now);
  c=linkEvidence(c,'H1','E2','supports',now);c=linkEvidence(c,'H1','E1','refutes',now);c=linkEvidence(c,'H2','E3','supports',now);
  return c;
}
