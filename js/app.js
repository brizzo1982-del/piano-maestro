'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Note e nomi ---------- */
const NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES_IT = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
function noteToMidi(s) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error('Nota non valida: ' + s);
  let n = NAMES_EN.indexOf(m[1]) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return n + (+m[3] + 1) * 12;
}
function label(m, mode = Store.s.labels) {
  if (mode === 'off') return '';
  return (mode === 'en' ? NAMES_EN : NAMES_IT)[m % 12];
}
function parseSong(song) {
  if (song._notes) return song._notes;
  let t = 0; const out = [];
  song.n.trim().split(/\s+/).forEach(tok => {
    const [p, d] = tok.split(':'); const dur = d ? parseFloat(d) : 1;
    if (p !== 'R') out.push({ midi: noteToMidi(p), start: t, dur, i: out.length });
    t += dur;
  });
  song._notes = out; song._len = t;
  return out;
}
function difficulty(song) {
  if (song._lvl) return song._lvl;
  const ns = parseSong(song);
  const range = Math.max(...ns.map(n => n.midi)) - Math.min(...ns.map(n => n.midi));
  const blacks = ns.filter(n => isBlack(n.midi)).length / ns.length;
  const fast = ns.filter(n => n.dur < 0.5).length / ns.length;
  let jumps = 0; for (let i = 1; i < ns.length; i++) if (Math.abs(ns[i].midi - ns[i - 1].midi) > 7) jumps++;
  const score = ns.length / 35 + range / 14 + blacks * 2.2 + fast * 2 + jumps / ns.length * 3;
  return (song._lvl = score < 2.1 ? 1 : score < 3.3 ? 2 : 3);
}

/* ---------- Salvataggi ---------- */
const Store = {
  KEY: 'piano-maestro-v1',
  s: { labels: 'it', speed: 1, vol: 0.8, metro: 1, best: {}, ins: {} },
  load() { try { const d = JSON.parse(localStorage.getItem(this.KEY)); if (d) Object.assign(this.s, d); } catch (e) { } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.s)); } catch (e) { } }
};
Store.load();

/* ---------- HOME ---------- */
const CAT_COLOR = { rock: '#ff5c7a', film: '#9b7bff', classica: '#f7c548', folk: '#ff9f5a', fiabe: '#34e0c8', feste: '#4ee08a' };
let curCat = 'all';
function bestStars(id) { const b = Store.s.best[id] || {}; return Math.max(b.learn || 0, b.challenge || 0); }
function renderHome() {
  $('#chips').innerHTML = CATEGORIES.map(c => `<button class="chip ${c.id === curCat ? 'on' : ''}" data-c="${c.id}">${c.icon} ${c.name}</button>`).join('');
  $$('.chip').forEach(b => b.onclick = () => { curCat = b.dataset.c; renderHome(); });
  const q = $('#search').value.trim().toLowerCase();
  const list = SONGS.filter(s => (curCat === 'all' || s.cat === curCat) && (!q || (s.t + ' ' + s.a).toLowerCase().includes(q)));
  const lvlName = ['', 'Facile', 'Media', 'Difficile'];
  $('#list').innerHTML = list.length ? list.map(s => {
    const lv = difficulty(s), st = bestStars(s.id), ins = INSTRUMENTS[s.ins];
    return `<button class="song" data-id="${s.id}">
      <span class="ico" style="background:${CAT_COLOR[s.cat]}22;color:${CAT_COLOR[s.cat]}">${CAT_ICON[s.cat]}</span>
      <span class="meta"><b>${s.t}</b><small>${s.a}</small>
        <span class="sub"><span class="lvl l${lv}">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>${lvlName[lv]} · ${ins.icon} ${ins.name}</span></span>
      <span class="st">${[1, 2, 3].map(i => `<span class="${i <= st ? 'on' : ''}">★</span>`).join('')}</span>
    </button>`;
  }).join('') : '<div class="empty">Nessuna canzone trovata 🎵</div>';
  $$('.song').forEach(b => b.onclick = () => openSong(SONGS.find(s => s.id === b.dataset.id)));
  const done = SONGS.filter(s => bestStars(s.id) > 0).length;
  const stars = SONGS.reduce((a, s) => a + bestStars(s.id), 0);
  $('#stats').innerHTML = `<div class="stat"><b>${done}/${SONGS.length}</b><small>canzoni</small></div><div class="stat"><b>${stars}★</b><small>stelle</small></div>`;
}
$('#search').addEventListener('input', renderHome);
$('#free-btn').onclick = () => openFree();

