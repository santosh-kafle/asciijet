// Synthesised sound (Web Audio, no files): turbine whine, jet roar, afterburner rumble and crackle,
// the ignition thump, turboprop drone, bay doors and UI ticks. Browsers only allow audio after a
// click or key press, so the context starts on the first gesture after sound is switched on.
class JetAudio {
  constructor() { this.on = false; this.ctx = null; this.abWas = false; this.last = {}; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const c = this.ctx = new AC();
    const master = this.master = c.createGain(); master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp).connect(c.destination);

    // noise buffers: white for roar and crackle, brown for the reheat rumble
    const len = c.sampleRate * 2, white = c.createBuffer(1, len, c.sampleRate), brown = c.createBuffer(1, len, c.sampleRate);
    const w = white.getChannelData(0), b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
    this.white = white;
    const loop = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const gain = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };

    // jet roar
    this.roarLP = filt('lowpass', 400); this.roarG = gain();
    loop(white).connect(this.roarLP).connect(this.roarG).connect(master);
    // turbine whine: two detuned tones through a resonant band-pass
    this.wA = c.createOscillator(); this.wA.type = 'sawtooth';
    this.wB = c.createOscillator(); this.wB.type = 'sine';
    this.whBP = filt('bandpass', 1500, 6); this.whG = gain();
    this.wA.connect(this.whBP); this.wB.connect(this.whBP); this.whBP.connect(this.whG).connect(master);
    this.wA.start(); this.wB.start();
    // afterburner rumble and crackle
    this.abLP = filt('lowpass', 220); this.abG = gain();
    loop(brown).connect(this.abLP).connect(this.abG).connect(master);
    this.crHP = filt('highpass', 2500); this.crG = gain();
    loop(white).connect(this.crHP).connect(this.crG).connect(master);
    // turboprop: blade-passing tones of two contra-rotating rows beat against each other
    this.pA = c.createOscillator(); this.pA.type = 'sawtooth';
    this.pB = c.createOscillator(); this.pB.type = 'sawtooth';
    this.pLP = filt('lowpass', 500); this.pG = gain();
    this.pA.connect(this.pLP); this.pB.connect(this.pLP); this.pLP.connect(this.pG).connect(master);
    this.pA.start(); this.pB.start();
    this.set(master.gain, 0.8, 0.3);
    return true;
  }

  set(param, v, tc = 0.12) { if (this.ctx) param.setTargetAtTime(v, this.ctx.currentTime, tc); }

  toggle(on) {
    this.on = on;
    if (on) this.start();
    if (this.ctx) this.set(this.master.gain, on ? 0.8 : 0, 0.15);
  }

  // Called about 30 times a second with the engine state.
  update({ thr, mil, ab, type, n, big, rear, zoom }) {
    if (!this.ctx || !this.on) return;
    const spool = clamp(thr / mil, 0, 1), abU = ab ? clamp((thr - mil) / (1 - mil), 0, 1) : 0;
    const lift = (0.55 + 0.45 * rear) * clamp(1.15 / zoom, 0.4, 1.6) * (n > 2 ? 1.1 : 1);
    const pitch = big ? 0.62 : 1;
    if (type === 'turboprop') {
      const rpm = 0.35 + 0.65 * spool, f = 49 * rpm;         // NK-12: 735 rpm x 4 blades
      this.set(this.pA.frequency, f); this.set(this.pB.frequency, f * 1.035);
      this.set(this.pLP.frequency, 250 + 500 * spool);
      this.set(this.pG.gain, (0.08 + 0.3 * spool) * lift);
      this.set(this.whG.gain, 0.02 * spool * lift); this.set(this.wA.frequency, 700 + 900 * spool);
      this.set(this.roarG.gain, (0.03 + 0.1 * spool) * lift); this.set(this.roarLP.frequency, 300 + 500 * spool);
      this.set(this.abG.gain, 0); this.set(this.crG.gain, 0);
      return;
    }
    this.set(this.pG.gain, 0);
    const fan = type === 'fan';                                // high-bypass engines whine more and roar less
    const wf = (fan ? 1300 : 900) + (fan ? 2600 : 2400) * spool;
    this.set(this.wA.frequency, wf * pitch); this.set(this.wB.frequency, wf * 1.5 * pitch);
    this.set(this.whBP.frequency, wf * 1.2 * pitch);
    this.set(this.whG.gain, (fan ? 0.07 : 0.035) * (0.3 + 0.7 * spool) * lift);
    this.set(this.roarLP.frequency, (260 + 2200 * spool ** 1.3 + 1200 * abU) * pitch);
    this.set(this.roarG.gain, (0.04 + (fan ? 0.22 : 0.34) * spool ** 1.2 + 0.2 * abU) * lift);
    this.set(this.abG.gain, ab && thr > mil ? (0.45 + 0.45 * abU) * lift : 0, 0.08);
    this.set(this.abLP.frequency, 160 + 180 * abU);
    this.set(this.crG.gain, ab && thr > mil ? (0.02 + 0.05 * abU) * lift * (0.6 + 0.8 * Math.random()) : 0, 0.03);
    const lit = ab && thr > mil + 0.005;
    if (lit && !this.abWas) this.thump(lift);
    this.abWas = lit;
  }

  // Afterburner light-off: a low thud with a burst of filtered noise.
  thump(k = 1) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    g.gain.setValueAtTime(0.9 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
    this.burst(t, 0.35, 1800, 200, 0.6 * k);
  }
  burst(t, dur, f0, f1, v, type = 'lowpass') {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.white; f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  // Weapon bay doors: hydraulic whir, then the clunk of the doors locking.
  bay(open) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 700;
    o.frequency.setValueAtTime(open ? 150 : 220, t); o.frequency.linearRampToValueAtTime(open ? 230 : 140, t + 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.75);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.8);
    this.burst(t + 0.72, 0.18, 900, 120, 0.5, 'bandpass');
    const k = c.createOscillator(), kg = c.createGain();
    k.frequency.setValueAtTime(110, t + 0.72); k.frequency.exponentialRampToValueAtTime(50, t + 0.9);
    kg.gain.setValueAtTime(0.5, t + 0.72); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    k.connect(kg).connect(this.master); k.start(t + 0.72); k.stop(t + 1);
  }
  // Store change: a short latch click.
  click() {
    if (!this.ctx || !this.on) return;
    this.burst(this.ctx.currentTime, 0.06, 3000, 800, 0.35, 'bandpass');
  }
}
const audio = new JetAudio();
