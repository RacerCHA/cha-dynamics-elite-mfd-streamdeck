'use strict';

const fs = require('node:fs');
const path = require('node:path');

const number = value => Number.isFinite(value) ? value : null;
const bit = (flags, index) => Boolean(flags & (1 << index));
const timestamp = record => Date.parse(record.timestamp);
const realName = value => typeof value === 'string' && value && !value.startsWith('$') ? value : null;

function emptyFlight() {
  return {
    from: 0, ended: false, status: null, system: null, station: null, credits: null, creditsAt: 0,
    shipId: null, capacity: null, hull: null, hullAt: 0, fuel: null, fuelAt: 0, journalFuelAt: 0, fuelBoundary: 0,
    target: null, targetLegal: null, targetShield: null, targetHull: null, scanAt: 0, targetCommander: null, wing: new Set(), interdictor: null, interdictedUntil: 0, next: null, remaining: null,
    jumpTo: null, jumpUntil: 0, jumpType: null, arrivedUntil: 0, arrivalDistance: null,
    attackUntil: 0, scoopUntil: 0, warningUntil: 0, damageUntil: 0,
    shields: null, shieldsAt: 0
  };
}

class Telemetry {
  constructor() {
    this.start = Infinity;
    this.flight = emptyFlight();
  }

  setSession(start) {
    const time = Number.isFinite(start) ? start : Infinity;
    if (time === this.start) return;
    this.start = time;
    this.flight = emptyFlight();
    // Journal timestamps have whole-second precision.
    this.flight.from = Math.floor(time / 1000) * 1000;
  }

