// Proves each level is winnable with a goal-directed search: shortest routes to the next pickup, with backtracking.
// Usage: node test/solve.js [levelNumber] [--ruby]
//   --ruby also requires collecting every ruby before reaching the exit.
'use strict';
const E = require('../src/engine.js');
const LEVELS = require('../src/levels.js');

const ACTIONS = [null, 'U', 'D', 'L', 'R'];

function lint(level) {
  const problems = [];
  const w = level.map[0].length;
  level.map.forEach((r, y) => { if (r.length !== w) problems.push(`row ${y} is ${r.length} wide, expected ${w}`); });
  const s = E.parse(level);
  const edge = (x, y) => x === 0 || y === 0 || x === s.w - 1 || y === s.h - 1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (edge(x, y) && s.t[y * s.w + x] !== E.T.WALL) problems.push(`border gap at ${x},${y}`);
  }
  const players = [...s.t].filter((c) => c === E.T.PLAYER).length;
  const exits = [...s.t].filter((c) => c === E.T.EXIT).length;
  if (players !== 1) problems.push(`${players} players`);
  if (exits !== 1) problems.push(`${exits} exits`);
  if (s.totalGems < level.need) problems.push(`needs ${level.need} gems, only ${s.totalGems} exist`);
  // Nothing should tumble the moment a level starts
  const idle = E.parse(level);
  for (let k = 0; k < 3; k++) E.step(idle, null);
  for (let i = 0; i < s.t.length; i++) {
    if (s.t[i] === E.T.BOULDER && idle.t[i] !== E.T.BOULDER) problems.push(`boulder at ${i % s.w},${Math.floor(i / s.w)} falls at start`);
  }
  return { problems, s };
}

// 52-bit FNV-style hash of the dynamic parts of a state
function key(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const mix = (v) => {
    h1 = Math.imul(h1 ^ v, 16777619);
    h2 = Math.imul(h2 ^ v, 2246822519) ^ (h2 >>> 13);
  };
  for (let i = 0; i < s.t.length; i++) mix(s.t[i] | (s.f[i] << 4) | ((s.d[i] + 1) << 5));
  mix(s.gems); mix(s.keys); mix(s.red); mix(s.tick % E.SPIKE_PERIOD); mix(s.hold);
  return (h1 >>> 0) * 1048576 + ((h2 >>> 0) & 0xfffff);
}

// Hash that treats soil as open floor. Used only to cap how many soil variants of the
// same position the search keeps, which keeps the dig-anywhere explosion in check.
function looseKey(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.t.length; i++) {
    const c = s.t[i] === E.T.DIRT ? 0 : s.t[i];
    h = Math.imul(h ^ (c | (s.f[i] << 4) | ((s.d[i] + 1) << 5)), 16777619);
  }
  return (h >>> 0) * 64 + (s.tick % E.SPIKE_PERIOD) * 4 + (s.keys & 3);
}

const progress = (s) => s.gems * 1000 + s.red * 50 + s.keys * 7;
const SUB_LIMIT = 400_000;
const VARIANTS = 4;
const BRANCH = 6;

// Breadth-first from s until something is picked up (or the exit is reached).
// Returns up to BRANCH distinct outcomes, nearest first.
function nextPickups(s0, wantRuby) {
  const p0 = progress(s0);
  const seen = new Set([key(s0)]);
  const loose = new Map();
  let frontier = [{ s: s0, path: [] }];
  const out = [];
  const outKeys = new Set();
  let count = 0;
  while (frontier.length && out.length < BRANCH && count < SUB_LIMIT) {
    const next = [];
    for (const { s, path } of frontier) {
      for (const a of ACTIONS) {
        const c = E.clone(s);
        E.step(c, a);
        if (!c.alive) continue;
        const p = path.concat([a]);
        if (c.won) {
          if (!wantRuby || c.red === c.totalRed) return [{ s: c, path: p, win: true }];
          continue;
        }
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        count++;
        if (progress(c) !== p0) {
          if (!outKeys.has(k)) { outKeys.add(k); out.push({ s: c, path: p }); }
          continue;
        }
        const lk = looseKey(c);
        const v = loose.get(lk) || 0;
        if (v >= VARIANTS) continue;
        loose.set(lk, v + 1);
        next.push({ s: c, path: p });
      }
    }
    frontier = next;
  }
  return out;
}

function solve(level, wantRuby) {
  const start = E.parse(level);
  const visited = new Set();
  let expanded = 0;
  const deadline = Date.now() + 240_000;
  function dfs(s) {
    if (Date.now() > deadline) return null;
    const k = key(s);
    if (visited.has(k)) return null;
    visited.add(k);
    expanded++;
    for (const o of nextPickups(s, wantRuby)) {
      if (o.win) return o.path;
      const rest = dfs(o.s);
      if (rest) return o.path.concat(rest);
    }
    return null;
  }
  const path = dfs(start);
  if (path) return { ok: true, path, states: expanded };
  return { ok: false, reason: Date.now() > deadline ? `timed out after ${expanded} pickup states` : `no route found (${expanded} pickup states)` };
}

// Replay a found path from scratch so the answer doesn't depend on hashing
function verify(level, path) {
  const s = E.parse(level);
  for (const a of path) E.step(s, a);
  return s.won;
}

const args = process.argv.slice(2);
const wantRuby = args.includes('--ruby');
const only = args.find((a) => /^\d+$/.test(a));
let failed = 0;
LEVELS.forEach((level, i) => {
  if (only && Number(only) !== i + 1) return;
  const { problems, s } = lint(level);
  const label = `${i + 1}. ${level.name} (${s.w}x${s.h}, need ${level.need}/${s.totalGems}, rubies ${s.totalRed})`;
  if (problems.length) { console.log(`FAIL ${label}\n     ${problems.join('\n     ')}`); failed++; return; }
  const t0 = Date.now();
  const r = solve(level, wantRuby && s.totalRed > 0);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok && verify(level, r.path)) {
    const compact = r.path.map((a) => a || '.').join('');
    console.log(`ok   ${label}: ${r.path.length} ticks, ${r.states} states, ${secs}s`);
    if (args.includes('--path')) console.log(`     ${compact}`);
  } else {
    console.log(`FAIL ${label}: ${r.reason || 'path did not verify'} (${secs}s)`);
    failed++;
  }
});
process.exit(failed ? 1 : 0);