function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }

/* ---------- TASTIERA ---------- */
const KB = {
  lo: 48, hi: 83, keys: new Map(), whiteW: 40, scrollEl: $('#kbd-scroll'), el: $('#kbd'),
  build(lo, hi) {
    // allarga ai bordi in modo da iniziare su DO/FA e finire su MI/SI
    while (isBlack(lo) || ![0, 5].includes(lo % 12)) lo--;
    while (isBlack(hi) || ![4, 11].includes(hi % 12)) hi++;
    // almeno 10 tasti bianchi
    let whites = () => { let n = 0; for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++; return n; };
    while (whites() < 10) { hi++; while (isBlack(hi) || ![4, 11].includes(hi % 12)) hi++; if (whites() < 10) { lo--; while (isBlack(lo) || ![0, 5].includes(lo % 12)) lo--; } }
    this.lo = lo; this.hi = hi; this.layout();
  },
  layout() {
    const lo = this.lo, hi = this.hi;
    let nW = 0; for (let m = lo; m <= hi; m++) if (!isBlack(m)) nW++;
    const vw = this.scrollEl.clientWidth || window.innerWidth;
    const minW = window.innerHeight > window.innerWidth ? 30 : Math.min(48, Math.max(34, window.innerHeight * 0.075));
    this.whiteW = Math.max(vw / nW, minW);
    this.width = this.whiteW * nW;
    this.el.style.width = this.width + 'px';
    this.keys.clear();
    let html = '', x = 0;
    const W = this.whiteW, BW = W * 0.6;
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) {
        this.keys.set(m, { x, w: W, black: false });
        const lab = label(m), oct = Math.floor(m / 12) - 1;
        html += `<div class="wk" data-m="${m}" style="left:${x}px;width:${W}px"><span class="kl ${m % 12 === 0 ? 'c' : ''}">${lab}</span>${m % 12 === 0 && Store.s.labels !== 'off' ? `<span class="ko">${oct}</span>` : ''}</div>`;
        x += W;
      } else {
        const bx = x - BW / 2 + (([1, 6].includes(m % 12)) ? -W * 0.06 : ([3, 10].includes(m % 12)) ? W * 0.06 : 0);
        this.keys.set(m, { x: bx, w: BW, black: true });
        html += `<div class="bk" data-m="${m}" style="left:${bx}px;width:${BW}px"><span class="kl">${W > 36 ? label(m) : ''}</span></div>`;
      }
    }
    this.el.innerHTML = html;
    this.nodes = new Map($$('[data-m]', this.el).map(e => [+e.dataset.m, e]));
    const tip = $('#rotate-tip');
    tip.classList.toggle('show', this.width > vw + 4 && window.innerHeight > window.innerWidth);
  },
  node(m) { return this.nodes && this.nodes.get(m); },
  set(m, cls, on) { const n = this.node(m); if (n) n.classList.toggle(cls, on); },
  clear(cls) { this.nodes && this.nodes.forEach(n => n.classList.remove(cls)); },
  ensureVisible(m, smooth = true) {
    const k = this.keys.get(m); if (!k) return;
    const sl = this.scrollEl.scrollLeft, vw = this.scrollEl.clientWidth;
    if (k.x < sl + vw * 0.15 || k.x + k.w > sl + vw * 0.85) {
      this.scrollEl.scrollTo({ left: Math.max(0, k.x + k.w / 2 - vw / 2), behavior: smooth ? 'smooth' : 'auto' });
    }
  },
  midiAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const k = el && el.closest && el.closest('[data-m]');
    return k ? +k.dataset.m : null;
  }
};