  event(e, now, historical = false) {
    const at = timestamp(e);
    if (!Number.isFinite(at) || at < this.flight.from || at > now + 2000) return;
    if (e.event === 'LoadGame') {
      this.flight = emptyFlight();
      this.flight.from = at;
    }
    const f = this.flight;
    if (f.ended) return;
    const recent = !historical && at >= now - 10000;
    const shipFlags = f.status?.Flags || 0;
    switch (e.event) {
      case 'Shutdown':
        f.ended = true;
        return;
      case 'Music':
        if (e.MusicTrack === 'MainMenu') f.ended = true;
        return;
      case 'LoadGame':
        f.credits = number(e.Credits);
        f.creditsAt = at;
        f.shipId = e.ShipID ?? null;
        break;
      case 'Loadout': {
        const capacity = number(e.FuelCapacity?.Main);
        const changedShip = f.shipId !== null && f.shipId !== e.ShipID;
        const changedTank = f.shipId === e.ShipID && f.capacity !== null && f.capacity !== capacity;
        if (changedShip || changedTank) this.resetTank(at);
        f.shipId = e.ShipID ?? null;
        f.capacity = capacity;
        this.updateHull(e.HullHealth, at);
        break;
      }
      case 'HullDamage':
        if (e.PlayerPilot === true && e.Fighter === false) this.updateHull(e.Health, at);
        break;
      case 'RepairAll':
        if (f.shipId !== null) this.updateHull(1, at);
        break;
      case 'Repair':
        if ([e.Item, ...(Array.isArray(e.Items) ? e.Items : [])].some(item => /^hull$/i.test(item))) {
          this.updateHull(1, at);
        }
        break;
      case 'ShipyardSwap':
      case 'ShipyardNew':
      case 'Died':
        f.shipId = f.hull = f.capacity = f.fuel = f.target = f.targetLegal = null;
        this.resetTank(at);
        f.attackUntil = f.jumpUntil = f.scoopUntil = 0;
        break;
      case 'Location':
      case 'CarrierJump':
        f.system = realName(e.StarSystem);
        f.station = e.Docked ? realName(e.StationName_Localised) || realName(e.StationName) : null;
        break;
      case 'Docked':
        f.interdictor = null;
        f.system = realName(e.StarSystem) || f.system;
        f.station = realName(e.StationName_Localised) || realName(e.StationName);
        f.attackUntil = f.jumpUntil = f.scoopUntil = 0;
        f.target = f.targetLegal = null;
        break;
      case 'Undocked':
        f.station = null;
        break;
      case 'WingJoin':
        f.wing = new Set((e.Others || []).filter(n => typeof n === 'string').map(n => n.toLowerCase()));
        break;
      case 'WingAdd':
        if(typeof e.Name === 'string') f.wing.add(e.Name.toLowerCase());
        break;
      case 'WingLeave':
        f.wing.clear();
        break;
      case 'ShipTargeted':
        f.scanAt = at;
        f.targetHull = e.TargetLocked && e.ScanStage >= 2 && Number.isFinite(e.HullHealth) &&
          e.HullHealth >= 0 && e.HullHealth <= 100 ? e.HullHealth : null;
        f.targetCommander = typeof e.PilotName === 'string' ? /^\$cmdr_decorate:#name=([^;]+);$/i.exec(e.PilotName)?.[1].toLowerCase() : null;
        f.targetShield = e.TargetLocked && e.ScanStage >= 2 && Number.isFinite(e.ShieldHealth) &&
          e.ShieldHealth >= 0 && e.ShieldHealth <= 100 ? e.ShieldHealth : null;
        f.target = e.TargetLocked ? realName(e.PilotName_Localised) || realName(e.PilotName)
          || realName(e.Ship_Localised) || realName(e.Ship) || 'Корабль' : null;
        f.targetLegal = e.TargetLocked ? realName(e.LegalStatus) : null;
        break;
      case 'Interdicted':
        if(recent && e.IsPlayer === true && typeof e.Interdictor === 'string'){
          f.interdictor = e.Interdictor.replace(/^CMDR /i,'').toLowerCase();
          f.interdictedUntil = at + 60000;
        }
        break;
      case 'UnderAttack':
        if (recent && (e.Target === 'You' || (e.Target === 'Mothership' && bit(shipFlags,24))
          || (e.Target === 'Fighter' && bit(shipFlags,25)))) f.attackUntil = at + 20000;
        break;
      case 'ShieldState':
        if (typeof e.ShieldsUp === 'boolean') {
          f.shields = e.ShieldsUp;
          f.shieldsAt = at;
        }
        break;
      case 'FSDTarget':
        f.next = realName(e.Name);
        f.remaining = number(e.RemainingJumpsInRoute);
        break;
      case 'NavRouteClear':
        f.next = f.remaining = null;
        break;
      case 'StartJump':
        f.interdictor = null;
        f.target = f.targetLegal = null;
        if (recent) {
          f.jumpType = e.JumpType;
          f.jumpTo = realName(e.StarSystem);
          f.jumpUntil = at + 90000;
          f.arrivedUntil = 0;
        }
        break;
      case 'FSDJump':
        f.system = realName(e.StarSystem);
        f.station = f.target = f.targetLegal = null;
        f.attackUntil = f.jumpUntil = f.scoopUntil = 0;
        f.jumpType = f.jumpTo = null;
        f.arrivedUntil = recent ? at + 4000 : 0;
        f.arrivalDistance = number(e.JumpDist);
        // FSDTarget for the FOLLOWING system can already be received in transit.
        if (f.next === f.system) f.next = f.remaining = null;
        this.updateFuel(e.FuelLevel, at);
        break;
      case 'SupercruiseEntry':
      case 'SupercruiseExit':
        f.system = realName(e.StarSystem) || f.system;
        f.station = f.target = f.targetLegal = null;
        f.attackUntil = f.jumpUntil = f.arrivedUntil = 0;
        f.jumpType = f.jumpTo = null;
        break;
      case 'FuelScoop':
        this.updateFuel(e.Total, at);
        if (recent) f.scoopUntil = at + 3500;
        break;
      case 'HeatWarning':
        if (recent) f.warningUntil = at + 10000;
        break;
      case 'HeatDamage':
        if (recent) f.damageUntil = at + 12000;
        break;
    }
  }

