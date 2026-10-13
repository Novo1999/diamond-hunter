// Pixel art. Characters are drawn from 16x16 text grids; tiles are drawn in code.
(function (root) {
  'use strict';

  const S = 16;

  const ART = {
    player: {
      pal: { k: '#1a1208', H: '#c98a44', h: '#8a5a2b', s: '#f0c08a', S: '#c98e5a', e: '#1a1208', r: '#c8402e', w: '#e3d6a4', W: '#ab9a68', p: '#4d6b3a', b: '#5a3a1a' },
      frames: [
        [
          '................',
          '.....kkkkk......',
          '....kHHHHHk.....',
          '....kHhhhhk.....',
          '..kkkkkkkkkkk...',
          '....kssssek.....',
          '....kssssSk.....',
          '.....kSSSk......',
          '....krrrrrk.....',
          '...kwwwwwwWk....',
          '...kwWwwwWWk....',
          '...ksWwwwWsk....',
          '....kpppppk.....',
          '....kpk.kpk.....',
          '....kbk.kbk.....',
          '....kkk.kkk.....',
        ],
        [
          '................',
          '.....kkkkk......',
          '....kHHHHHk.....',
          '....kHhhhhk.....',
          '..kkkkkkkkkkk...',
          '....kssssek.....',
          '....kssssSk.....',
          '.....kSSSk......',
          '....krrrrrk.....',
          '...kwwwwwwWk....',
          '..kswWwwwWWsk...',
          '...kkWwwwWkk....',
          '....kpppppk.....',
          '...kpk...kpk....',
          '...kbk...kbbk...',
          '...kkk...kkkk...',
        ],
      ],
    },
    boulder: {
      pal: { k: '#1c1a16', G: '#a49e8c', g: '#7d7869', d: '#57524a', D: '#3e3a34' },
      frames: [[
        '................',
        '.....kkkkkk.....',
        '...kkGGGgggkk...',
        '..kGGGGggggggk..',
        '..kGGgggggggddk.',
        '.kGGgggggggggddk',
        '.kGggggggggggddk',
        '.kgggggggggggddk',
        '.kggggggggggdddk',
        '.kgggggggggddddk',
        '.kdgggggggdddDDk',
        '..kddggddddDDDk.',
        '..kDdddddDDDDDk.',
        '...kkDDDDDDDkk..',
        '.....kkkkkkk....',
        '................',
      ]],
    },
    gem: {
      pal: { k: '#0c2a33', w: '#ffffff', C: '#bdf6ff', c: '#5fd4e6', n: '#2a8fa8', N: '#1b6478' },
      frames: [[
        '................',
        '................',
        '................',
        '....kkkkkkkk....',
        '...kCwCCcccnk...',
        '..kCCCCccccnnk..',
        '.kkkkkkkkkkkkkk.',
        '.kCCcccccnnnnNk.',
        '..kCccccnnnnNk..',
        '...kCcccnnnNk...',
        '....kcccnnNk....',
        '.....kccnNk.....',
        '......kcNk......',
        '.......kk.......',
        '................',
        '................',
      ]],
    },
    ruby: {
      pal: { k: '#3a0a14', w: '#ffffff', C: '#ffb3c0', c: '#e0475b', n: '#a82238', N: '#6e1222' },
      frames: [[
        '................',
        '................',
        '......kkkk......',
        '....kkCwCckk....',
        '...kCCCCcccnk...',
        '..kCCCccccccnk..',
        '..kCcccccccnnk..',
        '.kCcccccccnnnNk.',
        '.kccccccccnnnNk.',
        '.kcccccccnnnNNk.',
        '..kcccccnnnNNk..',
        '..kncccnnnNNNk..',
        '...knnnnnNNNk...',
        '....kkNNNNkk....',
        '......kkkk......',
        '................',
      ]],
    },
    key: {
      pal: { k: '#2a1a04', Y: '#fff0a8', y: '#e8b84a', o: '#a8761c' },
      frames: [[
        '................',
        '................',
        '................',
        '...kkkk.........',
        '..kYYyyk........',
        '.kYk..kyk.......',
        '.kyk..kykkkkkkk.',
        '.kyk..kyyyyyyyyk',
        '.kyo..koooyooyok',
        '..kyyyyok.kok.kk',
        '...kkkkk..kok...',
        '...........k....',
        '................',
        '................',
        '................',
        '................',
      ]],
    },
    bat: {
      pal: { k: '#140a1c', V: '#a888d0', v: '#6a4a8a', u: '#4a3066', r: '#ff5050' },
      frames: [
        [
          '................',
          '.k............k.',
          '.kk..........kk.',
          '.kVk...kk...kVk.',
          '.kVVk.kvvk.kVVk.',
          '.kVvvkvvvvkvvVk.',
          '.kvvvvrvvrvvvvk.',
          '..kvvvvvvvvvvk..',
          '..kuvvvvvvvvuk..',
          '...kuk.kk.kuk...',
          '....k......k....',
          '................',
          '................',
          '................',
          '................',
          '................',
        ],
        [
          '................',
          '................',
          '................',
          '.......kk.......',
          '......kvvk......',
          '.....kvvvvk.....',
          '..kkkvrvvrvkkk..',
          '.kVVvvvvvvvvVVk.',
          'kVVvvvvvvvvvvVVk',
          'kVvvukvvvvkuvvVk',
          'kvvuk.kvvk.kuvvk',
          'kvuk...kk...kuvk',
          'kuk..........kuk',
          '.k............k.',
          '................',
          '................',
        ],
      ],
    },
    spider: {
      pal: { k: '#1a0606', r: '#b83a2a', R: '#e8644a', d: '#7a2018', y: '#ffe060', l: '#2a1410' },
      frames: [
        [
          '.......kk.......',
          '.......kk.......',
          '.l....kRRk....l.',
          '..l..kRrrrk..l..',
          'l..l.krrrrk.l..l',
          '.l..lkrrrrkl..l.',
          '..llkrrrrrrkll..',
          '....krryyrrk....',
          '..llkrrrrrrkll..',
          '.l..lkdrrdkl..l.',
          'l..l..kddk..l..l',
          '..l....kk....l..',
          '.l............l.',
          '................',
          '................',
          '................',
        ],
        [
          '.......kk.......',
          '.......kk.......',
          '......kRRk......',
          'l....kRrrrk....l',
          '.l...krrrrk...l.',
          '..l.lkrrrrkl.l..',
          '...lkrrrrrrkl...',
          'llllkrryyrrkllll',
          '...lkrrrrrrkl...',
          '..l.lkdrrdkl.l..',
          '.l....kddk....l.',
          'l......kk......l',
          '................',
          '................',
          '................',
          '................',
        ],
      ],
    },
  };

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function fromArt(rows, pal, flip) {
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      if (row.length !== S) throw new Error(`sprite row ${y} is ${row.length} wide`);
      for (let x = 0; x < S; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(flip ? S - 1 - x : x, y, 1, 1);
      }
    });
    return c;
  }

  // Small deterministic random so every tile variant looks the same on every load
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
  }

  function px(g, color, x, y, w = 1, h = 1) { g.fillStyle = color; g.fillRect(x, y, w, h); }

  const PAL = {
    bg: '#111a15', bgLine: '#17221b', bgDot: '#1b2820',
    mortar: '#232b24', stone: '#56614f', stoneHi: '#717d68', stoneLo: '#3d4639',
    moss: '#5e8a3c', mossLo: '#3f6a2a',
    soil: '#6b4a2c', soilLo: '#4a321c', soilHi: '#8a6238', root: '#3a5a26',
    wood: '#7a4a22', woodLo: '#523014', iron: '#2c2a26', gold: '#e8b84a', goldHi: '#fff0a8',
    steel: '#c8d0d8', steelLo: '#7c8690',
  };

  function wallTile(seed) {
    const c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(seed);
    px(g, PAL.mortar, 0, 0, S, S);
    const brick = (x, y, w, h) => {
      px(g, PAL.stone, x, y, w, h);
      px(g, PAL.stoneHi, x, y, w, 1);
      px(g, PAL.stoneHi, x, y, 1, h);
      px(g, PAL.stoneLo, x, y + h - 1, w, 1);
      px(g, PAL.stoneLo, x + w - 1, y, 1, h);
      for (let i = 0; i < 3; i++) px(g, r() < 0.5 ? PAL.stoneLo : PAL.stoneHi, x + 1 + Math.floor(r() * (w - 2)), y + 1 + Math.floor(r() * (h - 2)));
    };
    const off = seed % 2 ? 4 : 0;
    brick(0, 0, 7, 7); brick(8, 0, 7, 7);
    brick(-4 + off, 8, 7, 7); brick(4 + off, 8, 7, 7); brick(12 + off, 8, 7, 7);
    if (r() < 0.45) {
      const mx = Math.floor(r() * 12);
      for (let i = 0; i < 6; i++) px(g, r() < 0.6 ? PAL.moss : PAL.mossLo, mx + Math.floor(r() * 5), Math.floor(r() * 3));
    }
    return c;
  }

  function soilTile(seed) {
    const c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(seed * 7 + 3);
    px(g, PAL.soil, 0, 0, S, S);
    for (let i = 0; i < 22; i++) px(g, PAL.soilLo, Math.floor(r() * S), Math.floor(r() * S), r() < 0.3 ? 2 : 1, 1);
    for (let i = 0; i < 10; i++) px(g, PAL.soilHi, Math.floor(r() * S), Math.floor(r() * S));
    if (r() < 0.5) {
      let x = Math.floor(r() * 12) + 2, y = 0;
      while (y < S) { px(g, PAL.root, x, y); y++; if (r() < 0.4) x += r() < 0.5 ? -1 : 1; }
    }
    return c;
  }

  function bgTile(seed) {
    const c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(seed * 13 + 5);
    px(g, PAL.bg, 0, 0, S, S);
    if (seed % 3 === 0) px(g, PAL.bgLine, 0, 15, S, 1);
    if (seed % 5 === 0) px(g, PAL.bgLine, 15, 0, 1, S);
    for (let i = 0; i < 3; i++) px(g, PAL.bgDot, Math.floor(r() * S), Math.floor(r() * S));
    return c;
  }

  function doorTile() {
    const c = makeCanvas(S, S), g = c.getContext('2d');
    px(g, PAL.mortar, 0, 0, S, S);
    px(g, PAL.stone, 0, 0, S, 2); px(g, PAL.stone, 0, 0, 2, S); px(g, PAL.stone, 14, 0, 2, S);
    px(g, PAL.stoneHi, 0, 0, S, 1);
    px(g, PAL.wood, 2, 2, 12, 14);
    for (let x = 5; x < 14; x += 3) px(g, PAL.woodLo, x, 2, 1, 14);
    px(g, PAL.iron, 2, 4, 12, 1); px(g, PAL.iron, 2, 12, 12, 1);
    px(g, PAL.gold, 6, 7, 4, 4); px(g, PAL.goldHi, 6, 7, 4, 1);
    px(g, PAL.iron, 7, 6, 2, 1); px(g, PAL.iron, 6, 6, 1, 1); px(g, PAL.iron, 9, 6, 1, 1);
    px(g, PAL.iron, 7, 9, 2, 1);
    return c;
  }

  function exitTile(open) {
    const c = makeCanvas(S, S), g = c.getContext('2d');
    px(g, PAL.stone, 0, 0, S, S);
    px(g, PAL.stoneHi, 0, 0, S, 1);
    px(g, PAL.stoneLo, 0, 15, S, 1);
    // arched doorway
    const inner = open ? '#f4d77a' : '#050806';
    px(g, inner, 4, 4, 8, 12); px(g, inner, 5, 3, 6, 1); px(g, inner, 6, 2, 4, 1);
    px(g, PAL.gold, 7, 0, 2, 2);
    if (open) {
      px(g, '#fffbe0', 6, 5, 4, 11);
      px(g, '#fff', 7, 6, 2, 10);
    } else {
      for (let x = 5; x < 12; x += 2) px(g, PAL.steelLo, x, 3, 1, 13);
      px(g, PAL.steelLo, 4, 8, 8, 1);
    }
    return c;
  }

  function spikeTile(state) {
    const c = makeCanvas(S, S), g = c.getContext('2d');
    px(g, PAL.iron, 0, 14, S, 2);
    px(g, PAL.steelLo, 0, 14, S, 1);
    const h = state === 'up' ? 11 : state === 'warn' ? 3 : 0;
    for (const bx of [1, 6, 11]) {
      if (!h) { px(g, '#050505', bx + 1, 14, 2, 1); continue; }
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round(((i + 1) / h) * 4));
        px(g, PAL.steel, bx + 2 - Math.ceil(w / 2), 14 - h + i, w, 1);
      }
      px(g, '#ffffff', bx + 1, 14 - h, 1, 1);
      if (h > 4) px(g, PAL.steelLo, bx + 2, 14 - h + 4, 1, h - 4);
    }
    return c;
  }

  function checkpointTile(lit) {
    const c = makeCanvas(S, S), g = c.getContext('2d');
    const ring = lit ? '#7ff0ff' : '#6d7a68', core = lit ? '#e8ffff' : '#2a322b';
    px(g, PAL.stoneLo, 4, 13, 8, 3); px(g, PAL.stone, 5, 12, 6, 1);
    px(g, PAL.stone, 6, 8, 4, 4); px(g, PAL.stoneHi, 6, 8, 1, 4);
    px(g, ring, 5, 1, 6, 1); px(g, ring, 5, 7, 6, 1); px(g, ring, 4, 2, 1, 5); px(g, ring, 11, 2, 1, 5);
    px(g, core, 6, 3, 4, 3);
    if (lit) { px(g, '#ffffff', 7, 4, 2, 1); }
    return c;
  }

  function build() {
    const out = {};
    for (const [name, a] of Object.entries(ART)) {
      out[name] = a.frames.map((f) => fromArt(f, a.pal, false));
      out[name + 'L'] = a.frames.map((f) => fromArt(f, a.pal, true));
    }
    out.wall = [0, 1, 2, 3, 4, 5].map(wallTile);
    out.soil = [0, 1, 2, 3].map(soilTile);
    out.bg = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(bgTile);
    out.door = doorTile();
    out.exitClosed = exitTile(false);
    out.exitOpen = exitTile(true);
    out.spike = { down: spikeTile('down'), warn: spikeTile('warn'), up: spikeTile('up') };
    out.check = [checkpointTile(false), checkpointTile(true)];
    return out;
  }

  root.Sprites = { S, build, PAL };
})(this);
