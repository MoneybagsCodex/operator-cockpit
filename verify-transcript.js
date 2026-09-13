// End-to-end verification against the RUNNING bridge:
//   1. launch an agent the way the cockpit does (WebSocket -> bridge -> pty)
//   2. clear the trust prompt
//   3. have it do one real turn
//   4. check a .jsonl transcript landed on disk
// Resume is verified separately, from the shell.
const WebSocket = require('ws');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const SID = randomUUID();
const PROJ = path.join(os.homedir(), '.claude', 'projects', '-Users-joshuaminton');
const url = `ws://127.0.0.1:3002/terminal?mode=launch&sid=${SID}`
  + `&agent=zz-verify&label=${encodeURIComponent('ZZ Verify')}&cols=100&rows=30`;

const ws = new WebSocket(url);
let out = '';
let trustDone = false;
let asked = false;

const clean = () => out
  .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
  .replace(/\x1b[()][A-Z0-9]/g, '')
  .replace(/\x1b\]8;[^\x07]*\x07/g, '')
  .replace(/\x1b[>=<][0-9;]*[a-zA-Z]?/g, '');

const caret = () => {
  const tail = clean().slice(-1500);
  const y = Math.max(tail.lastIndexOf('❯Yes'), tail.lastIndexOf('❯ Yes'));
  const n = Math.max(tail.lastIndexOf('❯No'), tail.lastIndexOf('❯ No'));
  if (y < 0 && n < 0) return 'NONE';
  return y > n ? 'YES' : 'NO';
};

const send = (data) => ws.send(JSON.stringify({ type: 'input', data }));

ws.on('open', () => console.log(`launched sid=${SID}`));
ws.on('message', (d) => { out += d.toString(); });

// Drive the trust menu the same way the UI now does: nudge, verify, then confirm.
const iv = setInterval(() => {
  if (trustDone) return;
  const c = caret();
  if (c === 'NO') send('\x1b[B');
  else if (c === 'YES') { send('\r'); trustDone = true; console.log('trust: confirmed on "Yes"'); }
}, 700);

// Once booted, do one real turn so there is something to persist.
setTimeout(() => {
  if (!asked) { asked = true; send('say ok\r'); console.log('sent a turn'); }
}, 22000);

setTimeout(() => {
  clearInterval(iv);
  const c = clean();
  const f = path.join(PROJ, `${SID}.jsonl`);
  console.log('---');
  console.log('booted            :', /auto mode on|accept edits|for shortcuts|manual mode/i.test(c));
  console.log('transcript warning:', /Transcript saving is off/i.test(c) ? 'STILL SHOWN (bad)' : 'gone (good)');
  console.log('transcript file   :', fs.existsSync(f) ? `WRITTEN ${fs.statSync(f).size} bytes` : 'MISSING (bad)');
  console.log('SID=' + SID);
  try { ws.close(); } catch {}
  process.exit(0);
}, 50000);
