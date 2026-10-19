'use strict';
/* Motore audio: strumenti sintetizzati con Web Audio (nessun file da scaricare). */
const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

const INSTRUMENTS = {
  piano: { name: 'Pianoforte', icon: '🎹' },
  honkytonk: { name: 'Piano honky-tonk', icon: '🤠' },
  epiano: { name: 'Piano elettrico', icon: '🎛️' },
  churchorgan: { name: 'Organo da chiesa', icon: '⛪' },
  rockorgan: { name: 'Organo rock', icon: '🎚️' },
  synthbrass: { name: 'Synth brass anni \'80', icon: '🌆' },
  synthpoly: { name: 'Synth pop', icon: '💾' },
  synthlead: { name: 'Synth solista', icon: '🔊' },
  synthbass: { name: 'Synth basso', icon: '🕺' },
  chip: { name: 'Videogioco 8-bit', icon: '👾' },
  distguitar: { name: 'Chitarra distorta', icon: '🎸' },
  cleanguitar: { name: 'Chitarra elettrica', icon: '⚡' },
  acguitar: { name: 'Chitarra acustica', icon: '🪕' },
  banjo: { name: 'Banjo', icon: '🤠' },
  bass: { name: 'Basso elettrico', icon: '🎵' },
  harpsichord: { name: 'Clavicembalo', icon: '🏰' },
  strings: { name: 'Archi', icon: '🎻' },
  cello: { name: 'Violoncello', icon: '🎻' },
  pizzicato: { name: 'Archi pizzicati', icon: '🤏' },
  brass: { name: 'Ottoni', icon: '🎺' },
  sax: { name: 'Sassofono', icon: '🎷' },
  flute: { name: 'Flauto', icon: '🪈' },
  accordion: { name: 'Fisarmonica', icon: '🪗' },
  celesta: { name: 'Celesta', icon: '✨' },
  musicbox: { name: 'Carillon', icon: '🎁' },
  bells: { name: 'Campanelli', icon: '🔔' },
  xylophone: { name: 'Xilofono', icon: '🌈' }
};

