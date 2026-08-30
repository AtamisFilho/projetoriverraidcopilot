/* =========================================================================
 * River Raid Remaster — Motor de áudio sintetizado (WebAudio API)
 * Sem assets externos: tudo gerado por osciladores e ruído.
 * Trilha dinâmica que acelera com o capítulo + alerta de combustível.
 * ========================================================================= */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicTempo = 132;
  private musicOn = false;
  muted = false;

  /** Deve ser chamado a partir de um gesto do usuário */
  init() {
    if (this.ctx) return;
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);

    // Buffer de ruído para explosões
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    this.ctx?.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /* ------------------------- Efeitos sonoros ------------------------- */

  shoot() {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.09);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  explode(size: 1 | 2 | 3 = 1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.now();
    const dur = 0.28 + size * 0.22;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400 / size, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4 + size * 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur);
    // Sub-boom
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120 / size, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + dur);
    og.gain.setValueAtTime(0.32, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.now();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const start = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  powerup() {
    if (!this.ctx) return;
    const t = this.now();
    const notes = [392, 523.25, 659.25, 1046.5];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.1, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  /** Bipe duplo urgente — alerta de combustível crítico (≤10s) */
  lowFuelBeep() {
    if (!this.ctx) return;
    const t = this.now();
    for (const off of [0, 0.14]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1244.5;
      const start = t + off;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  hit() {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  bossAlarm() {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sawtooth";
      const start = t + i * 0.3;
      osc.frequency.setValueAtTime(196, start);
      osc.frequency.linearRampToValueAtTime(392, start + 0.22);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.28);
    }
  }

  chapterFanfare() {
    if (!this.ctx) return;
    const t = this.now();
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "triangle";
      const start = t + i * 0.11;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.15, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(g).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  /* --------------------------- Motor do jato --------------------------- */

  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    const t = this.now();
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 52;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 240;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0001, t);
    this.engineGain.gain.exponentialRampToValueAtTime(0.07, t + 0.4);
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master!);
    this.engineOsc.start(t);
  }

  updateEngine(speedNorm: number) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter) return;
    const t = this.now();
    this.engineOsc.frequency.setTargetAtTime(46 + speedNorm * 70, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(200 + speedNorm * 600, t, 0.12);
  }

  stopEngine() {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.now();
    this.engineGain?.gain.setTargetAtTime(0.0001, t, 0.1);
    this.engineOsc.stop(t + 0.5);
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  /* ------------------------- Trilha dinâmica ------------------------- */

  startMusic(chapter = 1) {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.musicTempo = 126 + chapter * 8;
    this.scheduleStep();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setChapter(chapter: number) {
    this.musicTempo = 126 + chapter * 8;
  }

  private scheduleStep() {
    if (!this.musicOn || !this.ctx) return;
    const stepDur = 60 / this.musicTempo / 2; // colcheias
    const step = this.musicStep % 16;
    const t = this.now() + 0.05;
    const scale = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66];
    // Baixo pulsante
    if (step % 4 === 0) {
      this.tone("triangle", scale[0] * (step === 8 ? 1.5 : 1), t, stepDur * 1.8, 0.22, this.musicGain!);
    }
    // Arpejo tenso
    if (step % 2 === 1) {
      const idx = (this.musicStep * 3) % scale.length;
      this.tone("square", scale[idx] * 2, t, stepDur * 0.9, 0.05, this.musicGain!);
    }
    // Hi-hat de ruído
    if (step % 2 === 0 && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(f).connect(g).connect(this.musicGain!);
      src.start(t);
      src.stop(t + 0.05);
    }
    this.musicStep++;
    this.musicTimer = window.setTimeout(() => this.scheduleStep(), stepDur * 1000);
  }

  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    dest: AudioNode
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  destroy() {
    this.stopMusic();
    this.stopEngine();
    this.ctx?.close();
    this.ctx = null;
  }
}
