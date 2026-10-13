// Game rules. Pure logic with no DOM access, so the test solver can run it in Node.
(function (root) {
  'use strict';

  const T = { EMPTY: 0, WALL: 1, DIRT: 2, BOULDER: 3, GEM: 4, RED: 5, KEY: 6, DOOR: 7, EXIT: 8, PLAYER: 9, BAT: 10, SPIDER: 11 };
  const OV = { NONE: 0, SPIKE: 1, CHECK: 2 };
  const SPIKE_PERIOD = 16;
  const SPIKE_UP = 6;
  const TICK_MS = 135;
  // Standing still under a resting boulder for this long crushes the explorer (about 3 seconds)
  const HOLD_TICKS = Math.round(3000 / TICK_MS);
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

  // Map legend:
  //  #  wall          .  soil (dig through)   O  boulder
  //  *  gem           R  ruby (bonus)         k  key        D  locked door
  //  E  exit          P  player start         C  checkpoint
  //  b/B bat flying right/left                s/S spider crawling down/up
  //  ^  spikes (phase A)                      ;  spikes (phase B, half a cycle later)
  const LEGEND = {
    ' ': [T.EMPTY], '#': [T.WALL], '.': [T.DIRT], 'O': [T.BOULDER], '*': [T.GEM], 'R': [T.RED],
    'k': [T.KEY], 'D': [T.DOOR], 'E': [T.EXIT], 'P': [T.PLAYER],
    'b': [T.BAT, 1], 'B': [T.BAT, -1], 's': [T.SPIDER, 1], 'S': [T.SPIDER, -1],
    '^': [T.EMPTY, 0, OV.SPIKE, 0], ';': [T.EMPTY, 0, OV.SPIKE, SPIKE_PERIOD / 2], 'C': [T.EMPTY, 0, OV.CHECK],
  };

  function isRound(c) { return c === T.BOULDER || c === T.GEM || c === T.RED; }
  function isEnemy(c) { return c === T.BAT || c === T.SPIDER; }

  function parse(level) {
    const rows = level.map;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const n = w * h;
    const s = {
      w, h,
      t: new Uint8Array(n),   // tile type
      f: new Uint8Array(n),   // 1 while a boulder is falling
      d: new Int8Array(n),    // enemy heading
      ov: new Uint8Array(n),  // floor overlay: spikes or checkpoint
      sp: new Uint8Array(n),  // spike phase offset
      mv: new Int32Array(n).fill(-1), // where each cell's content came from this tick (for animation)
      moved: new Uint8Array(n),
      cp: new Uint8Array(n),  // checkpoints already touched
      px: 0, py: 0, face: 1,
      gems: 0, red: 0, keys: 0,
      need: level.need, totalGems: 0, totalRed: 0,
      tick: 0, alive: true, won: false, cause: '',
      hold: 0,                // ticks spent standing still under a boulder
      events: [],
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] === undefined ? '#' : rows[y][x];
        const def = LEGEND[ch];
        if (!def) throw new Error(`Unknown map char "${ch}" at ${x},${y} in ${level.name}`);
        const i = y * w + x;
        s.t[i] = def[0];
        if (def[1]) s.d[i] = def[1];
        if (def[2]) { s.ov[i] = def[2]; s.sp[i] = def[3] || 0; }
        if (def[0] === T.PLAYER) { s.px = x; s.py = y; }
        if (def[0] === T.GEM || isEnemy(def[0])) s.totalGems++;
        if (def[0] === T.RED) s.totalRed++;
      }
    }
    return s;
  }

  function clone(s) {
    const c = Object.assign({}, s);
    for (const k of ['t', 'f', 'd', 'ov', 'sp', 'mv', 'moved', 'cp']) c[k] = s[k].slice();
    c.events = [];
    return c;
  }

  function spikePhase(s, i) { return (s.tick + s.sp[i]) % SPIKE_PERIOD; }
  function spikeUp(s, i) { return spikePhase(s, i) < SPIKE_UP; }
  function spikeWarn(s, i) { return spikePhase(s, i) >= SPIKE_PERIOD - 3; }

  function die(s, cause) {
    s.alive = false;
    s.cause = cause;
    s.events.push('die');
  }

  function move(s, from, to) {
    s.t[to] = s.t[from];
    s.d[to] = s.d[from];
    s.t[from] = T.EMPTY;
    s.f[from] = 0;
    s.d[from] = 0;
    s.mv[to] = from;
    s.moved[to] = 1;
  }

  // Advance the world one tick. dir is 'U', 'D', 'L', 'R' or null.
  function step(s, dir) {
    if (!s.alive || s.won) return;
    s.tick++;
    s.events.length = 0;
    s.mv.fill(-1);
    s.moved.fill(0);
    const W = s.w, t = s.t;

    // 1. Player
    if (dir) {
      const [dx, dy] = DIRS[dir];
      if (dx) s.face = dx;
      const pi = s.py * W + s.px;
      const ni = pi + dy * W + dx;
      const c = t[ni];
      let go = false;
      switch (c) {
        case T.EMPTY: go = true; break;
        case T.DIRT: go = true; s.events.push('dig'); break;
        case T.GEM: go = true; s.gems++; s.events.push('gem'); break;
        case T.RED: go = true; s.red++; s.events.push('red'); break;
        case T.KEY: go = true; s.keys++; s.events.push('key'); break;
        case T.DOOR:
          if (s.keys > 0) { s.keys--; go = true; s.events.push('door'); }
          else s.events.push('bump');
          break;
        case T.EXIT:
          if (s.gems >= s.need) { go = true; s.won = true; s.events.push('win'); }
          else s.events.push('bump');
          break;
        case T.BOULDER:
          if (dy === 0 && !s.f[ni] && t[ni + dx] === T.EMPTY) {
            move(s, ni, ni + dx);
            go = true;
            s.events.push('push');
          }
          break;
        case T.BAT: case T.SPIDER:
          t[pi] = T.EMPTY;
          s.mv[ni] = pi;
          s.px += dx; s.py += dy;
          die(s, 'enemy');
          return;
      }
      if (go) {
        s.hold = 0;
        t[pi] = T.EMPTY;
        t[ni] = T.PLAYER;
        s.mv[ni] = pi;
        s.moved[ni] = 1;
        s.px += dx; s.py += dy;
        if (s.won) return;
        if (s.ov[ni] === OV.CHECK && !s.cp[ni]) { s.cp[ni] = 1; s.events.push('check'); }
      }
    }

    // 2. Boulders and enemies, scanned bottom-up so stacks fall together. Gems stay where they are.
    const enemyTurn = s.tick % 2 === 0;
    for (let y = s.h - 2; y >= 1; y--) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (s.moved[i]) continue;
        const c = t[i];
        if (c === T.BOULDER) {
          const b = i + W, cb = t[b];
          if (cb === T.EMPTY) {
            move(s, i, b);
            s.f[b] = 1;
          } else if (cb === T.PLAYER && s.f[i]) {
            die(s, 'crush');
            return;
          } else if (isEnemy(cb)) {
            // A boulder landing on a creature turns it into a gem
            t[b] = T.GEM; s.d[b] = 0; s.f[b] = 0; s.moved[b] = 1;
            s.f[i] = 0;
            s.events.push('squash');
          } else if (isRound(cb) && !s.f[b]) {
            // Boulders roll off gems and other boulders when there is room to the side
            if (t[i - 1] === T.EMPTY && t[i - 1 + W] === T.EMPTY) { move(s, i, i - 1); s.f[i - 1] = 1; }
            else if (t[i + 1] === T.EMPTY && t[i + 1 + W] === T.EMPTY) { move(s, i, i + 1); s.f[i + 1] = 1; }
            else { if (s.f[i]) s.events.push('land'); s.f[i] = 0; }
          } else {
            if (s.f[i]) s.events.push('land');
            s.f[i] = 0;
          }
        } else if (isEnemy(c) && enemyTurn) {
          const n = c === T.BAT ? i + s.d[i] : i + s.d[i] * W;
          if (t[n] === T.PLAYER) { die(s, 'enemy'); return; }
          if (t[n] === T.EMPTY) move(s, i, n);
          else s.d[i] = -s.d[i];
        }
      }
    }

    // 3. Spikes
    const pi = s.py * W + s.px;
    if (s.ov[pi] === OV.SPIKE && spikeUp(s, pi)) { die(s, 'spike'); return; }

    // 4. A boulder resting on the explorer's head gets too heavy to hold
    if (t[pi - W] === T.BOULDER) {
      s.hold++;
      if (s.hold >= HOLD_TICKS) { die(s, 'held'); return; }
      if (s.hold === Math.round(HOLD_TICKS / 3) || s.hold === Math.round((HOLD_TICKS * 2) / 3)) s.events.push('strain');
    } else {
      s.hold = 0;
    }
  }

  const api = { T, OV, DIRS, LEGEND, SPIKE_PERIOD, TICK_MS, HOLD_TICKS, parse, clone, step, spikeUp, spikeWarn, isRound, isEnemy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
