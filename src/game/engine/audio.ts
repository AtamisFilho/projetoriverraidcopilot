/**
 * River Raid Remaster — Motor de áudio procedural
 * ------------------------------------------------
 * Correções em relação ao código original (PDF):
 *  - O AudioContext não é mais criado no construtor (a política de autoplay
 *    dos navegadores bloqueia AudioContext sem gesto do usuário). A
 *    inicialização é preguiçosa, no primeiro clique/toque/tecla.
 *  - Nenhum arquivo externo de áudio é necessário: todos os efeitos e a
 *    trilha são sintetizados via osciladores/ruído (o código original
 *    referenciava assets que nunca foram criados).
 *  - A música é um sequenciador dinâmico cujo andamento e intensidade
 *    acompanham a fase, com padrão especial durante lutas de chefe.
 */

export type SfxName =
  | 'shoot'
  | 'explosion'
  | 'bigExplosion'
  | 'refuel'
  | 'powerup'
  | 'hit'
  | 'bridge'
  | 'bossAlert'
  | 'extraLife'
  | 'gameOver'
  | 'ui';

const NOTE = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12);

// Linha de baixo (semitons a partir de A2) — 16 passos
const BASS_PATTERN = [0, 0, 7, 0, 3, 3, 10, 3, 5, 5, 12, 5, 3, 3, 10, 7];
// Arpejo pentatônico menor (sem tons acima do baixo)
const ARP_PATTERN = [12, 15, 19, 22, 19, 15, 12, 15, 19, 22, 24, 22, 19, 15, 12, 10];
// Padrão de chefe: mais tenso
const BOSS_BASS = [0, 0, 1, 0, 0, 0, 6, 5, 0, 0, 1, 0, 8, 7, 6, 5];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private tempo = 104;
  private stageTempo = 104; // andamento base da fase atual
  private bossMode = false;
  private musicOn = false;

  muted = false;

  /** Inicialização preguiçosa — deve ser chamada a partir de um gesto do usuário. */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);

      // Buffer de ruído branco para explosões/percussão
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  /** Ajusta a trilha conforme a fase (andamento crescente). */
  setStage(stage: number): void {
    this.stageTempo = Math.min(104 + (stage - 1) * 6, 184);
    this.tempo = this.bossMode
      ? Math.max(this.stageTempo, 150)
      : this.stageTempo;
  }

  setBossMode(on: boolean): void {
    this.bossMode = on;
    // Ao SAIR do modo chefe, restaura o andamento da fase atual
    // (antes o tempo 150 "vazava" para o jogo normal até a próxima fase)
    this.tempo = on ? Math.max(this.stageTempo, 150) : this.stageTempo;
  }

  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduler(), 25);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduler(): void {
    if (!this.ctx || !this.musicOn) return;
    const lookahead = 0.12;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.step, this.nextNoteTime);
      const secondsPerBeat = 60 / this.tempo;
      this.nextNoteTime += secondsPerBeat / 4; // semicolcheias
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const bass = this.bossMode ? BOSS_BASS : BASS_PATTERN;

    // Baixo: notas longas em compasso
    if (step % 2 === 0) {
      this.tone(
        NOTE(bass[step] - 24),
        time,
        0.22,
        'triangle',
        0.9,
        this.musicGain
      );
    }
    // Caixa suave (ruído curto) nos tempos 4 e 12
    if (step === 4 || step === 12) {
      this.noise(time, 0.06, 1800, 0.25, this.musicGain);
    }
    // Chimbal nas ímpares
    if (step % 2 === 1) {
      this.noise(time, 0.025, 8000, 0.06, this.musicGain);
    }
    // Arpejo entra a partir de 128 BPM ou modo chefe
    if (this.tempo >= 128 || this.bossMode) {
      if (step % 2 === 0 || this.bossMode) {
        this.tone(
          NOTE(ARP_PATTERN[step] - 12),
          time,
          0.09,
          'square',
          0.12,
          this.musicGain
        );
      }
    }
  }

  private tone(
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private noise(
    time: number,
    dur: number,
    filterFreq: number,
    vol: number,
    dest: AudioNode
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private sweep(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    vol: number
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Dispara um efeito sonoro sintetizado. */
  play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;

    switch (name) {
      case 'shoot':
        this.sweep(880, 220, 0.08, 'square', 0.12);
        break;
      case 'explosion':
        this.noise(t, 0.35, 900, 0.55, this.sfxGain);
        this.sweep(160, 40, 0.3, 'sawtooth', 0.25);
        break;
      case 'bigExplosion':
        this.noise(t, 0.9, 600, 0.8, this.sfxGain);
        this.sweep(120, 25, 0.8, 'sawtooth', 0.35);
        this.sweep(300, 60, 0.5, 'triangle', 0.2);
        break;
      case 'refuel':
        this.sweep(300, 700, 0.18, 'sine', 0.25);
        break;
      case 'powerup': {
        // Arpejo ascendente rápido
        [0, 4, 7, 12].forEach((semi, i) => {
          this.tone(
            NOTE(semi),
            t + i * 0.06,
            0.12,
            'square',
            0.18,
            this.sfxGain as AudioNode
          );
        });
        break;
      }
      case 'hit':
        this.noise(t, 0.08, 4000, 0.2, this.sfxGain);
        this.sweep(500, 300, 0.06, 'square', 0.1);
        break;
      case 'bridge':
        this.noise(t, 0.6, 1200, 0.5, this.sfxGain);
        this.sweep(200, 50, 0.5, 'sawtooth', 0.3);
        break;
      case 'bossAlert':
        // Sirene: duas notas alternadas
        for (let i = 0; i < 3; i++) {
          this.tone(NOTE(0), t + i * 0.35, 0.16, 'sawtooth', 0.22, this.sfxGain);
          this.tone(NOTE(-5), t + i * 0.35 + 0.17, 0.16, 'sawtooth', 0.22, this.sfxGain);
        }
        break;
      case 'extraLife':
        [0, 7, 12, 19].forEach((semi, i) => {
          this.tone(
            NOTE(semi),
            t + i * 0.08,
            0.15,
            'triangle',
            0.25,
            this.sfxGain as AudioNode
          );
        });
        break;
      case 'gameOver':
        [12, 8, 5, 0].forEach((semi, i) => {
          this.tone(
            NOTE(semi),
            t + i * 0.22,
            0.3,
            'triangle',
            0.25,
            this.sfxGain as AudioNode
          );
        });
        break;
      case 'ui':
        this.sweep(600, 900, 0.06, 'sine', 0.15);
        break;
    }
  }

  destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
