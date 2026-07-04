#!/usr/bin/env node
/**
 * free-ports.js — kill whatever is listening on the given ports.
 *
 * Runs automatically as the `predev:all` npm hook so every `npm run dev:all`
 * starts from a clean slate instead of stacking zombie servers.
 *
 * Usage: node src/scripts/free-ports.js 3001 3002
 *
 * Uses Windows `netstat -ano` + `taskkill /F` (no dependencies, no PowerShell
 * execution-policy issues). On non-Windows it falls back to `lsof` + `kill`.
 */
'use strict';

const { execSync } = require('child_process');

const ports = process.argv.slice(2).map((p) => parseInt(p, 10)).filter(Boolean);
if (ports.length === 0) {
  console.log('[free-ports] no ports given — nothing to do');
  process.exit(0);
}

const isWin = process.platform === 'win32';

function pidsOnPort(port) {
  try {
    if (isWin) {
      // netstat lines look like:  TCP    0.0.0.0:3001   0.0.0.0:0   LISTENING   37148
      const out = execSync(`netstat -ano -p TCP`, { encoding: 'utf-8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!/LISTENING/i.test(line)) continue;
        // match :PORT in the local-address column (avoid matching the foreign col)
        const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
        if (m && parseInt(m[1], 10) === port) pids.add(m[2]);
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port} -s tcp:LISTEN`, { encoding: 'utf-8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return []; // nothing listening, or tool returned non-zero
  }
}

function kill(pid) {
  try {
    if (isWin) execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    else execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

let killedAny = false;
for (const port of ports) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`[free-ports] :${port} already free`);
    continue;
  }
  for (const pid of pids) {
    const ok = kill(pid);
    console.log(`[free-ports] :${port} ${ok ? 'freed' : 'could not kill'} PID ${pid}`);
    killedAny = killedAny || ok;
  }
}

// Give the OS a moment to release the sockets before the servers try to bind.
if (killedAny) {
  const until = Date.now() + 800;
  while (Date.now() < until) { /* brief spin so ports are fully released */ }
}
