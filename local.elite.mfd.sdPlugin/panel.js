'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTelemetry } = require('./telemetry');
const { render, command } = require('./cockpit');

const PLUGIN = 'local.elite.mfd';
const MENU_IDLE_MS = 8000;

class Deck {
  constructor({ telemetry, send, clock = Date.now, runCommand, render: paint = render, command: select = command, uuid }) {
    Object.assign(this, { telemetry, send, clock, runCommand, paint, select, uuid });
    this.keys = new Map();
    this.devices = new Map();
  }

  device(id) {
    if (!this.devices.has(id)) this.devices.set(id, { menu: null, until: 0 });
    return this.devices.get(id);
  }

  menuAt(device, now) {
    if (now >= device.until) device.menu = null;
    return device.menu;
  }

  message(m) {
    const { event, context, device, action } = m;
    if (action === PLUGIN + '.open' && event === 'keyDown') {
      this.devices.delete(device);
      this.switchProfile(device, 'Elite MFD');
      return;
    }
    if (action !== PLUGIN + '.cell') return;
    if (event === 'willAppear') {
      const c = m.payload?.coordinates;
      if (!c || c.row < 0 || c.row > 2 || c.column < 0 || c.column > 4) return;
      this.keys.set(context, { index: c.row * 5 + c.column, device, image: null });
      this.draw();
    } else if (event === 'willDisappear') {
      this.keys.delete(context);
      if (![...this.keys.values()].some(k => k.device === device)) this.devices.delete(device);
    } else if (event === 'keyUp' && this.keys.has(context)) {
      this.keys.get(context).heatHeld = false;
    } else if (event === 'keyDown' && this.keys.has(context)) {
      this.press(context, this.keys.get(context));
    }
  }

  switchProfile(device, profile) {
    this.send({ event: 'switchToProfile', context: this.uuid, device, payload: { profile } });
  }

  press(context, key) {
    if (key.heatHeld) return;
    const now = this.clock();
    const device = this.device(key.device);
    const oldMenu = this.menuAt(device, now);
    const snapshot = this.telemetry.snapshot(now);
    const action = this.select(oldMenu, key.index, snapshot.context, snapshot);
    if (action === 'DeployHeatSink') key.heatHeld = true;
    if (oldMenu) device.until = now + MENU_IDLE_MS;
    if (action === '@exit') {
      device.menu = null;
      this.switchProfile(key.device, '');
      return;
    }
    if (action === '@nav' || action === '@systems') {
      device.menu = action.slice(1);
      device.until = now + MENU_IDLE_MS;
    } else if (action === '@back') {
      device.menu = null;
    } else if (action) {
      const alert = () => this.send({ event: 'showAlert', context });
      if (this.telemetry.snapshot(now).online) this.runCommand(action, alert);
      else alert();
    }
    this.draw();
  }

  draw() {
    if (!this.keys.size) return;
    const now = this.clock();
    const snapshot = this.telemetry.snapshot(now);
    for (const [context, key] of this.keys) {
      const menu = this.menuAt(this.device(key.device), now);
      const image = this.paint(snapshot, menu, key.index, now);
      if (image === key.image) continue;
      key.image = image;
      this.send({ event: 'setImage', context, payload: { image, target: 0 } });
    }
  }
}

function start() {
  const args = process.argv.slice(2);
  const arg = key => args[args.indexOf(key) + 1];
  const uuid = arg('-pluginUUID');
  const socket = new WebSocket('ws://127.0.0.1:' + arg('-port'));
  const send = message => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const telemetry = createTelemetry(path.join(process.env.USERPROFILE, 'Saved Games', 'Frontier Developments', 'Elite Dangerous'));
  function runCommand(action, alert) {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned',
      '-File', path.join(__dirname, 'key.ps1'), action], { windowsHide: true, stdio: 'ignore' });
    child.once('error', alert);
    child.once('exit', code => { if (code) alert(); });
  }
  const deck = new Deck({ telemetry, send, runCommand, uuid });
  socket.onopen = () => {
    send({ event: arg('-registerEvent'), uuid });
    send({ event: 'logMessage', payload: { message: 'Elite MFD 2.5.1 connected' } });
  };
  socket.onmessage = ({ data }) => deck.message(JSON.parse(data));
  socket.onclose = () => process.exit(0);
  socket.onerror = () => process.exit(1);

  let checking = false;
  function checkSession() {
    if (checking) return;
    checking = true;
    const query = '$p=Get-Process EliteDangerous64 -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds()}';
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.on('error', () => { checking = false; });
    child.on('close', () => {
      checking = false;
      telemetry.setSession(Number(output.trim()) || Infinity);
      telemetry.poll(Date.now());
      deck.draw();
    });
  }
  checkSession();
  setInterval(checkSession, 5000);
  setInterval(() => telemetry.poll(Date.now()), 500);
  setInterval(() => deck.draw(), 180);
}

module.exports = { Deck };
if (require.main === module) start();
