/* Paper World — jogo de conquista de território (HTML5 Canvas, sem dependências) */
'use strict';
(function () {
  const COUNTRIES = window.COUNTRIES;
  const UNLOCK_AT = 50;          // % necessária num país para liberar o próximo
  const SPEED = 8.2;             // células por segundo
  const PLAYER_TURN = 7.5;       // rad/s
  const BOT_TURN = 6.5;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  // ------------------------------------------------------------------ save
  const SAVE_KEY = 'paperworld.save.v1';
  const save = Object.assign(
    { coins: 0, skin: 'classic', owned: ['classic'], progress: {}, name: 'Você', sound: true, country: 0, games: 0 },
    (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })()
  );
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sem storage */ } }
  const prog = (ci) => save.progress[COUNTRIES[ci].id] || 0;
  const unlocked = (ci) => ci === 0 || prog(ci - 1) >= UNLOCK_AT;

  // ------------------------------------------------------------------ cores / skins
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shade(h, a) {
    const f = (v) => Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a);
    const [r, g, b] = rgb(h); return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const SKINS = [
    { id: 'classic', name: 'Clássico', price: 0, color: '#3b82f6', pat: 'none' },
    { id: 'menta', name: 'Menta', price: 60, color: '#14b8a6', pat: 'dots' },
    { id: 'uva', name: 'Uva', price: 100, color: '#a855f7', pat: 'dots' },
    { id: 'melancia', name: 'Melancia', price: 150, color: '#ef4444', pat: 'seeds' },
    { id: 'mel', name: 'Favo de Mel', price: 200, color: '#f59e0b', pat: 'hex' },
    { id: 'alien', name: 'Alien', price: 220, color: '#22c55e', pat: 'alien' },
    { id: 'vaca', name: 'Vaca', price: 250, color: '#f1f5f9', pat: 'spots', dark: '#94a3b8', light: '#ffffff' },
    { id: 'unicornio', name: 'Unicórnio', price: 300, color: '#f9a8d4', pat: 'stars' },
    { id: 'lava', name: 'Lava', price: 350, color: '#f97316', pat: 'stripes' },
    { id: 'carvao', name: 'Carvão', price: 400, color: '#334155', pat: 'dots' },
    { id: 'galaxia', name: 'Galáxia', price: 500, color: '#4c1d95', pat: 'stars' },
    { id: 'ouro', name: 'Ouro', price: 800, color: '#facc15', pat: 'stars' },
  ];
  const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
  const BOT_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
    '#a855f7', '#ec4899', '#f43f5e', '#0ea5e9', '#92400e', '#64748b', '#d946ef'];
  const BOT_PATS = ['none', 'none', 'dots', 'stripes', 'spots', 'stars', 'hex', 'seeds', 'none'];
  const NAMES = ['Maiamii', 'Rope', 'Tizio_Tok', 'Kara', 'Lobo', 'Zeca', 'Bia_', 'Nando', 'Pixel', 'Tuca', 'Dudu', 'Lulu', 'Gugu',
    'Neo', 'Kiko', 'Mel', 'Rafa', 'Juju', 'Caio', 'Vivi', 'Toddy', 'Xuxa_br', 'Mago', 'Nina', 'Cacau', 'Tigrão', 'Pipoca', 'Ventania',
    'Bolt', 'Zara', 'Fofo', 'Duda', 'Sushi', 'Paçoca', 'Ninja', 'Yuki', 'Sombra', 'Turbo', 'Cometa', 'Lili'];

  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  // gera um ladrilho de textura (repete) para o território
  function makeTile(color, pat, S) {
    const T = S * 8, c = document.createElement('canvas'); c.width = c.height = T;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, T, T);
    const lt = shade(color, 0.3), dk = shade(color, -0.22);
    const at = (fx, fy, fn) => { for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) fn(fx * T + ox, fy * T + oy); };
    switch (pat) {
      case 'dots': g.fillStyle = lt; [[.25, .25], [.75, .75]].forEach(([x, y]) => at(x, y, (a, b) => { g.beginPath(); g.arc(a, b, S * .55, 0, TAU); g.fill(); })); break;
      case 'seeds': g.fillStyle = '#2b1b1b';
        [[.2, .2, .4], [.65, .35, -.3], [.4, .75, .2], [.85, .85, .6]].forEach(([x, y, r]) => at(x, y, (a, b) => {
          g.save(); g.translate(a, b); g.rotate(r); g.beginPath(); g.ellipse(0, 0, S * .32, S * .55, 0, 0, TAU); g.fill(); g.restore();
        })); break;
      case 'hex': {
        g.strokeStyle = dk; g.lineWidth = S * .4; const R = T / 4;
        for (let row = -1; row < 4; row++) for (let col = -1; col < 4; col++) {
          const x = col * R * 2 + (row % 2 ? R : 0), y = row * R * 1.0;
          g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + Math.cos(a) * R * .62, y + Math.sin(a) * R * .62); }
          g.closePath(); g.stroke();
        }
        break;
      }
      case 'alien': [[.28, .3], [.75, .72]].forEach(([x, y]) => at(x, y, (a, b) => {
        g.fillStyle = dk; g.beginPath(); g.ellipse(a, b, S * .9, S * 1.05, 0, 0, TAU); g.fill();
        g.fillStyle = '#123'; g.beginPath(); g.ellipse(a - S * .35, b, S * .25, S * .38, -.4, 0, TAU); g.ellipse(a + S * .35, b, S * .25, S * .38, .4, 0, TAU); g.fill();
      })); break;
      case 'spots': g.fillStyle = '#1f2937';
        [[.25, .3, 1.3], [.72, .62, 1.0], [.2, .82, .7]].forEach(([x, y, r]) => at(x, y, (a, b) => {
          g.beginPath(); g.ellipse(a, b, S * r, S * r * .75, .5, 0, TAU); g.fill();
        })); break;
      case 'stars': {
        const cols = color === '#4c1d95' ? ['#fff', '#c4b5fd', '#fde68a'] : color === '#facc15' ? ['#fff7cc', '#fff', '#fde047'] : ['#fff', '#fde047', '#67e8f9', '#f472b6'];
        [[.2, .2], [.7, .3], [.45, .65], [.85, .85], [.1, .7]].forEach(([x, y], i) => at(x, y, (a, b) => { g.fillStyle = cols[i % cols.length]; star(g, a, b, S * .55); }));
        break;
      }
      case 'stripes': g.strokeStyle = lt; g.lineWidth = S * .9;
        for (let k = -T; k <= 2 * T; k += T / 2) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + T, T); g.stroke(); }
        break;
    }
    return c;
  }

  // ------------------------------------------------------------------ áudio
  let actx = null;
  function beep(freq, dur, type = 'sine', vol = 0.08, slide = 0) {
    if (!save.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* sem áudio */ }
  }
  const sfx = {
    capture: (big) => { beep(520, .12, 'triangle', .07, 300); if (big) setTimeout(() => beep(780, .15, 'triangle', .06, 400), 70); },
    kill: () => { beep(300, .25, 'square', .05, -200); setTimeout(() => beep(900, .12, 'triangle', .05, 300), 80); },
    die: () => beep(220, .5, 'sawtooth', .06, -170),
    click: () => beep(660, .06, 'triangle', .05),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2, 'triangle', .07), i * 120)),
  };

  // ------------------------------------------------------------------ canvas principal
  const cv = $('game'), ctx = cv.getContext('2d');
  let DPR = 1, VW = 0, VH = 0, Z = 14;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
    Z = clamp(Math.sqrt(VW * VH) / 42, 11, 17);
    const mm = $('minimap'); mm.width = 140 * DPR; mm.height = 100 * DPR;
    if (state === 'menu') drawMenuShape();
  }
  addEventListener('resize', resize);

  // ------------------------------------------------------------------ mundo
  let W = 0, H = 0, S = 8, own = null, trail = null, landCount = 0;
  let landCv = null, terrCv = null, tctx = null;
  let queue = null, mark = null, gen = 1;
  let ents = [], player = null, level = 0, time = 0;
  let state = 'menu', paused = false;
  const cam = { x: 0, y: 0 };
  let particles = [];
  const WATER = 255;

  const isLandXY = (x, y) => { const cx = x | 0, cy = y | 0; return x >= 0 && y >= 0 && cx < W && cy < H && own[cy * W + cx] !== WATER; };
  const isLandCell = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H && own[cy * W + cx] !== WATER;

  function buildMap(ci) {
    const p = COUNTRIES[ci].pts, n = p.length / 2;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, area = 0;
    for (let i = 0; i < n; i++) {
      const x = p[2 * i], y = p[2 * i + 1];
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      const j = (i + n - 1) % n; area += p[2 * j] * y - x * p[2 * j + 1];
    }
    area = Math.abs(area) / 2;
    const target = Math.min(50000, 22000 + ci * 1500);
    const k = Math.sqrt(target / area), M = 8;
    W = Math.ceil((maxx - minx) * k) + 2 * M; H = Math.ceil((maxy - miny) * k) + 2 * M;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.beginPath();
    for (let i = 0; i < n; i++) g.lineTo((p[2 * i] - minx) * k + M, (p[2 * i + 1] - miny) * k + M);
    g.closePath(); g.fill();
    const d = g.getImageData(0, 0, W, H).data;
    own = new Uint8Array(W * H).fill(WATER);
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 127) own[i] = 0;
    trail = new Uint8Array(W * H);
    queue = new Int32Array(W * H); mark = new Uint32Array(W * H); gen = 1;
    // mantém só a maior região contínua de terra
    const label = new Int32Array(W * H); let best = 0, bestId = 0, id = 0;
    for (let i = 0; i < W * H; i++) {
      if (own[i] !== 0 || label[i]) continue;
      id++; let qh = 0, qt = 0, cnt = 0; queue[qt++] = i; label[i] = id;
      while (qh < qt) {
        const c2 = queue[qh++]; cnt++; const x = c2 % W, y = (c2 / W) | 0;
        const nb = [x > 0 ? c2 - 1 : -1, x < W - 1 ? c2 + 1 : -1, y > 0 ? c2 - W : -1, y < H - 1 ? c2 + W : -1];
        for (const q of nb) if (q >= 0 && own[q] === 0 && !label[q]) { label[q] = id; queue[qt++] = q; }
      }
      if (cnt > best) { best = cnt; bestId = id; }
    }
    landCount = 0;
    for (let i = 0; i < W * H; i++) { if (own[i] === 0 && label[i] !== bestId) own[i] = WATER; if (own[i] === 0) landCount++; }
    // resolução das texturas (limita memória em celulares)
    S = clamp(Math.floor(Math.sqrt(6.5e6 / (W * H))), 4, 9);
  }

  function renderLand() {
    landCv = document.createElement('canvas'); landCv.width = W * S; landCv.height = H * S;
    const g = landCv.getContext('2d');
    const foam1 = new Path2D(), foam2 = new Path2D();
    const land = msPaths(0, 0, W - 1, H - 1, (x, y) => (x < 0 || y < 0 || x >= W || y >= H || own[y * W + x] === WATER) ? 0 : 1).get(1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (own[i] === WATER) continue;
      const cx = (x + .5) * S, cy = (y + .5) * S;
      const edge = own[i - 1] === WATER || own[i + 1] === WATER || own[i - W] === WATER || own[i + W] === WATER;
      if (edge) { foam1.moveTo(cx + S * 2.4, cy); foam1.arc(cx, cy, S * 2.4, 0, TAU); foam2.moveTo(cx + S * 1.3, cy); foam2.arc(cx, cy, S * 1.3, 0, TAU); }
    }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(foam1);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(foam2);
    g.lineJoin = 'round'; g.lineWidth = S * .34;
    g.save(); g.translate(0, S * .7); g.fillStyle = g.strokeStyle = '#9fd3c0'; g.fill(land); g.stroke(land); g.restore();
    g.fillStyle = g.strokeStyle = '#eefaf4'; g.fill(land); g.stroke(land);
    terrCv = document.createElement('canvas'); terrCv.width = W * S; terrCv.height = H * S;
    tctx = terrCv.getContext('2d');
  }

  // contorno suave por "marching squares": um Path2D por dono
  function msPaths(x0, y0, x1, y1, get) {
    const paths = new Map(), h = S / 2;
    const pts = new Array(16);
    for (let ly = y0 - 1; ly <= y1; ly++) for (let lx = x0 - 1; lx <= x1; lx++) {
      const ka = get(lx, ly), kb = get(lx + 1, ly), kc = get(lx + 1, ly + 1), kd = get(lx, ly + 1);
      if (!(ka | kb | kc | kd)) continue;
      const X = (lx + .5) * S, Y = (ly + .5) * S;
      for (const k of [ka, kb, kc, kd]) {
        if (!k) continue;
        let p = paths.get(k);
        if (p && p._last === ly * W + lx + 1) continue; // já desenhado neste quadrado
        if (!p) { p = new Path2D(); paths.set(k, p); }
        p._last = ly * W + lx + 1;
        const a = ka === k, b = kb === k, c = kc === k, d = kd === k;
        if (a && b && c && d) { p.rect(X, Y, S, S); continue; }
        let n = 0;
        if (a) { pts[n++] = X; pts[n++] = Y; }
        if (a !== b) { pts[n++] = X + h; pts[n++] = Y; }
        if (b) { pts[n++] = X + S; pts[n++] = Y; }
        if (b !== c) { pts[n++] = X + S; pts[n++] = Y + h; }
        if (c) { pts[n++] = X + S; pts[n++] = Y + S; }
        if (c !== d) { pts[n++] = X + h; pts[n++] = Y + S; }
        if (d) { pts[n++] = X; pts[n++] = Y + S; }
        if (d !== a) { pts[n++] = X; pts[n++] = Y + h; }
        p.moveTo(pts[0], pts[1]); for (let q = 2; q < n; q += 2) p.lineTo(pts[q], pts[q + 1]); p.closePath();
      }
    }
    return paths;
  }
  const ownerAt = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 0; const o = own[y * W + x]; return o === WATER ? 0 : o; };

  // redesenha o território numa região retangular (em células)
  function redraw(x0, y0, x1, y1) {
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
    const c = tctx; c.save();
    c.beginPath(); c.rect(x0 * S, y0 * S, (x1 - x0 + 1) * S, (y1 - y0 + 1) * S); c.clip();
    c.clearRect(x0 * S, y0 * S, (x1 - x0 + 1) * S, (y1 - y0 + 1) * S);
    const paths = msPaths(Math.max(0, x0 - 1), Math.max(0, y0 - 2), Math.min(W - 1, x1 + 1), Math.min(H - 1, y1 + 1), ownerAt);
    c.lineJoin = 'round'; c.lineWidth = S * 0.34;
    c.save(); c.translate(0, S * 0.45);
    for (const [o, pth] of paths) { c.fillStyle = c.strokeStyle = ents[o].dark; c.fill(pth); c.stroke(pth); }
    c.restore();
    for (const [o, pth] of paths) {
      const e = ents[o]; if (!e.pattern) e.pattern = c.createPattern(e.tile, 'repeat');
      c.fillStyle = c.strokeStyle = e.pattern; c.fill(pth); c.stroke(pth);
    }
    c.restore();
  }

  // ------------------------------------------------------------------ entidades
  function makeEnt(id, o) {
    const e = {
      id, name: o.name, isPlayer: !!o.isPlayer, color: o.color, dark: o.dark || shade(o.color, -0.3), light: o.light || shade(o.color, 0.45),
      tile: makeTile(o.color, o.pat, S), pattern: null,
      x: 0, y: 0, cx: -1, cy: -1, ang: 0, targetAng: 0, turn: o.isPlayer ? PLAYER_TURN : BOT_TURN, speed: SPEED,
      alive: false, trail: [], pts: [], count: 0, bb: null, kills: 0, respawnT: 0, combo: 0, lastKill: -9,
      ai: o.ai || null, spawnT: 0,
    };
    return e;
  }
  const growBB = (e, x, y) => { const b = e.bb; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; };

  function spawn(e, prefCenter) {
    const R = 3;
    for (let attempt = 0; attempt < 400; attempt++) {
      let cx, cy;
      if (prefCenter && attempt < 150) { cx = (W / 2 + rand(-W / 5, W / 5)) | 0; cy = (H / 2 + rand(-H / 5, H / 5)) | 0; }
      else { cx = (rand(R + 1, W - R - 1)) | 0; cy = (rand(R + 1, H - R - 1)) | 0; }
      let ok = true;
      for (let dy = -R - 1; dy <= R + 1 && ok; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
        const x = cx + dx, y = cy + dy; if (!isLandCell(x, y)) { ok = false; break; }
        const i = y * W + x; if (own[i] !== 0 || trail[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (const o of ents) if (o && o !== e && o.alive && Math.hypot(o.x - cx, o.y - cy) < 14) { ok = false; break; }
      if (!ok) continue;
      e.bb = { x0: cx, y0: cy, x1: cx, y1: cy }; e.count = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R + 1) continue;
        const i = (cy + dy) * W + cx + dx; own[i] = e.id; e.count++; growBB(e, cx + dx, cy + dy);
      }
      e.x = cx + .5; e.y = cy + .5; e.cx = cx; e.cy = cy; e.ang = e.targetAng = rand(0, TAU);
      e.alive = true; e.trail = []; e.pts = []; e.spawnT = time;
      if (e.ai) { e.ai.mode = 'home'; e.ai.plan = null; e.ai.homeT = 0; }
      redraw(e.bb.x0, e.bb.y0, e.bb.x1, e.bb.y1);
      return true;
    }
    return false;
  }

  function burst(x, y, color, n = 26) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(2, 9);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.5, 1), max: 1, color, size: rand(.25, .6) });
    }
  }

  function kill(v, killer, cause) {
    if (!v.alive) return;
    v.alive = false;
    for (const i of v.trail) if (trail[i] === v.id) trail[i] = 0;
    v.trail = []; v.pts = [];
    const b = v.bb;
    if (b) {
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = y * W + x; if (own[i] === v.id) own[i] = 0; }
      redraw(b.x0, b.y0, b.x1, b.y1);
    }
    v.count = 0;
    burst(v.x, v.y, v.color, 34);
    if (killer && killer !== v) {
      killer.kills++;
      if (killer.isPlayer) {
        killer.combo = time - killer.lastKill < 4 ? killer.combo + 1 : 1; killer.lastKill = time;
        const T = ['', 'ABATE!', 'DUPLO ABATE!', 'TRIPLO ABATE!', 'IMPARÁVEL!', 'LENDÁRIO!'];
        showCombo(T[Math.min(5, killer.combo)], v.name); sfx.kill();
        shake = 0.25;
      }
    }
    if (v.isPlayer) {
      sfx.die(); shake = 0.4;
      deathCause = cause === 'self' ? 'Você bateu no próprio rastro!' : killer ? `${killer.name} te pegou!` : 'Você foi eliminado.';
      overT = 1.3;
    } else {
      v.respawnT = rand(2.5, 5);
    }
  }

  function capture(e) {
    const tr = e.trail;
    for (const i of tr) {
      if (trail[i] === e.id) trail[i] = 0;
      const prev = own[i];
      if (prev !== e.id) { if (prev > 0 && prev !== WATER) ents[prev].count--; own[i] = e.id; e.count++; growBB(e, i % W, (i / W) | 0); }
    }
    e.trail = []; e.pts = [];
    const b = e.bb;
    const x0 = Math.max(0, b.x0 - 1), y0 = Math.max(0, b.y0 - 1), x1 = Math.min(W - 1, b.x1 + 1), y1 = Math.min(H - 1, b.y1 + 1);
    gen++; if (gen > 4e9) { mark.fill(0); gen = 1; }
    let qh = 0, qt = 0;
    const push = (i) => { if (mark[i] !== gen && own[i] !== e.id) { mark[i] = gen; queue[qt++] = i; } };
    for (let x = x0; x <= x1; x++) { push(y0 * W + x); push(y1 * W + x); }
    for (let y = y0; y <= y1; y++) { push(y * W + x0); push(y * W + x1); }
    while (qh < qt) {
      const i = queue[qh++], x = i % W, y = (i / W) | 0;
      if (x > x0) push(i - 1); if (x < x1) push(i + 1); if (y > y0) push(i - W); if (y < y1) push(i + W);
    }
    let gained = tr.length; const victims = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (mark[i] === gen) continue;
      const o = own[i]; if (o === e.id || o === WATER) continue;
      if (o > 0) { ents[o].count--; victims.add(o); }
      own[i] = e.id; e.count++; gained++;
    }
    // quem ficou cercado (sem território ou com a cabeça dentro da área tomada) é eliminado
    for (const o of ents) {
      if (!o || o === e || !o.alive) continue;
      const hi = o.cy * W + o.cx;
      if (o.count <= 0 || (own[hi] === e.id && victims.has(o.id) && o.trail.length === 0)) kill(o, e, 'enc');
    }
    redraw(x0, y0, x1, y1);
    if (e.isPlayer) {
      const frac = gained / landCount;
      sfx.capture(frac > 0.01);
      if (frac > 0.02) showCombo(['INCRÍVEL!', 'PERFEITO!', 'LEGAL!', 'MANDOU BEM!'][(Math.random() * 4) | 0], '+' + (frac * 100).toFixed(1) + '%', true);
    }
  }

  function enterCell(e, cx, cy) {
    e.cx = cx; e.cy = cy;
    const i = cy * W + cx, t = trail[i];
    if (t) {
      if (t === e.id) {
        // tolera as últimas células (curvas fechadas)
        const L = e.trail.length; let recent = false;
        for (let k = Math.max(0, L - 4); k < L; k++) if (e.trail[k] === i) recent = true;
        if (recent) return;
        kill(e, null, 'self'); return;
      }
      const v = ents[t];
      if (v && v.alive && time - v.spawnT > 0.3) kill(v, e, 'cut');
    }
    if (own[i] === e.id) { if (e.trail.length) capture(e); }
    else { trail[i] = e.id; e.trail.push(i); }
  }

  function moveEntity(e, dt) {
    const da = angDiff(e.targetAng, e.ang), mt = e.turn * dt;
    e.ang += clamp(da, -mt, mt);
    if (e.ang > Math.PI) e.ang -= TAU; else if (e.ang < -Math.PI) e.ang += TAU;
    let dist = e.speed * dt;
    const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
    while (dist > 1e-6 && e.alive) {
      const st = Math.min(0.34, dist); dist -= st;
      let nx = e.x + ca * st, ny = e.y + sa * st;
      if (!isLandXY(nx, ny)) {
        if (isLandXY(nx, e.y)) ny = e.y; else if (isLandXY(e.x, ny)) nx = e.x; else break;
      }
      const px = e.x, py = e.y;
      e.x = nx; e.y = ny;
      const cx = nx | 0, cy = ny | 0;
      if (cx !== e.cx || cy !== e.cy) {
        if (cx !== e.cx && cy !== e.cy) {
          if (isLandCell(cx, e.cy)) enterCell(e, cx, e.cy); else if (isLandCell(e.cx, cy)) enterCell(e, e.cx, cy);
          if (!e.alive) break;
        }
        enterCell(e, cx, cy);
        if (!e.alive) break;
      }
      if (e.trail.length) {
        if (!e.pts.length) e.pts.push([px, py]);
        const l = e.pts[e.pts.length - 1];
        if (Math.abs(l[0] - nx) + Math.abs(l[1] - ny) > 0.35) e.pts.push([nx, ny]);
      }
    }
  }

  function headCollisions() {
    for (let a = 1; a < ents.length; a++) {
      const A = ents[a]; if (!A.alive) continue;
      for (let b = a + 1; b < ents.length; b++) {
        const B = ents[b]; if (!B.alive) continue;
        if (Math.abs(A.x - B.x) > 1 || Math.abs(A.y - B.y) > 1 || Math.hypot(A.x - B.x, A.y - B.y) > 0.85) continue;
        const aIn = own[A.cy * W + A.cx] === A.id, bIn = own[B.cy * W + B.cx] === B.id;
        if (aIn && bIn) continue;
        if (aIn) kill(B, A, 'head'); else if (bIn) kill(A, B, 'head');
        else if (A.trail.length > B.trail.length) kill(A, B, 'head'); else kill(B, A, 'head');
      }
    }
  }

  // ------------------------------------------------------------------ IA dos bots
  function nearestOwn(e, x, y, R) {
    const cx = x | 0, cy = y | 0;
    for (let r = 0; r <= R; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        if (own[Y * W + X] === e.id) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [X + .5, Y + .5]; } }
      }
      if (best) return best;
    }
    return null;
  }
  function safeAngle(e, des) {
    const offs = [0, .3, -.3, .6, -.6, .9, -.9, 1.25, -1.25, 1.6, -1.6, 2.0, -2.0, 2.5, -2.5, 3.0];
    let ownI = e.cy * W + e.cx;
    for (const o of offs) {
      const a = des + o, ca = Math.cos(a), sa = Math.sin(a); let ok = true;
      for (let k = 1; k <= 4; k++) {
        const x = e.x + ca * k * 0.75, y = e.y + sa * k * 0.75;
        if (!isLandXY(x, y)) { ok = false; break; }
        const i = (y | 0) * W + (x | 0);
        if (i !== ownI && trail[i] === e.id) { ok = false; break; }
      }
      if (ok) return a;
    }
    return des;
  }
  function onLandPt(x, y) { return isLandXY(x, y) && x > 2 && y > 2 && x < W - 2 && y < H - 2; }

  function botThink(b, dt) {
    const ai = b.ai;
    ai.t -= dt; ai.homeT += dt;
    const here = own[b.cy * W + b.cx] === b.id;
    let target = null;

    if (b.trail.length === 0) {
      if (ai.mode !== 'plan' || ai.homeT > 7) {
        // escolhe direção com mais terreno a conquistar
        let bestA = rand(0, TAU), bestS = -1;
        for (let k = 0; k < 10; k++) {
          const a = rand(0, TAU); let s = 0;
          for (let d = 4; d <= 18; d += 2) {
            const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
            if (!isLandXY(x, y)) { s -= 3; break; }
            const o = own[(y | 0) * W + (x | 0)]; if (o !== b.id) s += o === 0 ? 1 : 1.4 * ai.aggr + 0.6;
          }
          s += Math.random() * 2;
          if (s > bestS) { bestS = s; bestA = a; }
        }
        ai.mode = 'plan'; ai.plan = { dir: bestA, side: Math.random() < .5 ? 1 : -1, wp: null, k: 0 }; ai.homeT = 0;
      }
    } else if (ai.mode === 'plan' && !ai.plan.wp) {
      // acabou de sair: monta o laço (ida, lado, volta)
      const p = ai.plan, d = p.dir, sd = d + p.side * Math.PI / 2;
      let L1 = rand(4, ai.greed), L2 = rand(4, ai.greed);
      for (let t = 0; t < 4; t++) {
        const A = [b.x + Math.cos(d) * L1, b.y + Math.sin(d) * L1];
        const B = [A[0] + Math.cos(sd) * L2, A[1] + Math.sin(sd) * L2];
        if (onLandPt(...A) && onLandPt(...B)) { p.wp = [A, B, [b.x + Math.cos(sd) * L2, b.y + Math.sin(sd) * L2]]; break; }
        L1 *= .6; L2 *= .6;
      }
      if (!p.wp) ai.mode = 'return';
      ai.exit = [b.x, b.y];
    }

    // perigo: inimigo perto do meu rastro?
    if (b.trail.length) {
      if (ai.t <= 0 || !ai.home) { ai.home = nearestOwn(b, b.x, b.y, 30); }
      const home = ai.home;
      if (!home) { /* sem casa por perto: segue */ }
      const homeD = home ? Math.hypot(home[0] - b.x, home[1] - b.y) : 20;
      let threat = 1e9;
      for (const o of ents) {
        if (!o || o === b || !o.alive) continue;
        let d = Math.hypot(o.x - b.x, o.y - b.y);
        for (let k = 0; k < b.pts.length; k += 3) { const p = b.pts[k]; const dd = Math.abs(o.x - p[0]) + Math.abs(o.y - p[1]); if (dd < d) d = dd; }
        if (d < threat) threat = d;
      }
      if (ai.mode !== 'return' && (threat < homeD + ai.caution || b.trail.length > ai.greed * 3.2)) ai.mode = 'return';
    }

    // ataque oportunista
    if (ai.t <= 0) {
      ai.t = 0.25;
      if (ai.mode !== 'return' && b.trail.length < 26 && Math.random() < ai.aggr) {
        let bestV = null, bestP = null, bd = 13;
        for (const o of ents) {
          if (!o || o === b || !o.alive || o.trail.length < 3) continue;
          if (o.isPlayer && time - o.spawnT < 3) continue;
          for (let k = 0; k < o.pts.length; k += 2) {
            const p = o.pts[k], d = Math.hypot(p[0] - b.x, p[1] - b.y);
            if (d < bd) { bd = d; bestV = o; bestP = p; }
          }
        }
        if (bestV) {
          const vh = bestV.pts[0] ? Math.hypot(bestV.x - bestV.pts[0][0], bestV.y - bestV.pts[0][1]) : 0;
          if (bd < vh * 1.4 + 3) { ai.mode = 'attack'; ai.victim = bestV; }
        }
      }
    }

    if (ai.mode === 'attack') {
      const v = ai.victim;
      if (!v || !v.alive || v.trail.length === 0) ai.mode = b.trail.length ? 'return' : 'home';
      else {
        let bd = 1e9;
        for (let k = 0; k < v.pts.length; k++) { const p = v.pts[k], d = Math.hypot(p[0] - b.x, p[1] - b.y); if (d < bd) { bd = d; target = p; } }
        if (!target) target = [v.x, v.y];
      }
    }
    if (ai.mode === 'plan') {
      const p = ai.plan;
      if (!p.wp) b.targetAng = safeAngle(b, p.dir);
      else {
        const w = p.wp[p.k];
        if (Math.hypot(w[0] - b.x, w[1] - b.y) < 1.4) { p.k++; if (p.k >= p.wp.length) ai.mode = 'return'; }
        else target = w;
      }
      if (b.trail.length === 0 && here && p.wp) ai.mode = 'home';
    }
    if (ai.mode === 'return') {
      if (b.trail.length === 0) { ai.mode = 'home'; }
      else {
        if (!ai.home || ai.t <= 0) ai.home = nearestOwn(b, b.x, b.y, 30);
        target = ai.home || ai.exit;
      }
    }
    if (ai.mode === 'home' && b.trail.length === 0) ai.homeT = 99; // força novo plano no próximo tick
    if (target) b.targetAng = safeAngle(b, Math.atan2(target[1] - b.y, target[0] - b.x));
  }

  // ------------------------------------------------------------------ controles
  const pointer = { mouse: false, mx: 0, my: 0, touch: false, ox: 0, oy: 0, tx: 0, ty: 0, id: null };
  const keys = new Set();
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { pointer.mouse = true; pointer.mx = e.clientX; pointer.my = e.clientY; return; }
    pointer.touch = true; pointer.id = e.pointerId; pointer.ox = pointer.tx = e.clientX; pointer.oy = pointer.ty = e.clientY; pointer.mouse = false;
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { pointer.mouse = true; pointer.mx = e.clientX; pointer.my = e.clientY; return; }
    if (!pointer.touch || e.pointerId !== pointer.id) return;
    pointer.tx = e.clientX; pointer.ty = e.clientY;
    const dx = pointer.tx - pointer.ox, dy = pointer.ty - pointer.oy, d = Math.hypot(dx, dy);
    if (d > 10 && player) player.targetAng = Math.atan2(dy, dx);
    if (d > 70) { pointer.ox = pointer.tx - dx / d * 70; pointer.oy = pointer.ty - dy / d * 70; }
  });
  const endTouch = (e) => { if (e.pointerId === pointer.id) { pointer.touch = false; pointer.id = null; } };
  addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
  addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (state === 'play') togglePause(); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase()) && state === 'play') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !paused && player && player.alive) togglePause(); });

  function playerControl() {
    const p = player; if (!p || !p.alive) return;
    let kx = 0, ky = 0;
    if (keys.has('arrowleft') || keys.has('a')) kx--; if (keys.has('arrowright') || keys.has('d')) kx++;
    if (keys.has('arrowup') || keys.has('w')) ky--; if (keys.has('arrowdown') || keys.has('s')) ky++;
    if (kx || ky) { p.targetAng = Math.atan2(ky, kx); pointer.mouse = false; return; }
    if (pointer.mouse) {
      const sx = VW / 2 + (p.x - cam.x) * Z, sy = VH / 2 + (p.y - cam.y) * Z;
      if (Math.hypot(pointer.mx - sx, pointer.my - sy) > 6) p.targetAng = Math.atan2(pointer.my - sy, pointer.mx - sx);
    }
  }

  // ------------------------------------------------------------------ partida
  let shake = 0, overT = 0, deathCause = '', won = false, hudT = 0, mmT = 0, bestAtStart = 0;

  function startGame(ci) {
    level = ci; save.country = ci; persist();
    buildMap(ci); renderLand();
    ents = [null]; particles = []; time = 0; won = false; overT = 0; shake = 0; deathCause = '';
    const sk = skinById(save.skin);
    player = makeEnt(1, { name: save.name || 'Você', isPlayer: true, color: sk.color, pat: sk.pat, dark: sk.dark, light: sk.light });
    ents.push(player);
    const nb = Math.min(14, 6 + Math.floor(ci * 0.5));
    const names = NAMES.slice().sort(() => Math.random() - .5);
    const cols = BOT_COLORS.filter((c) => c !== sk.color).sort(() => Math.random() - .5);
    for (let i = 0; i < nb; i++) {
      const lv = ci / (COUNTRIES.length - 1);
      const ai = {
        mode: 'home', t: rand(0, .3), homeT: 99, plan: null, home: null, exit: null, victim: null,
        aggr: clamp(0.12 + lv * 0.55 + rand(-.08, .12), 0.05, 0.85),
        greed: 8 + lv * 12 + rand(0, 8),
        caution: 1.5 + lv * 4 + rand(0, 2),
      };
      ents.push(makeEnt(i + 2, { name: names[i % names.length], color: cols[i % cols.length], pat: BOT_PATS[(Math.random() * BOT_PATS.length) | 0], ai }));
    }
    spawn(player, true);
    for (let i = 2; i < ents.length; i++) if (!spawn(ents[i])) ents[i].respawnT = 2;
    cam.x = player.x; cam.y = player.y;
    bestAtStart = prog(ci);
    state = 'play'; paused = false;
    showScreen(null); $('hud').classList.remove('hidden');
    $('pbest').style.left = bestAtStart + '%';
    $('pbest').style.display = bestAtStart > 0 ? '' : 'none';
    $('pfill').style.background = player.color === '#f1f5f9' ? '#94a3b8' : player.color;
    updateHud(true);
    if (save.games < 3) toast(matchMedia('(pointer: coarse)').matches ? 'Arraste o dedo para mudar a direção' : 'Mova o mouse ou use as setas / WASD');
  }

  function update(dt) {
    time += dt;
    playerControl();
    for (let i = 2; i < ents.length; i++) { const b = ents[i]; if (b.alive) botThink(b, dt); }
    for (let i = 1; i < ents.length; i++) { const e = ents[i]; if (e.alive) moveEntity(e, dt); }
    headCollisions();
    for (let i = 2; i < ents.length; i++) {
      const b = ents[i];
      if (!b.alive) { b.respawnT -= dt; if (b.respawnT <= 0) { if (!spawn(b)) b.respawnT = 3; } }
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    if (player.alive) {
      cam.x += (player.x - cam.x) * Math.min(1, dt * 8); cam.y += (player.y - cam.y) * Math.min(1, dt * 8);
      if (player.count >= landCount * 0.995 && !won) { won = true; overT = 1.2; sfx.win(); showCombo('PAÍS CONQUISTADO!', '100%'); }
    }
    if (overT > 0) { overT -= dt; if (overT <= 0) gameOver(); }
    hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHud(); }
  }

  function pct(e) { return e.count / landCount * 100; }
  function fmtPct(v) { return (v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '%'; }

  function updateHud() {
    const p = pct(player);
    $('pfill').style.width = Math.min(100, p) + '%';
    $('ptext').textContent = fmtPct(p);
    $('killsTxt').textContent = player.kills;
    const list = ents.filter((e) => e && (e.alive || e === player)).sort((a, b) => b.count - a.count);
    const top = list.slice(0, 5); if (!top.includes(player)) top.push(player);
    $('board').innerHTML = top.map((e) => {
      const rank = list.indexOf(e) + 1;
      return `<li class="${e === player ? 'me' : ''}"><span class="sw" style="background:${e.color}"></span><span class="nm">${rank === 1 ? '<span class="cr">👑</span> ' : rank + '. '}${escapeHtml(e.name)}</span><span class="pc">${fmtPct(pct(e))}</span></li>`;
    }).join('');
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function gameOver() {
    state = 'over';
    const p = won ? 100 : pct(player);
    const c = COUNTRIES[level];
    const before = prog(level);
    const after = Math.max(before, Math.round(p * 10) / 10);
    save.progress[c.id] = after;
    const coins = Math.round(p * 1.5) + player.kills * 5 + (won ? 200 : 0);
    save.coins += coins; save.games++;
    const wasLocked = level + 1 < COUNTRIES.length && before < UNLOCK_AT;
    persist();
    $('overTitle').textContent = won ? 'País conquistado! 🏆' : 'Fim de jogo';
    $('overCause').textContent = won ? 'Você pintou o país inteiro!' : deathCause;
    $('stPct').textContent = fmtPct(p);
    $('stKills').textContent = player.kills;
    $('stCoins').textContent = '+' + coins;
    $('ovFlag').textContent = c.flag; $('ovName').textContent = c.name; $('ovPct').textContent = after.toFixed(1) + '%';
    $('ovBar').style.width = after + '%';
    let note = after > before ? `Novo recorde! (antes ${before.toFixed(1)}%)` : `Seu recorde: ${before.toFixed(1)}%`;
    if (wasLocked && after >= UNLOCK_AT) note = `🔓 ${COUNTRIES[level + 1].flag} ${COUNTRIES[level + 1].name} foi liberado!`;
    else if (level + 1 < COUNTRIES.length && after < UNLOCK_AT) note += ` · ${UNLOCK_AT}% libera ${COUNTRIES[level + 1].name}`;
    $('ovNote').textContent = note;
    $('over').classList.remove('hidden');
    $('hud').classList.add('hidden');
  }

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused; $('pause').classList.toggle('hidden', !paused);
  }

  // ------------------------------------------------------------------ desenho
  let wavePat = null;
  function makeWave() {
    const c = document.createElement('canvas'); c.width = 160; c.height = 80; const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(20, 30); g.quadraticCurveTo(35, 20, 50, 30); g.quadraticCurveTo(65, 40, 80, 30); g.stroke();
    g.beginPath(); g.moveTo(100, 68); g.quadraticCurveTo(112, 60, 124, 68); g.stroke();
    wavePat = ctx.createPattern(c, 'repeat');
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawHead(g, e, sx, sy, s) {
    g.save(); g.translate(sx, sy);
    g.fillStyle = 'rgba(0,0,0,.16)'; roundRect(g, -s / 2, -s / 2 + s * .32, s, s, s * .26); g.fill();
    g.fillStyle = e.dark; roundRect(g, -s / 2, -s / 2 + s * .18, s, s, s * .26); g.fill();
    g.fillStyle = e.color; roundRect(g, -s / 2, -s / 2, s, s, s * .26); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; roundRect(g, -s * .38, -s * .4, s * .76, s * .22, s * .1); g.fill();
    const ex = Math.cos(e.ang) * s * .1, ey = Math.sin(e.ang) * s * .1;
    for (const k of [-1, 1]) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(k * s * .19 + ex, s * .02 + ey, s * .15, 0, TAU); g.fill();
      g.fillStyle = '#1d2b53'; g.beginPath(); g.arc(k * s * .19 + ex * 1.6, s * .02 + ey * 1.6, s * .075, 0, TAU); g.fill();
    }
    g.restore();
  }

  function render(dt) {
    if (state === 'menu') return;
    const g = ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    let shx = 0, shy = 0;
    if (shake > 0) { shake -= dt; shx = rand(-1, 1) * shake * 14; shy = rand(-1, 1) * shake * 14; }
    const ox = VW / 2 - cam.x * Z + shx, oy = VH / 2 - cam.y * Z + shy;
    g.fillStyle = '#3fd0e4'; g.fillRect(0, 0, VW, VH);
    if (!wavePat) makeWave();
    g.save(); g.translate((ox * .5 + time * 8) % 160, (oy * .5) % 80); g.fillStyle = wavePat; g.fillRect(-160, -80, VW + 320, VH + 160); g.restore();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // desenha só a parte visível dos mapas pré-renderizados
    const sx0 = Math.max(0, -ox / Z - 1), sy0 = Math.max(0, -oy / Z - 1), sx1 = Math.min(W, (VW - ox) / Z + 1), sy1 = Math.min(H, (VH - oy) / Z + 1);
    if (sx1 > sx0 && sy1 > sy0) {
      for (const img of [landCv, terrCv]) g.drawImage(img, sx0 * S, sy0 * S, (sx1 - sx0) * S, (sy1 - sy0) * S, ox + sx0 * Z, oy + sy0 * Z, (sx1 - sx0) * Z, (sy1 - sy0) * Z);
    }

    // rastros
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < ents.length; i++) {
      const e = ents[i]; if (!e.alive || !e.pts.length) continue;
      g.beginPath(); g.moveTo(ox + e.pts[0][0] * Z, oy + e.pts[0][1] * Z);
      for (let k = 1; k < e.pts.length; k++) g.lineTo(ox + e.pts[k][0] * Z, oy + e.pts[k][1] * Z);
      g.lineTo(ox + e.x * Z, oy + e.y * Z);
      g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = Z * .9; g.save(); g.translate(0, Z * .2); g.stroke(); g.restore();
      g.strokeStyle = e.light; g.globalAlpha = .9; g.lineWidth = Z * .8; g.stroke(); g.globalAlpha = 1;
    }
    // partículas
    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.color;
      const s = p.size * Z; g.fillRect(ox + p.x * Z - s / 2, oy + p.y * Z - s / 2, s, s);
    }
    g.globalAlpha = 1;
    // cabeças e nomes
    g.font = `600 ${Math.max(11, Z * .8)}px Fredoka, system-ui, sans-serif`; g.textAlign = 'center';
    for (let i = 1; i < ents.length; i++) {
      const e = ents[i]; if (!e.alive) continue;
      const sx = ox + e.x * Z, sy = oy + e.y * Z;
      if (sx < -60 || sy < -60 || sx > VW + 60 || sy > VH + 60) continue;
      drawHead(g, e, sx, sy, Z * 1.3);
      if (!e.isPlayer) {
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(e.name, sx, sy - Z * 1.1);
        g.fillStyle = '#1d2b53'; g.fillText(e.name, sx, sy - Z * 1.1);
      }
    }
    // joystick de toque
    if (pointer.touch && state === 'play') {
      g.globalAlpha = .35; g.fillStyle = '#fff';
      g.beginPath(); g.arc(pointer.ox, pointer.oy, 46, 0, TAU); g.fill();
      g.globalAlpha = .7; g.beginPath(); g.arc(pointer.tx, pointer.ty, 20, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
    // minimapa
    mmT -= dt;
    if (mmT <= 0 && state === 'play') { mmT = 0.1; drawMinimap(); }
  }

  function drawMinimap() {
    const mm = $('minimap'), g = mm.getContext('2d');
    const w = 140, h = Math.round(140 * H / W);
    const ch = Math.min(110, h), cw = Math.round(ch * W / H);
    if (mm.height !== ch * DPR || mm.width !== cw * DPR) { mm.width = cw * DPR; mm.height = ch * DPR; mm.style.width = cw + 'px'; mm.style.height = ch + 'px'; }
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, cw, ch);
    g.drawImage(landCv, 0, 0, cw, ch); g.drawImage(terrCv, 0, 0, cw, ch);
    const k = cw / W;
    for (let i = 1; i < ents.length; i++) {
      const e = ents[i]; if (!e.alive) continue;
      g.fillStyle = e.isPlayer ? '#fff' : e.dark;
      g.beginPath(); g.arc(e.x * k, e.y * k, e.isPlayer ? 3.5 : 2, 0, TAU); g.fill();
      if (e.isPlayer) { g.strokeStyle = '#1d2b53'; g.lineWidth = 1.5; g.stroke(); }
    }
    void w;
  }

  let lastT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if ((state === 'play' || state === 'over') && !paused) update(dt);
    render(dt);
  }

  // ------------------------------------------------------------------ UI / menus
  let comboTimer = null;
  function showCombo(text, sub, small) {
    const el = $('combo');
    el.innerHTML = `<div class="c ${small ? 'small' : ''}">${escapeHtml(text)}</div>${sub ? `<div class="s">${escapeHtml(sub)}</div>` : ''}`;
    clearTimeout(comboTimer); comboTimer = setTimeout(() => { el.innerHTML = ''; }, 1400);
  }
  let toastT = null;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

  function showScreen(id) {
    for (const s of ['menu', 'skins', 'countries']) $(s).classList.toggle('hidden', s !== id);
    $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    if (id) { state = 'menu'; $('hud').classList.add('hidden'); }
    if (id === 'menu') refreshMenu();
    if (id === 'skins') buildSkins();
    if (id === 'countries') buildCountries();
  }

  function shapePath(g, ci, w, h, pad) {
    const p = COUNTRIES[ci].pts; let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0; i < p.length; i += 2) { minx = Math.min(minx, p[i]); maxx = Math.max(maxx, p[i]); miny = Math.min(miny, p[i + 1]); maxy = Math.max(maxy, p[i + 1]); }
    const k = Math.min((w - 2 * pad) / (maxx - minx), (h - 2 * pad) / (maxy - miny));
    const ox = (w - (maxx - minx) * k) / 2, oy = (h - (maxy - miny) * k) / 2;
    const path = new Path2D();
    for (let i = 0; i < p.length; i += 2) path.lineTo(ox + (p[i] - minx) * k, oy + (p[i + 1] - miny) * k);
    path.closePath();
    return { path, x0: ox, x1: ox + (maxx - minx) * k, y0: oy, y1: oy + (maxy - miny) * k };
  }
  function drawCountryShape(canvas, ci, color, opts = {}) {
    const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const sp = shapePath(g, ci, w, h, opts.pad ?? 16);
    const pr = prog(ci), lock = !unlocked(ci);
    g.save(); g.translate(0, h * .025); g.fillStyle = 'rgba(0,30,90,.25)'; g.fill(sp.path); g.restore();
    g.fillStyle = lock ? '#c9d6ee' : '#fff'; g.fill(sp.path);
    if (pr > 0 && !lock) {
      g.save(); g.clip(sp.path);
      g.fillStyle = color; g.fillRect(sp.x0 - 2, sp.y0 - 2, (sp.x1 - sp.x0) * pr / 100 + 2, sp.y1 - sp.y0 + 4);
      g.restore();
    }
    if (opts.stroke) { g.lineWidth = 2; g.strokeStyle = 'rgba(29,43,83,.15)'; g.stroke(sp.path); }
    return sp;
  }

  function drawMenuShape() {
    const ci = save.country, cvs = $('cShape'), sk = skinById(save.skin);
    const sp = drawCountryShape(cvs, ci, sk.color === '#f1f5f9' ? '#94a3b8' : sk.color, { pad: 30 });
    if (unlocked(ci)) {
      const g = cvs.getContext('2d');
      const fake = { color: sk.color, dark: sk.dark || shade(sk.color, -0.3), ang: Math.PI / 2 };
      drawHead(g, fake, (sp.x0 + sp.x1) / 2, (sp.y0 + sp.y1) / 2 - 10, 64);
    }
  }

  function refreshMenu() {
    if (save.country >= COUNTRIES.length) save.country = 0;
    while (save.country > 0 && !unlocked(save.country)) save.country--;
    const ci = save.country, c = COUNTRIES[ci], pr = prog(ci), lock = !unlocked(ci);
    $('coinTxt').textContent = save.coins;
    $('cFlag').textContent = c.flag; $('cName').textContent = c.name;
    $('cBar').style.width = pr + '%'; $('cPct').textContent = pr.toFixed(1) + '%';
    $('cLock').classList.toggle('hidden', !lock);
    if (lock) $('cLock').textContent = `🔒 Faça ${UNLOCK_AT}% em ${COUNTRIES[ci - 1].name} para liberar`;
    $('playBtn').disabled = lock;
    $('prevC').disabled = ci === 0; $('nextC').disabled = ci === COUNTRIES.length - 1;
    const nb = Math.min(14, 6 + Math.floor(ci * 0.5));
    $('levelInfo').textContent = `Fase ${ci + 1} de ${COUNTRIES.length} · ${nb} oponentes` + (ci + 1 < COUNTRIES.length ? ` · ${UNLOCK_AT}% libera o próximo país` : '');
    drawMenuShape();
  }
  // navegação entre países (mostra também os bloqueados, mas não deixa jogar)
  function setMenuCountry(ci) {
    save.country = ci;
    const c = COUNTRIES[ci], pr = prog(ci), lock = !unlocked(ci);
    $('cFlag').textContent = c.flag; $('cName').textContent = c.name;
    $('cBar').style.width = pr + '%'; $('cPct').textContent = pr.toFixed(1) + '%';
    $('cLock').classList.toggle('hidden', !lock);
    if (lock) $('cLock').textContent = `🔒 Faça ${UNLOCK_AT}% em ${COUNTRIES[ci - 1].name} para liberar`;
    $('playBtn').disabled = lock;
    $('prevC').disabled = ci === 0; $('nextC').disabled = ci === COUNTRIES.length - 1;
    const nb = Math.min(14, 6 + Math.floor(ci * 0.5));
    $('levelInfo').textContent = `Fase ${ci + 1} de ${COUNTRIES.length} · ${nb} oponentes`;
    drawMenuShape();
    if (!lock) persist();
  }
  $('prevC').onclick = () => { sfx.click(); setMenuCountry(Math.max(0, save.country - 1)); };
  $('nextC').onclick = () => { sfx.click(); setMenuCountry(Math.min(COUNTRIES.length - 1, save.country + 1)); };
  $('playBtn').onclick = () => { if (!unlocked(save.country)) return; sfx.click(); startGame(save.country); };
  $('skinsBtn').onclick = () => { sfx.click(); showScreen('skins'); };
  $('mapBtn').onclick = () => { sfx.click(); showScreen('countries'); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { sfx.click(); showScreen('menu'); }));
  $('settingsBtn').onclick = () => {
    $('nameInput').value = save.name; $('soundToggle').checked = save.sound; $('resetBtn').dataset.armed = '';
    $('resetBtn').textContent = 'Apagar progresso'; $('settings').classList.remove('hidden');
  };
  $('closeSettings').onclick = () => {
    save.name = ($('nameInput').value || '').trim().slice(0, 12) || 'Você'; save.sound = $('soundToggle').checked; persist();
    $('settings').classList.add('hidden'); refreshMenu();
  };
  $('resetBtn').onclick = (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Toque de novo para confirmar'; return; }
    Object.assign(save, { coins: 0, skin: 'classic', owned: ['classic'], progress: {}, country: 0, games: 0 }); persist();
    $('settings').classList.add('hidden'); toast('Progresso apagado'); refreshMenu();
  };
  $('pauseBtn').onclick = () => togglePause();
  $('resumeBtn').onclick = () => togglePause();
  $('quitBtn').onclick = () => { paused = false; state = 'menu'; showScreen('menu'); };
  $('againBtn').onclick = () => { sfx.click(); $('over').classList.add('hidden'); startGame(level); };
  $('menuBtn').onclick = () => { sfx.click(); showScreen('menu'); };

  function buildSkins() {
    document.querySelector('.coinTxt2').textContent = save.coins;
    const grid = $('skinGrid'); grid.innerHTML = '';
    for (const sk of SKINS) {
      const t = document.createElement('div'); t.className = 'tile' + (save.skin === sk.id ? ' selected' : '');
      const c = document.createElement('canvas'); c.width = 240; c.height = 150;
      const g = c.getContext('2d'); const tile = makeTile(sk.color, sk.pat, 8);
      g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, 240, 150);
      drawHead(g, { color: sk.color, dark: sk.dark || shade(sk.color, -0.3), ang: Math.PI / 2 }, 120, 70, 70);
      const owned = save.owned.includes(sk.id);
      const btn = document.createElement('button'); btn.className = 'tbtn';
      if (save.skin === sk.id) { btn.className += ' using'; btn.textContent = 'Usando'; }
      else if (owned) btn.textContent = 'Usar';
      else { btn.className += ' price' + (save.coins < sk.price ? ' cant' : ''); btn.textContent = '🪙 ' + sk.price; }
      btn.onclick = () => {
        if (save.skin === sk.id) return;
        if (!owned) {
          if (save.coins < sk.price) { toast(`Faltam ${sk.price - save.coins} moedas. Jogue para ganhar mais!`); return; }
          save.coins -= sk.price; save.owned.push(sk.id); sfx.win();
        } else sfx.click();
        save.skin = sk.id; persist(); buildSkins();
      };
      const n = document.createElement('div'); n.className = 'tname'; n.textContent = sk.name;
      t.append(c, n, btn); grid.append(t);
    }
  }

  function buildCountries() {
    const grid = $('countryGrid'); grid.innerHTML = '';
    let sum = 0;
    const sk = skinById(save.skin), col = sk.color === '#f1f5f9' ? '#94a3b8' : sk.color;
    COUNTRIES.forEach((c, ci) => {
      sum += prog(ci);
      const lock = !unlocked(ci);
      const t = document.createElement('button'); t.className = 'tile' + (lock ? ' locked' : '') + (ci === save.country ? ' selected' : '');
      const cvs = document.createElement('canvas'); cvs.width = 240; cvs.height = 150; cvs.style.background = '#e9f2ff';
      drawCountryShape(cvs, ci, col, { pad: 14, stroke: true });
      const n = document.createElement('div'); n.className = 'tname'; n.textContent = `${lock ? '🔒' : c.flag} ${c.name}`;
      const bar = document.createElement('div'); bar.className = 'cc-bar'; bar.innerHTML = `<div style="width:${prog(ci)}%"></div><span>${prog(ci).toFixed(1)}%</span>`;
      t.append(cvs, n, bar);
      t.onclick = () => {
        if (lock) { toast(`Faça ${UNLOCK_AT}% em ${COUNTRIES[ci - 1].name} para liberar`); return; }
        sfx.click(); save.country = ci; persist(); showScreen('menu');
      };
      grid.append(t);
    });
    $('worldPct').textContent = `🌍 ${(sum / COUNTRIES.length).toFixed(1)}%`;
  }

  // ------------------------------------------------------------------ início
  resize();
  showScreen('menu');
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (state === 'menu') drawMenuShape(); });
  // ganchos para testes automatizados
  window.__pw = { get state() { return state; }, get player() { return player; }, get ents() { return ents; }, startGame, landCount: () => landCount };
})();