/* Input: tocchi multipli + glissando */
const pointers = new Map();
const held = new Map(); // midi -> voce
function keyDown(m) {
  Audio2.init();
  if (held.has(m)) { held.get(m).stop(); }
  held.set(m, Audio2.play(Game.ins, m, 0, null));
  KB.set(m, 'down', true);
  Game.onPress(m);
}
function keyUp(m) {
  const v = held.get(m); if (v) { v.stop(); held.delete(m); }
  KB.set(m, 'down', false);
}
KB.el.addEventListener('pointerdown', e => {
  e.preventDefault();
  const m = KB.midiAt(e.clientX, e.clientY); if (m == null) return;
  try { KB.el.setPointerCapture(e.pointerId); } catch (err) { }
  pointers.set(e.pointerId, m); keyDown(m);
});
KB.el.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const m = KB.midiAt(e.clientX, e.clientY), old = pointers.get(e.pointerId);
  if (m != null && m !== old) { keyUp(old); pointers.set(e.pointerId, m); keyDown(m); }
});
const endPtr = e => { if (!pointers.has(e.pointerId)) return; keyUp(pointers.get(e.pointerId)); pointers.delete(e.pointerId); };
KB.el.addEventListener('pointerup', endPtr);
KB.el.addEventListener('pointercancel', endPtr);
KB.el.addEventListener('contextmenu', e => e.preventDefault());
// tastiera del computer: A W S E D F T G Y H U J K O L P
const PC_KEYS = 'awsedftgyhujkolp;';
function pcBase() { let b = KB.lo; const sl = KB.scrollEl.scrollLeft; for (let m = KB.lo; m <= KB.hi; m++) { if (m % 12 === 0 && KB.keys.get(m).x >= sl - 1) { b = m; break; } } return b; }
const pcDown = new Map();
window.addEventListener('keydown', e => {
  if (!$('#player').classList.contains('active') || e.repeat || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); Game.togglePause(); return; }
  const i = PC_KEYS.indexOf(e.key.toLowerCase()); if (i < 0) return;
  const m = pcBase() + i; if (m > KB.hi) return;
  pcDown.set(e.key.toLowerCase(), m); keyDown(m);
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (pcDown.has(k)) { keyUp(pcDown.get(k)); pcDown.delete(k); } });

