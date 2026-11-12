import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/detective/investigation-core.js';
const NOW='2026-01-10T10:00:00.000Z', LATER='2026-01-11T11:00:00.000Z';
const base=()=>C.createCase(NOW);
const one=(draft={})=>C.addEvidence(base(),{observation:'原件写着尚未确定。',...draft},NOW);
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};

test('empty case has deterministic UTC time, empty content and no truth score',()=>{
 const c=base();assert.equal(c.schemaVersion,1);assert.equal(c.updatedAt,NOW);assert.deepEqual(c.evidence,[]);assert.deepEqual(c.hypotheses,[]);assert.equal(c.nextEvidenceNumber,1);assert.ok(!('confidence' in C.summarizeCase(c)));
});
test('updates are immutable and project allowed fields only',()=>{
 const c=freeze(base());const updated=C.updateCaseInfo(c,{title:' 核验公告 ',question:'哪一版有效？',secret:'discard'},LATER);
 assert.equal(c.title,'');assert.equal(updated.title,'核验公告');assert.equal(updated.updatedAt,LATER);assert.equal(updated.secret,undefined);
 const e=C.addEvidence(freeze(updated),{observation:'看到日期',unknown:'discard'},LATER);assert.equal(updated.evidence.length,0);assert.equal(e.evidence[0].unknown,undefined);
});
test('new evidence defaults fields and generates retained IDs without reusing deleted IDs',()=>{
 let c=one();c=C.addEvidence(c,{observation:'第二条'},NOW);c=C.removeEvidence(c,'E2',NOW);c=C.addEvidence(c,{observation:'第三条'},NOW);assert.deepEqual(c.evidence.map(e=>e.id),['E1','E3']);assert.equal(c.evidence[0].capturedAt,NOW);assert.equal(c.evidence[0].kind,'observation');assert.equal(c.evidence[0].verification,'unverified');
});
test('editing preserves ID, collection time and associated hypothesis references',()=>{
 let c=C.addHypothesis(one(),'假设A',NOW);c=C.linkEvidence(c,'H1','E1','supports',NOW);const before=clone(c);freeze(c);
 const out=C.updateEvidence(c,'E1',{observation:'纠正原话',id:'E99',capturedAt:LATER,verification:'disputed'},LATER);
 assert.deepEqual(c,before);assert.equal(out.evidence[0].id,'E1');assert.equal(out.evidence[0].capturedAt,NOW);assert.equal(out.evidence[0].observation,'纠正原话');assert.equal(out.updatedAt,LATER);assert.deepEqual(out.hypotheses[0].links,[{evidenceId:'E1',relation:'supports'}]);
});
test('relation replacement, removal and evidence deletion cannot leave stale links',()=>{
 let c=C.addHypothesis(one(),'解释A',NOW);c=C.linkEvidence(c,'H1','E1','supports',NOW);c=C.linkEvidence(c,'H1','E1','refutes',NOW);assert.deepEqual(c.hypotheses[0].links,[{evidenceId:'E1',relation:'refutes'}]);
 c=C.linkEvidence(c,'H1','E1','none',NOW);assert.equal(c.hypotheses[0].links.length,0);c=C.linkEvidence(c,'H1','E1','supports',NOW);c=C.removeEvidence(c,'E1',NOW);assert.equal(c.hypotheses[0].links.length,0);
 assert.throws(()=>C.linkEvidence(c,'H1','E1','supports',NOW));assert.throws(()=>C.removeEvidence(c,'E999',NOW));
});
test('hypothesis deletion preserves monotonic hypothesis numbering',()=>{
 let c=C.addHypothesis(base(),'A',NOW);c=C.removeHypothesis(c,'H1',NOW);c=C.addHypothesis(c,'B',NOW);assert.equal(c.hypotheses[0].id,'H2');assert.throws(()=>C.removeHypothesis(c,'H9',NOW));
});
test('strict dates reject impossible and ambiguous values but permit unknown and leap day',()=>{
 assert.equal(one({eventDate:'2024-02-29'}).evidence[0].eventDate,'2024-02-29');
 for(const date of ['2025-02-29','2026-02-30','2026-13-01','2026-1-01','01/02/2026','0000-01-01',null,42])assert.throws(()=>one({eventDate:date}),String(date));
 assert.throws(()=>one({publishedDate:'2026-04-31'}));assert.throws(()=>C.createCase('not-a-date'));
});
test('UTC timestamps on import must be exact valid instants, never a guessed locale date',()=>{
 for(const value of ['2026-01-10','2026-01-10T10:00:00Z','2026-02-30T10:00:00.000Z','2026-01-10T18:00:00.000+08:00']){const c=one();c.evidence[0].capturedAt=value;assert.throws(()=>C.validateCase(c));}
});
test('source URL is canonical HTTP(S), not executable or credential-bearing',()=>{
 assert.equal(one({sourceUrl:'https://EXAMPLE.com:443/公开'}).evidence[0].sourceUrl,'https://example.com/%E5%85%AC%E5%BC%80');
 for(const sourceUrl of ['javascript:alert(1)','data:text/html,test','//example.com','https://u:p@example.com','https://@example.com','https://example.com\\evil','https://example.com/ a','https://example.com/\nsecret'])assert.throws(()=>one({sourceUrl}),sourceUrl);
});
test('length, field type and enumeration limits are enforced without coercion',()=>{
 for(const draft of [{observation:''},{observation:'中'.repeat(1501)},{sourceName:'名'.repeat(121)},{interpretation:'推'.repeat(1001)},{kind:'fact'},{verification:'verified'},{kind:null},{sourceName:42},{sourceUrl:null}])assert.throws(()=>one(draft));
 assert.equal(one({observation:'😀'.repeat(1500)}).evidence[0].observation.length,3000);
 assert.throws(()=>C.updateCaseInfo(base(),{title:null}));assert.throws(()=>C.updateCaseInfo(base(),{title:'长'.repeat(121)}));assert.throws(()=>C.addHypothesis(base(),'长'.repeat(601),NOW));
});
test('evidence and hypothesis caps reject additions atomically',()=>{
 let c=base();for(let i=0;i<100;i++)c=C.addEvidence(c,{observation:String(i)},NOW);assert.equal(c.evidence.length,100);assert.throws(()=>C.addEvidence(c,{observation:'overflow'},NOW));
 for(let i=0;i<20;i++)c=C.addHypothesis(c,'解释'+i,NOW);assert.throws(()=>C.addHypothesis(c,'overflow',NOW));assert.equal(c.hypotheses.length,20);
});
test('duplicate IDs, absent references and duplicate contradictory relations are rejected',()=>{
 let c=C.addHypothesis(one(),'假设',NOW);
 let bad=clone(c);bad.evidence.push(clone(bad.evidence[0]));assert.throws(()=>C.validateCase(bad),/重复/);
 bad=clone(c);bad.hypotheses.push(clone(bad.hypotheses[0]));assert.throws(()=>C.validateCase(bad),/重复/);
 bad=clone(c);bad.hypotheses[0].links=[{evidenceId:'E99',relation:'supports'}];assert.throws(()=>C.validateCase(bad),/不存在/);
 bad=clone(c);bad.hypotheses[0].links=[{evidenceId:'E1',relation:'supports'},{evidenceId:'E1',relation:'refutes'}];assert.throws(()=>C.validateCase(bad),/重复/);
 assert.throws(()=>C.linkEvidence(c,'H1','E1','confirmed',NOW));
});
test('old schema-one records without counters import safely, invalid counters do not',()=>{
 const c=one();delete c.nextEvidenceNumber;delete c.nextHypothesisNumber;assert.equal(C.validateCase(c).nextEvidenceNumber,2);
 for(const value of [0,1,1.5,-1,'2',1000000000])assert.throws(()=>C.validateCase({...c,nextEvidenceNumber:value}));
});
test('strict schema projects unknown JSON keys without prototype pollution',()=>{
 const raw=JSON.stringify(one()).replace('"schemaVersion":1','"schemaVersion":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"extra":"discard"');
 const c=C.parseCase(raw);assert.equal(Object.getPrototypeOf(c),Object.prototype);assert.equal(Object.hasOwn(c,'__proto__'),false);assert.equal(c.extra,undefined);assert.equal({}.polluted,undefined);
 for(const schemaVersion of [2,'1',null])assert.throws(()=>C.validateCase({...base(),schemaVersion}));
});
test('JSON parsing bounds total bytes and rejects malformed, non-object, cycles and executable shapes',()=>{
 for(const raw of ['',null,'{}','[]','null','{bad'])assert.throws(()=>C.parseCase(raw));assert.throws(()=>C.parseCase(' '.repeat(1048577)),/1 MiB/);
 const c=base();c.extra='中'.repeat(350000);assert.throws(()=>C.validateCase(c),/1 MiB/);
 const cyclic=base();cyclic.cycle=cyclic;assert.throws(()=>C.validateCase(cyclic),/循环/);
 let calls=0;const accessor=base();Object.defineProperty(accessor,'bad',{enumerable:true,get(){calls++;return 1;}});assert.throws(()=>C.validateCase(accessor));assert.equal(calls,0);
 const executable={...base(),toJSON(){calls++;return base();}};assert.throws(()=>C.validateCase(executable));assert.equal(calls,0);
});
test('JSON roundtrip preserves dates, relations, unicode and editable text while escaping HTML boundaries',()=>{
 let c=one({observation:'<script>alert(1)</script> 🍵 & 内容',interpretation:'可能，不是事实'});c=C.addHypothesis(c,'解释</script>',NOW);c=C.linkEvidence(c,'H1','E1','refutes',NOW);
 const out=C.exportCase(c);assert.ok(!out.includes('<'));assert.deepEqual(C.parseCase(out),c);assert.deepEqual(C.parseCase('\uFEFF'+out),c);
});
test('timeline uses event dates, with same-day stable IDs and undated records kept separate',()=>{
 let c=one({eventDate:'2026-01-09',publishedDate:'2025-01-01'});c=C.addEvidence(c,{observation:'早',eventDate:'2026-01-01'},LATER);c=C.addEvidence(c,{observation:'未知'},NOW);c=C.addEvidence(c,{observation:'同日',eventDate:'2026-01-01'},NOW);
 const s=C.summarizeCase(c);assert.deepEqual(s.timeline.map(e=>e.id),['E2','E4','E1']);assert.deepEqual(s.undated.map(e=>e.id),['E3']);assert.equal(s.undated[0].capturedAt,NOW);
});
test('source reuse ignores fragment and utm tags but does not infer independent sources from other URLs',()=>{
 let c=one({sourceUrl:'https://example.com/article?utm_source=a#one'});c=C.addEvidence(c,{observation:'同一篇的另一段',sourceUrl:'https://example.com/article#two'},NOW);c=C.addEvidence(c,{observation:'另一个查询内容',sourceUrl:'https://example.com/article?id=2'},NOW);
 const s=C.summarizeCase(c);assert.deepEqual(s.duplicateSources,[{url:'https://example.com/article',evidenceIds:['E1','E2']}]);assert.ok(s.nextSteps.some(x=>x.code==='duplicate-source'&&x.message.includes('不同网址')));
});
test('next steps expose gaps, inference-only support and absence of counterevidence without verdicts',()=>{
 let c=one({kind:'inference',verification:'disputed'});c=C.addHypothesis(c,'猜测',NOW);c=C.linkEvidence(c,'H1','E1','supports',NOW);
 const s=C.summarizeCase(c),codes=s.nextSteps.map(x=>x.code);for(const code of ['missing-question','missing-source','missing-date','disputed','single-hypothesis','inference-only-support','no-counterevidence'])assert.ok(codes.includes(code),code);
 assert.equal(s.counts.inference,1);assert.equal(s.counts.disputed,1);assert.equal(s.hypotheses[0].supports[0].id,'E1');assert.equal(s.hypotheses[0].refutes.length,0);assert.match(s.disclaimer,/数量不代表可信概率/);
});
test('competing support and refutation are shown as unresolved, not voted into a conclusion',()=>{
 let c=one();c=C.addEvidence(c,{observation:'相反材料',kind:'statement'},NOW);c=C.addHypothesis(c,'待检验解释',NOW);c=C.linkEvidence(c,'H1','E1','supports',NOW);c=C.linkEvidence(c,'H1','E2','refutes',NOW);
 const h=C.summarizeCase(c).hypotheses[0];assert.deepEqual(h.supports.map(e=>e.id),['E1']);assert.deepEqual(h.refutes.map(e=>e.id),['E2']);assert.ok(h.gaps.some(x=>x.includes('不按票数')));assert.ok(!('verdict' in h));
});
test('markdown separates observations, hearsay, inference, interpretation and manual verification',()=>{
 let c=one({observation:'<img src=x onerror=alert(1)>\n# pretend-heading',interpretation:'[点我](javascript:alert(1))',verification:'corroborated'});const md=C.exportMarkdown(c);
 for(const label of ['直接观察（仍需核验）','个人解释（推测，不是事实）','用户标注','事件日期未知','下一步核验','不是网站认证'])assert.ok(md.includes(label),label);
 assert.ok(!md.includes('<img'));assert.ok(md.includes('&lt;img'));assert.ok(!md.includes('\n# pretend-heading'));assert.ok(!md.includes('[点我](javascript:'));
});
test('fictional demo has three typed records, two competing hypotheses and no real personal data or future-event assertions',()=>{
 const c=C.createDemoCase();assert.match(c.title,/虚构演示/);assert.equal(c.evidence.length,3);assert.equal(c.hypotheses.length,2);assert.deepEqual(c.evidence.map(e=>e.kind),['observation','statement','inference']);assert.ok(c.evidence.every(e=>!e.sourceUrl||new URL(e.sourceUrl).hostname==='example.com'));
 const summary=C.summarizeCase(c);
 assert.deepEqual(summary.timeline.map(e=>e.eventDate),['2026-01-09','2026-01-10']);assert.deepEqual(summary.timeline.map(e=>e.id),['E2','E1']);
 assert.match(c.evidence[0].observation,/当前仍计划 1 月 12 日恢复营业，未发布其他日期安排/);
 assert.match(c.hypotheses[0].statement,/截至 1 月 10 日.*已正式/);
 assert.deepEqual(c.hypotheses[0].links,[{evidenceId:'E2',relation:'supports'},{evidenceId:'E1',relation:'refutes'}]);
 assert.deepEqual(c.hypotheses[1].links,[{evidenceId:'E3',relation:'supports'}]);
 assert.match(c.evidence[2].observation,/旧稿或记错日期/);assert.match(c.evidence[2].interpretation,/相容不等于已证明/);
 for(const code of ['inference-only-support','no-counterevidence'])assert.ok(summary.nextSteps.some(step=>step.code===code&&step.hypothesisId==='H2'),code);
 assert.deepEqual(C.parseCase(C.exportCase(c)),c);
});
test('accepted cases remain exportable below the import byte limit even when HTML escaping expands content',()=>{
 let accepted=0,rejected=0;
 for(let n=64;n<=72;n++){
  const c=base();c.evidence=Array.from({length:n},(_,i)=>({...one({observation:'<'.repeat(1500),interpretation:'&'.repeat(1000)}).evidence[0],id:`E${i+1}`}));c.nextEvidenceNumber=n+1;
  let clean;try{clean=C.validateCase(c);}catch(error){assert.match(error.message,/1 MiB/);rejected++;continue;}
  const out=C.exportCase(clean);assert.ok(new TextEncoder().encode(out).length<=1048576);assert.deepEqual(C.parseCase(out),clean);accepted++;
 }
 assert.ok(accepted>0);assert.ok(rejected>0);
});