  updateHull(fraction, at) {
    this.flight.hull = number(fraction) !== null && fraction >= 0 && fraction <= 1 ? fraction * 100 : null;
    this.flight.hullAt = at;
  }

  resetTank(at) {
    const f = this.flight;
    f.fuelBoundary = at;
    if (f.fuelAt <= at) {
      f.fuel = null;
      f.fuelAt = at;
      f.journalFuelAt = 0;
    }
  }

  updateFuel(value, at, fromStatus = false) {
    // Status timestamps have second precision and do not identify the ship.
    if (fromStatus && at <= this.flight.fuelBoundary) return;
    if (number(value) !== null && value >= 0 && at >= this.flight.fuelAt) {
      this.flight.fuel = value;
      this.flight.fuelAt = at;
      if (!fromStatus) this.flight.journalFuelAt = at;
    }
  }

  status(record, now) {
    const at = record ? timestamp(record) : NaN;
    const valid = !this.flight.ended && Number.isFinite(this.start) && Number.isInteger(record?.Flags)
      && at >= this.flight.from && at <= now + 2000;
    this.flight.status = valid ? record : null;
    if (valid && number(record.Balance) !== null && at >= this.flight.creditsAt) {
      this.flight.credits = record.Balance;
      this.flight.creditsAt = at;
    }
    if (valid && bit(record.Flags,24) && !(record.Flags2 & 7)) {
      // At equal whole-second timestamps keep a journal FuelScoop.Total that
      // just arrived instead of repeatedly replaying an older Status file.
      if (at !== this.flight.journalFuelAt) this.updateFuel(record.Fuel?.FuelMain, at, true);
    }
  }

  snapshot(now) {
    const f = this.flight;
    const online = Number.isFinite(this.start) && !f.ended;
    const state = online ? f.status : null;
    const flags = state?.Flags ?? 0;
    const flags2 = state?.Flags2 ?? 0;
    const cockpit = !!state && !(flags2 & 7) && (bit(flags,24) || bit(flags,25));
    const main = cockpit && bit(flags,24);
    const inDock = bit(flags,0);
    const landed = bit(flags,1);
    const cruise = bit(flags,4);
    const hud = cockpit ? (bit(flags,27) ? 'analysis' : 'fight') : null;
    const hardpoints = !cockpit ? null : inDock ? 'docked' : landed ? 'landed' : cruise ? 'cruise' : bit(flags,6) ? 'out' : 'in';
    const underAttack = online && now < f.attackUntil && (cockpit || !state);
    const typed = now < f.jumpUntil ? f.jumpType : null;
    const charging = cockpit && (bit(flags,17) || bit(flags2,19));
    const inTransit = cockpit && bit(flags,30);
    const scooping = main && (bit(flags,11) || now < f.scoopUntil);
    let phase = null;
    let jumpType = null;
    if (online && now < f.arrivedUntil) {
      phase = 'arrived';
      jumpType = 'Hyperspace';
    } else if (online && (typed === 'Hyperspace' || (inTransit && typed !== 'Supercruise'))) {
      phase = 'jumping';
      jumpType = 'Hyperspace';
    } else if (charging && typed !== 'Supercruise') {
      phase = 'charging';
      if (bit(flags2,19)) jumpType = 'Hyperspace';
    }
    const context = underAttack ? 'fight' : phase && phase !== 'arrived' ? 'nav' :
      (hud === 'fight' && hardpoints === 'out') ? 'fight' : scooping ? 'fuel' : phase ? 'nav' : 'home';
    const heat = !main ? null : now < f.damageUntil ? 'damage' : bit(flags,20) ? 'overheat' :
      now < f.warningUntil ? 'warning' : 'normal';
    const shields = cockpit ? (f.shieldsAt > timestamp(state) ? f.shields : bit(flags,3)) : null;
    return {
      context, online, lights: main ? bit(flags,8) : null, scoopOpen: main ? bit(flags,9) : null,
      fss: main && Number.isInteger(state.GuiFocus) ? state.GuiFocus === 9 : null, statusValid: !!state, flags: state ? flags : null, hud, hardpoints,
      system: online ? f.system : null, station: online && (!cockpit || inDock) ? f.station : null,
      credits: online ? number(state?.Balance) ?? f.credits : null,
      hull: main ? f.hull : null, hullAt: main && f.hull !== null ? f.hullAt : null,
      shields, underAttack, heat, fuel: main && f.shipId !== null ? f.fuel : null, capacity: main ? f.capacity : null,
      next: online ? f.next : null, remaining: online ? f.remaining : null,
      jumpTarget: online && typed === 'Hyperspace' ? f.jumpTo : null,
      phase, jumpType, jumpDistance: phase === 'arrived' ? f.arrivalDistance : null,
      targetHull: cockpit && f.target && now - f.scanAt <= 30000 ? f.targetHull : null,
      targetShield: cockpit && f.target && now - f.scanAt <= 30000 ? f.targetShield : null,
      targetRelation: cockpit && f.target && f.targetCommander && bit(flags,7) && f.wing.has(f.targetCommander) ? 'wing' :
        cockpit && f.target && f.targetCommander && f.targetCommander === f.interdictor && now < f.interdictedUntil ? 'interdictor' : null,
      target: cockpit ? f.target : null, targetLegal: cockpit ? f.targetLegal : null,
      supercruise: cockpit ? cruise : null
    };
  }
}

