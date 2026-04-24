// ═══════ WEB AUDIO SYNTHESIZED SOUND EFFECTS ═══════
export default class SoundFX {
  constructor() { this.ctx = null; this.on = true; this.vol = 0.4; }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { this.on = false; }
  }

  _p(fn) {
    if (!this.on || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    try { fn(this.ctx, this.ctx.currentTime); } catch {}
  }

  _osc(c, t, type, f1, f2, dur, g) {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(g * this.vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(c.destination);
    o.start(t); o.stop(t + dur);
  }

  _noise(c, t, dur, g) {
    const sr = c.sampleRate, buf = c.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const gn = c.createGain();
    gn.gain.setValueAtTime(g * this.vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(gn).connect(c.destination);
    s.start(t); s.stop(t + dur);
  }

  _filtNoise(c, t, dur, g, fStart, fEnd, q) {
    const sr = c.sampleRate, buf = c.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fStart, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(fEnd, 1), t + dur);
    bp.Q.value = q || 1.5;
    const gn = c.createGain();
    gn.gain.setValueAtTime(g * this.vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(bp).connect(gn).connect(c.destination);
    s.start(t); s.stop(t + dur);
  }

  // ─── Hit sounds ───
  lightHit() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 300, 100, 0.08, 0.35);
      this._noise(c, t, 0.04, 0.2);
    });
  }

  heavyHit() {
    this._p((c, t) => {
      this._osc(c, t, 'triangle', 120, 35, 0.15, 0.5);
      this._osc(c, t, 'sine', 200, 60, 0.1, 0.3);
      this._noise(c, t, 0.08, 0.35);
    });
  }

  kick() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 180, 50, 0.12, 0.4);
      this._noise(c, t, 0.05, 0.25);
    });
  }

  slash() {
    this._p((c, t) => {
      this._filtNoise(c, t, 0.12, 0.3, 3000, 800, 2);
      this._osc(c, t, 'sawtooth', 400, 150, 0.06, 0.12);
    });
  }

  pierce() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 500, 200, 0.06, 0.3);
      this._filtNoise(c, t, 0.08, 0.2, 4000, 1500, 3);
    });
  }

  // ─── Defense sounds ───
  block() {
    this._p((c, t) => {
      this._osc(c, t, 'square', 600, 200, 0.06, 0.18);
      this._osc(c, t, 'sine', 400, 150, 0.08, 0.12);
      this._noise(c, t, 0.03, 0.12);
    });
  }

  parry() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 1200, 600, 0.15, 0.3);
      this._osc(c, t, 'sine', 1800, 900, 0.1, 0.15);
      this._noise(c, t, 0.02, 0.08);
    });
  }

  counter() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 1400, 700, 0.12, 0.35);
      this._osc(c, t, 'triangle', 800, 300, 0.08, 0.2);
      this._noise(c, t + 0.02, 0.05, 0.22);
    });
  }

  dodge() {
    this._p((c, t) => {
      this._filtNoise(c, t, 0.18, 0.22, 500, 2500, 1.5);
    });
  }

  // ─── Grab / Throw ───
  grab() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 150, 80, 0.1, 0.35);
      this._noise(c, t, 0.04, 0.18);
    });
  }

  throwSfx() {
    this._p((c, t) => {
      this._filtNoise(c, t, 0.14, 0.3, 800, 200, 1);
      this._osc(c, t + 0.08, 'sine', 100, 40, 0.12, 0.4);
      this._noise(c, t + 0.08, 0.06, 0.25);
    });
  }

  // ─── Big events ───
  knockdown() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 100, 30, 0.2, 0.45);
      this._noise(c, t, 0.08, 0.3);
    });
  }

  ko() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 60, 20, 0.6, 0.6);
      this._osc(c, t, 'triangle', 100, 30, 0.4, 0.35);
      this._noise(c, t, 0.25, 0.45);
      this._noise(c, t + 0.1, 0.15, 0.25);
      this._noise(c, t + 0.2, 0.1, 0.15);
    });
  }

  weaponBreak() {
    this._p((c, t) => {
      this._osc(c, t, 'sawtooth', 800, 100, 0.3, 0.25);
      this._noise(c, t, 0.12, 0.4);
      this._noise(c, t + 0.04, 0.08, 0.3);
      this._noise(c, t + 0.08, 0.06, 0.2);
    });
  }

  victory() {
    this._p((c, t) => {
      [523, 659, 784, 1047].forEach((f, i) => {
        this._osc(c, t + i * 0.15, 'sine', f, f * 0.95, 0.25, 0.25);
        this._osc(c, t + i * 0.15, 'triangle', f * 0.5, f * 0.48, 0.2, 0.08);
      });
    });
  }

  roundStart() {
    this._p((c, t) => {
      this._osc(c, t, 'sine', 880, 440, 0.5, 0.3);
      this._osc(c, t, 'sine', 1320, 660, 0.3, 0.12);
    });
  }
}