/* ---------- GIOCO ---------- */
const cv = $('#cv'), g2 = cv.getContext('2d');
const Game = {
  song: null, notes: [], mode: 'learn', ins: 'piano', running: false, paused: false, free: false,
  t: 0, last: 0, next: 0, errors: 0, hits: 0, perfect: 0, combo: 0, maxCombo: 0, fx: [],
  get spb() { return 60 / ((this.song ? this.song.bpm : 100) * Store.s.speed); },

  open(song) {
    this.stop(); this.free = false; this.song = song; this.notes = parseSong(song).map(n => ({ ...n }));
    this.ins = Store.s.ins[song.id] || song.ins;
    $('#player').classList.remove('free');
    $('#p-title').textContent = song.t; $('#p-artist').textContent = song.a;
    const ms = this.notes.map(n => n.midi);
    KB.build(Math.min(...ms), Math.max(...ms));
    this.setIns(this.ins, false);
    this.reset();
    show('player');
    requestAnimationFrame(() => { KB.layout(); this.resize(); KB.ensureVisible(this.notes[0].midi, false); this.draw(); });
  },
  openFree() {
    this.stop(); this.free = true; this.song = null; this.notes = [];
    this.ins = Store.s.ins._free || 'piano';
    $('#player').classList.add('free');
    $('#p-title').textContent = 'Suona libero'; $('#p-artist').textContent = 'Scegli lo strumento in alto a destra';
    KB.build(48, 83);
    this.setIns(this.ins, false);
    $('#start-ov').classList.add('hide');
    show('player');
    requestAnimationFrame(() => { KB.layout(); this.resize(); KB.ensureVisible(60, false); this.running = true; this.loop(); });
  },
  setIns(id, save = true) {
    this.ins = id; const I = INSTRUMENTS[id];
    $('#ins-ico').textContent = I.icon; $('#ins-name').textContent = I.name;
    if (save) { Store.s.ins[this.free ? '_free' : this.song.id] = id; Store.save(); }
    Audio2.warmup(id, this.free ? [] : [...new Set(this.notes.map(n => n.midi))]);
  },
  setMode(m) {
    this.mode = m;
    $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    this.stop(); this.reset();
  },
  reset() {
    this.running = false; this.paused = false;
    this.t = -4; this.next = 0; this.errors = 0; this.hits = 0; this.perfect = 0; this.combo = 0; this.maxCombo = 0; this.fx = [];
    this.notes.forEach(n => { n.hit = false; n.miss = false; n.played = false; n.q = 0; });
    KB.clear('target'); KB.clear('lit'); KB.clear('wrong');
    const hints = { listen: 'Ascolta la canzone e guarda i tasti', learn: 'La canzone aspetta te: premi il tasto che si illumina', challenge: 'Suona a tempo! Premi quando la nota tocca la linea' };
    $('#start-hint').textContent = hints[this.mode];
    $('#start-ov').classList.remove('hide');
    $('#pause-btn').textContent = '❚❚';
    this.updateHud(); this.draw();
  },
  start() {
    Audio2.init(); Audio2.setVolume(Store.s.vol);
    $('#start-ov').classList.add('hide');
    this.running = true; this.paused = false; this.last = performance.now();
    this.beatClick = Math.floor(this.t);
    this.loop();
  },
  stop() { this.running = false; cancelAnimationFrame(this.raf); held.forEach(v => v.stop()); held.clear(); KB.clear('down'); },
  togglePause() {
    if (this.free) return;
    if (!this.running) { this.start(); return; }
    this.paused = !this.paused; this.last = performance.now();
    $('#pause-btn').textContent = this.paused ? '▶' : '❚❚';
  },
  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.free && this.running && !this.paused) this.tick(dt);
    this.draw(dt);
  },
  tick(dt) {
    const spb = this.spb, prev = this.t;
    let nt = this.t + dt / spb;
    const N = this.notes;
    if (this.mode === 'learn') {
      const tgt = N[this.next];
      if (tgt && nt >= tgt.start) nt = tgt.start; // aspetta la nota giusta
    }
    // conto alla rovescia (3 colpi) e metronomo in modalità Sfida
    const b = Math.floor(nt);
    if (b > this.beatClick) { this.beatClick = b; if (b < 0 || (this.mode === 'challenge' && Store.s.metro)) Audio2.click(0, b < 0 || b % 4 === 0); }
    this.t = nt;
    if (this.mode === 'listen') {
      N.forEach(n => {
        if (!n.played && n.start <= nt) { n.played = true; n.hit = true; Audio2.play(this.ins, n.midi, 0, n.dur * spb * 0.92); this.spark(n); KB.ensureVisible(n.midi); }
        const on = n.start <= nt && nt < n.start + n.dur * 0.92;
        if (on !== !!n.lit) { n.lit = on; KB.set(n.midi, 'lit', on); }
      });
      this.next = N.filter(n => n.played).length;
    }
    if (this.mode === 'challenge') {
      const win = this.window();
      N.forEach(n => { if (!n.hit && !n.miss && nt > n.start + win) { n.miss = true; this.combo = 0; this.updateHud(); } });
      const up = N.find(n => !n.hit && !n.miss);
      this.setTarget(up && up.start - nt < 1.2 ? up.midi : null);
    }
    if (this.mode === 'learn') { const tg = N[this.next]; this.setTarget(tg && tg.start - nt < 1.5 ? tg.midi : null); }
    $('#prog').style.width = Math.max(0, Math.min(100, this.t / this.song._len * 100)) + '%';
    const lastEnd = this.song._len;
    if (this.t >= lastEnd + 1 && (this.mode !== 'learn' || this.next >= N.length)) this.finish();
  },
  window() { return Math.max(0.3, 0.2 / this.spb); }, // in battiti: almeno 200 ms
  setTarget(m) {
    if (m === this.target) return;
    if (this.target != null) KB.set(this.target, 'target', false);
    this.target = m;
    if (m != null) { KB.set(m, 'target', true); KB.ensureVisible(m); }
  },
  onPress(m) {
    if (this.free || !this.running || this.paused) return;
    const N = this.notes;
    if (this.mode === 'learn') {
      const tg = N[this.next]; if (!tg) return;
      if (m === tg.midi && tg.start - this.t < 1.5) {
        tg.hit = true; this.next++; this.hits++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.spark(tg); if (this.combo % 10 === 0) this.showCombo(this.combo + ' di fila! 🔥');
        // se il tasto è stato premuto in anticipo, la canzone salta avanti
        if (this.t < tg.start) this.t = tg.start;
      } else { this.wrong(m); }
    } else if (this.mode === 'challenge') {
      const win = this.window();
      const cand = N.filter(n => !n.hit && !n.miss && n.midi === m && Math.abs(n.start - this.t) <= win)
        .sort((a, b) => Math.abs(a.start - this.t) - Math.abs(b.start - this.t))[0];
      if (cand) {
        cand.hit = true; this.hits++; const off = Math.abs(cand.start - this.t);
        cand.q = off < win * 0.45 ? 1 : 0.7; if (cand.q === 1) this.perfect++;
        this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.spark(cand, cand.q === 1 ? 'Perfetto' : 'Bene');
        if (this.combo % 10 === 0) this.showCombo('Combo x' + this.combo + ' 🔥');
      } else { this.wrong(m); this.combo = 0; }
    }
    this.updateHud();
  },
  wrong(m) {
    this.errors++;
    KB.set(m, 'wrong', true); setTimeout(() => KB.set(m, 'wrong', false), 250);
    if (this.mode === 'learn') this.combo = 0;
  },
  showCombo(txt) { const c = $('#combo'); c.textContent = txt; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); },
  updateHud() {
    const h = $('#hud');
    if (this.free || this.mode === 'listen') { h.innerHTML = ''; return; }
    const tot = this.notes.length;
    h.innerHTML = this.mode === 'learn'
      ? `<b>${this.hits}/${tot}</b><br>errori ${this.errors}`
      : `<b>${this.score()}%</b><br>combo ${this.combo}`;
  },
  score() {
    const N = this.notes; if (!N.length) return 0;
    return Math.round(N.reduce((a, n) => a + (n.hit ? n.q || 1 : 0), 0) / N.length * 100);
  },
  finish() {
    this.stop(); this.setTarget(null); KB.clear('lit');
    let stars, acc;
    if (this.mode === 'listen') { this.reset(); return; }
    if (this.mode === 'learn') {
      acc = Math.round(this.notes.length / (this.notes.length + this.errors) * 100);
      stars = acc >= 95 ? 3 : acc >= 80 ? 2 : 1;
    } else {
      const raw = this.notes.reduce((a, n) => a + (n.hit ? n.q : 0), 0) / this.notes.length;
      acc = Math.round(Math.max(0, raw - this.errors * 0.01) * 100);
      stars = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 40 ? 1 : 0;
    }
    const id = this.song.id, b = Store.s.best[id] || (Store.s.best[id] = {});
    const record = stars > (b[this.mode] || 0);
    b[this.mode] = Math.max(b[this.mode] || 0, stars); Store.save();
    if (stars > 0) Audio2.fanfare(this.ins);
    $('#res-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('');
    const titles = ['Riprova, ce la fai!', 'Buon inizio!', 'Ottimo lavoro!', 'Perfetto, sei un maestro!'];
    $('#res-title').textContent = titles[stars];
    $('#res-text').textContent = (record ? 'Nuovo record! ' : '') + (this.mode === 'learn' && stars === 3 ? 'Ora prova la modalità Sfida 🏆' : this.song.t);
    $('#res-grid').innerHTML = this.mode === 'learn'
      ? `<div><b>${acc}%</b><small>precisione</small></div><div><b>${this.errors}</b><small>errori</small></div><div><b>${this.maxCombo}</b><small>di fila</small></div>`
      : `<div><b>${acc}%</b><small>punteggio</small></div><div><b>${this.perfect}</b><small>perfette</small></div><div><b>${this.notes.length - this.hits}</b><small>mancate</small></div><div><b>${this.maxCombo}</b><small>combo max</small></div>`;
    openModal('res-modal');
  },
  spark(n, txt) {
    const k = KB.keys.get(n.midi); if (!k) return;
    this.fx.push({ x: k.x + k.w / 2, life: 1, txt, black: k.black });
  },

  /* ---- disegno ---- */
  resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    this.W = r.width; this.H = r.height; g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  draw(dt = 0) {
    const W = this.W, H = this.H; if (!W) return;
    const sl = KB.scrollEl.scrollLeft;
    g2.clearRect(0, 0, W, H);
    // corsie (linee in corrispondenza di DO e FA)
    for (let m = KB.lo; m <= KB.hi; m++) {
      const k = KB.keys.get(m); if (!k || k.black) continue;
      const x = k.x - sl; if (x < -2 || x > W + 2) continue;
      g2.fillStyle = m % 12 === 0 ? 'rgba(255,255,255,.09)' : m % 12 === 5 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)';
      g2.fillRect(x, 0, 1, H);
    }
    if (this.free) { this.drawFx(dt, sl, H); return; }
    const spb = this.spb;
    const ppb = Math.max(46, Math.min(150, 170 * spb * (H / 360 + 0.3)));
    const hitY = H - 2;
    // linee di battuta
    g2.fillStyle = 'rgba(255,255,255,.05)';
    for (let b = Math.ceil(this.t); b < this.t + H / ppb + 1; b++) {
      if (b % 4 !== 0) continue;
      const y = hitY - (b - this.t) * ppb; g2.fillRect(0, y, W, 1);
    }
    const labOn = Store.s.labels !== 'off';
    for (const n of this.notes) {
      const y0 = hitY - (n.start - this.t) * ppb; // bordo inferiore
      const h = Math.max(10, n.dur * ppb - 4);
      const y1 = y0 - h;
      if (y1 > H || y0 < -10) continue;
      const k = KB.keys.get(n.midi); if (!k) continue;
      const pad = k.black ? 1 : 3, x = k.x - sl + pad, w = k.w - pad * 2;
      if (x + w < 0 || x > W) continue;
      let c1, c2;
      const isTarget = (this.mode === 'learn' && n.i === this.next) || (this.mode === 'challenge' && n.midi === this.target && !n.hit && !n.miss && Math.abs(n.start - this.t) < 1.2);
      if (n.miss) { c1 = '#6b2a3a'; c2 = '#4a1d2a'; }
      else if (n.hit && this.mode !== 'listen') { c1 = '#4ee08a'; c2 = '#1f9d5a'; }
      else if (k.black) { c1 = '#b49bff'; c2 = '#6b46d6'; }
      else { c1 = '#6ff5e1'; c2 = '#15b39c'; }
      const gr = g2.createLinearGradient(0, y1, 0, y0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g2.save();
      if (isTarget) { g2.shadowColor = k.black ? '#9b7bff' : '#34e0c8'; g2.shadowBlur = 18; }
      g2.fillStyle = gr; roundRect(g2, x, y1, w, h, Math.min(6, w / 3)); g2.fill();
      g2.restore();
      if (isTarget) { g2.strokeStyle = '#fff'; g2.lineWidth = 2; roundRect(g2, x, y1, w, h, Math.min(6, w / 3)); g2.stroke(); }
      if (labOn && h >= 16 && w >= 16) {
        g2.fillStyle = n.miss ? '#c98' : 'rgba(0,0,0,.65)';
        g2.font = `700 ${Math.min(13, w * 0.42)}px Outfit, sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'bottom';
        g2.fillText(label(n.midi), x + w / 2, y0 - 3);
      }
    }
    // linea di battuta
    const lg = g2.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(52,224,200,.2)'); lg.addColorStop(.5, 'rgba(155,123,255,.9)'); lg.addColorStop(1, 'rgba(52,224,200,.2)');
    g2.fillStyle = lg; g2.fillRect(0, hitY - 1, W, 3);
    // messaggio di attesa
    if (this.mode === 'learn' && this.running && !this.paused) {
      const tg = this.notes[this.next];
      if (tg && this.t >= tg.start - 0.001 && Store.s.labels !== 'off') {
        const k = KB.keys.get(tg.midi);
        const x = Math.max(40, Math.min(W - 40, k.x - sl + k.w / 2));
        g2.fillStyle = 'rgba(255,255,255,.95)'; g2.font = '700 15px Outfit, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'bottom';
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 160);
        g2.globalAlpha = pulse; g2.fillText('▼ ' + label(tg.midi), x, hitY - Math.max(10, tg.dur * ppb - 4) - 8); g2.globalAlpha = 1;
      }
    }
    this.drawFx(dt, sl, H);
  },
  drawFx(dt, sl, H) {
    this.fx = this.fx.filter(f => (f.life -= dt * 1.6) > 0);
    for (const f of this.fx) {
      const x = f.x - sl, a = f.life;
      const rg = g2.createRadialGradient(x, H, 0, x, H, 60 * (1.3 - a));
      rg.addColorStop(0, `rgba(255,255,255,${a * .8})`); rg.addColorStop(.4, f.black ? `rgba(155,123,255,${a * .5})` : `rgba(52,224,200,${a * .5})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = rg; g2.fillRect(x - 70, H - 70, 140, 70);
      if (f.txt) { g2.globalAlpha = a; g2.fillStyle = f.txt === 'Perfetto' ? '#f7c548' : '#9fe'; g2.font = '700 13px Outfit, sans-serif'; g2.textAlign = 'center'; g2.fillText(f.txt, x, H - 40 - (1 - a) * 30); g2.globalAlpha = 1; }
    }
  }
};
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function openSong(s) { Game.open(s); }
function openFree() { Game.openFree(); }

/* ---------- Controlli player ---------- */
$('#play-btn').onclick = () => Game.start();
$('#back-btn').onclick = () => { Game.stop(); Game.free = false; show('home'); renderHome(); };
$('#pause-btn').onclick = () => Game.togglePause();
$('#restart-btn').onclick = () => { Game.stop(); Game.reset(); };
$$('#modes button').forEach(b => b.onclick = () => Game.setMode(b.dataset.m));
$('#oct-l').onclick = () => KB.scrollEl.scrollBy({ left: -KB.whiteW * 7, behavior: 'smooth' });
$('#oct-r').onclick = () => KB.scrollEl.scrollBy({ left: KB.whiteW * 7, behavior: 'smooth' });
KB.scrollEl.addEventListener('scroll', () => { if (!Game.running) Game.draw(); });

function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { m.classList.remove('open'); if (m.id === 'set-modal' || m.id === 'ins-modal') Game.paused = Game.wasPaused; } }));

