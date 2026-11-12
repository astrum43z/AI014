import {createCase, updateCaseInfo, addEvidence, updateEvidence, removeEvidence, addHypothesis, removeHypothesis, linkEvidence, parseCase, exportCase, exportMarkdown, summarizeCase, createDemoCase} from './investigation-core.js';
const $ = id => document.getElementById(id);
const KEY = 'ai014.detective.investigation.v1';
const kinds = {observation:'直接观察 · 内容仍待核验',statement:'他人陈述 / 转述',inference:'个人推测'};
const states = {unverified:'待核验',corroborated:'已交叉核验（由你标记）',disputed:'存在争议或冲突'};
const el = (tag,text,cls) => {const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const button = (text,fn,cls) => {const node=el('button',text,cls);node.type='button';node.addEventListener('click',fn);return node;};
let current=createCase(), revision=0, importGeneration=0, pending=null, dirty=false;
function status(text,error=false,id='case-status'){$(id).textContent=text;$(id).classList.toggle('error',error);}
const evidenceFields={'evidence-observation':'observation','evidence-kind':'kind','evidence-verification':'verification','evidence-source-name':'sourceName','evidence-source-url':'sourceUrl','evidence-event-date':'eventDate','evidence-published-date':'publishedDate','evidence-interpretation':'interpretation'};
function hasInfoDraft(){return current.title!==$('case-title').value||current.question!==$('case-question').value;}
function hasEvidenceDraft(){
 const original=current.evidence.find(e=>e.id===$('evidence-id').value)||{kind:'observation',verification:'unverified'};
 return Object.entries(evidenceFields).some(([input,key])=>$(input).value!==(original[key]||''));
}
function hasRecordDraft(){return Boolean($('hypothesis-statement').value||hasEvidenceDraft());}
function hasData(){return Boolean(current.title||current.question||current.evidence.length||current.hypotheses.length||$('case-title').value||$('case-question').value||hasRecordDraft());}
function unsaved(){return dirty||hasInfoDraft()||hasRecordDraft();}
function savedLabel(){ $('case-save-state').textContent=hasRecordDraft()?'有尚未加入记录的表单草稿；保存和导出都不包含它，请先提交或取消草稿。':unsaved()?'当前有未保存到本机的修改。离开前请保存或导出并确认文件已收到。':hasData()?'当前记录已读取或保存到本机；此存储不加密，请保管好设备。':'当前没有记录。默认不保存到设备。'; }
function invalidatePending(){revision++;importGeneration++;closePending();savedLabel();}
function closePending(){pending=null;$('case-confirm').hidden=true;}
function commit(next,message,saved=false){current=next;revision++;importGeneration++;dirty=!saved;closePending();render();if(message)status(message);}
function syncInfo(){if(current.title!==$('case-title').value||current.question!==$('case-question').value){current=updateCaseInfo(current,{title:$('case-title').value,question:$('case-question').value});$('case-title').value=current.title;$('case-question').value=current.question;revision++;importGeneration++;dirty=true;closePending();}}
function requestAction(message,fn,label='确认替换'){importGeneration++;pending={fn,revision};$('case-confirm-text').textContent=message;$('case-confirm-yes').textContent=label;$('case-confirm').hidden=false;}
$('case-confirm-no').addEventListener('click',()=>{closePending();importGeneration++;status('已取消，当前记录保留。');});
$('case-confirm-yes').addEventListener('click',()=>{const action=pending;closePending();if(!action)return;if(action.revision!==revision){status('记录已变化，请重新发起操作。',true);return;}try{action.fn();}catch(error){status(error.message,true);}});
function resetEvidenceForm(){for(const id of ['evidence-id','evidence-observation','evidence-source-name','evidence-source-url','evidence-event-date','evidence-published-date','evidence-interpretation'])$(id).value='';$('evidence-kind').value='observation';$('evidence-verification').value='unverified';$('evidence-submit').textContent='加入记录';$('evidence-editor-title').textContent='新增一条记录';status('',false,'evidence-status');savedLabel();}
function replaceCase(next,message,saved=false){resetEvidenceForm();$('hypothesis-statement').value='';$('case-title').value=next.title;$('case-question').value=next.question;commit(next,message,saved);}
function offerReplace(next,message,saved=false){const fn=()=>replaceCase(next,message,saved);if(hasData())requestAction('将替换当前页面中的研判及尚未加入的表单内容。建议先保存或导出备份；本机已保存的副本不会自动覆盖。',fn);else fn();}
function evidenceSnippet(e){return `${e.id} · ${e.observation.length>90?e.observation.slice(0,90)+'…':e.observation}`;}
function renderEvidence(){
 $('case-evidence-count').textContent=`${current.evidence.length} / 100 条`;
 $('evidence-list').replaceChildren();
 if(!current.evidence.length){$('evidence-list').append(el('p','还没有线索。先记录一个可以回到原出处复查的观察，再写你的解释。','case-empty'));return;}
 for(const e of current.evidence){
  const card=el('article',undefined,'evidence-card'),head=el('header');head.append(el('h4',e.id),el('span',kinds[e.kind],`evidence-label ${e.kind}`));card.append(head,el('p',e.observation,'observation'));
  const meta=el('div',undefined,'evidence-meta');meta.append(el('p',`出处：${e.sourceName||'未记录'} · 核验状态：${states[e.verification]}`));
  if(e.sourceUrl){const link=el('a',e.sourceUrl);link.href=e.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';meta.append(link);}
  meta.append(el('p',`事件：${e.eventDate||'日期未知'} · 来源发布：${e.publishedDate||'日期未知'}\n本条录入：${e.capturedAt.replace('T',' ').replace('.000Z',' UTC')}`));card.append(meta);
  if(e.interpretation)card.append(el('p',`你的解释（推测，不是已证事实）：\n${e.interpretation}`,'interpretation'));
  const actions=el('div',undefined,'record-actions');actions.append(button('修正这条记录',()=>editEvidence(e.id)),button('移除记录',()=>requestAction(`移除 ${e.id}，并清理它在假设中的支持/反证关联？不会删除本机之前保存的副本。`,()=>{commit(removeEvidence(current,e.id),`${e.id} 已移除，关联已清理。`);if($('evidence-id').value===e.id)resetEvidenceForm();},'确认移除'),'danger'));
  card.append(actions);$('evidence-list').append(card);
 }
}
function renderTimeline(summary){
 $('case-timeline').replaceChildren();
 for(const e of summary.timeline){const li=el('li');li.append(el('time',e.eventDate),el('p',`${evidenceSnippet(e)}（${kinds[e.kind]}）`));$('case-timeline').append(li);}
 if(!summary.timeline.length)$('case-timeline').append(el('li','尚无已知事件日期，录入时间不会代替事件时间。'));
 $('case-undated').replaceChildren();
 if(summary.undated.length){$('case-undated').append(el('strong',`日期待查 · ${summary.undated.length} 条`));for(const e of summary.undated)$('case-undated').append(el('p',evidenceSnippet(e)));}
}
function evidenceSide(label,items){const box=el('div');box.append(el('strong',label));if(!items.length)box.append(el('p','尚未关联，不能视为不存在。'));else{const list=el('ul');for(const e of items)list.append(el('li',`${evidenceSnippet(e)} · ${kinds[e.kind]} · ${states[e.verification]}`));box.append(list);}return box;}
function renderHypotheses(summary){
 $('hypothesis-list').replaceChildren();
 if(!current.hypotheses.length){$('hypothesis-list').append(el('p','先写一个待检验的解释，再写一个可能与它竞争的解释。不要只收集支持自己最初猜想的材料。','case-empty'));return;}
 for(const h of summary.hypotheses){
  const card=el('article',undefined,'hypothesis-card'),head=el('header');head.append(el('h4',`${h.id} · ${h.statement}`),el('span','待检验的假设','evidence-label inference'));card.append(head);
  const sides=el('div',undefined,'support-refute');sides.append(evidenceSide('支持它的记录（由你关联）',h.supports),evidenceSide('反对它的记录（由你关联）',h.refutes));card.append(sides);
  if(h.gaps.length){const gaps=el('ul',undefined,'hypothesis-gaps');gaps.append(...h.gaps.map(text=>el('li',text)));card.append(gaps);}
  if(current.evidence.length){
   const form=el('form',undefined,'hypothesis-linker'),a=el('div'),b=el('div'),select=el('select'),relation=el('select');select.id=`evidence-for-${h.id}`;relation.id=`relation-for-${h.id}`;
   const al=el('label','选择记录');al.htmlFor=select.id;const bl=el('label','与此假设的关系');bl.htmlFor=relation.id;
   for(const e of current.evidence){const o=el('option',evidenceSnippet(e));o.value=e.id;select.append(o);}
   for(const [value,text] of [['supports','支持'],['refutes','反对 / 反证'],['none','取消该记录的关联']]){const o=el('option',text);o.value=value;relation.append(o);}
   a.append(al,select);b.append(bl,relation);const submit=el('button','更新关联');submit.type='submit';form.append(a,b,submit);
   form.addEventListener('submit',event=>{event.preventDefault();try{commit(linkEvidence(current,h.id,select.value,relation.value),`已更新 ${h.id} 与 ${select.value} 的关系。关系由你判断，网站没有自动验证。`);}catch(error){status(error.message,true);}});card.append(form);
  }
  card.append(button('移除这个假设',()=>requestAction(`移除 ${h.id} 及其关联？证据记录本身保留。`,()=>commit(removeHypothesis(current,h.id),`${h.id} 已移除，原记录保留。`),'确认移除'),'danger'));$('hypothesis-list').append(card);
 }
}
function render(){const summary=summarizeCase(current);renderEvidence();renderTimeline(summary);renderHypotheses(summary);$('case-next-steps').replaceChildren(...summary.nextSteps.map(step=>el('li',step.message)));if(!summary.nextSteps.length)$('case-next-steps').append(el('li','没有触发这些有限的资料缺口检查，不代表已证实结论。请回到原始来源核验。'));savedLabel();}
function fillEvidenceEditor(id){const e=current.evidence.find(x=>x.id===id);if(!e)return;const fields={'evidence-id':'id','evidence-observation':'observation','evidence-kind':'kind','evidence-verification':'verification','evidence-source-name':'sourceName','evidence-source-url':'sourceUrl','evidence-event-date':'eventDate','evidence-published-date':'publishedDate','evidence-interpretation':'interpretation'};for(const [input,key] of Object.entries(fields))$(input).value=e[key];$('evidence-editor-title').textContent=`修正 ${id}（保留编号与关联）`;$('evidence-submit').textContent='保存修正';$('evidence-form').parentElement.open=true;$('evidence-observation').focus();invalidatePending();status('修改会更新记录，不是不可篡改的取证日志。',false,'evidence-status');}
function editEvidence(id){if(hasEvidenceDraft())requestAction('将用所选记录替换尚未提交的证据表单草稿；已加入的记录不变。要继续修正所选记录吗？',()=>fillEvidenceEditor(id),'确认切换编辑');else fillEvidenceEditor(id);}
$('case-info-form').addEventListener('submit',event=>{event.preventDefault();try{syncInfo();render();status('研判问题已更新；先围绕这个具体问题核验。');}catch(error){status(error.message,true);}});
for(const id of ['case-title','case-question','evidence-observation','evidence-source-name','evidence-source-url','evidence-event-date','evidence-published-date','evidence-interpretation','hypothesis-statement'])$(id).addEventListener('input',invalidatePending);
for(const id of ['evidence-kind','evidence-verification'])$(id).addEventListener('change',invalidatePending);
$('evidence-form').addEventListener('submit',event=>{event.preventDefault();try{syncInfo();const draft={observation:$('evidence-observation').value,kind:$('evidence-kind').value,verification:$('evidence-verification').value,sourceName:$('evidence-source-name').value,sourceUrl:$('evidence-source-url').value,eventDate:$('evidence-event-date').value,publishedDate:$('evidence-published-date').value,interpretation:$('evidence-interpretation').value};const id=$('evidence-id').value;commit(id?updateEvidence(current,id,draft):addEvidence(current,draft),id?`${id} 已修正，编号和关联保留。`:'记录已加入。请继续查原始出处，而不是把记录当成证明。');resetEvidenceForm();}catch(error){status(error.message,true,'evidence-status');}});
$('evidence-cancel').addEventListener('click',()=>{resetEvidenceForm();invalidatePending();status('已取消表单编辑，已加入的记录及本机副本均保留。',false,'evidence-status');});
$('hypothesis-form').addEventListener('submit',event=>{event.preventDefault();try{syncInfo();commit(addHypothesis(current,$('hypothesis-statement').value),'假设已加入，请分别关联支持记录和反证。');$('hypothesis-statement').value='';savedLabel();status('',false,'hypothesis-status');}catch(error){status(error.message,true,'hypothesis-status');}});
$('case-demo').addEventListener('click',()=>offerReplace(createDemoCase(),'已载入虚构演示。商家、通知和网址仅作练习，不代表真实事件。'));
$('case-new').addEventListener('click',()=>offerReplace(createCase(),'已新建空白研判。本机之前保存的副本仍保留。'));
$('case-save').addEventListener('click',()=>{try{syncInfo();localStorage.setItem(KEY,exportCase(current));dirty=false;savedLabel();status(hasRecordDraft()?'已保存已加入的记录；尚未提交的证据或假设草稿没有保存，请先加入记录再保存。':'已保存在这台设备的浏览器中，不会自动同步，也不是加密存储。建议另导出备份。');}catch(error){status(`未能保存到本机：${error.message} 请改用导出备份。`,true);}});
$('case-load').addEventListener('click',()=>{try{const raw=localStorage.getItem(KEY);if(!raw){status('这台设备没有此工具保存的研判。');return;}offerReplace(parseCase(raw),'已读取本机保存。没有上传或发送给服务器。',true);}catch(error){status(`无法读取本机保存：${error.message} 当前记录未被替换。`,true);}});
$('case-forget').addEventListener('click',()=>requestAction('删除此工具在当前浏览器保存的副本？当前页面中的记录不会清空；已下载的文件也不会删除。',()=>{localStorage.removeItem(KEY);dirty=hasData();savedLabel();status('本机保存的副本已删除。当前页面和你导出的文件仍由你保管。');},'确认删除本机副本'));
$('case-import').addEventListener('change',async()=>{const file=$('case-import').files[0],generation=++importGeneration,atRevision=revision;if(!file)return;try{if(file.size>1024*1024)throw new Error('资料超过 1 MiB。');status('正在本地读取和校验备份…');const raw=await file.text();if(generation!==importGeneration||atRevision!==revision)return;const next=parseCase(raw);$('case-import').value='';offerReplace(next,'备份已导入本页，尚未保存到这台设备。');}catch(error){if(generation===importGeneration)status(`未导入：${error.message} 当前记录保留。`,true);}finally{if(generation===importGeneration)$('case-import').value='';}});
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
for(const [id,formatter,name,type] of [['case-json',exportCase,'ai014-investigation.json','application/json;charset=utf-8'],['case-markdown',exportMarkdown,'ai014-investigation-report.md','text/markdown;charset=utf-8']])$(id).addEventListener('click',()=>{try{syncInfo();download(formatter(current),name,type);savedLabel();status(hasRecordDraft()?'已发起正式记录下载，但未提交的表单草稿未包含在内。请先加入记录后重新导出。':'已发起下载，请确认文件已保存再离开。导出包含你的记录与来源，请自行妥善保管。');}catch(error){status(`无法导出：${error.message}`,true);}});
window.addEventListener('beforeunload',event=>{if(unsaved()&&hasData()){event.preventDefault();event.returnValue='';}});
render();
