import test from 'node:test';
import assert from 'node:assert/strict';

let instance = 0;
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
async function setup() {
  const elements = new Map();
  function node(id) {
    return { id, textContent:'', hidden:true, checked:false, value:'', files:[], children:[], handlers:{},
      classList:{toggle(){}}, addEventListener(type, callback){this.handlers[type]=callback;},
      append(...children){this.children.push(...children);}, replaceChildren(...children){this.children=children;},
      setAttribute(){}, focus(){} };
  }
  const el = id => { if(!elements.has(id)) elements.set(id,node(id)); return elements.get(id); };
  globalThis.document = {getElementById:el, querySelectorAll:()=>[], createElement:tag=>node(tag)};
  const pending = deferred(), started = deferred();
  globalThis.exifr = {parse(){started.resolve(); return pending.promise;}};
  await import(`../public/detective/app.js?file-regression=${instance++}`);
  const choose = (name, type) => {
    el('inspect-file').files = [{name,type,size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer}];
    return el('inspect-file').handlers.change();
  };
  const snapshot = () => JSON.stringify({
    status:el('file-status').textContent, hidden:el('file-output').hidden,
    facts:el('file-facts').children, metadata:el('metadata').children, gps:el('show-gps').checked,
  });
  return {el,pending,started,choose,snapshot};
}
for(const operation of ['new file','clear']) for(const outcome of ['resolve','reject']) {
  test(`late EXIF ${outcome} cannot override ${operation}`, async () => {
    const h = await setup();
    const older = h.choose('old.jpg','image/jpeg'); await h.started.promise;
    if(operation === 'new file') {
      await h.choose('new.bin','application/octet-stream');
      assert.equal(h.el('file-output').hidden,false);
      assert.equal(h.el('file-facts').children[0].children[1].textContent,'new.bin');
    } else {
      h.el('clear-file').handlers.click();
      assert.equal(h.el('file-output').hidden,true);
      assert.equal(h.el('file-facts').children.length,0);
    }
    const before = h.snapshot();
    outcome === 'resolve' ? h.pending.resolve({Make:'STALE',latitude:1,longitude:2}) : h.pending.reject(new Error('late corrupt photo'));
    await older;
    assert.equal(h.snapshot(),before);
  });
}
test('current EXIF failure preserves calculated SHA-256 and displays no location', async () => {
  const h = await setup(), current = h.choose('broken.jpg','image/jpeg'); await h.started.promise;
  h.pending.reject(new Error('corrupt')); await current;
  assert.equal(h.el('file-output').hidden,false);
  assert.match(h.el('file-status').textContent,/未能解析照片元数据/);
  assert.match(h.el('file-facts').children[2].children[1].textContent,/^[a-f0-9]{64}$/);
  assert.equal(h.el('show-gps').checked,false);
});
test('resolved EXIF errors warn while preserving readable fields and keeping GPS hidden', async () => {
  const h = await setup(), current = h.choose('partial.jpg','image/jpeg'); await h.started.promise;
  h.pending.resolve({Make:'Readable Camera',Model:'Partial Fixture',latitude:12.5,longitude:34.25,errors:[new Error('truncated field')]});
  await current;
  assert.equal(h.el('file-output').hidden,false);
  assert.match(h.el('file-status').textContent,/部分元数据解析失败/);
  assert.match(h.el('file-status').textContent,/字段可能不完整/);
  assert.match(h.el('file-facts').children[2].children[1].textContent,/^[a-f0-9]{64}$/);
  const displayed = () => h.el('metadata').children.map(row => row.children.map(cell => cell.textContent));
  assert.ok(displayed().some(([label,value]) => label === '相机厂商' && value === 'Readable Camera'));
  assert.ok(displayed().some(([label,value]) => label === '相机型号' && value === 'Partial Fixture'));
  assert.equal(h.el('show-gps').checked,false);
  assert.ok(!displayed().some(([label]) => label.includes('纬度') || label.includes('经度')));
  h.el('show-gps').checked = true;
  h.el('show-gps').handlers.change();
  assert.ok(displayed().some(([label,value]) => label === '纬度 / 经度' && value === '12.500000 / 34.250000'));
});