$('#ins-btn').onclick = () => {
  const def = Game.song ? Game.song.ins : null;
  $('#ins-grid').innerHTML = Object.entries(INSTRUMENTS).map(([id, I]) =>
    `<button class="ins-item ${id === Game.ins ? 'on' : ''}" data-i="${id}"><span>${I.icon}</span><span>${I.name}${id === def ? '<small>originale</small>' : ''}</span></button>`).join('');
  $$('.ins-item').forEach(b => b.onclick = () => {
    Game.setIns(b.dataset.i); closeModal('ins-modal'); Game.paused = Game.wasPaused;
    Audio2.play(b.dataset.i, 60, 0, 0.4); setTimeout(() => Audio2.play(b.dataset.i, 64, 0, 0.4), 180); setTimeout(() => Audio2.play(b.dataset.i, 67, 0, 0.6), 360);
  });
  Game.wasPaused = Game.paused; if (Game.running) Game.paused = true;
  openModal('ins-modal');
};
function segInit(id, key, cb) {
  const seg = $(id);
  const paint = () => $$('button', seg).forEach(b => b.classList.toggle('on', b.dataset.v == Store.s[key]));
  $$('button', seg).forEach(b => b.onclick = () => { Store.s[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; Store.save(); paint(); cb && cb(); });
  paint();
}
$('#set-btn').onclick = () => { Game.wasPaused = Game.paused; if (Game.running) Game.paused = true; openModal('set-modal'); };
segInit('#speed-seg', 'speed');
segInit('#label-seg', 'labels', () => { const sl = KB.scrollEl.scrollLeft; KB.layout(); KB.scrollEl.scrollLeft = sl; if (Game.target != null) KB.set(Game.target, 'target', true); Game.draw(); });
segInit('#metro-seg', 'metro');
$('#vol').value = Store.s.vol;
$('#vol').oninput = e => { Store.s.vol = +e.target.value; Audio2.setVolume(Store.s.vol); Store.save(); };

$('#res-again').onclick = () => { closeModal('res-modal'); Game.reset(); };
$('#res-list').onclick = () => { closeModal('res-modal'); show('home'); renderHome(); };
$('#res-next').onclick = () => {
  closeModal('res-modal');
  const i = SONGS.indexOf(Game.song); Game.open(SONGS[(i + 1) % SONGS.length]);
};

let rzT;
window.addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (!$('#player').classList.contains('active')) return;
    const keep = Game.target ?? (Game.notes[Game.next] || {}).midi ?? 60;
    KB.layout(); if (Game.target != null) KB.set(Game.target, 'target', true);
    Game.resize(); KB.ensureVisible(keep, false); Game.draw();
  }, 120);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && Game.running && !Game.free) { Game.paused = true; $('#pause-btn').textContent = '▶'; } });

renderHome();
