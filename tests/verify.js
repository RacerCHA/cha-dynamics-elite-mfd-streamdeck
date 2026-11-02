'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTelemetry } = require('../local.elite.mfd.sdPlugin/telemetry');
const { render, command, credits } = require('../local.elite.mfd.sdPlugin/cockpit');
const { Deck } = require('../local.elite.mfd.sdPlugin/panel');

for (const [amount,formatted] of [[null,'—'],[0,'0'],[999,'999'],[1000,'1 к'],[850000,'850 к'],[999949,'999,9 к'],[999950,'1 кк'],[23400000,'23,4 кк'],[999950000,'1 ккк'],[1200000000,'1,2 ккк']]) assert.equal(credits(amount),formatted);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-fixture-'));
const journal = path.join(fixture, 'Journal.2099-01-12T030101.01.log');
const statusFile = path.join(fixture, 'Status.json');
const start = Math.floor(Date.now() / 1000) * 1000;
let now = start;

function entry(event, data = {}) {
  const row = { timestamp: new Date(now).toISOString(), event, ...data };
  fs.appendFileSync(journal, JSON.stringify(row) + '\n', 'utf8');
}

const main = 2 ** 24;
const analysis = 2 ** 27;
const hardpoints = 2 ** 6;
const charge = 2 ** 17;
const scoop = 2 ** 11;
const cruise = 2 ** 4;
const shields = 2 ** 3;
function status(flags, fuel = 9.6) {
  fs.writeFileSync(statusFile, JSON.stringify({
    timestamp: new Date(now).toISOString(), event: 'Status', Flags: flags, Flags2: 0,
    Fuel: { FuelMain: fuel, FuelReservoir: 0.31 }, Balance: 123456789, GuiFocus: 0,
  }));
}

