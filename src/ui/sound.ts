/**
 * Tiny synthesised sound effects (no audio files). Browsers only allow audio after a
 * user gesture, so the AudioContext is created lazily on first use.
 */
export type SoundName = 'gulp' | 'clink' | 'pour' | 'buy' | 'beer' | 'freeRound' | 'streak' | 'denied';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;

  /** Call from a user gesture (pointerdown/keydown) so playback is allowed. */
  unlock(): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // One second of white noise, reused for fizzy and gulpy sounds.
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  play(name: SoundName, detail = 0): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'gulp': return this.gulp(t);
      case 'clink': return this.clink(t);
      case 'pour': return this.fizz(t, 0.5, 2400, 0.25);
      case 'buy': return this.notes(t, [660, 990], 0.07, 'triangle', 0.25);
      case 'beer': return this.notes(t, [523, 659, 784], 0.09, 'triangle', 0.3);
      case 'freeRound': return this.notes(t, [523, 659, 784, 1047, 1319], 0.08, 'square', 0.12);
      case 'streak': return this.notes(t, [440 * Math.pow(2, Math.min(detail, 12) / 12)], 0.08, 'sine', 0.18);
      case 'denied': return this.notes(t, [180, 140], 0.08, 'sawtooth', 0.08);
    }
  }

  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master!);
    return g;
  }

  private notes(t: number, freqs: number[], step: number, type: OscillatorType, peak: number) {
    freqs.forEach((f, i) => {
      const start = t + i * step;
      const o = this.ctx!.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(this.env(start, peak, 0.01, step * 2.5));
      o.start(start);
      o.stop(start + step * 3);
    });
  }

  /** A low, throaty swallow: filtered noise with a falling pitch. */
  private gulp(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(520, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.16);
    src.connect(f).connect(this.env(t, 0.5, 0.02, 0.16));
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.22);
  }

  /** Glass on glass: two bright, quickly-fading partials. */
  private clink(t: number) {
    for (const [f, peak] of [[2350, 0.22], [3510, 0.12]] as const) {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * (0.98 + Math.random() * 0.04);
      o.connect(this.env(t, peak, 0.003, 0.35));
      o.start(t);
      o.stop(t + 0.4);
    }
  }

  /** Fizz of a pint being poured. */
  private fizz(t: number, duration: number, freq: number, peak: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + duration * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.master!);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 0.4);
    src.stop(t + duration);
  }
}
