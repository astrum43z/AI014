import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const layout=fs.readFileSync('src/layouts/Layout.astro','utf8');
const source=layout.match(/<script>([\s\S]*?)<\/script>/)[1];
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(clipboard){
 const status={textContent:''},contact={},events={},calls=[];
 const button={addEventListener:(name,handler)=>events[name]=handler};
 const range={selectNodeContents:element=>calls.push(['select',element])};
 const selection={removeAllRanges:()=>calls.push(['clear']),addRange:r=>calls.push(['range',r])};
 const context={navigator:clipboard?{clipboard}:{},document:{querySelector:selector=>({'#copy-wechat':button,'#copy-wechat-status':status,'#wechat-contact':contact}[selector]||null),addEventListener:()=>{},createRange:()=>range},window:{matchMedia:()=>({matches:true}),getSelection:()=>selection}};
 vm.runInNewContext(compiled,context);
 return {status,contact,events,calls,range};
}
test('shared WeChat button copies the requested value on repeated clicks',async()=>{
 const written=[],view=fixture({writeText:async value=>written.push(value)});
 await view.events.click();await view.events.click();
 assert.deepEqual(written,['goodmorning2you','goodmorning2you']);
 assert.equal(view.status.textContent,'已复制微信号');
 assert.deepEqual(view.calls,[]);
});
test('clipboard failure or missing API selects the visible WeChat and gives a manual fallback',async()=>{
 for(const clipboard of [undefined,{writeText:async()=>{throw Error('unavailable');}}]){
  const view=fixture(clipboard);await view.events.click();
  assert.match(view.status.textContent,/Ctrl\/Cmd\+C/);
  assert.deepEqual(view.calls,[['select',view.contact],['clear'],['range',view.range]]);
 }
});