const samples = [];
function writePreview() {
  const panels = samples.map(({ title, images }) =>
    '<section><h2>' + title + '</h2><div>' +
    images.map(url => '<img width="72" height="72" src="' + url + '">').join('') +
    '</div></section>').join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Elite MFD · MK.1</title><style>
    *{box-sizing:border-box}body{margin:0;padding:14px;background:#081322;color:#DBE5F1;font:16px "Segoe UI",sans-serif}
    header{font-size:18px;font-weight:600;margin-bottom:11px}main{display:grid;grid-template-columns:repeat(3,376px);gap:12px}
    h2{font-weight:600;font-size:16px;line-height:20px;margin:0 0 4px}section div{display:grid;grid-template-columns:repeat(5,72px);gap:4px}
    img{display:block;width:72px;height:72px}
    </style><header>Elite MFD 2.4 · Stream Deck MK.1 · 72 × 72 пикселя на клавишу</header><main>${panels}</main>`;
  fs.writeFileSync(path.join(__dirname, 'preview.html'), html, 'utf8');
}

function integration() {
  entry('Fileheader', { gameversion: '4.2.0.0', part: 1 });
  entry('LoadGame', { Ship: 'CobraMkIII', ShipID: 31, Credits: 120000000 });
  entry('Location', { Docked: true, StarSystem: 'Shinrarta Dezhra', StationName: 'Jameson Memorial' });
  entry('Loadout', { Ship: 'CobraMkIII', ShipID: 31, HullHealth: 0.814, FuelCapacity: { Main: 16, Reserve: 0.36 }, Modules: [] });
  entry('UnderAttack', { Target: 'You' }); // Existing line at startup must not trigger the alarm.
  status(main | shields | 1);
  const telemetry = createTelemetry(fixture);
  telemetry.setSession(start - 10000);
  const images = new Map(), sent = [], keys = [];
  const deck = new Deck({
    telemetry, render, command, uuid: 'test-mfd', clock: () => now,
    runCommand: (name) => { keys.push(name); return Promise.resolve(true); },
    send: (m) => {
      sent.push(m);
      if (m.event === 'setImage') images.set(Number(m.context.slice(1)), m.payload.image);
    },
  });
  function tick(delta = 50) {
    now += delta;
    telemetry.poll(now);
    deck.draw();
    return telemetry.snapshot(now);
  }
  function message(event, index, type = 'cell') {
    deck.message({ event, action: 'local.elite.mfd.' + type, context: 'k' + index, device: 'mk1-test',
      payload: { coordinates: { row: Math.floor(index / 5), column: index % 5 } } });
  }
  function snapshot(title) {
    assert.equal(images.size, 15, 'SDK should receive all 15 keys');
    samples.push({ title, images: Array.from({ length: 15 }, (_, i) => images.get(i)) });
  }
  function displayed(menu) {
    const s = telemetry.snapshot(now);
    for (let i = 0; i < 15; i++) {
      assert.equal(images.get(i), render(s, menu, i, now), 'Wrong layer for key ' + i);
    }
  }
  function menuKey(menu, id) {
    const index = Array.from({ length: 15 }, (_, i) => i).find(i => command(menu, i) === id);
    assert.notEqual(index, undefined, 'Missing ' + id);
    return index;
  }
  function switches() { return sent.filter(x => x.event === 'switchToProfile').map(x => x.payload.profile); }
  assert.equal(tick().context, 'home');
  message('keyDown', 0, 'open');
  assert.deepEqual(switches(), ['Elite MFD']);
  for (let i = 0; i < 15; i++) message('willAppear', i);
  tick();
  displayed(null);
  snapshot('Стоянка · система, станция и баланс');
  let s = telemetry.snapshot(now);
  assert.equal(s.station, 'Jameson Memorial');
  assert.equal(s.system, 'Shinrarta Dezhra');
  assert.equal(s.credits, 123456789);
  entry('Undocked', { StationName: 'Jameson Memorial' });
  for (const [flags, hud, position, context] of [
    [0, 'fight', 'in', 'home'], [hardpoints, 'fight', 'out', 'fight'],
    [analysis, 'analysis', 'in', 'home'], [analysis | hardpoints, 'analysis', 'out', 'home'],
  ]) {
    status(main | shields | flags);
    s = tick();
    assert.equal(s.hud, hud); assert.equal(s.hardpoints, position); assert.equal(s.context, context);
  }
  // Every primary information tile is passive on all automatic pages.
  for (let i = 0; i < 10; i++) {
    assert.ok(!command(null, i), 'Information tile dispatched a command');
    message('keyDown', i);
  }
  assert.deepEqual(keys, []);
  message('keyDown', menuKey(null, '@nav')); tick();
  displayed('nav'); snapshot('Навигация · меню команд');
  const expectedNav = ['GalaxyMapOpen', 'SystemMapOpen', 'OrbitLinesToggle', 'TargetNextRouteSystem'];
  expectedNav.forEach(id => menuKey('nav', id));
  message('keyDown', menuKey('nav', expectedNav[0])); tick(6000);
  message('keyDown', menuKey('nav', expectedNav[1]));
  assert.deepEqual(keys, expectedNav.slice(0, 2));
  status(main | hardpoints | shields);
  entry('UnderAttack', { Target: 'You' });
  entry('ShipTargeted', { TargetLocked: true, ScanStage: 3, Ship: 'vulture', PilotName_Localised: 'Test Pilot', LegalStatus: 'Wanted', ShieldHealth: 0.05, HullHealth: 0.15 });
  entry('HullDamage', { PlayerPilot: true, Fighter: false, Health: 0.735 });
  s = tick(7999);
  assert.equal(s.context, 'fight');
  assert.equal(s.shields, true);
  assert.ok(s.hull >= 73 && s.hull <= 74, 'Own hull must not use target HP');
  displayed('nav');
  tick(2); displayed(null); snapshot('Бой · атака на свой корабль');
  function animationDuring(title) {
    const frames = new Set();
    for (let step = 0; step < 12; step++) {
      tick(175);
      frames.add(Array.from({ length: 10 }, (_, i) => images.get(i)).join(''));
    }
    assert.ok(frames.size > 1, title + ' produced just one setImage frame');
  }
  animationDuring('Attack');entry('ShipTargeted',{TargetLocked:false});tick();snapshot('Самооборона · цель потеряна');
  message('keyDown', menuKey(null, '@systems')); tick();
  const imageText=i=>Buffer.from(images.get(i).split(',')[1],'base64').toString();
  const keyCount=keys.length;
  for(const [mask,light,cargo,hudName] of [[0,'ВЫКЛ','ЗАКРЫТ','БОЙ'],[256,'ВКЛ','ЗАКРЫТ','БОЙ'],[256+512,'ВКЛ','ОТКРЫТ','БОЙ'],[256+512+analysis,'ВКЛ','ОТКРЫТ','АНАЛИЗ'],[512+analysis,'ВЫКЛ','ОТКРЫТ','АНАЛИЗ'],[0,'ВЫКЛ','ЗАКРЫТ','БОЙ']]){
    status(main | hardpoints | shields | mask); tick(120);displayed('systems');
    assert.ok(imageText(0).includes('>'+light+'<'));assert.ok(imageText(1).includes('>'+cargo+'<'));assert.ok(imageText(2).includes('>'+hudName+'<'));assert.ok(imageText(12).includes('>'+hudName+'<'));
    if(mask===256+512+analysis)snapshot('Системы · фары вкл, ковш открыт');
  }
  snapshot('Системы · фары выкл, ковш закрыт');
  assert.equal(keys.length,keyCount);
  const offline=render({...s,online:false,lights:null,scoopOpen:null,hud:null,fss:null},'systems',0,now);
  assert.ok(Buffer.from(offline.split(',')[1],'base64').toString().includes('ОФЛАЙН'));
  for (const id of ['ShipSpotLightToggle', 'ToggleCargoScoop']) {
    message('keyDown', menuKey('systems', id)); tick();
  }
  assert.deepEqual(keys.slice(-2), ['ShipSpotLightToggle', 'ToggleCargoScoop']);
  message('keyDown', menuKey('systems', '@back')); tick(); displayed(null);
  status(main | shields);
  tick(70000);
  entry('StartJump', { JumpType: 'Supercruise' }); tick();
  status(main | shields | cruise); tick();
  entry('SupercruiseEntry', { StarSystem: 'Shinrarta Dezhra' }); s = tick(); assert.notEqual(s.context, 'nav');
  entry('FSDTarget', { Name: 'Col 285 Sector AB-C d12-145', RemainingJumpsInRoute: 3 });
  status(main | shields | charge);
  s = tick(); assert.equal(s.context, 'nav'); assert.equal(s.phase, 'charging');
  snapshot('FSD · зарядка и цель маршрута'); animationDuring('Charging');
  entry('StartJump', { JumpType: 'Hyperspace', StarSystem: 'Col 285 Sector AB-C d12-145' });
  s = tick(); assert.equal(s.phase, 'jumping'); assert.equal(s.context, 'nav'); snapshot('FSD · переход');
  entry('FSDJump', { StarSystem: 'Col 285 Sector AB-C d12-145', JumpDist: 28.7, FuelLevel: 9.6 });
  status(main | shields | cruise); s = tick(); assert.equal(s.phase, 'arrived');snapshot('FSD · прибытие');
  tick(6000);
  status(main | cruise | scoop | shields);
  entry('FuelScoop', { Total: 9.6, Scooped: 0.1 });
  s = tick(); assert.equal(s.context, 'fuel'); assert.equal(s.fuel, 9.6); assert.equal(s.capacity, 16);
  assert.equal(s.heat, 'normal'); snapshot('Заправка · бак 60%, нагрев в норме');

  // Now fill 2.5 of five keys: a partially filled middle square verifies continuity.
  status(main | cruise | scoop | shields, 8);
  entry('FuelScoop', { Total: 8, Scooped: 0.1 });
  tick();
  for (let col = 0; col < 5; col++) {
    const svg = Buffer.from(images.get(col).split(',')[1], 'base64').toString();
    const bars = [...svg.matchAll(/<rect[^>]*>/g)].map(m => m[0]);
    const rect = bars.find(r => r.includes('y="32"') && r.includes('fill="#34CBFD"'));
    const width = rect ? Number(rect.match(/width="([.0-9]+)"/)[1]) : 0;
    assert.equal(width, [72,72,36,0,0][col]);
  }
  entry('HeatWarning'); s = tick(); assert.equal(s.heat, 'warning');
  const warningFrames = Array.from({ length:5 }, (_, i) => images.get(i + 5));
  status(main | cruise | scoop | shields | (2 ** 20)); s = tick(); assert.equal(s.heat, 'overheat');
  snapshot('Заправка · подтверждённый перегрев');
  assert.ok(warningFrames.some((u,i) => u !== images.get(i+5)));
  entry('HeatDamage'); s = tick(); assert.equal(s.heat, 'damage');
  entry('Shutdown'); telemetry.setSession(Infinity);
  s = tick(); assert.equal(s.online, false); assert.equal(s.heat, null);
  snapshot('Офлайн · телеметрия недоступна');
  message('keyDown', menuKey(null, '@exit'));
  for (let i = 0; i < 15; i++) message('willDisappear', i);
  const count = sent.length; entry('UnderAttack', { Target: 'You' }); tick();
  assert.equal(sent.length, count);
  assert.deepEqual(switches(), ['Elite MFD', '']);
  writePreview();
}

try {
  integration();
  console.log('PASS · actual SDK dispatcher and renderer, isolated journal and Status, auto pages, 8-second idle timeout, two menu commands, all 4 HUD combinations, animations, safe exit, 72px preview.');
} finally {
  // Only the two files created by this run are removed.
  for (const filename of [journal, statusFile]) if (fs.existsSync(filename)) fs.unlinkSync(filename);
  fs.rmdirSync(fixture);
}
