/* Paper World — jogo de conquista de território (HTML5 Canvas, sem dependências) */
'use strict';
(function () {
  const COUNTRIES = window.COUNTRIES;
  const UNLOCK_AT = 50;          // % necessária num país para liberar o próximo
  const SPEED = 8.2;             // células por segundo
  const PLAYER_TURN = 7.5;       // rad/s
  const WALL_BOOST = 1.6;        // multiplicador de velocidade ao deslizar na borda
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
    { id: 'melancia', name: 'Melancia', price: 150, color: '#ef4444', pat: 'seeds', model: 'melancia' },
    { id: 'mel', name: 'Favo de Mel', price: 200, color: '#f59e0b', pat: 'hex' },
    { id: 'alien', name: 'Alien', price: 220, color: '#22c55e', pat: 'alien' },
    { id: 'vaca', name: 'Vaca', price: 250, color: '#f1f5f9', pat: 'spots', dark: '#94a3b8', light: '#ffffff', model: 'vaca' },
    { id: 'unicornio', name: 'Unicórnio', price: 300, color: '#f9a8d4', pat: 'stars', model: 'unicornio' },
    { id: 'lava', name: 'Lava', price: 350, color: '#f97316', pat: 'stripes' },
    { id: 'carvao', name: 'Carvão', price: 400, color: '#334155', pat: 'dots' },
    { id: 'galaxia', name: 'Galáxia', price: 500, color: '#4c1d95', pat: 'stars' },
    { id: 'ouro', name: 'Ouro', price: 800, color: '#facc15', pat: 'stars' },
    { id: 'nino', name: 'Nino', price: 400, color: '#27272a', pat: 'paws', model: 'nino' },
    { id: 'tereza', name: 'Tereza', price: 400, color: '#8a7b68', pat: 'tabby', model: 'tereza' },
    { id: 'bode', name: 'Bode', price: 450, color: '#e7dfcf', pat: 'grass', dark: '#a8a091', model: 'bode' },
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
      case 'paws': g.fillStyle = 'rgba(255,255,255,.75)';
        [[.27, .3, .3], [.74, .72, -.4]].forEach(([x, y, r]) => at(x, y, (a, b) => {
          g.save(); g.translate(a, b); g.rotate(r);
          g.beginPath(); g.ellipse(0, S * .25, S * .55, S * .45, 0, 0, TAU); g.fill();
          for (const [dx, dy] of [[-.55, -.35], [-.2, -.7], [.2, -.7], [.55, -.35]]) { g.beginPath(); g.arc(dx * S, dy * S, S * .2, 0, TAU); g.fill(); }
          g.restore();
        })); break;
      case 'tabby': g.strokeStyle = '#4a3f33'; g.lineWidth = S * .55; g.lineCap = 'round';
        for (const fy of [.15, .48, .81]) {
          g.beginPath();
          for (let x = -T * .1; x <= T * 1.1; x += T / 16) g.lineTo(x, fy * T + Math.sin(x / T * TAU * 2) * S * .5);
          g.stroke();
        }
        break;
      case 'grass': g.fillStyle = '#86c35a';
        [[.2, .25], [.7, .4], [.4, .8]].forEach(([x, y]) => at(x, y, (a, b) => {
          for (const dx of [-.35, 0, .35]) { g.beginPath(); g.moveTo(a + dx * S - S * .12, b); g.lineTo(a + dx * S + S * .05 * Math.sign(dx || 1), b - S * (dx ? .7 : 1)); g.lineTo(a + dx * S + S * .12, b); g.fill(); }
        })); break;
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
    Z = clamp(Math.sqrt(VW * VH) / 34, 13, 21);
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
    // arredonda os cantos da costa: desfoque em caixa (2 passadas) + limiar
    {
      const f = new Float32Array(W * H), tmp = new Float32Array(W * H), R = 3, k = 1 / (2 * R + 1);
      for (let i = 0; i < W * H; i++) f[i] = own[i] === 0 ? 1 : 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0; for (let q = -R; q <= R; q++) { const xx = x + q; if (xx >= 0 && xx < W) s2 += f[y * W + xx]; } tmp[y * W + x] = s2 * k; }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0; for (let q = -R; q <= R; q++) { const yy = y + q; if (yy >= 0 && yy < H) s2 += tmp[yy * W + x]; } f[y * W + x] = s2 * k; }
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; own[i] = (f[i] >= 0.5 && x > 1 && y > 1 && x < W - 2 && y < H - 2) ? 0 : WATER;
      }
    }
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
      alive: false, wall: null, trail: [], pts: [], count: 0, bb: null, kills: 0, respawnT: 0, combo: 0, lastKill: -9,
      ai: o.ai || null, spawnT: 0, model: getModel(o.model, o.color),
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
      e.alive = true; e.wall = null; e.trail = []; e.pts = []; e.spawnT = time;
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
    if (v.isPlayer) v.finalPct = pct(v);
    v.alive = false; v.wall = null;
    let inherited = 0;
    for (const i of v.trail) if (trail[i] === v.id) trail[i] = 0;
    v.trail = []; v.pts = [];
    const b = v.bb;
    if (b) {
      // quem eliminou herda o território da vítima
      const heir = killer && killer !== v && killer.alive ? killer : null;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const i = y * W + x; if (own[i] !== v.id) continue;
        if (heir) { own[i] = heir.id; heir.count++; growBB(heir, x, y); inherited++; } else own[i] = 0;
      }
      redraw(b.x0, b.y0, b.x1, b.y1);
    }
    v.count = 0;
    burst(v.x, v.y, v.color, 34);
    if (killer && killer !== v) {
      killer.kills++;
      if (killer.isPlayer) {
        killer.combo = time - killer.lastKill < 4 ? killer.combo + 1 : 1; killer.lastKill = time;
        const T = ['', 'ABATE!', 'DUPLO ABATE!', 'TRIPLO ABATE!', 'IMPARÁVEL!', 'LENDÁRIO!'];
        showCombo(T[Math.min(5, killer.combo)], inherited ? `${v.name} · +${(inherited / landCount * 100).toFixed(1)}%` : v.name); sfx.kill();
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
      if (t === e.id) return; // cruzar o próprio rastro não mata
      const v = ents[t];
      if (v && v.alive && time - v.spawnT > 0.3) kill(v, e, 'cut');
    }
    if (own[i] === e.id) { if (e.trail.length) capture(e); }
    else { trail[i] = e.id; e.trail.push(i); }
  }

  // direção (normalizada) que aponta para a água mais próxima, ou null se não há água por perto
  function waterNormal(x, y) {
    let vx = 0, vy = 0;
    const cx = x | 0, cy = y | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (isLandCell(cx + dx, cy + dy)) continue;
      const wx = cx + dx + .5 - x, wy = cy + dy + .5 - y, d2 = wx * wx + wy * wy;
      if (d2 > 6.5) continue;
      vx += wx / d2; vy += wy / d2;
    }
    const L = Math.hypot(vx, vy);
    return L > 1e-6 ? [vx / L, vy / L] : null;
  }

  function moveEntity(e, dt) {
    // modo "deslizar na borda" (só o jogador): segue a costa mais rápido até mudar de direção
    if (e.wall) {
      const n = waterNormal(e.x, e.y);
      const tx = Math.cos(e.targetAng), ty = Math.sin(e.targetAng);
      if (!n || tx * n[0] + ty * n[1] < -0.2 || Math.abs(angDiff(e.targetAng, e.wall.inAng)) > 0.6) e.wall = null;
    }
    if (!e.wall) {
      const da = angDiff(e.targetAng, e.ang), mt = e.turn * dt;
      e.ang += clamp(da, -mt, mt);
    }
    if (e.ang > Math.PI) e.ang -= TAU; else if (e.ang < -Math.PI) e.ang += TAU;
    let dist = e.speed * dt * (e.wall ? WALL_BOOST : 1);
    let ca = Math.cos(e.ang), sa = Math.sin(e.ang);
    while (dist > 1e-6 && e.alive) {
      const st = Math.min(0.34, dist); dist -= st;
      let nx = e.x + ca * st, ny = e.y + sa * st;
      if (e.wall) {
        const n = waterNormal(e.x, e.y);
        if (!n) { e.wall = null; }
        else {
          let tx = -n[1] * e.wall.sgn, ty = n[0] * e.wall.sgn;
          let mx = tx + n[0] * 0.3, my = ty + n[1] * 0.3; const ml = Math.hypot(mx, my); mx /= ml; my /= ml;
          // tenta: rente à borda, tangente, e só o eixo X ou Y (resolve cantos côncavos)
          const ax = Math.abs(tx) >= Math.abs(ty);
          const cand = [[mx, my], [tx, ty], ax ? [Math.sign(tx), 0] : [0, Math.sign(ty)], ax ? [0, Math.sign(ty)] : [Math.sign(tx), 0]];
          let moved = false;
          for (const [qx, qy] of cand) {
            const ql = Math.hypot(qx, qy); if (ql < 1e-6) continue;
            const X = e.x + qx / ql * st, Y = e.y + qy / ql * st;
            if (isLandXY(X, Y)) { nx = X; ny = Y; moved = true; break; }
          }
          if (!moved) { e.wall.sgn *= -1; break; }
          e.ang = Math.atan2(ny - e.y, nx - e.x); ca = Math.cos(e.ang); sa = Math.sin(e.ang);
        }
      }
      if (!e.wall && !isLandXY(nx, ny)) {
        const n = e.isPlayer ? waterNormal(e.x, e.y) : null;
        if (n) {
          const t1x = -n[1], t1y = n[0];
          e.wall = { inAng: e.targetAng, sgn: ca * t1x + sa * t1y >= 0 ? 1 : -1 };
          dist += st; continue;
        }
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
    player = makeEnt(1, { name: save.name || 'Você', isPlayer: true, color: sk.color, pat: sk.pat, dark: sk.dark, light: sk.light, model: sk.model });
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
    $('pbest').style.width = Math.min(100, bestAtStart) + '%';
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
      if (!won && (bestAtStart + pct(player) >= 100 || player.count >= landCount * 0.995)) { won = true; overT = 1.4; sfx.win(); showCombo('PAÍS CONCLUÍDO!', '100%'); }
    }
    if (overT > 0) { overT -= dt; if (overT <= 0) gameOver(); }
    hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHud(); }
  }

  function pct(e) { return e.count / landCount * 100; }
  function fmtPct(v) { return (v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '%'; }

  function updateHud() {
    const p = pct(player);
    $('pfill').style.width = Math.min(100, bestAtStart + p) + '%';
    $('ptext').textContent = `${Math.min(100, bestAtStart + p).toFixed(1)}%  (+${fmtPct(p)})`;
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
    const p = player.alive ? pct(player) : (player.finalPct || 0);
    const c = COUNTRIES[level];
    const before = prog(level);
    const after = won ? 100 : Math.min(100, Math.round((before + p) * 10) / 10);
    save.progress[c.id] = after;
    const coins = Math.round(p * 1.5) + player.kills * 5 + (won ? 200 : 0);
    save.coins += coins; save.games++;
    const wasLocked = level + 1 < COUNTRIES.length && before < UNLOCK_AT;
    persist();
    $('overTitle').textContent = won ? 'País concluído! 🏆' : 'Fim de jogo';
    $('overCause').textContent = won ? `Você completou 100% de ${c.name}!` : deathCause;
    $('stPct').textContent = fmtPct(p);
    $('stKills').textContent = player.kills;
    $('stCoins').textContent = '+' + coins;
    $('ovFlag').textContent = c.flag; $('ovName').textContent = c.name; $('ovPct').textContent = after.toFixed(1) + '%';
    $('ovBar').style.width = after + '%';
    let note = `${before.toFixed(1)}% + ${p.toFixed(1)}% desta partida`;
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

  // ------------------------------------------------------------------ personagens 3D (voxel)
  // Cada modelo é uma lista de caixas em coordenadas locais: u = frente, v = direita, w = altura.
  const B = (u, v, w, du, dv, dw, c) => ({ u, v, w, du, dv, dw, c: rgb(c) });
  const MODELS = {
    melancia: () => {
      const m = [B(-0.43, 0, 0.22, 0.14, 1.0, 0.44, '#2f9e44'), B(-0.33, 0, 0.22, 0.07, 0.96, 0.43, '#bef264')];
      const W = [0.92, 0.72, 0.5, 0.28];
      W.forEach((w, k) => m.push(B(-0.19 + k * 0.2, 0, 0.21, 0.21, w, 0.42, '#f43f5e')));
      [[-0.17, -0.25], [-0.17, 0.25], [0.03, -0.14], [0.03, 0.14], [0.23, 0]].forEach(([u, v]) => m.push(B(u, v, 0.435, 0.07, 0.07, 0.03, '#3b0a12')));
      // carinha na ponta
      m.push(B(0.03, -0.14, 0.445, 0.02, 0.02, 0.01, '#3b0a12'));
      return m;
    },
    vaca: () => [
      B(0, 0, 0.45, 0.9, 0.9, 0.9, '#f8fafc'),
      B(-0.1, 0.455, 0.58, 0.34, 0.02, 0.3, '#1f2937'), B(0.12, -0.455, 0.32, 0.28, 0.02, 0.26, '#1f2937'),
      B(-0.455, 0.12, 0.55, 0.02, 0.38, 0.3, '#1f2937'), B(-0.2, -0.18, 0.905, 0.32, 0.3, 0.02, '#1f2937'),
      B(0.5, 0, 0.27, 0.12, 0.62, 0.3, '#f9a8b8'),
      B(0.565, -0.14, 0.29, 0.02, 0.09, 0.11, '#9f1239'), B(0.565, 0.14, 0.29, 0.02, 0.09, 0.11, '#9f1239'),
      B(0.455, -0.24, 0.64, 0.02, 0.17, 0.19, '#ffffff'), B(0.455, 0.24, 0.64, 0.02, 0.17, 0.19, '#ffffff'),
      B(0.47, -0.24, 0.64, 0.02, 0.09, 0.11, '#111827'), B(0.47, 0.24, 0.64, 0.02, 0.09, 0.11, '#111827'),
      B(0.05, -0.3, 0.98, 0.12, 0.12, 0.16, '#fbbf24'), B(0.05, 0.3, 0.98, 0.12, 0.12, 0.16, '#fbbf24'),
      B(0.05, -0.4, 1.08, 0.1, 0.16, 0.08, '#f59e0b'), B(0.05, 0.4, 1.08, 0.1, 0.16, 0.08, '#f59e0b'),
      B(0.05, -0.52, 0.76, 0.14, 0.16, 0.1, '#f1f5f9'), B(0.05, 0.52, 0.76, 0.14, 0.16, 0.1, '#f1f5f9'),
    ],
    unicornio: () => [
      B(-0.12, 0, 0.3, 0.88, 0.74, 0.6, '#fbcfe8'),
      B(-0.58, 0, 0.42, 0.12, 0.16, 0.28, '#a78bfa'),
      B(0.24, 0, 0.78, 0.44, 0.5, 0.52, '#f9a8d4'),
      B(0.52, 0, 0.7, 0.2, 0.42, 0.28, '#f472b6'),
      B(0.625, -0.1, 0.72, 0.01, 0.06, 0.06, '#831843'), B(0.625, 0.1, 0.72, 0.01, 0.06, 0.06, '#831843'),
      B(0.3, -0.255, 0.86, 0.14, 0.02, 0.14, '#ffffff'), B(0.3, 0.255, 0.86, 0.14, 0.02, 0.14, '#ffffff'),
      B(0.32, -0.265, 0.86, 0.08, 0.02, 0.09, '#1f2937'), B(0.32, 0.265, 0.86, 0.08, 0.02, 0.09, '#1f2937'),
      B(0.4, -0.255, 0.72, 0.08, 0.02, 0.05, '#fb7185'), B(0.4, 0.255, 0.72, 0.08, 0.02, 0.05, '#fb7185'),
      B(0.3, 0, 1.1, 0.14, 0.14, 0.12, '#fde047'), B(0.3, 0, 1.21, 0.1, 0.1, 0.12, '#facc15'), B(0.3, 0, 1.31, 0.05, 0.05, 0.1, '#fef9c3'),
      B(0.06, 0, 1.02, 0.1, 0.22, 0.12, '#f43f5e'), B(0.0, 0, 0.9, 0.1, 0.24, 0.12, '#f59e0b'),
      B(-0.05, 0, 0.78, 0.1, 0.24, 0.12, '#22c55e'), B(-0.1, 0, 0.66, 0.1, 0.22, 0.12, '#38bdf8'),
      B(-0.15, 0, 0.56, 0.1, 0.2, 0.08, '#a78bfa'),
    ],
  };
  // orelha de gato em degraus (base, meio, ponta) + parte de dentro rosa
  const catEars = (c) => {
    const m = [];
    for (const k of [-1, 1]) m.push(
      B(0.12, k * 0.28, 0.97, 0.2, 0.26, 0.14, c), B(0.12, k * 0.31, 1.09, 0.15, 0.16, 0.1, c), B(0.12, k * 0.33, 1.17, 0.08, 0.07, 0.07, c),
      B(0.225, k * 0.28, 1.0, 0.01, 0.13, 0.1, '#f9a8b8'));
    return m;
  };
  MODELS.nino = () => [
    B(0, 0, 0.45, 0.9, 0.9, 0.9, '#1c1c21'),
    ...catEars('#1c1c21'),
    B(0.455, 0, 0.24, 0.02, 0.62, 0.34, '#f5f5f4'), B(0.455, 0, 0.47, 0.02, 0.2, 0.14, '#f5f5f4'),
    B(0.47, 0, 0.4, 0.02, 0.14, 0.09, '#0a0a0a'),
    B(0.455, -0.22, 0.64, 0.02, 0.19, 0.19, '#e6d32b'), B(0.455, 0.22, 0.64, 0.02, 0.19, 0.19, '#e6d32b'),
    B(0.47, -0.22, 0.64, 0.02, 0.05, 0.17, '#0a0a0a'), B(0.47, 0.22, 0.64, 0.02, 0.05, 0.17, '#0a0a0a'),
    B(0.47, -0.43, 0.33, 0.01, 0.24, 0.015, '#e5e7eb'), B(0.47, 0.43, 0.33, 0.01, 0.24, 0.015, '#e5e7eb'),
    B(0.47, -0.43, 0.26, 0.01, 0.24, 0.015, '#e5e7eb'), B(0.47, 0.43, 0.26, 0.01, 0.24, 0.015, '#e5e7eb'),
    B(0.36, -0.28, 0.04, 0.22, 0.22, 0.08, '#f5f5f4'), B(0.36, 0.28, 0.04, 0.22, 0.22, 0.08, '#f5f5f4'),
    B(-0.52, 0.26, 0.5, 0.12, 0.12, 0.5, '#1c1c21'), B(-0.52, 0.26, 0.81, 0.12, 0.12, 0.12, '#1c1c21'),
  ];
  MODELS.tereza = () => [
    B(0, 0, 0.45, 0.9, 0.9, 0.9, '#857866'),
    ...catEars('#857866'),
    B(0.2, 0, 0.905, 0.07, 0.56, 0.02, '#3f362c'), B(0.02, 0, 0.905, 0.07, 0.62, 0.02, '#3f362c'), B(-0.18, 0, 0.905, 0.07, 0.56, 0.02, '#3f362c'),
    B(0.455, 0, 0.8, 0.02, 0.05, 0.16, '#3f362c'), B(0.455, -0.12, 0.82, 0.02, 0.04, 0.12, '#3f362c'), B(0.455, 0.12, 0.82, 0.02, 0.04, 0.12, '#3f362c'),
    B(-0.12, -0.455, 0.6, 0.07, 0.02, 0.42, '#3f362c'), B(-0.12, 0.455, 0.6, 0.07, 0.02, 0.42, '#3f362c'),
    B(0.12, -0.455, 0.56, 0.07, 0.02, 0.34, '#3f362c'), B(0.12, 0.455, 0.56, 0.07, 0.02, 0.34, '#3f362c'),
    B(-0.455, 0, 0.62, 0.02, 0.6, 0.07, '#3f362c'), B(-0.455, 0, 0.4, 0.02, 0.6, 0.07, '#3f362c'),
    B(0.455, 0, 0.22, 0.02, 0.42, 0.24, '#efe9df'),
    B(0.455, -0.22, 0.47, 0.02, 0.17, 0.08, '#c8925a'), B(0.455, 0.22, 0.47, 0.02, 0.17, 0.08, '#c8925a'),
    B(0.455, -0.22, 0.64, 0.02, 0.19, 0.19, '#a5b45e'), B(0.455, 0.22, 0.64, 0.02, 0.19, 0.19, '#a5b45e'),
    B(0.47, -0.22, 0.64, 0.02, 0.06, 0.17, '#111111'), B(0.47, 0.22, 0.64, 0.02, 0.06, 0.17, '#111111'),
    B(0.47, 0, 0.37, 0.02, 0.11, 0.07, '#e39a98'),
    B(0.47, -0.43, 0.3, 0.01, 0.24, 0.015, '#f3f4f6'), B(0.47, 0.43, 0.3, 0.01, 0.24, 0.015, '#f3f4f6'),
    B(-0.52, 0.26, 0.37, 0.12, 0.12, 0.24, '#857866'), B(-0.52, 0.26, 0.55, 0.12, 0.12, 0.12, '#3f362c'),
    B(-0.52, 0.26, 0.67, 0.12, 0.12, 0.12, '#857866'), B(-0.52, 0.26, 0.79, 0.12, 0.12, 0.12, '#3f362c'),
  ];
  MODELS.bode = () => {
    const m = [
      B(0, 0, 0.45, 0.88, 0.84, 0.9, '#f1ece2'),
      B(-0.1, 0.05, 0.905, 0.4, 0.34, 0.02, '#b08960'),
      B(0.51, 0, 0.3, 0.14, 0.5, 0.34, '#e4d8c4'),
      B(0.585, -0.1, 0.34, 0.01, 0.07, 0.06, '#5b4636'), B(0.585, 0.1, 0.34, 0.01, 0.07, 0.06, '#5b4636'),
      B(0.585, 0, 0.2, 0.01, 0.18, 0.02, '#5b4636'),
      B(0.52, 0, 0.06, 0.1, 0.16, 0.14, '#d3c6b0'), B(0.53, 0, -0.04, 0.08, 0.1, 0.1, '#c4b59c'),
      B(0.445, -0.22, 0.64, 0.02, 0.2, 0.16, '#f2b33d'), B(0.445, 0.22, 0.64, 0.02, 0.2, 0.16, '#f2b33d'),
      B(0.46, -0.22, 0.64, 0.02, 0.14, 0.04, '#111111'), B(0.46, 0.22, 0.64, 0.02, 0.14, 0.04, '#111111'),
    ];
    for (const k of [-1, 1]) m.push(
      B(0.15, k * 0.24, 0.97, 0.14, 0.13, 0.14, '#8d806e'), B(0.04, k * 0.26, 1.1, 0.14, 0.12, 0.14, '#7d715f'),
      B(-0.11, k * 0.28, 1.18, 0.15, 0.11, 0.12, '#8d806e'), B(-0.26, k * 0.3, 1.15, 0.12, 0.1, 0.1, '#7d715f'),
      B(-0.36, k * 0.31, 1.05, 0.09, 0.09, 0.1, '#8d806e'),
      B(0.12, k * 0.54, 0.7, 0.16, 0.22, 0.08, '#f1ece2'), B(0.12, k * 0.6, 0.66, 0.12, 0.12, 0.06, '#e8b4b8'));
    return m;
  };
  const modelCache = new Map();
  function cubeModel(color) {
    return [
      B(0, 0, 0.42, 0.9, 0.9, 0.84, color),
      B(0.455, -0.2, 0.52, 0.02, 0.2, 0.22, '#ffffff'), B(0.455, 0.2, 0.52, 0.02, 0.2, 0.22, '#ffffff'),
      B(0.47, -0.2, 0.52, 0.02, 0.1, 0.12, '#1d2b53'), B(0.47, 0.2, 0.52, 0.02, 0.1, 0.12, '#1d2b53'),
    ];
  }
  function getModel(name, color) {
    const key = name || 'cube:' + color;
    if (!modelCache.has(key)) modelCache.set(key, name && MODELS[name] ? MODELS[name]() : cubeModel(color));
    return modelCache.get(key);
  }
  const FACES = [
    [[1, 0, 0], [1, 3, 7, 5]], [[-1, 0, 0], [0, 4, 6, 2]], [[0, 1, 0], [2, 6, 7, 3]],
    [[0, -1, 0], [0, 1, 5, 4]], [[0, 0, 1], [4, 5, 7, 6]], [[0, 0, -1], [0, 2, 3, 1]],
  ];
  const LIGHT = (() => { const l = [-0.45, 0.35, 0.82], n = Math.hypot(...l); return l.map((x) => x / n); })();
  const faceBuf = [];
  // desenha o modelo: (sx,sy) = ponto no chão, s = tamanho em px de 1 unidade, ang = direção, el = inclinação da câmera
  function drawModel(g, model, sx, sy, s, ang, el = 1.0) {
    const ca = Math.cos(ang), sa = Math.sin(ang), CE = Math.cos(el), SE = Math.sin(el);
    // sombra
    g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(sx, sy + s * 0.05, s * 0.62, s * 0.62 * SE, 0, 0, TAU); g.fill();
    let n = 0;
    const P = new Array(8);
    for (const b of model) {
      // ordena por bloco (centro): resolve detalhes "colados" na face (olhos, focinho, manchas)
      const by = b.u * sa + b.v * ca, bd = by * CE + b.w * SE;
      for (let i = 0; i < 8; i++) {
        const u = b.u + (i & 1 ? .5 : -.5) * b.du, v = b.v + (i & 2 ? .5 : -.5) * b.dv, w = b.w + (i & 4 ? .5 : -.5) * b.dw;
        const x = u * ca - v * sa, y = u * sa + v * ca;
        P[i] = [x, y, w];
      }
      for (const [nl, idx] of FACES) {
        const nx = nl[0] * ca - nl[1] * sa, ny = nl[0] * sa + nl[1] * ca, nz = nl[2];
        if (ny * CE + nz * SE <= 0.002) continue;
        const d = bd; const pts = [];
        for (const k of idx) { const p = P[k]; pts.push(sx + p[0] * s, sy + (p[1] * SE - p[2] * CE) * s); }
        const lit = 0.6 + 0.48 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        const f = faceBuf[n] || (faceBuf[n] = {}); f.d = d; f.pts = pts; f.col = `rgb(${Math.min(255, b.c[0] * lit) | 0},${Math.min(255, b.c[1] * lit) | 0},${Math.min(255, b.c[2] * lit) | 0})`;
        n++;
      }
    }
    const list = faceBuf.slice(0, n).sort((a, b) => a.d - b.d);
    g.lineJoin = 'round'; g.lineWidth = Math.max(0.6, s * 0.012);
    for (const f of list) {
      const p = f.pts; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(p[4], p[5]); g.lineTo(p[6], p[7]); g.closePath();
      g.fillStyle = f.col; g.strokeStyle = f.col; g.fill(); g.stroke();
    }
  }
  function drawHead(g, e, sx, sy, s) {
    drawModel(g, e.model || getModel(null, e.color), sx, sy + s * 0.3, s, e.ang, 0.85);
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
      drawHead(g, e, sx, sy, Z * 1.65);
      if (!e.isPlayer) {
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(e.name, sx, sy - Z * 1.7);
        g.fillStyle = '#1d2b53'; g.fillText(e.name, sx, sy - Z * 1.7);
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
      drawModel(g, getModel(sk.model, sk.color), (sp.x0 + sp.x1) / 2, (sp.y0 + sp.y1) / 2 + 20, 70, Math.PI / 2 - 0.55, 0.75);
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
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(120, 112, 70, 22, 0, 0, TAU); g.fill();
      drawModel(g, getModel(sk.model, sk.color), 120, 112, 88, Math.PI / 2 - 0.6, 0.75);
      c.onclick = () => openViewer(SKINS.indexOf(sk));
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

  // vitrine de skin: modelo 3D girando no pedestal
  let viewerIdx = -1, viewerAng = 0, viewerLast = 0;
  function openViewer(i) {
    viewerIdx = (i + SKINS.length) % SKINS.length;
    const sk = SKINS[viewerIdx], owned = save.owned.includes(sk.id), btn = $('vBtn');
    $('vName').textContent = sk.name;
    $('vCheck').classList.toggle('hidden', save.skin !== sk.id);
    btn.className = 'btn big v-btn';
    if (save.skin === sk.id) { btn.textContent = 'Em uso'; btn.classList.add('using'); }
    else if (owned) btn.textContent = 'Usar';
    else { btn.textContent = '🪙 ' + sk.price; btn.classList.add('price'); }
    $('vCoins').textContent = save.coins;
    if ($('viewer').classList.contains('hidden')) { $('viewer').classList.remove('hidden'); viewerLast = performance.now(); requestAnimationFrame(viewerLoop); }
  }
  function viewerLoop(t) {
    if ($('viewer').classList.contains('hidden')) return;
    const dt = Math.min(0.05, (t - viewerLast) / 1000); viewerLast = t; viewerAng += dt * 0.9;
    const c = $('vCanvas'), g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const sk = SKINS[viewerIdx];
    // pedestal
    const py = h * 0.74;
    const grd = g.createRadialGradient(w / 2, py, 10, w / 2, py, w * 0.36);
    grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.7, 'rgba(220,245,255,.9)'); grd.addColorStop(1, 'rgba(255,255,255,.5)');
    g.fillStyle = 'rgba(10,60,160,.25)'; g.beginPath(); g.ellipse(w / 2, py + 14, w * 0.37, w * 0.1, 0, 0, TAU); g.fill();
    g.fillStyle = grd; g.beginPath(); g.ellipse(w / 2, py, w * 0.36, w * 0.095, 0, 0, TAU); g.fill();
    drawModel(g, getModel(sk.model, sk.color), w / 2, py - 6, w * 0.46, viewerAng, 0.5);
    requestAnimationFrame(viewerLoop);
  }
  $('vPrev').onclick = () => { sfx.click(); openViewer(viewerIdx - 1); };
  $('vNext').onclick = () => { sfx.click(); openViewer(viewerIdx + 1); };
  $('vClose').onclick = () => { sfx.click(); $('viewer').classList.add('hidden'); buildSkins(); };
  $('vBtn').onclick = () => {
    const sk = SKINS[viewerIdx];
    if (save.skin === sk.id) return;
    if (!save.owned.includes(sk.id)) {
      if (save.coins < sk.price) { toast(`Faltam ${sk.price - save.coins} moedas. Jogue para ganhar mais!`); return; }
      save.coins -= sk.price; save.owned.push(sk.id); sfx.win();
    } else sfx.click();
    save.skin = sk.id; persist(); openViewer(viewerIdx);
  };

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