class JournalReader {
  constructor(dir, model) {
    this.dir = dir;
    this.model = model;
    this.session = null;
    this.file = '';
    this.offset = 0;
    this.partial = Buffer.alloc(0);
  }

  poll(now) {
    const model = this.model;
    if (!Number.isFinite(model.start)) return;
    let status = null;
    try {
      status = JSON.parse(fs.readFileSync(path.join(this.dir,'Status.json'),'utf8').replace(/^\uFEFF/,''));
    } catch {}
    model.status(status,now);
    try {
      const initial = this.session !== model.start;
      if (initial) {
        this.file = '';
        this.session = model.start;
      }
      const names = fs.readdirSync(this.dir).filter(n => /^Journal\..*\.log$/i.test(n) && n >= this.file).sort();
      for (const name of names) {
        const file = path.join(this.dir,name);
        const stat = fs.statSync(file);
        if (!this.file && stat.mtimeMs < model.start - 2000) continue;
        if (name !== this.file || stat.size < this.offset) {
          this.file = name;
          this.offset = 0;
          this.partial = Buffer.alloc(0);
        }
        if (stat.size === this.offset) continue;
        const fd = fs.openSync(file,'r');
        try {
          while (this.offset < stat.size) {
            const chunk = Buffer.allocUnsafe(Math.min(stat.size-this.offset,262144));
            const count = fs.readSync(fd,chunk,0,chunk.length,this.offset);
            if (!count) break;
            this.offset += count;
            const data = Buffer.concat([this.partial,chunk.subarray(0,count)]);
            let start = 0, end;
            while ((end = data.indexOf(10,start)) >= 0) {
              try { model.event(JSON.parse(data.toString('utf8',start,end)),now,initial); } catch {}
              start = end+1;
            }
            this.partial = Buffer.from(data.subarray(start));
          }
        } finally {fs.closeSync(fd);}
      }
    } catch {}
    model.status(status,now);
  }
}

function createTelemetry(dir) {
  const model = new Telemetry();
  const reader = new JournalReader(dir,model);
  return {
    setSession: start => model.setSession(start),
    poll: now => reader.poll(now),
    snapshot: now => model.snapshot(now)
  };
}

module.exports = { createTelemetry, Telemetry, JournalReader };
