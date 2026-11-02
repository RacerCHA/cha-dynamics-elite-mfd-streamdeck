'use strict';
const assert=require('node:assert/strict');
const {render,command}=require('../local.elite.mfd.sdPlugin/cockpit');
const {Deck}=require('../local.elite.mfd.sdPlugin/panel');
const s={online:true,statusValid:true,hud:'fight',flags:1<<24,capacity:16,heat:'normal',context:'home'};
function frame(ctx,i,t=0){return Buffer.from(render({...s,context:ctx},null,i,t).split(',')[1],'base64').toString();}
for(const [n,level] of [[8,'normal'],[7.9,'low'],[2.4,'low'],[2.3,'critical'],[0,'critical'],[2.4,'low'],[8,'normal'],[16,'normal']]){
 s.fuel=n;
 for(const [ctx,i] of [['home',8],['fuel',0],['fuel',4]]){
  const f=frame(ctx,i);assert.equal(f.includes('#886900'),level==='low');assert.equal(f.includes('#d02b3e'),level==='critical');
  assert.equal(f!==frame(ctx,i,550),level==='critical');
 }
 assert.equal(frame('fuel',6),frame('fuel',6,550));
}
for(const [fuel,capacity,online,statusValid] of [[null,16,true,true],[0,0,true,true],[0,16,false,false],[0,16,true,false]]){
 Object.assign(s,{fuel,capacity,online,statusValid});assert.doesNotMatch(frame('home',8),/#d02b3e|#886900/);
}
Object.assign(s,{online:true,statusValid:true,capacity:40,fuel:6});assert.match(frame('home',8),/#886900/);
const actions=[];const deck=new Deck({telemetry:{snapshot:()=>s},clock:()=>1000,render,command,uuid:'test',send:()=>{},runCommand:n=>actions.push(n)});
function msg(i,event){deck.message({action:'local.elite.mfd.cell',context:'k'+i,device:'mk1',event,payload:{coordinates:{row:Math.floor(i/5),column:i%5}}});}
for(const i of [4,10])msg(i,'willAppear');msg(10,'keyDown');msg(4,'keyDown');msg(4,'keyDown');assert.deepEqual(actions,['PhotoCameraToggle','PhotoCameraToggle']);
s.flags=1<<26;s.hud=null;msg(4,'keyDown');assert.equal(actions.length,2);
console.log('Camera key and fuel threshold tests passed.');
