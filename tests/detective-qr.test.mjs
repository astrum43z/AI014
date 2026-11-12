import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {qrRasterSize,decodeQrPixels} from '../public/detective/qr-core.js';
const context={module:{exports:{}},exports:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/detective/vendor/jsQR-1.4.0.js',import.meta.url),'utf8'),context);
const jsQR=context.module.exports;
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/detective-qr.json',import.meta.url),'utf8'));
function pixels({invert=false,rotate=false}={}){
 const margin=4,scale=6,width=(fixture.size+margin*2)*scale;
 const data=new Uint8ClampedArray(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const ox=rotate?y:x,oy=rotate?width-x-1:y;
  const mx=Math.floor(ox/scale)-margin,my=Math.floor(oy/scale)-margin;
  const dark=mx>=0&&my>=0&&mx<fixture.size&&my<fixture.size&&fixture.data[my*fixture.size+mx];
  const v=Boolean(dark)!==invert?0:255,offset=(y*width+x)*4;
  data[offset]=data[offset+1]=data[offset+2]=v;data[offset+3]=255;
 }
 return {data,width,height:width};
}
for(const [name,options] of [['normal',{}],['inverted',{invert:true}],['rotated',{rotate:true}]])test(`vendored jsQR decodes real ${name} generated QR pixels`,()=>{
 assert.equal(decodeQrPixels(pixels(options),jsQR),fixture.text);
});
test('real QR decoder does not read a blank image',()=>{
 const p=pixels();p.data.fill(255);assert.throws(()=>decodeQrPixels(p,jsQR),/没有识别/);
});
test('raster resizing bounds memory and preserves aspect ratio',()=>{
 assert.deepEqual(qrRasterSize(440,440),{width:440,height:440});assert.deepEqual(qrRasterSize(4000,3000),{width:1600,height:1200});assert.deepEqual(qrRasterSize(1,40000),{width:1,height:1600});
 for(const pair of [[0,1],[-1,2],[2.5,3],[Infinity,3],[10000,10000],[NaN,2]])assert.throws(()=>qrRasterSize(...pair));
});
test('pixel helper rejects malformed buffers, dimensions, missing decoder and oversized content',()=>{
 for(const p of [{data:[],width:1,height:1},{data:new Uint8ClampedArray(3),width:1,height:1},{data:new Uint8ClampedArray(4),width:1601,height:1},{data:new Uint8ClampedArray(0),width:0,height:0}])assert.throws(()=>decodeQrPixels(p,jsQR),/像素格式/);
 assert.throws(()=>decodeQrPixels(pixels(),null),/未能加载/);assert.throws(()=>decodeQrPixels(pixels(),()=>({data:'x'.repeat(12001)})),/过长/);
});
test('decoded script-like content remains text rather than a navigation instruction',()=>{
 assert.equal(decodeQrPixels(pixels(),()=>({data:'javascript:alert(1)'})),'javascript:alert(1)');
});
