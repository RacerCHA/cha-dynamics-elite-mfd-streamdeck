'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createTelemetry}=require('../local.elite.mfd.sdPlugin/telemetry');
const {render}=require('../local.elite.mfd.sdPlugin/cockpit');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mfd-capacity-')), journal=path.join(dir,'Journal.test.log'),statusFile=path.join(dir,'Status.json');
let now=Math.floor(Date.now()/1000)*1000;const t=createTelemetry(dir);t.setSession(now-2000);
const iso=n=>new Date(n).toISOString();
function event(event,data){fs.appendFileSync(journal,JSON.stringify({timestamp:iso(now),event,...data})+'\n');}
function status(fuel,when=now){fs.writeFileSync(statusFile,JSON.stringify({timestamp:iso(when),event:'Status',Flags:1<<24,Fuel:{FuelMain:fuel,FuelReservoir:.9}}));}
function load(id,main){event('Loadout',{ShipID:id,FuelCapacity:{Main:main,Reserve:.9}});}
function check(amount,capacity,level){
 t.poll(now);const s=t.snapshot(now);assert.equal(s.fuel,amount);assert.equal(s.capacity,capacity);
 const svg=(context,i,ms)=>Buffer.from(render({...s,context},null,i,ms).split(',')[1],'base64').toString();
 for(const [context,i] of [['home',8],['fuel',1]]){
  const a=svg(context,i,0);assert.equal(a.includes('#886900'),level==='low');assert.equal(a.includes('#d02b3e'),level==='critical');assert.equal(a!==svg(context,i,550),level==='critical');
  if(amount!==null)assert.ok(a.includes('>'+amount+' т<'));
 }
 if(capacity){assert.ok(svg('home',8,0).includes('из '+capacity+' т'));assert.ok(svg('fuel',3,0).includes('>'+capacity+' т<'));}
}
try{
 event('LoadGame',{ShipID:1});load(1,8);status(6);check(6,8,'normal');
 now+=1000;load(1,16);check(null,16,'unknown');now+=1000;status(6);check(6,16,'low');
 now+=1000;status(0);event('ShipyardSwap',{ShipID:2});check(null,null,'unknown');load(2,64);check(null,64,'unknown');now+=1000;status(6);check(6,64,'critical');
 now+=1000;event('ShipyardSwap',{ShipID:1});check(null,null,'unknown');now+=1000;status(6);check(null,null,'unknown');now+=1000;load(1,8);check(6,8,'normal');
 now+=1000;load(9,16);status(0);check(null,16,'unknown');now+=1000;status(6);check(6,16,'low');
 console.log('PASS: file reader -> Loadout/Status -> both display modes, same-ship refit and ship swaps in both arrival orders.');
}finally{fs.unlinkSync(statusFile);fs.unlinkSync(journal);fs.rmdirSync(dir);}
