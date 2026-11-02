'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Telemetry}=require('../local.elite.mfd.sdPlugin/telemetry');
const {render,command}=require('../local.elite.mfd.sdPlugin/cockpit');
const {Deck}=require('../local.elite.mfd.sdPlugin/panel');
const t=new Telemetry(),now=1700000000000, shots=[], pressed=[];
t.setSession(now-10000);
const evt=(event,fields={})=>t.event({timestamp:new Date(now).toISOString(),event,...fields},now);
const flags=(v)=>t.status({timestamp:new Date(now).toISOString(),Flags:(1<<24)|v},now);
const lock=(health,other={})=>evt('ShipTargeted',{TargetLocked:true,ScanStage:3,Ship:'Viper',PilotName_Localised:'Пилот',ShieldHealth:health,HullHealth:67,LegalStatus:'Wanted',...other});
const state=()=>t.snapshot(now);
const frame=(i,time=now)=>Buffer.from(render(t.snapshot(time < now ? now : time),null,i,time).split(',')[1],'base64').toString();
const snap=(title,time=now)=>shots.push([title,Array.from({length:15},(_,i)=>render(t.snapshot(time < now ? now : time),null,i,time))]);
flags(64|8);evt('Loadout',{ShipID:17,HullHealth:.92});evt('FSDTarget',{Name:'Sol'});const deck=new Deck({telemetry:t,render,command,clock:()=>now,runCommand:n=>pressed.push(n),send:()=>{},uuid:'test'});
const key=event=>deck.message({action:'local.elite.mfd.cell',context:'target',device:'MK1',event,payload:{coordinates:{row:0,column:0}}});
key('willAppear');key('keyDown');key('keyDown');assert.deepEqual(pressed,['CycleNextTarget','CycleNextTarget']);assert.equal(state().target,null);assert.equal(state().next,'Sol');
for(const [pct,color] of [[100,'#137442'],[75,'#137442'],[74,'#886900'],[50,'#886900'],[49,'#ac4d0b'],[25,'#ac4d0b'],[24,'#af2839'],[0.4,'#af2839']]){lock(pct);assert.ok(frame(1).includes(color));assert.equal(state().targetRelation,null);}
assert.ok(frame(6).includes('В СЕТИ'));assert.ok(frame(13).includes('#137442'));lock(86);snap('Щит цели · 86%');lock(53);snap('Щит цели · 53%');
flags(64);evt('UnderAttack',{Target:'You'});lock(33);flags(64|(1<<20));snap('Сбит щит · перегрев · теплоотвод');lock(12);snap('Под атакой · цель 12%');
lock(0);flags(0);assert.equal(state().context,'fight');assert.ok(frame(13).includes('#732636'));for(const i of [6,1,9]){assert.match(frame(i,0),/#d02b3e/);assert.match(frame(i,550),/#691729/);}
snap('Тревога · светлый кадр',0);snap('Тревога · тёмный кадр',550);
assert.equal(state().targetRelation,null);assert.equal(t.snapshot(now+30001).targetShield,null);
lock(undefined,{LegalStatus:'Clean'});assert.equal(state().targetShield,null);assert.equal(state().targetRelation,null);
evt('WingJoin',{Others:['Delta']});flags(64|8|128);lock(82,{PilotName:'$cmdr_decorate:#name=Delta;'});assert.equal(state().targetRelation,'wing');evt('WingLeave');assert.equal(state().targetRelation,null);assert.equal(state().targetHull,67);
evt('Interdicted',{IsPlayer:true,Interdictor:'Delta'});assert.equal(state().targetRelation,'interdictor');lock(70,{PilotName:'$cmdr_decorate:#name=Gamma;'});assert.equal(state().targetRelation,null);
evt('ShipTargeted',{TargetLocked:false});assert.equal(state().targetHull,null);assert.equal(state().context,'fight');snap('Самооборона · под огнём',0);assert.match(frame(2),/ОГНЁМ/);assert.equal(state().targetShield,null);assert.equal(state().target,null);evt('NavRouteClear');assert.equal(state().next,null);flags((1<<27)|64);assert.ok(!frame(13).includes('#137442'));
evt('Location',{StarSystem:'Col 285 Sector AB-C d12-145',StationName:'Jameson Memorial',Docked:true});flags(1|8);
const later=now+70000;
snap('Обзор · отдельные контуры системы и станции',later);
const src=(i)=>frame(i,later);
assert.match(src(0),/M8 2H72/);assert.match(src(1),/M0 2H72M72 70H0/);assert.match(src(2),/M0 2H64Q70/);
assert.match(src(5),/M8 2H72/);assert.match(src(7),/M0 2H64Q70/);
assert.match(src(2),/Sector|d12|AB-C/);
fs.writeFileSync('Combat 2.3.html','<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box}body{margin:0;background:#071422;color:#DBE5F1;font:15px Segoe UI;padding:10px;display:grid;grid-template-columns:repeat(2,368px);gap:10px}h3{margin:0 0 4px;font-size:15px}section div{display:grid;grid-template-columns:repeat(5,72px);gap:2px}img{width:72px;height:72px}</style>'+shots.map(([title,f])=>'<section><h3>'+title+'</h3><div>'+f.map(u=>'<img src="'+u+'">').join('')+'</div></section>').join(''));
const hp=(event)=>deck.message({event,action:'local.elite.mfd.cell',context:'hp',device:'MK1',payload:{coordinates:{row:2,column:3}}});
hp('willAppear');
for (const initial of [0,64]){
 flags(initial);const pre=state().hardpoints, start=pressed.length;
 hp('keyDown');assert.deepEqual(pressed.slice(start),['DeployHardpointToggle']);assert.equal(state().hardpoints,pre);
}
for (const mask of [1,2,16]){flags(mask);const start=pressed.length;hp('keyDown');assert.equal(pressed.length,start);}
t.status({timestamp:new Date(now).toISOString(),Flags:0,Flags2:1},now);const startGuard=pressed.length;hp('keyDown');t.status(null,now);hp('keyDown');t.setSession(Infinity);hp('keyDown');assert.equal(pressed.length,startGuard);
t.setSession(now-10000);flags(64|(1<<20));const heat=(event)=>deck.message({event,action:'local.elite.mfd.cell',context:'heat',device:'MK1',payload:{coordinates:{row:1,column:3}}});
heat('willAppear');const base=pressed.length;
for(let n=0;n<10;n++)deck.draw();assert.equal(pressed.length,base);
heat('keyDown');heat('keyDown');deck.draw();assert.deepEqual(pressed.slice(base),['DeployHeatSink']);heat('keyUp');heat('keyDown');heat('keyUp');assert.equal(pressed.length,base+2);
assert.match(frame(8,0),/Теплоотвод/);assert.match(frame(8,550),/#691729/);
for(const [view,pos] of [['home',9],['fight',8],['fuel',5]]){
 assert.equal(command(null,pos,view,state()),'DeployHeatSink');assert.notEqual(command('nav',pos,view,state()),'DeployHeatSink');
 for(const temp of ['normal','warning',null])assert.notEqual(command(null,pos,view,{...state(),heat:temp}),'DeployHeatSink');
}
flags(64);heat('keyDown');assert.equal(pressed.length,base+2);console.log('Combat 2.3 checks passed');
