// Game loop, rendering, input, sound and menus.
(function () {
  'use strict';

  const { T, OV } = Engine;
  const TS = Sprites.S;
  const VW = 15, VH = 11;
  const TICK = Engine.TICK_MS;
  const SAVE_KEY = 'diamondhunter.v1';
  const OLD_SAVE_KEY = 'gemhunter.v1'; // the game's earlier name; progress carries over
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const overlay = $('overlay');
  const SPR = Sprites.build();

  // ---------- Saved progress ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY);
      if (raw) return Object.assign({ unlocked: 1, best: {}, muted: false }, JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return { unlocked: 1, best: {}, muted: false };
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
  }
  const save = loadSave();

  // ---------- Sound (square-wave bleeps in the spirit of old handsets) ----------
  let ac = null;
  let muted = !!save.muted;
  function audio() {
    if (muted) return null;
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, opts = {}) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + (opts.at || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    g.gain.setValueAtTime(opts.vol || 0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, at = 0) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + at;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    src.buffer = buf; g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  }
  const SFX = {
    gem() { tone(1318, 0.05); tone(1976, 0.09, { at: 0.05, vol: 0.04 }); },
    red() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.08, { at: i * 0.06, vol: 0.045 })); },
    key() { tone(880, 0.06); tone(1175, 0.06, { at: 0.07 }); tone(1760, 0.1, { at: 0.14, vol: 0.04 }); },
    door() { tone(220, 0.12, { to: 330 }); noise(0.12, 0.12); },
    push() { noise(0.08, 0.18); },
    land() { noise(0.12, 0.3); tone(90, 0.1, { type: 'triangle', vol: 0.12, to: 50 }); },
    dig() { noise(0.035, 0.08); },
    squash() { tone(600, 0.12, { to: 120, type: 'sawtooth', vol: 0.05 }); tone(1568, 0.1, { at: 0.12, vol: 0.04 }); },
    bump() { tone(140, 0.07, { vol: 0.04 }); },
    strain() { tone(110, 0.18, { type: 'sawtooth', vol: 0.05, to: 80 }); noise(0.1, 0.12); },
    check() { [784, 1046, 1318].forEach((f, i) => tone(f, 0.12, { at: i * 0.08, type: 'triangle', vol: 0.07 })); },
    die() { tone(660, 0.5, { to: 80, vol: 0.06 }); noise(0.3, 0.2); },
    win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.3 : 0.1, { at: i * 0.1, vol: 0.05 })); },
  };

  // ---------- Game state ----------
  let mode = 'title';          // title | select | intro | play | pause | dead | won | done
  let li = 0;                  // level index
  let st = null;               // engine state
  let checkpoint = null;       // engine state snapshot at the last checkpoint
  let run = { time: 0, deaths: 0 };
  let acc = 0;
  let lastFrame = 0;
  let deathAt = 0;
  let shake = 0;
  let particles = [];
  const held = [];
  let queued = null;
  let cam = { x: 0, y: 0, init: false };

  function startLevel(i, showIntro = true) {
    li = i;
    st = Engine.parse(LEVELS[li]);
    checkpoint = null;
    run = { time: 0, deaths: 0 };
    particles = [];
    held.length = 0; queued = null;
    acc = 0;
    cam.init = false;
    if (showIntro) showIntroCard(); else setMode('play');
    updateHud(true);
  }

  function respawn() {
    st = checkpoint ? Engine.clone(checkpoint) : Engine.parse(LEVELS[li]);
    particles = [];
    held.length = 0; queued = null;
    acc = 0;
    cam.init = false;
    setMode('play');
    clearOverlay();
  }

  function setMode(m) {
    mode = m;
    $('padPause').textContent = m === 'pause' ? 'Resume' : 'Pause';
    syncMusic();
  }

  // ---------- Background music ----------
  // Plays at half volume while a level is being played; pauses on menus, pause, death and win.
  // Keeps its position between levels. Respects the sound toggle. Missing file fails quietly.
  const MUSIC_VOLUME = 0.5;
  const bgm = $('bgm');
  bgm.volume = MUSIC_VOLUME;
  function syncMusic() {
    const want = mode === 'play' && !muted;
    if (want) {
      if (bgm.paused) { const p = bgm.play(); if (p && p.catch) p.catch(() => { /* autoplay blocked or file missing */ }); }
    } else if (!bgm.paused) {
      bgm.pause();
    }
  }

  // ---------- Attract mode behind the title screen ----------
  function startAttract() {
    li = 3;
    st = Engine.parse(LEVELS[li]);
    cam.init = false;
    particles = [];
  }

  // ---------- Input ----------
  const KEYMAP = {
    ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
    KeyW: 'U', KeyS: 'D', KeyA: 'L', KeyD: 'R',
  };
  function press(dir) {
    audio();
    if (mode === 'intro') { clearOverlay(); setMode('play'); }
    if (mode !== 'play') return;
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
    held.push(dir);
    queued = dir;
  }
  function release(dir) {
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
  }

  window.addEventListener('keydown', (e) => {
    const dir = KEYMAP[e.code];
    if (dir) {
      // Arrow keys move the explorer; let them drive menu focus only when a card is up
      if (mode === 'play' || mode === 'intro') { e.preventDefault(); if (!e.repeat) press(dir); }
      return;
    }
    if (e.code === 'Space' && (mode === 'play' || mode === 'intro')) e.preventDefault();
    if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (mode === 'play') pauseGame();
      else if (mode === 'pause') resumeGame();
    } else if (e.code === 'KeyR' && (mode === 'play' || mode === 'pause' || mode === 'dead')) {
      respawn();
    }
  });
  window.addEventListener('keyup', (e) => { const dir = KEYMAP[e.code]; if (dir) release(dir); });
  window.addEventListener('blur', () => { held.length = 0; if (mode === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pauseGame(); });

  document.querySelectorAll('.dpad button').forEach((b) => {
    const dir = b.dataset.dir;
    const down = (e) => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('on'); press(dir); };
    const up = () => { b.classList.remove('on'); release(dir); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  $('padPause').addEventListener('click', () => { if (mode === 'play') pauseGame(); else if (mode === 'pause') resumeGame(); });
  $('padRetry').addEventListener('click', () => { if (mode === 'play' || mode === 'pause' || mode === 'dead') respawn(); });
  $('levelsBtn').addEventListener('click', () => { if (mode === 'play') setMode('pause'); showSelect(); });
  $('muteBtn').addEventListener('click', toggleMute);
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) $('app').classList.add('touch');

  function toggleMute() {
    muted = !muted;
    save.muted = muted;
    writeSave();
    $('muteBtn').textContent = muted ? 'Sound: off' : 'Sound: on';
    $('muteBtn').setAttribute('aria-pressed', String(muted));
    syncMusic();
    if (!muted) SFX.gem();
  }
  $('muteBtn').textContent = muted ? 'Sound: off' : 'Sound: on';

  // ---------- Overlays ----------
  function iconURL(sprite) {
    const c = document.createElement('canvas');
    c.width = TS; c.height = TS;
    c.getContext('2d').drawImage(sprite, 0, 0);
    return c.toDataURL();
  }
  const ICON = { gem: iconURL(SPR.gem[0]), key: iconURL(SPR.key[0]), ruby: iconURL(SPR.ruby[0]) };
  $('icGem').src = ICON.gem; $('icKey').src = ICON.key; $('icRuby').src = ICON.ruby;

  function card(html, cls = '') {
    overlay.className = 'overlay ' + cls;
    overlay.hidden = false;
    overlay.innerHTML = `<div class="card">${html}</div>`;
    const first = overlay.querySelector('[data-primary]') || overlay.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }
  function clearOverlay() { overlay.hidden = true; overlay.innerHTML = ''; }
  function on(id, fn) { const el = overlay.querySelector('#' + id); if (el) el.addEventListener('click', fn); }

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function showTitle() {
    setMode('title');
    startAttract();
    const next = Math.min(save.unlocked, LEVELS.length) - 1;
    const fresh = !Object.keys(save.best).length;
    card(`
      <p class="eyebrow">A temple full of gems and falling stone</p>
      <h2 class="title">Diamond Hunter</h2>
      <p>Dig through the jungle temple, collect gems, and get out before the boulders get you.</p>
      <div class="btns">
        <button class="btn primary" id="cPlay" data-primary type="button">${fresh ? 'Start adventure' : `Continue: level ${next + 1}`}</button>
        <button class="btn" id="cSel" type="button">Choose level</button>
      </div>
      <p class="sub">${LEVELS.length} levels. Find the hidden ruby in each one.</p>`, 'clear');
    on('cPlay', () => startLevel(next));
    on('cSel', showSelect);
  }

  function showSelect() {
    if (mode !== 'pause') setMode('select');
    if (!st) startAttract();
    const items = LEVELS.map((lv, i) => {
      const b = save.best[i];
      const locked = i + 1 > save.unlocked;
      const status = locked ? 'Locked'
        : b ? `${fmt(b.time)}${b.ruby ? ` <img src="${ICON.ruby}" alt="Ruby found">` : ''}`
        : 'Not cleared';
      return `<button class="lv" type="button" data-lv="${i}" ${locked ? 'disabled' : ''}>
        <span class="n">${i + 1}</span><span class="nm">${lv.name}</span><span class="st">${status}</span></button>`;
    }).join('');
    const back = mode === 'pause' ? 'Back to game' : 'Back';
    card(`<p class="eyebrow">Choose a level</p>
      <div class="levels">${items}</div>
      <div class="btns"><button class="btn" id="cBack" type="button">${back}</button></div>
      <p class="sub">Clear a level to unlock the next one.</p>`);
    overlay.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.lv))));
    const firstOpen = overlay.querySelector(`[data-lv="${Math.min(save.unlocked, LEVELS.length) - 1}"]`);
    if (firstOpen) firstOpen.focus({ preventScroll: true });
    on('cBack', () => { if (mode === 'pause') showPause(); else showTitle(); });
  }

  function showIntroCard() {
    setMode('intro');
    const lv = LEVELS[li];
    card(`<p class="eyebrow">Level ${li + 1} of ${LEVELS.length}</p>
      <h2>${lv.name}</h2>
      <p>${lv.hint}</p>
      <p class="sub">Collect ${lv.need} gems to open the exit.</p>
      <div class="btns"><button class="btn primary" id="cGo" data-primary type="button">Start</button></div>
      <p class="sub">Or press any arrow key.</p>`, 'clear');
    on('cGo', () => { audio(); clearOverlay(); setMode('play'); });
  }

  function pauseGame() {
    setMode('pause');
    held.length = 0;
    showPause();
  }
  function showPause() {
    card(`<p class="eyebrow">Paused</p><h2>${LEVELS[li].name}</h2>
      <div class="btns">
        <button class="btn primary" id="cRes" data-primary type="button">Resume</button>
        <button class="btn" id="cCp" type="button">${checkpoint ? 'Back to checkpoint' : 'Restart level'}</button>
        ${checkpoint ? '<button class="btn" id="cRst" type="button">Restart level</button>' : ''}
        <button class="btn" id="cSel" type="button">Levels</button>
      </div>
      <p class="sub">Stuck behind a boulder? Go back to your last checkpoint.</p>`);
    on('cRes', resumeGame);
    on('cCp', respawn);
    on('cRst', () => startLevel(li, false));
    on('cSel', showSelect);
  }
  function resumeGame() { clearOverlay(); setMode('play'); lastFrame = performance.now(); }

  const CAUSE = {
    crush: 'A boulder came down on you.',
    enemy: 'A temple creature caught you.',
    spike: 'The spikes caught you.',
    held: 'You held the boulder too long and it crushed you.',
  };
  function showDead() {
    card(`<p class="eyebrow">You died</p><h2>${CAUSE[st.cause] || 'Ouch.'}</h2>
      <div class="btns">
        <button class="btn primary" id="cCp" data-primary type="button">${checkpoint ? 'Back to checkpoint' : 'Try again'}</button>
        ${checkpoint ? '<button class="btn" id="cRst" type="button">Restart level</button>' : ''}
      </div>
      <p class="sub">Press R to try again.</p>`);
    on('cCp', respawn);
    on('cRst', () => startLevel(li, false));
  }

  function completeLevel() {
    setMode('won');
    const prev = save.best[li];
    const ruby = st.red >= st.totalRed && st.totalRed > 0;
    const newBest = !prev || run.time < prev.time;
    save.best[li] = {
      time: newBest ? run.time : prev.time,
      ruby: ruby || (prev && prev.ruby) || false,
      deaths: prev ? Math.min(prev.deaths, run.deaths) : run.deaths,
    };
    save.unlocked = Math.max(save.unlocked, li + 2);
    writeSave();
    const last = li === LEVELS.length - 1;
    card(`<p class="eyebrow">Level ${li + 1} cleared</p><h2>${LEVELS[li].name}</h2>
      <dl class="stats">
        <dt>Time</dt><dd>${fmt(run.time)}</dd>
        <dt>Gems</dt><dd>${st.gems} of ${st.totalGems}</dd>
        <dt>Ruby</dt><dd>${st.totalRed ? (ruby ? 'Found' : 'Missed') : 'None here'}</dd>
        <dt>Deaths</dt><dd>${run.deaths}</dd>
      </dl>
      ${newBest && prev ? '<p class="tag">New best time</p>' : ''}
      <div class="btns">
        <button class="btn primary" id="cNext" data-primary type="button">${last ? 'Finish' : 'Next level'}</button>
        <button class="btn" id="cAgain" type="button">Play again</button>
        <button class="btn" id="cSel" type="button">Levels</button>
      </div>`);
    on('cNext', () => (last ? showDone() : startLevel(li + 1)));
    on('cAgain', () => startLevel(li));
    on('cSel', showSelect);
  }

  function showDone() {
    setMode('done');
    const bests = Object.values(save.best);
    const total = bests.reduce((a, b) => a + b.time, 0);
    const rubies = bests.filter((b) => b.ruby).length;
    const rubyLevels = LEVELS.filter((lv) => lv.map.some((r) => r.includes('R'))).length;
    card(`<p class="eyebrow">The temple is conquered</p><h2>You reached the Heart of the Temple</h2>
      <dl class="stats">
        <dt>Total best time</dt><dd>${fmt(total)}</dd>
        <dt>Rubies</dt><dd>${rubies} of ${rubyLevels}</dd>
      </dl>
      <p>${rubies < rubyLevels ? 'Some rubies are still hidden in the ruins. Go back and find them.' : 'Every ruby found. A true diamond hunter.'}</p>
      <div class="btns">
        <button class="btn primary" id="cSel" data-primary type="button">Levels</button>
        <button class="btn" id="cTitle" type="button">Title screen</button>
      </div>`);
    on('cSel', showSelect);
    on('cTitle', showTitle);
  }

  let toastTimer = 0;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => { t.hidden = true; }, 300); }, 1600);
  }

  // ---------- HUD ----------
  const hudCache = {};
  function setText(id, v, cls) {
    if (hudCache[id] === v + (cls || '')) return;
    hudCache[id] = v + (cls || '');
    const el = $(id);
    el.textContent = v;
    if (cls !== undefined) el.className = cls;
  }
  function updateHud() {
    if (!st) return;
    const inLevel = mode !== 'title' && mode !== 'select';
    if (!inLevel) {
      setText('hGems', '-', 'dim'); setText('hKeys', '-', 'dim'); setText('hRuby', '-', 'dim');
      setText('hTime', '0:00'); setText('hDeaths', '0'); setText('hLevel', '');
      return;
    }
    setText('hGems', `${st.gems}/${st.need}`, st.gems >= st.need ? 'ok' : '');
    setText('hKeys', String(st.keys), st.keys ? '' : 'dim');
    setText('hRuby', `${st.red}/${st.totalRed}`, st.red >= st.totalRed ? 'ok' : '');
    setText('hTime', fmt(run.time));
    setText('hDeaths', String(run.deaths));
    setText('hLevel', `${li + 1}. ${LEVELS[li].name}`);
  }

  // ---------- Particles ----------
  function burst(x, y, color, n, speed = 1) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * speed;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 26 + Math.random() * 14, color });
    }
  }

  function handleEvents() {
    const cx = st.px * TS + 8, cy = st.py * TS + 8;
    const seen = new Set();
    for (const e of st.events) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (SFX[e]) SFX[e]();
      if (e === 'gem') burst(cx, cy, '#bdf6ff', 8);
      else if (e === 'red') { burst(cx, cy, '#ff9aa8', 14, 1.4); toast('Hidden ruby found'); }
      else if (e === 'key') burst(cx, cy, '#fff0a8', 8);
      else if (e === 'dig') burst(cx, cy, '#8a6238', 5, 0.6);
      else if (e === 'door') burst(cx, cy, '#e8b84a', 10);
      else if (e === 'land') { if (!reduceMotion) shake = Math.max(shake, 3); }
      else if (e === 'squash') { for (let i = 0; i < st.t.length; i++) if (st.t[i] === T.GEM && st.moved[i] && st.mv[i] < 0) burst((i % st.w) * TS + 8, Math.floor(i / st.w) * TS + 8, '#a888d0', 14, 1.3); }
      else if (e === 'check') { checkpoint = Engine.clone(st); burst(cx, cy, '#7ff0ff', 16, 1.2); toast('Checkpoint reached'); }
      else if (e === 'die') { run.deaths++; deathAt = performance.now(); setMode('dead'); burst(cx, cy, '#ef5a6c', 18, 1.5); }
      else if (e === 'win') { setTimeout(completeLevel, 450); setMode('won'); }
    }
  }

  // ---------- World update ----------
  function tickWorld() {
    if (mode === 'play') {
      const dir = held.length ? held[held.length - 1] : queued;
      queued = null;
      Engine.step(st, dir);
      handleEvents();
    } else if (mode === 'title' || mode === 'select') {
      Engine.step(st, null);
      st.events.length = 0;
    }
  }

  // ---------- Rendering ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }

  function entityPos(i, a) {
    const x = i % st.w, y = (i / st.w) | 0;
    const from = st.mv[i];
    if (from < 0 || a >= 1) return [x * TS, y * TS];
    const fx = from % st.w, fy = (from / st.w) | 0;
    return [(fx + (x - fx) * a) * TS, (fy + (y - fy) * a) * TS];
  }

  function render(now, a) {
    const W = st.w, H = st.h;
    // Camera follows the explorer, eased, clamped to the map
    const [ppx, ppy] = entityPos(st.py * W + st.px, a);
    const maxX = Math.max(0, W * TS - VW * TS), maxY = Math.max(0, H * TS - VH * TS);
    const tx = Math.min(maxX, Math.max(0, ppx + 8 - (VW * TS) / 2));
    const ty = Math.min(maxY, Math.max(0, ppy + 8 - (VH * TS) / 2));
    if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
    cam.x += (tx - cam.x) * 0.18;
    cam.y += (ty - cam.y) * 0.18;
    let ox = Math.round(cam.x), oy = Math.round(cam.y);
    if (W * TS < VW * TS) ox = -Math.floor((VW * TS - W * TS) / 2);
    if (H * TS < VH * TS) oy = -Math.floor((VH * TS - H * TS) / 2);
    if (shake > 0) { ox += Math.round((Math.random() - 0.5) * shake); oy += Math.round((Math.random() - 0.5) * shake); shake *= 0.8; if (shake < 0.5) shake = 0; }

    ctx.fillStyle = '#050806';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const x0 = Math.max(0, Math.floor(ox / TS) - 1), x1 = Math.min(W - 1, Math.floor((ox + VW * TS) / TS) + 1);
    const y0 = Math.max(0, Math.floor(oy / TS) - 1), y1 = Math.min(H - 1, Math.floor((oy + VH * TS) / TS) + 1);
    const exitOpen = st.gems >= st.need;
    const frame = Math.floor(now / 220) % 2;

    // Pass 1: floor, walls, soil, doors, exits and floor overlays
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, c = st.t[i], sx = x * TS - ox, sy = y * TS - oy, hsh = hash(x, y);
        if (c === T.WALL) { ctx.drawImage(SPR.wall[hsh % SPR.wall.length], sx, sy); continue; }
        ctx.drawImage(SPR.bg[hsh % SPR.bg.length], sx, sy);
        if (c === T.DIRT) ctx.drawImage(SPR.soil[hsh % SPR.soil.length], sx, sy);
        else if (c === T.DOOR) ctx.drawImage(SPR.door, sx, sy);
        else if (c === T.EXIT) {
          ctx.drawImage(exitOpen ? SPR.exitOpen : SPR.exitClosed, sx, sy);
          if (exitOpen) {
            ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now / 180);
            ctx.fillStyle = '#ffe9a0';
            ctx.fillRect(sx - 2, sy - 2, TS + 4, TS + 4);
            ctx.globalAlpha = 1;
          }
        }
        const ov = st.ov[i];
        if (ov === OV.SPIKE) {
          const s = Engine.spikeUp(st, i) ? 'up' : Engine.spikeWarn(st, i) ? 'warn' : 'down';
          ctx.drawImage(SPR.spike[s], sx, sy);
        } else if (ov === OV.CHECK) {
          ctx.drawImage(SPR.check[st.cp[i] ? 1 : 0], sx, sy);
        }
      }
    }

    // Pass 2: things that move, at their in-between positions
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, c = st.t[i];
        let img = null;
        switch (c) {
          case T.BOULDER: img = SPR.boulder[0]; break;
          case T.GEM: img = SPR.gem[0]; break;
          case T.RED: img = SPR.ruby[0]; break;
          case T.KEY: img = SPR.key[0]; break;
          case T.BAT: img = (st.d[i] < 0 ? SPR.batL : SPR.bat)[frame]; break;
          case T.SPIDER: img = SPR.spider[frame]; break;
          default: break;
        }
        if (!img) continue;
        let [ex, ey] = entityPos(i, a);
        let bob = 0;
        if (c === T.KEY) bob = Math.round(Math.sin(now / 260 + x) * 1.5);
        // The boulder on the explorer's head shakes harder the longer it is held
        const strain = c === T.BOULDER && st.alive && i === (st.py - 1) * W + st.px ? st.hold / Engine.HOLD_TICKS : 0;
        if (strain > 0.15 && !reduceMotion) ex += Math.round((Math.random() - 0.5) * 4 * strain);
        ctx.drawImage(img, Math.round(ex - ox), Math.round(ey - oy) + bob);
        if (strain > 0.15) {
          ctx.globalAlpha = strain * (0.35 + 0.25 * Math.sin(now / (reduceMotion ? 300 : 60)));
          ctx.fillStyle = '#ef5a6c';
          ctx.fillRect(Math.round(ex - ox) + 2, Math.round(ey - oy) + 2, TS - 4, TS - 3);
          ctx.globalAlpha = 1;
        }
        if ((c === T.GEM || c === T.RED) && (hash(x, y) + Math.floor(now / 90)) % 23 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(ex - ox) + 5, Math.round(ey - oy) + 5, 1, 1);
          ctx.fillRect(Math.round(ex - ox) + 4, Math.round(ey - oy) + 6, 3, 1);
          ctx.fillRect(Math.round(ex - ox) + 5, Math.round(ey - oy) + 7, 1, 1);
        }
      }
    }
    // The explorer is drawn last so falling things pass behind, and always even when dying
    {
      const i = st.py * W + st.px;
      const [ex, ey] = entityPos(i, a);
      const walking = st.mv[i] >= 0 && a < 1;
      const set = st.face < 0 ? SPR.playerL : SPR.player;
      const img = set[walking ? Math.floor(a * 2) % 2 : 0];
      if (!st.alive) {
        const t = deathAt ? Math.min(1, (now - deathAt) / 700) : 1;
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(img, Math.round(ex - ox), Math.round(ey - oy - t * 10));
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(img, Math.round(ex - ox), Math.round(ey - oy));
      }
    }

    // Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function stepParticles() {
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; }
    particles = particles.filter((p) => p.life > 0);
  }

  // ---------- Main loop ----------
  function frame(now) {
    const dt = Math.min(250, now - (lastFrame || now));
    lastFrame = now;
    const ticking = mode === 'play' || mode === 'title' || mode === 'select';
    if (ticking) {
      acc += dt;
      if (mode === 'play') run.time += dt;
      while (acc >= TICK) {
        acc -= TICK;
        tickWorld();
        if (mode !== 'play' && mode !== 'title' && mode !== 'select') { acc = 0; break; }
      }
      // Attract world: restart the demo if a bat ever catches the idle explorer
      if ((mode === 'title' || mode === 'select') && !st.alive) startAttract();
    }
    if (mode === 'dead' && deathAt && now - deathAt > 750) { deathAt = 0; showDead(); }
    stepParticles();
    render(now, ticking ? acc / TICK : 1);
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  function start(data) {
    if (data && typeof data.li === 'number' && data.mode === 'play' && LEVELS[data.li]) {
      startLevel(data.li, false);
      pauseGame();
    } else {
      showTitle();
    }
    requestAnimationFrame(frame);
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ li, mode: mode === 'pause' || mode === 'play' ? 'play' : mode }));
  if (hot && hot.ready) hot.ready(start); else start(hot && hot.data ? hot.data : {});
})();