const Audio2 = (() => {
  let ctx = null, master, dry, revIn, rev, comp;
  const ksCache = new Map();
  let shaperCurves = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    dry = ctx.createGain(); dry.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(2.6, 2.8);
    revIn = ctx.createGain(); revIn.connect(rev);
    const revOut = ctx.createGain(); revOut.gain.value = 0.9; rev.connect(revOut); revOut.connect(master);
    unlockIOS();
    return ctx;
  }
  // iPhone: con l'interruttore silenzioso attivo, Web Audio è muto senza un <audio> in riproduzione
  function unlockIOS() {
    try {
      const a = document.createElement('audio');
      a.setAttribute('x-webkit-airplay', 'deny'); a.loop = true; a.preload = 'auto';
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
      a.play().catch(() => {});
    } catch (e) { /* niente */ }
  }
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
    }
    return b;
  }
  function shaper(k) {
    if (shaperCurves[k]) return shaperCurves[k];
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return (shaperCurves[k] = c);
  }
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // Karplus-Strong: corda pizzicata realistica, calcolata una volta per nota
  function ksBuffer(midi, o) {
    const key = midi + '|' + o.id;
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, f = midiFreq(midi);
    const len = Math.floor(sr * o.len), buf = ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f - 0.5));
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev + o.bright * (r - prev); y[i] = prev; }
    // decadimento più lento sui bassi, più rapido sugli acuti
    const fb = Math.min(0.9995, o.decay + (1 - o.decay) * Math.max(0, (60 - midi)) / 60 * 0.6);
    for (let i = N; i < len; i++) y[i] = fb * (o.mix * y[i - N] + (1 - o.mix) * y[i - N - 1 < 0 ? 0 : i - N - 1]);
    let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(y[i]));
    if (mx > 0) for (let i = 0; i < len; i++) y[i] /= mx;
    ksCache.set(key, buf);
    return buf;
  }

  /* ---- mattoncini ---- */
  function osc(type, f, t, detune = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); return o; }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function lp(f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = Math.min(f, 18000); b.Q.value = q; return b; }
  function vibrato(t, oscs, rate, cents, delay = 0.25) {
    const l = osc('sine', rate, t), g = gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
    l.connect(g); oscs.forEach(o => g.connect(o.detune));
    return l;
  }
  // voce: out → dry + reverb. Restituisce {stop(t)}
  function voice(t, revAmt, vol) {
    const out = gain(1); const v = gain(vol); out.connect(v); v.connect(dry);
    if (revAmt > 0) { const s = gain(revAmt); v.connect(s); s.connect(revIn); }
    return { out, v, srcs: [], t };
  }
  function finish(V, release, natural) {
    // natural = durata massima naturale (strumenti a percussione)
    const t0 = V.t;
    const kill = when => { V.srcs.forEach(s => { try { s.stop(when); } catch (e) { } }); setTimeout(() => { try { V.v.disconnect(); } catch (e) { } }, (when - ctx.currentTime + 0.2) * 1000); };
    if (natural) kill(t0 + natural);
    let stopped = false;
    return {
      stop(when) {
        if (stopped) return; stopped = true;
        when = Math.max(when || ctx.currentTime, ctx.currentTime);
        const g = V.out.gain;
        g.cancelScheduledValues(when); g.setValueAtTime(g.value, when);
        g.setTargetAtTime(0, when, release / 4);
        kill(when + release + 0.05);
      }
    };
  }
  function adsr(param, t, peak, a, d, s, curve = 'exp') {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') param.setTargetAtTime(peak * s, t + a, d / 3);
  }

  const PLUCKS = {
    cleanguitar: { id: 'cg', len: 3, bright: .55, decay: .996, mix: .5, vol: .5, rev: .25, chorus: true },
    acguitar: { id: 'ag', len: 3, bright: .7, decay: .995, mix: .5, vol: .55, rev: .2, body: true },
    banjo: { id: 'bj', len: 1.4, bright: .95, decay: .985, mix: .55, vol: .45, rev: .12, body: true },
    harpsichord: { id: 'hc', len: 2.2, bright: .98, decay: .993, mix: .55, vol: .35, rev: .3 },
    pizzicato: { id: 'pz', len: 1, bright: .35, decay: .99, mix: .5, vol: .65, rev: .45 },
    bass: { id: 'eb', len: 2.5, bright: .4, decay: .997, mix: .5, vol: .75, rev: .03, lpf: 1800 }
  };
  /* ---- strumenti ---- */
  const synth = {
    piano(m, t, opts = {}) {
      const f = midiFreq(m), V = voice(t, 0.22, 0.42);
      const dec = 3.2 * Math.pow(0.5, (m - 48) / 18);
      const filt = lp(Math.min(f * 9, 9000)); filt.connect(V.out);
      filt.frequency.setValueAtTime(Math.min(f * 12, 12000), t);
      filt.frequency.setTargetAtTime(Math.max(f * 3, 800), t + 0.02, dec * 0.4);
      const P = [[1, 1], [2, .55], [3, .28], [4, .18], [5, .1], [6, .06], [7, .03]];
      const dets = opts.detune ? [-opts.detune, opts.detune] : [0];
      dets.forEach(dt => P.forEach(([k, a], i) => {
        const B = 0.0004, fk = f * k * Math.sqrt(1 + B * k * k);
        if (fk > 16000) return;
        const o = osc(i === 0 ? 'triangle' : 'sine', fk, t, dt), g = gain(0);
        const dk = dec / Math.pow(k, 0.6);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a / dets.length, t + 0.004);
        g.gain.setTargetAtTime(a * 0.35 / dets.length, t + 0.004, 0.12);
        g.gain.setTargetAtTime(0, t + 0.15, dk / 2.5);
        o.connect(g); g.connect(filt); V.srcs.push(o);
      }));
      // martelletto
      const n = ctx.createBufferSource(); n.buffer = noise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 5, 6000); bp.Q.value = 1.2;
      const ng = gain(0); ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      n.connect(bp); bp.connect(ng); ng.connect(V.out); n.start(t); n.stop(t + 0.05);
      return finish(V, 0.18, dec * 2.2);
    },
    honkytonk(m, t) { return synth.piano(m, t, { detune: 11 }); },
    epiano(m, t) {
      const f = midiFreq(m), V = voice(t, 0.2, 0.5);
      const c = osc('sine', f, t), mo = osc('sine', f, t), mg = gain(0);
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.25);
      mo.connect(mg); mg.connect(c.frequency);
      const tine = osc('sine', f * 14, t), tg = gain(0); tg.gain.setValueAtTime(0.08, t); tg.gain.setTargetAtTime(0, t, 0.03);
      tine.connect(tg); tg.connect(V.out);
      const g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 0.005); g.gain.setTargetAtTime(0, t + 0.01, 1.2);
      const trem = osc('sine', 4.5, t), trg = gain(0.12); trem.connect(trg); trg.connect(g.gain);
      c.connect(g); g.connect(V.out); V.srcs.push(c, mo, tine, trem);
      return finish(V, 0.25, 5);
    },
    churchorgan(m, t) {
      const f = midiFreq(m), V = voice(t, 0.6, 0.2);
      const env = gain(0); env.connect(V.out); adsr(env.gain, t, 1, 0.06, 0.2, 1);
      [[.5, .55], [1, 1], [2, .6], [3, .3], [4, .38], [6, .14], [8, .2], [12, .06]].forEach(([k, a]) => {
        if (f * k > 14000) return;
        const o = osc('sine', f * k, t, (Math.random() - .5) * 4), g = gain(a); o.connect(g); g.connect(env); V.srcs.push(o);
      });
      return finish(V, 0.35);
    },
    rockorgan(m, t) {
      const f = midiFreq(m), V = voice(t, 0.15, 0.17);
      const sh = ctx.createWaveShaper(); sh.curve = shaper(2.5); const post = lp(5000); sh.connect(post); post.connect(V.out);
      const env = gain(0); env.connect(sh); adsr(env.gain, t, 1, 0.008, 0.1, 1);
      const os = [];
      [[.5, 1], [1.5, .8], [1, 1], [2, .7], [3, .35], [4, .3]].forEach(([k, a]) => {
        const o = osc('sine', f * k, t), g = gain(a); o.connect(g); g.connect(env); V.srcs.push(o); os.push(o);
      });
      const pc = osc('sine', f * 3, t), pg = gain(0); pg.gain.setValueAtTime(0.7, t); pg.gain.setTargetAtTime(0, t, 0.12);
      pc.connect(pg); pg.connect(env); V.srcs.push(pc);
      V.srcs.push(vibrato(t, os, 6.3, 9, 0));
      return finish(V, 0.08);
    },
    synthbrass(m, t) {
      const f = midiFreq(m), V = voice(t, 0.3, 0.2);
      const fl = lp(f, 2.5); fl.connect(V.out);
      fl.frequency.setValueAtTime(f * 1.2, t); fl.frequency.linearRampToValueAtTime(Math.min(f * 9, 12000), t + 0.07);
      fl.frequency.setTargetAtTime(Math.min(f * 4, 8000), t + 0.07, 0.25);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.03, 0.4, 0.75);
      const os = [-9, 9, 0].map((d, i) => { const o = osc(i < 2 ? 'sawtooth' : 'square', i < 2 ? f : f / 2, t, d); const g = gain(i < 2 ? .6 : .3); o.connect(g); g.connect(env); V.srcs.push(o); return o; });
      V.srcs.push(vibrato(t, os, 5, 5, 0.4));
      return finish(V, 0.3);
    },
    synthpoly(m, t) {
      const f = midiFreq(m), V = voice(t, 0.28, 0.2);
      const fl = lp(f * 6, 1.5); fl.connect(V.out);
      fl.frequency.setValueAtTime(Math.min(f * 10, 12000), t); fl.frequency.setTargetAtTime(Math.min(f * 2.5, 6000), t, 0.2);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.005, 0.5, 0.45);
      [['sawtooth', -6], ['square', 6]].forEach(([ty, d]) => { const o = osc(ty, f, t, d), g = gain(.5); o.connect(g); g.connect(env); V.srcs.push(o); });
      return finish(V, 0.2);
    },
    synthlead(m, t) {
      const f = midiFreq(m), V = voice(t, 0.22, 0.2);
      const fl = lp(Math.min(f * 5, 9000), 3); fl.connect(V.out);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.01, 0.3, 0.8);
      const o = osc('square', f, t), o2 = osc('sawtooth', f, t, 7), g2 = gain(.4);
      o.connect(env); o2.connect(g2); g2.connect(env); V.srcs.push(o, o2, vibrato(t, [o, o2], 5.5, 14, 0.3));
      return finish(V, 0.12);
    },
    synthbass(m, t) {
      const f = midiFreq(m), V = voice(t, 0.05, 0.42);
      const fl = lp(f * 8, 6); fl.connect(V.out);
      fl.frequency.setValueAtTime(Math.min(f * 14, 6000), t); fl.frequency.setTargetAtTime(f * 2, t, 0.09);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.004, 0.6, 0.5);
      [-8, 8].forEach(d => { const o = osc('sawtooth', f, t, d); o.connect(env); V.srcs.push(o); });
      const sub = osc('sine', f, t), sg = gain(.8); sub.connect(sg); sg.connect(env); V.srcs.push(sub);
      return finish(V, 0.1);
    },
    chip(m, t) {
      const f = midiFreq(m), V = voice(t, 0, 0.16);
      const real = new Float32Array(32), imag = new Float32Array(32);
      for (let k = 1; k < 32; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25) * 2; // impulso 25%
      const o = ctx.createOscillator(); o.setPeriodicWave(ctx.createPeriodicWave(real, imag)); o.frequency.value = f; o.start(t);
      const env = gain(0); env.gain.setValueAtTime(1, t); env.gain.setTargetAtTime(0.7, t + 0.05, 0.1);
      o.connect(env); env.connect(V.out); V.srcs.push(o);
      return finish(V, 0.03);
    },
    distguitar(m, t) {
      const f = midiFreq(m), V = voice(t, 0.12, 0.13);
      const pre = gain(1), sh = ctx.createWaveShaper(); sh.curve = shaper(40); sh.oversample = '4x';
      const cab = lp(3200, 1), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = 5; mid.Q.value = 0.8;
      pre.connect(sh); sh.connect(hp); hp.connect(mid); mid.connect(cab); cab.connect(V.out);
      const env = gain(0); env.connect(pre); adsr(env.gain, t, 1, 0.004, 1.2, 0.55);
      // power chord: nota + quinta + ottava
      [[1, 0, .7], [1, 12, .7], [1.4983, 0, .45], [2, 0, .3]].forEach(([k, d, a]) => {
        const o = osc('sawtooth', f * k, t, d), g = gain(a); o.connect(g); g.connect(env); V.srcs.push(o);
      });
      return finish(V, 0.12);
    },
    cleanguitar(m, t) { return pluck(m, t, PLUCKS.cleanguitar); },
    acguitar(m, t) { return pluck(m, t, PLUCKS.acguitar); },
    banjo(m, t) { return pluck(m, t, PLUCKS.banjo); },
    harpsichord(m, t) {
      const a = pluck(m, t, PLUCKS.harpsichord);
      const b = pluck(m + 12, t, { ...PLUCKS.harpsichord, vol: .14 });
      return { stop(w) { a.stop(w); b.stop(w); } };
    },
    pizzicato(m, t) { return pluck(m, t, PLUCKS.pizzicato); },
    bass(m, t) {
      const a = pluck(m, t, PLUCKS.bass);
      const f = midiFreq(m), V = voice(t, 0, 0.25), s = osc('sine', f, t), g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.01); g.gain.setTargetAtTime(0.4, t + 0.01, 0.4);
      s.connect(g); g.connect(V.out); V.srcs.push(s);
      const b = finish(V, 0.08);
      return { stop(w) { a.stop(w); b.stop(w); } };
    },
    strings(m, t, o = {}) {
      const f = midiFreq(m), V = voice(t, 0.45, o.vol || 0.14);
      const fl = lp(Math.min(f * (o.bright || 5), 7000), 0.8); fl.connect(V.out);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, o.att || 0.12, 0.5, 0.85);
      const os = [-12, 0, 12].map(d => { const x = osc('sawtooth', f, t, d); x.connect(env); V.srcs.push(x); return x; });
      V.srcs.push(vibrato(t, os, 5.4, 12, 0.2));
      return finish(V, 0.4);
    },
    cello(m, t) { return synth.strings(m, t, { bright: 3.5, att: 0.08, vol: 0.18 }); },
    brass(m, t) {
      const f = midiFreq(m), V = voice(t, 0.35, 0.18);
      const fl = lp(f, 1.2); fl.connect(V.out);
      fl.frequency.setValueAtTime(f * 1.5, t); fl.frequency.linearRampToValueAtTime(Math.min(f * 8, 10000), t + 0.05);
      fl.frequency.setTargetAtTime(Math.min(f * 4.5, 7000), t + 0.05, 0.2);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.035, 0.3, 0.8);
      const os = [-4, 4].map(d => { const x = osc('sawtooth', f, t, d); x.connect(env); V.srcs.push(x); return x; });
      V.srcs.push(vibrato(t, os, 5.2, 10, 0.35));
      return finish(V, 0.15);
    },
    sax(m, t) {
      const f = midiFreq(m), V = voice(t, 0.3, 0.2);
      const pk1 = ctx.createBiquadFilter(); pk1.type = 'peaking'; pk1.frequency.value = 700; pk1.gain.value = 8; pk1.Q.value = 1.5;
      const pk2 = ctx.createBiquadFilter(); pk2.type = 'peaking'; pk2.frequency.value = 1600; pk2.gain.value = 6; pk2.Q.value = 2;
      const fl = lp(Math.min(f * 6, 5000), 1); pk1.connect(pk2); pk2.connect(fl); fl.connect(V.out);
      const env = gain(0); env.connect(pk1); adsr(env.gain, t, 1, 0.04, 0.3, 0.8);
      const a = osc('sawtooth', f, t), b = osc('square', f, t, 3), bg = gain(.35);
      a.connect(env); b.connect(bg); bg.connect(env); V.srcs.push(a, b, vibrato(t, [a, b], 5, 16, 0.3));
      return finish(V, 0.12);
    },
    flute(m, t) {
      const f = midiFreq(m), V = voice(t, 0.4, 0.33);
      const env = gain(0); env.connect(V.out); adsr(env.gain, t, 1, 0.07, 0.3, 0.85);
      const a = osc('sine', f, t), b = osc('triangle', f * 2, t), bg = gain(.12);
      a.connect(env); b.connect(bg); bg.connect(env);
      const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
      const ng = gain(.12); n.connect(bp); bp.connect(ng); ng.connect(env); n.start(t);
      V.srcs.push(a, b, n, vibrato(t, [a, b], 5, 10, 0.3));
      return finish(V, 0.12);
    },
    accordion(m, t) {
      const f = midiFreq(m), V = voice(t, 0.2, 0.12);
      const fl = lp(Math.min(f * 6, 6000), 1); fl.connect(V.out);
      const env = gain(0); env.connect(fl); adsr(env.gain, t, 1, 0.04, 0.2, 0.9);
      [['square', 0, .6], ['square', 14, .6], ['sawtooth', -1200, .4]].forEach(([ty, d, a]) => {
        const o = osc(ty, f, t, d), g = gain(a); o.connect(g); g.connect(env); V.srcs.push(o);
      });
      return finish(V, 0.1);
    },
    celesta(m, t) { return bell(m, t, [[1, 1, 1.6], [2, .25, .5], [4, .35, .25], [6.8, .08, .12]], 0.35, 0.4); },
    musicbox(m, t) { return bell(m + 12, t, [[1, 1, 1.4], [3, .2, .25], [5.4, .12, .12], [8.6, .05, .06]], 0.4, 0.38); },
    xylophone(m, t) { return bell(m + 12, t, [[1, 1, .35], [3.93, .4, .08], [9.2, .15, .03]], 0.2, 0.5); },
    bells(m, t) {
      const f = midiFreq(m + 12), V = voice(t, 0.4, 0.3);
      const c = osc('sine', f, t), mo = osc('sine', f * 3.5, t), mg = gain(0);
      mg.gain.setValueAtTime(f * 2.5, t); mg.gain.setTargetAtTime(f * 0.2, t, 0.4);
      mo.connect(mg); mg.connect(c.frequency);
      const g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, 0.9);
      c.connect(g); g.connect(V.out); V.srcs.push(c, mo);
      return finish(V, 0.8, 4);
    }
  };
  function bell(m, t, partials, rev, vol) {
    const f = midiFreq(m), V = voice(t, rev, vol);
    let maxd = 0;
    partials.forEach(([k, a, d]) => {
      if (f * k > 16000) return;
      const o = osc('sine', f * k, t), g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, d);
      o.connect(g); g.connect(V.out); V.srcs.push(o); maxd = Math.max(maxd, d);
    });
    return finish(V, 0.6, maxd * 6);
  }
  function pluck(m, t, o) {
    const V = voice(t, o.rev, o.vol);
    const s = ctx.createBufferSource(); s.buffer = ksBuffer(m, o);
    let node = s;
    if (o.body) { const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 220; pk.gain.value = 5; pk.Q.value = 1; node.connect(pk); node = pk; }
    if (o.lpf) { const f = lp(o.lpf); node.connect(f); node = f; }
    node.connect(V.out);
    if (o.chorus) {
      const d = ctx.createDelay(); d.delayTime.value = 0.012; const l = osc('sine', 0.8, t), lg = gain(0.003);
      l.connect(lg); lg.connect(d.delayTime); const dg = gain(.5); node.connect(d); d.connect(dg); dg.connect(V.out); V.srcs.push(l);
    }
    s.start(t); V.srcs.push(s);
    return finish(V, 0.15, o.len);
  }

  return {
    init,
    get ctx() { return ctx; },
    now() { return ctx ? ctx.currentTime : 0; },
    // suona una nota: dur in secondi (o null = tenuta finché non si chiama stop)
    play(ins, midi, when, dur) {
      init();
      const t = Math.max(when || ctx.currentTime, ctx.currentTime);
      const fn = synth[ins] || synth.piano;
      const v = fn(midi, t);
      if (dur != null) v.stop(t + dur);
      return v;
    },
    click(when, accent) {
      init();
      const t = when || ctx.currentTime, o = osc('square', accent ? 1760 : 1320, t), g = gain(0);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g); g.connect(master); o.stop(t + 0.06);
    },
    // piccolo jingle di vittoria
    fanfare(ins) {
      init(); const t = ctx.currentTime + 0.05;
      [[72, 0], [76, .12], [79, .24], [84, .36]].forEach(([m, d]) => this.play(ins === 'chip' ? 'chip' : 'bells', m, t + d, d === .36 ? 0.8 : 0.15));
    },
    setVolume(v) { init(); master.gain.value = v; },
    warmup(ins, midis) { // precalcola i buffer delle corde pizzicate (evita scatti alla prima nota)
      init();
      const o = PLUCKS[ins]; if (!o) return;
      midis.forEach(m => { ksBuffer(m, o); if (ins === 'harpsichord') ksBuffer(m + 12, o); });
    }
  };
})();
