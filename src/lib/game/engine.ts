/* =========================================================================
 * River Raid Remaster — Motor do jogo
 * - Loop determinístico com timestep fixo (120 Hz lógico, render por RAF)
 * - Renderização HiDPI (devicePixelRatio até 3×) em coordenadas virtuais
 *   540×960 → nítido em telas modernas
 * - Rio procedural com margens fatais, ilhas, rochas e pontes
 * - 8 tipos de inimigo + 3 chefes + itens (benefícios) e armadilhas
 * - Combustível com ALERTA CRÍTICO a 10 segundos do fim
 * ========================================================================= */

import {
  GAME_CONST as G,
  VH,
  VW,
  ROW_H,
  type BossType,
  type EnemyType,
  type GameCallbacks,
  type PickupType,
  type RunResult,
  type StartOptions,
} from "./types";
import { CHAPTERS } from "./content";
import { drawBoss, drawEnemy, drawPickup, drawPlayer, drawRock, drawTurret } from "./sprites";
import { AudioEngine } from "./audio";
import { saveRun } from "./save";

/* ------------------------------ utilidades ------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToRgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

function mixHex(a: string, b: string, k: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(
    lerp(A[1], B[1], k)
  )},${Math.round(lerp(A[2], B[2], k))})`;
}

/* ------------------------------ paletas ------------------------------ */

interface Palette {
  waterA: string;
  waterB: string;
  bankLight: string;
  bankDark: string;
  foam: string;
  tree: string;
  treeDark: string;
  glitter: string;
}

const PALETTES: Palette[] = [
  {
    waterA: "#0e7490",
    waterB: "#0b4f6c",
    bankLight: "#2fae4d",
    bankDark: "#166534",
    foam: "#a5f3fc",
    tree: "#15803d",
    treeDark: "#14532d",
    glitter: "rgba(165,243,252,0.5)",
  },
  {
    waterA: "#b45309",
    waterB: "#7c2d12",
    bankLight: "#ca8a04",
    bankDark: "#713f12",
    foam: "#fed7aa",
    tree: "#a16207",
    treeDark: "#78350f",
    glitter: "rgba(254,215,170,0.5)",
  },
  {
    waterA: "#0f3d4a",
    waterB: "#07202a",
    bankLight: "#1c5d31",
    bankDark: "#0b3320",
    foam: "#67e8f9",
    tree: "#14532d",
    treeDark: "#052e16",
    glitter: "rgba(103,232,249,0.45)",
  },
];

/* ------------------------------ estruturas ------------------------------ */

interface RiverRow {
  left: number;
  right: number;
  islL: number; // -1 = sem ilha
  islR: number;
}

interface Bridge {
  row: number;
  hp: number;
  destroyed: boolean;
}

interface Enemy {
  type: EnemyType;
  x: number;
  worldY: number;
  vx: number;
  hp: number;
  t: number;
  seed: number;
  fireTimer: number;
  aim: number;
  hurt: number;
  radius: number;
}

interface Pickup {
  type: PickupType;
  x: number;
  worldY: number;
  seed: number;
}

interface Bullet {
  x: number;
  worldY: number;
  vx: number;
  homing: boolean;
  alive: boolean;
}

interface EnemyBullet {
  x: number;
  worldY: number;
  vx: number;
  vy: number; // velocidade em espaço de mundo
  alive: boolean;
}

interface Rock {
  x: number;
  worldY: number;
  seed: number;
  radius: number;
}

interface Particle {
  x: number;
  worldY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  fade: number;
}

interface Shockwave {
  x: number;
  worldY: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
}

interface FloatText {
  x: number;
  worldY: number;
  text: string;
  life: number;
  color: string;
  size: number;
}

interface Boss {
  type: BossType;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  t: number;
  fireT: number;
  specialT: number;
  hurt: number;
  dying: number;
}

export interface TouchInput {
  left: boolean;
  right: boolean;
  fire: boolean;
  accel: boolean;
  decel: boolean;
  special: boolean; // gatilho: pulso EMP
}

/* ------------------------------ motor ------------------------------ */

export class RiverRaidGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: GameCallbacks;
  audio = new AudioEngine();

  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private t = 0; // tempo total (animações)
  running = false;
  paused = false;
  private over = false;

  // render
  private dpr = 1;
  private scale = 1;
  private ro: ResizeObserver | null = null; // acompanha mudanças de layout (deck de controles)

  // mundo
  private rng = mulberry32((Date.now() & 0xffffffff) >>> 0);
  private scroll = 0;
  private rows = new Map<number, RiverRow>();
  private bridges = new Map<number, Bridge>();
  private nextBridgeM: number = G.levelLenM; // próxima ponte (marcador de fim de nível)
  private segRemain = 0;
  private segTotal = 1;
  private curCenter = VW / 2;
  private curWidth = 320;
  private tgtCenter = VW / 2;
  private tgtWidth = 320;
  private prevRow: RiverRow = { left: 110, right: 430, islL: -1, islR: -1 };
  private maxRow = -1;
  private islandRemain = 0;

  // entidades
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EnemyBullet[] = [];
  private rocks: Rock[] = [];
  private particles: Particle[] = [];
  private waves: Shockwave[] = [];
  private texts: FloatText[] = [];
  private boss: Boss | null = null;
  private bossSpawned = new Set<number>();
  private bossDefeated = new Set<number>();

  // spawn
  private spawnCursor = 900;
  private pickupCursor = 1500;
  private powerCursor = 3200;
  private rockCursor = 5000;

  // jogador
  private px = VW / 2;
  private pvx = 0;
  private alive = true;
  private deathTimer = 0;
  private invuln: number = G.invulnOnSpawn;
  private lives: number = G.lives;
  private throttle = 0.42;
  private speed: number = G.scrollBase;

  // combustível
  private fuel: number = G.fuelMax;
  private fuelCritical = false;
  private fuelBeepT = 0;

  // progresso
  private score = 0;
  private distanceM = 0;
  private level = 1; // nível atual — sobe a cada levelLenM metros (~1–2 min)
  private chapter = 1;
  private chapterLoop = 0;
  private enemiesKilled = 0;
  private fuelCollected = 0;
  private combo = 0;
  private comboT = 0;
  private everStarted = false; // pelo menos um start() nesta instância

  // armas
  private wShield = 0;
  private wTriple = 0;
  private wHoming = 0;
  private wTurbo = 0;
  private fireCd = 0;
  private lastShotSound = 0;

  // efeitos
  private shake = 0;
  private shakeMag = 0;
  private banner: { title: string; sub: string; life: number; color: string } | null = null;
  private palIndex = 0;
  private palMix = 1; // transição entre paletas

  // input
  private keys = new Set<string>();
  private touch: TouchInput = { left: false, right: false, fire: false, accel: false, decel: false, special: false };
  private padPauseEdge = false;
  private hudTick = 0;

  // pulso EMP (gatilho)
  private emp: number = G.empStart;
  private empCd = 0;
  private specialHeld = false;
  private specialLatch = false; // borda de subida capturada entre ticks (taps ultra-rápidos)

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D não suportado");
    this.ctx = ctx;
    this.cb = cb;
    this.resize();
    this.bindInput();
    // redimensiona quando o layout muda (ex.: barra de controles no mobile)
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    // hook de depuração/QA — permite injetar estados críticos em testes
    if (typeof window !== "undefined") {
      (window as unknown as { __rrGame?: RiverRaidGame }).__rrGame = this;
    }
  }

  /** Testes/QA: define o nível de combustível diretamente (0..100) */
  debugSetFuel(v: number) {
    this.fuel = clamp(v, 0, 100);
  }

  /** Testes/QA: teleporte seguro de distância (mantém consistência de nível/capítulo) */
  debugSetDistance(m: number) {
    this.scroll = Math.max(0, m * 10);
    this.distanceM = Math.max(0, m);
    this.syncLevelFromDistance(false);
    // avança cursores para não inundar a cena com spawns atrasados
    const ahead = this.scroll + VH + 240;
    this.spawnCursor = Math.max(this.spawnCursor, ahead - 600);
    this.pickupCursor = Math.max(this.pickupCursor, this.scroll + 600);
    this.powerCursor = Math.max(this.powerCursor, this.scroll + 1200);
    this.rockCursor = Math.max(this.rockCursor, this.scroll + 900);
    this.maxRow = Math.max(this.maxRow, Math.floor(this.scroll / ROW_H) - 2);
    this.generateAhead();
  }

  /* ---------------------- coordenadas mundo ↔ tela ----------------------
   * O jato voa para CIMA na tela; o mundo flui de cima para baixo.
   * Convenção: worldY CRESCE na direção do voo (para cima na tela).
   *   tela y = scroll + VH − worldY   (worldY maior = mais à frente/acima)
   * A câmera avança com `scroll`; conteúdo novo entra pela borda superior.
   * -------------------------------------------------------------------- */

  /** worldY → Y de tela */
  private sy(worldY: number): number {
    return this.scroll + VH - worldY;
  }

  /** Y de tela → worldY */
  private wy(screenY: number): number {
    return this.scroll + VH - screenY;
  }

  /** Posição do jogador no mundo (playerY é fixo em tela) */
  private get playerWY(): number {
    return this.scroll + VH - G.playerY;
  }

  /** Posição do chefe no mundo (boss.y é coordenada de tela) */
  private get bossWY(): number {
    return this.scroll + VH - (this.boss?.y ?? 0);
  }

  /* --------------------------- ciclo de vida --------------------------- */

  /**
   * Inicia a partida. Opções permitem: começar num nível escolhido, definir
   * quantas naves o piloto pode perder e retomar a pontuação/ponto exato
   * de uma partida anterior (continuar jogo salvo).
   */
  start(opts?: StartOptions) {
    if (this.running) return;
    const o: StartOptions = opts ?? { level: 1, lives: G.lives };
    this.lives = clamp(Math.round(o.lives ?? G.lives), G.livesMin, G.livesMax);
    if (o.score && o.score > 0) this.score = Math.round(o.score);
    if (o.enemiesKilled && o.enemiesKilled > 0) this.enemiesKilled = Math.round(o.enemiesKilled);
    if (o.fuelCollected && o.fuelCollected > 0) this.fuelCollected = Math.round(o.fuelCollected);

    // ponto de partida: distância exata (continuar) ou início do nível escolhido
    const level = clamp(Math.round(o.level ?? 1), G.levelMin, G.levelMax);
    const dist = Math.max(0, o.distanceM ?? (level - 1) * G.levelLenM);
    this.scroll = dist * 10;
    this.distanceM = dist;
    this.syncLevelFromDistance(false);
    // modo infinito: loop inicial coerente com o ponto de retomada
    this.chapterLoop = dist >= 11000 ? Math.max(1, Math.ceil((dist - 11000) / 5000)) : 0;

    // pontes: próxima ponte é o fim do nível corrente (com folga para não
    // nascer em cima dela ao continuar no meio de um nível)
    let nextBridgeM = Math.floor(dist / G.levelLenM + 1) * G.levelLenM;
    if (nextBridgeM * 10 < this.scroll + VH + 400) nextBridgeM += G.levelLenM;
    this.nextBridgeM = nextBridgeM;

    // cursores de spawn relativos à nova posição do mundo
    this.spawnCursor = this.scroll + 900;
    this.pickupCursor = this.scroll + 1500;
    this.powerCursor = this.scroll + 3200;
    this.rockCursor = this.scroll + 5000;
    // geração do rio começa perto da posição atual (histórico não é necessário)
    this.maxRow = Math.max(-1, Math.floor(this.scroll / ROW_H) - 2);
    this.generateAhead();

    this.running = true;
    this.everStarted = true;
    this.audio.init();
    this.audio.resume();
    this.audio.startEngine();
    this.audio.startMusic(this.chapter);
    this.showBanner(
      `NÍVEL ${this.level}`,
      `${CHAPTERS[this.chapter - 1].name} · Capítulo ${this.chapter}`,
      "#4ade80"
    );
    this.cb.onChapterStart(this.chapter, CHAPTERS[this.chapter - 1].name);
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Foto do estado atual da partida para salvar/continuar (localStorage) */
  getRunState() {
    if (!this.everStarted) return null;
    return {
      v: 1 as const,
      level: this.level,
      distanceM: Math.floor(this.distanceM),
      score: this.score,
      lives: Math.max(0, this.lives),
      chapter: this.chapter,
      enemiesKilled: this.enemiesKilled,
      fuelCollected: this.fuelCollected,
      ts: Date.now(),
    };
  }

  /** Nível/capítulo derivados da distância. O capítulo só AVANÇA (pela
   * distância — ex.: piloto ultrapassou o chefe — ou pela vitória sobre ele,
   * que é o caminho normal); nunca regride. `withEvents` emite banner/fanfarra. */
  private syncLevelFromDistance(withEvents: boolean) {
    const lv = Math.floor(this.distanceM / G.levelLenM) + 1;
    const dist = this.distanceM;
    const distChapter =
      dist >= G.chapterDistances[2] ? 3 : dist >= G.chapterDistances[1] ? 2 : 1;
    if (distChapter > this.chapter) {
      this.chapter = distChapter;
      this.palIndex = distChapter - 1;
      this.palMix = 0;
      if (withEvents) {
        this.showBanner(`CAPÍTULO ${distChapter}`, CHAPTERS[distChapter - 1].name, "#4ade80");
        this.audio.chapterFanfare();
        this.audio.setChapter(distChapter);
        this.cb.onChapterStart(distChapter, CHAPTERS[distChapter - 1].name);
      }
    }
    if (lv > this.level) {
      this.level = lv;
      if (withEvents) {
        const bonus = 200 + 100 * lv;
        this.addScore(bonus, this.px, this.playerWY + 120, "#4ade80", 18);
        this.showBanner(`NÍVEL ${lv}`, `Bônus +${bonus} pts · dificuldade aumenta`, "#4ade80");
        this.audio.chapterFanfare();
        this.pushHud();
      }
    } else if (lv < this.level) {
      this.level = Math.max(1, lv);
    }
    // capítulos já vencidos ao pular direto para um nível alto — e o chefe
    // do capítulo corrente, caso o ponto de retomada já o tenha ultrapassado
    for (let i = 0; i < this.chapter - 1; i++) this.bossSpawned.add(i);
    const chIdx = this.chapter - 1;
    const nextCh = CHAPTERS[chIdx + 1];
    const bossAt = nextCh ? nextCh.fromM - 260 : 11000 + this.chapterLoop * 5000;
    if (dist >= bossAt) this.bossSpawned.add(chIdx);
  }

  pause() {
    if (!this.paused && !this.over) {
      this.paused = true;
      this.audio.stopEngine();
      this.audio.stopMusic();
      this.pushHud();
    }
  }

  resume() {
    if (this.paused && !this.over) {
      this.paused = false;
      this.audio.resume();
      this.audio.startEngine();
      this.audio.startMusic(this.chapter);
      this.lastTime = performance.now();
      this.pushHud();
    }
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.audio.destroy();
  }

  setTouch(i: Partial<TouchInput>) {
    const was = this.touch.special;
    this.touch = { ...this.touch, ...i };
    // trava a borda de subida: um toque mais curto que 1 tick (1/120 s) ainda dispara
    if (!was && this.touch.special) this.specialLatch = true;
  }

  setMuted(m: boolean) {
    this.audio.setMuted(m);
  }

  /* ------------------------------ input ------------------------------ */

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if ((e.code === "KeyP" || e.code === "Escape") && !this.over) {
      if (this.paused) this.resume();
      else this.pause();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onResize = () => this.resize();

  private onVisibility = () => {
    if (document.hidden && !this.paused && !this.over) this.pause();
  };

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private readGamepad(): { lx: number; fire: boolean; accel: boolean; decel: boolean; pause: boolean; special: boolean } {
    const out = { lx: 0, fire: false, accel: false, decel: false, pause: false, special: false };
    if (typeof navigator === "undefined" || !navigator.getGamepads) return out;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.22) out.lx += ax;
      if (p.buttons[14]?.pressed) out.lx -= 1;
      if (p.buttons[15]?.pressed) out.lx += 1;
      out.fire = out.fire || !!(p.buttons[0]?.pressed || p.buttons[7]?.pressed || p.buttons[2]?.pressed);
      out.special = out.special || !!(p.buttons[1]?.pressed || p.buttons[4]?.pressed || p.buttons[5]?.pressed);
      out.accel = out.accel || !!(p.buttons[12]?.pressed || (p.axes[1] ?? 0) < -0.5);
      out.decel = out.decel || !!(p.buttons[13]?.pressed || (p.axes[1] ?? 0) > 0.5);
      const st = p.buttons[9]?.pressed;
      if (st && !this.padPauseEdge) out.pause = true;
      this.padPauseEdge = !!st;
      break;
    }
    return out;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / VW, h / VH);
  }

  /* ------------------------------ loop ------------------------------ */

  private frame = (now: number) => {
    if (!this.running) return;
    const dtReal = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.paused && !this.over) {
      this.acc += dtReal;
      const step = 1 / 120;
      let guard = 0;
      while (this.acc >= step && guard < 12) {
        this.update(step);
        this.acc -= step;
        guard++;
      }
    }
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  /* ------------------------------ update ------------------------------ */

  private update(dt: number) {
    this.t += dt;

    // --- input combinado ---
    const pad = this.readGamepad();
    if (pad.pause && !this.over) this.pause();
    const left =
      this.keys.has("ArrowLeft") ||
      this.keys.has("KeyA") ||
      this.touch.left ||
      pad.lx < -0.25;
    const right =
      this.keys.has("ArrowRight") ||
      this.keys.has("KeyD") ||
      this.touch.right ||
      pad.lx > 0.25;
    const accel =
      this.keys.has("ArrowUp") || this.keys.has("KeyW") || this.touch.accel || pad.accel;
    const decel =
      this.keys.has("ArrowDown") || this.keys.has("KeyS") || this.touch.decel || pad.decel;
    const fire =
      this.keys.has("Space") || this.keys.has("KeyJ") || this.touch.fire || pad.fire;
    // gatilho especial (pulso EMP) — detecção de borda (1 pulso por toque)
    const special =
      this.touch.special || this.keys.has("KeyK") || this.keys.has("KeyL") || pad.special;
    const specialEdge = this.specialLatch || (special && !this.specialHeld);
    this.specialLatch = false;
    this.specialHeld = special;

    // --- velocidade / throttle ---
    const targetThrottle = accel ? 1 : decel ? 0.04 : 0.42;
    this.throttle = lerp(this.throttle, targetThrottle, 1 - Math.exp(-dt * 3.2));
    const turbo = this.wTurbo > 0 ? 1.9 : 1;
    // dificuldade acompanha o nível (máx. +40% no nível 17+)
    const levelSpeed = 1 + Math.min(this.level - 1, 16) * 0.025;
    const targetSpeed =
      lerp(G.scrollMin, G.scrollMax, this.throttle) * turbo * levelSpeed;
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-dt * 2.4));

    if (this.alive) {
      // --- movimento horizontal ---
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      const ax = dir * G.playerAccel * (this.wTurbo > 0 ? 1.35 : 1);
      this.pvx += ax * dt;
      this.pvx *= Math.exp(-G.playerFriction * dt);
      this.pvx = clamp(this.pvx, -G.playerMaxVx, G.playerMaxVx);
      this.px += this.pvx * dt;

      // --- combustível ---
      const speedNorm = clamp((this.speed - G.scrollMin) / (G.scrollMax - G.scrollMin), 0, 1.6);
      const consumption = 1.0 + speedNorm * 1.3;
      this.fuel = Math.max(0, this.fuel - consumption * dt);
      const fuelSeconds = this.fuel / consumption;
      const nowCritical = fuelSeconds <= G.fuelWarnSeconds;
      if (nowCritical && !this.fuelCritical) {
        this.audio.lowFuelBeep();
        this.fuelBeepT = 0;
      }
      this.fuelCritical = nowCritical;
      if (this.fuelCritical) {
        this.fuelBeepT += dt;
        if (this.fuelBeepT >= 0.75) {
          this.audio.lowFuelBeep();
          this.fuelBeepT = 0;
        }
      }
      if (this.fuel <= 0) this.killPlayer();

      // --- disparo ---
      this.fireCd -= dt;
      if (fire && this.fireCd <= 0) {
        this.shoot();
        this.fireCd = 1 / G.fireRate;
      }

      // --- pulso EMP (gatilho) ---
      this.empCd = Math.max(0, this.empCd - dt);
      if (specialEdge && this.empCd <= 0 && this.emp > 0) this.fireEmp();

      // --- armas timers ---
      this.wShield = Math.max(0, this.wShield - dt);
      this.wTriple = Math.max(0, this.wTriple - dt);
      this.wHoming = Math.max(0, this.wHoming - dt);
      this.wTurbo = Math.max(0, this.wTurbo - dt);

      this.invuln = Math.max(0, this.invuln - dt);
    } else {
      // morte / respawn
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives <= 0) this.endGame();
        else this.respawn();
      }
    }

    // combo decai
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    // --- rolagem do mundo ---
    if (this.alive) this.scroll += this.speed * dt;
    this.distanceM = this.scroll / 10;

    // nível sobe a cada levelLenM metros (~1–2 min por nível) com bônus
    this.syncLevelFromDistance(true);

    // capítulo / chefe
    this.updateChapter();

    // geração do rio à frente
    this.generateAhead();
    // spawns
    this.updateSpawns();

    // atualiza entidades
    this.updateEnemies(dt);
    this.updatePickups();
    this.updateBullets(dt);
    this.updateEBullets(dt);
    this.updateBoss(dt);
    this.updateParticles(dt);

    // colisões
    if (this.alive) this.collide();

    // limpeza fora da tela
    this.cull();

    // efeitos
    this.shake = Math.max(0, this.shake - dt);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    this.palMix = Math.min(1, this.palMix + dt * 0.5);

    // HUD (~15 Hz)
    this.hudTick++;
    if (this.hudTick % 8 === 0) this.pushHud();
  }

  private pushHud() {
    const consumption = 1.0 + clamp((this.speed - G.scrollMin) / (G.scrollMax - G.scrollMin), 0, 1.6) * 1.3;
    this.cb.onHud({
      score: this.score,
      combo: this.combo,
      emp: this.emp,
      fuel: this.fuel,
      fuelSeconds: this.fuel / consumption,
      fuelCritical: this.fuelCritical && this.alive,
      speedKmh: Math.round(this.speed * 1.1),
      lives: this.lives,
      level: this.level,
      chapter: this.chapter,
      chapterName: CHAPTERS[this.chapter - 1].name,
      distanceM: Math.floor(this.distanceM),
      weapons: {
        shield: this.wShield,
        triple: this.wTriple,
        homing: this.wHoming,
        turbo: this.wTurbo,
      },
      bossActive: !!this.boss && this.boss.dying <= 0,
      bossName: this.boss?.name ?? "",
      bossHpPct: this.boss ? this.boss.hp / this.boss.maxHp : 0,
      paused: this.paused,
    });
  }

  /* --------------------------- capítulos/chefe --------------------------- */

  private updateChapter() {
    if (this.over || !this.alive) return;
    // chefe guarda o fim do capítulo
    const chIdx = this.chapter - 1;
    const nextCh = CHAPTERS[chIdx + 1];
    const bossAt = nextCh ? nextCh.fromM - 260 : 11000 + this.chapterLoop * 5000;
    if (this.distanceM >= bossAt && !this.bossSpawned.has(chIdx) && !this.boss) {
      this.spawnBoss(CHAPTERS[Math.min(chIdx, 2)].boss);
      this.bossSpawned.add(chIdx);
    }
  }

  private spawnBoss(type: BossType) {
    const info = { destroyer: "Contratorpedeiro Leviatã", fortress: "Fortaleza Voadora Águia de Ferro", carrier: "Porta-Aviões Titã" }[type];
    const hp = ({ destroyer: 60, fortress: 90, carrier: 140 }[type] ?? 60) * (1 + this.chapterLoop * 0.5);
    this.boss = {
      type,
      name: info,
      hp,
      maxHp: hp,
      x: VW / 2,
      y: type === "destroyer" ? 240 : 180,
      t: 0,
      fireT: 2.2,
      specialT: 3,
      hurt: 0,
      dying: 0,
    };
    this.audio.bossAlarm();
    this.showBanner("⚠ ALERTA", `${info} detectado`, "#f87171");
    this.pushHud();
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.hurt = Math.max(0, b.hurt - dt * 3);

    if (b.dying > 0) {
      b.dying -= dt;
      // explosões em cadeia
      if (Math.random() < dt * 22) {
        const ex = b.x + (Math.random() - 0.5) * 150;
        const ey = b.y + (Math.random() - 0.5) * 60;
        this.explodeAt(ex, this.wy(ey), 2);
      }
      if (b.dying <= 0) {
        this.onBossDefeated();
      }
      return;
    }

    // movimento por tipo
    if (b.type === "destroyer") {
      b.x = VW / 2 + Math.sin(b.t * 0.55) * 130;
      b.y = 240 + Math.sin(b.t * 0.3) * 26;
    } else if (b.type === "fortress") {
      b.x = VW / 2 + Math.sin(b.t * 0.5) * Math.sin(b.t * 0.23) * 165;
      b.y = 180 + Math.sin(b.t * 0.8) * 30;
    } else {
      b.x = VW / 2 + Math.sin(b.t * 0.35) * 110;
      b.y = 165 + Math.sin(b.t * 0.5) * 18;
    }

    const phase2 = b.hp < b.maxHp * 0.45;

    // ataques
    b.fireT -= dt;
    if (b.fireT <= 0) {
      if (b.type === "destroyer") {
        const n = phase2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const ang = Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
          this.spawnEBullet(b.x, this.wy(b.y + 30), Math.cos(ang) * 150, Math.sin(ang) * 190);
        }
        b.fireT = phase2 ? 1.15 : 1.7;
      } else if (b.type === "fortress") {
        for (let i = 0; i < 3; i++) {
          this.spawnEBullet(b.x - 40 + i * 40, this.wy(b.y + 24), (Math.random() - 0.5) * 40, 300);
        }
        b.fireT = phase2 ? 0.4 : 0.65;
      } else {
        const dx = this.px - b.x;
        const dy = G.playerY - b.y; // direção de tela até o jogador
        const len = Math.hypot(dx, dy) || 1;
        this.spawnEBullet(b.x - 26, this.wy(b.y + 20), (dx / len) * 210, (dy / len) * 210);
        this.spawnEBullet(b.x + 26, this.wy(b.y + 20), (dx / len) * 210, (dy / len) * 210);
        b.fireT = phase2 ? 1.4 : 2.1;
      }
      this.audio.hit();
    }

    // especial
    b.specialT -= dt;
    if (b.specialT <= 0) {
      if (b.type === "carrier" && this.enemies.length < 5) {
        // jatos decolam do porta-aviões e mergulham rumo ao jogador
        this.spawnEnemyAt("jet", clamp(b.x, 60, VW - 60), this.scroll + VH + 40);
      }
      if (b.type === "fortress") {
        for (let i = 0; i < 4; i++) {
          const ang = Math.PI / 2 + (i - 1.5) * 0.5;
          this.spawnEBullet(b.x, this.wy(b.y + 30), Math.cos(ang) * 120, Math.sin(ang) * 230);
        }
      }
      b.specialT = b.type === "carrier" ? 4 : 3.2;
    }
  }

  private onBossDefeated() {
    const b = this.boss!;
    const pts = ({ destroyer: 1500, fortress: 3000, carrier: 6000 }[b.type] ?? 1500) * (1 + this.chapterLoop);
    this.addScore(pts, b.x, this.wy(b.y), "#fbbf24", 22);
    this.explodeAt(b.x, this.wy(b.y), 3);
    this.audio.explode(3);
    // recompensa: recarga de uma carga do pulso EMP
    this.emp = Math.min(G.empMax, this.emp + 1);
    this.bossDefeated.add(this.chapter - 1);
    this.boss = null;

    const chIdx = this.chapter - 1;
    const next = CHAPTERS[chIdx + 1];
    if (next) {
      this.chapter = next.n;
      this.palIndex = this.chapter - 1;
      this.palMix = 0;
      this.showBanner(`CAPÍTULO ${next.n}`, next.name, "#4ade80");
      this.audio.chapterFanfare();
      this.audio.setChapter(this.chapter);
      this.cb.onChapterStart(this.chapter, next.name);
      // respawn seguro
      this.invuln = Math.max(this.invuln, 1.5);
      this.fuel = Math.max(this.fuel, 55);
    } else {
      // vitória — modo infinito continua
      this.chapterLoop++;
      this.showBanner("✓ MISSÃO CUMPRIDA", `Modo infinito — volta ${this.chapterLoop}`, "#facc15");
      this.audio.chapterFanfare();
      this.addScore(5000, VW / 2, this.wy(300), "#facc15", 20);
      this.bossSpawned.clear();
      this.invuln = Math.max(this.invuln, 1.5);
    }
    this.pushHud();
  }

  /* --------------------------- rio procedural --------------------------- */

  private generateAhead() {
    const need = Math.ceil((this.scroll + VH * 2) / ROW_H);
    for (let i = this.maxRow + 1; i <= need; i++) this.genRow(i);
    this.maxRow = Math.max(this.maxRow, need);
  }

  private genRow(i: number) {
    if (this.segRemain <= 0) {
      // novo segmento — rio estreita conforme o nível avança
      const minW = Math.max(155, 330 - (this.level - 1) * 12);
      const maxW = 400;
      this.segTotal = Math.round(28 + this.rng() * 46);
      this.segRemain = this.segTotal;
      this.tgtWidth = minW + this.rng() * (maxW - minW);
      const margin = (VW - this.tgtWidth) / 2 - 20;
      this.tgtCenter = clamp(this.curCenter + (this.rng() - 0.5) * 180, 60 + margin, VW - 60 - margin);
      // ilha em trechos largos
      this.islandRemain = this.tgtWidth > 300 && this.rng() < 0.34 && this.chapter >= 1
        ? Math.round(14 + this.rng() * 22)
        : 0;
    }
    const k = 1 - this.segRemain / this.segTotal; // progresso 0→1
    const ease = k * k * (3 - 2 * k);
    const width = lerp(this.curWidth, this.tgtWidth, ease);
    const center = lerp(this.curCenter, this.tgtCenter, ease);
    let islL = -1;
    let islR = -1;
    if (this.islandRemain > 0) {
      this.islandRemain--;
      const iw = Math.min(70, width * 0.22);
      islL = center - iw / 2;
      islR = center + iw / 2;
    }
    const row: RiverRow = {
      left: center - width / 2,
      right: center + width / 2,
      islL,
      islR,
    };
    this.rows.set(i, row);
    this.segRemain--;

    // ponte periódica — marca o FIM de cada nível (múltiplos de levelLenM)
    if (i * ROW_H >= this.nextBridgeM * 10) {
      this.bridges.set(i, { row: i, hp: 3, destroyed: false });
      this.nextBridgeM += G.levelLenM;
      // abre o rio após a ponte (gate clássico)
      this.segRemain = 0;
    }
    this.prevRow = row;
    if (this.segRemain === 0) {
      this.curWidth = width;
      this.curCenter = center;
    }
  }

  private rowAt(worldY: number): RiverRow {
    const idx = Math.floor(worldY / ROW_H);
    let r = this.rows.get(idx);
    if (!r) {
      r = this.prevRow;
    }
    return r;
  }

  /* ------------------------------ spawns ------------------------------ */

  private enemyWeights(): Array<[EnemyType, number]> {
    // dificuldade cresce com o nível (não mais com capítulos)
    const lv = this.level;
    if (lv <= 2)
      return [["patrol", 34], ["balloon", 24], ["drone", 42]];
    if (lv <= 5)
      return [["patrol", 16], ["balloon", 10], ["drone", 22], ["armored", 22], ["chopper", 18], ["jet", 12]];
    if (lv <= 8)
      return [["drone", 14], ["armored", 16], ["chopper", 20], ["jet", 16], ["turret", 12], ["stealth", 22]];
    return [["drone", 10], ["armored", 16], ["chopper", 18], ["jet", 18], ["turret", 14], ["stealth", 24]];
  }

  private pickType(): EnemyType {
    const weights = this.enemyWeights();
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = this.rng() * total;
    for (const [t, w] of weights) {
      r -= w;
      if (r <= 0) return t;
    }
    return "patrol";
  }

  private updateSpawns() {
    const ahead = this.scroll + VH + 240;
    // inimigos
    while (this.spawnCursor < ahead) {
      if (!this.boss || this.boss.dying > 0) {
        const row = this.rowAt(this.spawnCursor);
        const type = this.pickType();
        if (type === "turret") {
          // torres precisam de ilha ou margem larga
          if (row.islL > 0) {
            this.spawnEnemyAt("turret", (row.islL + row.islR) / 2, this.spawnCursor);
          } else {
            this.spawnEnemyAt("drone", this.randInRange(row), this.spawnCursor);
          }
        } else {
          this.spawnEnemyAt(type, this.randInRange(row), this.spawnCursor);
        }
      }
      const interval = Math.max(185, 400 - (this.level - 1) * 20);
      this.spawnCursor += interval * (0.75 + this.rng() * 0.6);
    }
    // combustível / itens
    while (this.pickupCursor < ahead) {
      const row = this.rowAt(this.pickupCursor);
      const roll = this.rng();
      let type: PickupType = "fuel";
      if (this.level >= 3 && roll < 0.22) type = "fakeFuel";
      else if (roll < 0.34) type = "fuelGold";
      this.pickups.push({
        type,
        x: this.randInRange(row),
        worldY: this.pickupCursor,
        seed: this.rng() * 100,
      });
      this.pickupCursor += 1350 * (0.8 + this.rng() * 0.5);
    }
    // power-ups
    while (this.powerCursor < ahead) {
      const row = this.rowAt(this.powerCursor);
      const types: PickupType[] = ["shield", "triple", "homing", "turbo"];
      this.pickups.push({
        type: types[Math.floor(this.rng() * types.length)],
        x: this.randInRange(row),
        worldY: this.powerCursor,
        seed: this.rng() * 100,
      });
      this.powerCursor += 2900 * (0.8 + this.rng() * 0.6);
    }
    // rochas
    while (this.rockCursor < ahead) {
      const row = this.rowAt(this.rockCursor);
      if (row.right - row.left > 300) {
        const side = this.rng() < 0.5 ? 0.32 : 0.68;
        this.rocks.push({
          x: lerp(row.left, row.right, side),
          worldY: this.rockCursor,
          seed: this.rng() * 100,
          radius: 17,
        });
      }
      this.rockCursor += 950 * (0.8 + this.rng() * 0.6);
    }
  }

  private randInRange(row: RiverRow) {
    const pad = 34;
    return lerp(row.left + pad, row.right - pad, this.rng());
  }

  private spawnEnemyAt(type: EnemyType, x: number, worldY: number) {
    const radii: Record<EnemyType, number> = {
      patrol: 24,
      balloon: 18,
      drone: 16,
      armored: 24,
      chopper: 18,
      jet: 17,
      turret: 18,
      stealth: 16,
    };
    this.enemies.push({
      type,
      x,
      worldY,
      vx: 0,
      hp: type === "armored" || type === "turret" ? 2 : 1,
      t: this.rng() * 10,
      seed: this.rng() * 100,
      fireTimer: 1.2 + this.rng() * 1.6,
      aim: Math.PI / 2,
      hurt: 0,
      radius: radii[type],
    });
  }

  private spawnEBullet(x: number, worldY: number, vx: number, vScreenY: number) {
    // converte velocidade de tela (y para baixo) → mundo (worldY cresce para cima na tela)
    this.ebullets.push({ x, worldY, vx, vy: this.speed - vScreenY, alive: true });
  }

  /* --------------------------- update entidades --------------------------- */

  private updateEnemies(dt: number) {
    const playerWorldY = this.playerWY;
    for (const e of this.enemies) {
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt * 4);
      const row = this.rowAt(e.worldY);
      // dificuldade acompanha velocidade e nível (máx. +30 px/s no nível 12+)
      const drift = (this.speed - 130) * 0.25 + Math.min(this.level * 2.5, 30);
      // "approach" = aproximação em TELA (px/s para baixo, rumo ao jogador).
      // Velocidade no mundo = −approach (a tela flui para baixo com o scroll).
      switch (e.type) {
        case "patrol":
        case "armored":
          e.worldY -= (20 + (e.type === "armored" ? 12 : 0) + drift) * dt;
          break;
        case "balloon":
          e.worldY -= (10 + drift * 0.5) * dt;
          e.x += Math.sin(e.t * 1.3 + e.seed) * 26 * dt;
          break;
        case "drone":
          e.worldY -= (45 + drift) * dt;
          e.x += Math.sin(e.t * 5 + e.seed) * 190 * dt;
          break;
        case "chopper": {
          e.worldY -= (18 + drift) * dt;
          const dx = this.px - e.x;
          e.x += clamp(dx, -120, 120) * 1.1 * dt;
          e.fireTimer -= dt;
          // atira quando está na tela e à frente do jogador (acima dele)
          if (e.fireTimer <= 0 && e.worldY > playerWorldY + 120 && e.worldY < this.scroll + VH) {
            const dy = e.worldY - playerWorldY; // > 0 = à frente (acima na tela)
            const len = Math.hypot(dx, dy) || 1;
            this.spawnEBullet(e.x, e.worldY - 10, (dx / len) * 175, (dy / len) * 175);
            e.fireTimer = 2.4 + this.rng() * 1.4;
            this.audio.hit();
          }
          break;
        }
        case "jet":
          e.worldY -= (300 + drift) * dt; // mergulho rápido em direção ao jogador
          break;
        case "stealth": {
          e.worldY -= (35 + drift) * dt;
          e.x += Math.sin(e.t * 2.4 + e.seed) * 150 * dt;
          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && e.worldY > playerWorldY + 140 && e.worldY < this.scroll + VH) {
            const dx = this.px - e.x;
            const dy = e.worldY - playerWorldY;
            const len = Math.hypot(dx, dy) || 1;
            this.spawnEBullet(e.x, e.worldY, (dx / len) * 195, (dy / len) * 195);
            e.fireTimer = 2.8 + this.rng() * 1.5;
          }
          break;
        }
        case "turret": {
          // fixa no mundo; mira no jogador
          const dx = this.px - e.x;
          const dy = e.worldY - playerWorldY; // direção de tela até o jogador
          e.aim = Math.atan2(dy, dx);
          e.fireTimer -= dt;
          const syE = this.sy(e.worldY);
          if (e.fireTimer <= 0 && syE > 40 && syE < VH - 260) {
            this.spawnEBullet(
              e.x + Math.cos(e.aim) * 22,
              e.worldY - Math.sin(e.aim) * 22,
              Math.cos(e.aim) * 185,
              Math.sin(e.aim) * 185
            );
            e.fireTimer = 1.9 + this.rng() * 0.9;
            this.audio.hit();
          }
          break;
        }
      }
      // mantém dentro do rio (exceto torre)
      if (e.type !== "turret") {
        e.x = clamp(e.x, row.left + 22, row.right - 22);
      }
    }
    // remove mortos, os que passaram do jogador (saíram por baixo)
    // e os que ainda estão muito à frente (acima do topo)
    this.enemies = this.enemies.filter(
      (e) => e.hp > 0 && e.worldY < this.scroll + VH + 280 && e.worldY > this.scroll - 140
    );
  }

  private updatePickups() {
    // itens e rochas são fixos no mundo (descem com o rio na tela);
    // margem de 300 acima do topo cobre a zona de spawn (240) — antes itens
    // nasciam além do limite de cull e morriam sem nunca aparecer
    this.pickups = this.pickups.filter(
      (p) => p.worldY < this.scroll + VH + 300 && p.worldY > this.scroll - 200
    );
    this.rocks = this.rocks.filter(
      (r) => r.worldY < this.scroll + VH + 300 && r.worldY > this.scroll - 200
    );
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.homing) {
        // busca alvo mais próximo (inimigos e chefe) — somente à frente
        let tx = this.px;
        let ty = this.scroll + VH + 200;
        let best = 1e9;
        for (const e of this.enemies) {
          if (e.worldY <= b.worldY) continue;
          const d = Math.hypot(e.x - b.x, e.worldY - b.worldY);
          if (d < best) {
            best = d;
            tx = e.x;
            ty = e.worldY;
          }
        }
        if (this.boss && this.boss.dying <= 0) {
          const d = Math.hypot(this.boss.x - b.x, this.bossWY - b.worldY);
          if (d < best) {
            tx = this.boss.x;
            ty = this.bossWY;
          }
        }
        const dx = tx - b.x;
        const dyScreen = ty - b.worldY;
        const hyp = Math.hypot(dx, dyScreen) || 1;
        const wantVx = (dx / hyp) * G.bulletSpeed * 0.85;
        b.vx = clamp(lerp(b.vx, wantVx, 1 - Math.exp(-dt * 7)), -260, 260);
      }
      // herda a velocidade do avião e dispara para frente (worldY cresce à frente)
      b.worldY += (this.speed + G.bulletSpeed) * dt;
      b.x += b.vx * dt;
      // rastro
      if (Math.random() < 0.5) {
        this.particles.push({
          x: b.x,
          worldY: b.worldY,
          vx: 0,
          vy: 0,
          life: 0.14,
          maxLife: 0.14,
          size: b.homing ? 3 : 2,
          color: b.homing ? "rgba(74,222,128,0.8)" : "rgba(253,224,71,0.7)",
          fade: 1,
        });
      }
    }
    // descarta ao sair pelo topo (à frente) ou morrer
    this.bullets = this.bullets.filter((b) => b.alive && b.worldY < this.scroll + VH + 60);
  }

  private updateEBullets(dt: number) {
    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.worldY += b.vy * dt;
    }
    this.ebullets = this.ebullets.filter(
      (b) => b.alive && b.worldY < this.scroll + VH + 60 && b.worldY > this.scroll - 100
    );
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.worldY += p.vy * dt;
      p.vx *= Math.exp(-dt * 1.4);
      p.vy *= Math.exp(-dt * 1.4);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const w of this.waves) {
      w.life -= dt;
      w.r = lerp(w.r, w.maxR, dt * 6);
    }
    this.waves = this.waves.filter((w) => w.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      // sobe 46 px/s na tela (worldY cresce para cima)
      t.worldY += (this.speed + 46) * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  /* ------------------------------ disparo ------------------------------ */

  private shoot() {
    const nose = this.playerWY + 26; // nariz do jato (26 px à frente na tela)
    const mk = (dx: number, vx: number, homing: boolean) =>
      this.bullets.push({
        x: this.px + dx,
        worldY: nose,
        vx,
        homing,
        alive: true,
      });
    if (this.wHoming > 0) {
      mk(0, 0, true);
    } else if (this.wTriple > 0) {
      mk(-14, -70, false);
      mk(0, 0, false);
      mk(14, 70, false);
    } else {
      mk(0, 0, false);
    }
    // flash do canhão
    this.particles.push({
      x: this.px,
      worldY: this.playerWY + 30,
      vx: 0,
      vy: this.speed, // acompanha a tela: fica junto ao canhão
      life: 0.08,
      maxLife: 0.08,
      size: 7,
      color: "rgba(254,240,138,0.95)",
      fade: 1,
    });
    if (this.t - this.lastShotSound > 0.09) {
      this.audio.shoot();
      this.lastShotSound = this.t;
    }
  }

  /* --------------------------- pulso EMP (gatilho) --------------------------- */

  private fireEmp() {
    this.emp--;
    this.empCd = G.empCooldown;
    // anel de choque em expansão a partir do jato
    this.waves.push({
      x: this.px,
      worldY: this.playerWY,
      r: 14,
      maxR: VW * 0.95,
      life: 0.55,
      maxLife: 0.55,
    });
    // dissipa todos os projéteis inimigos em cena
    for (const b of this.ebullets) {
      this.particles.push({
        x: b.x,
        worldY: b.worldY,
        vx: 0,
        vy: 0,
        life: 0.22,
        maxLife: 0.22,
        size: 6,
        color: "rgba(125,211,252,0.9)",
        fade: 1,
      });
    }
    this.ebullets = [];
    // dano em todos os inimigos visíveis
    for (const e of this.enemies) {
      if (e.worldY >= this.scroll - 40 && e.worldY <= this.scroll + VH + 40) {
        e.hp -= G.empDamage;
        if (e.hp <= 0) this.killEnemy(e, false);
      }
    }
    // o chefe sofre dano fixo
    if (this.boss && this.boss.dying <= 0) {
      this.boss.hp -= G.empBossDamage;
      this.boss.hurt = 0.7;
      if (this.boss.hp <= 0) {
        this.boss.dying = 2.2;
        this.addShake(0.8, 14);
      }
    }
    this.texts.push({
      x: this.px,
      worldY: this.playerWY + 52,
      text: "PULSO EMP",
      life: 1,
      color: "#7dd3fc",
      size: 15,
    });
    this.addShake(0.35, 7);
    this.audio.explode(2);
    this.pushHud();
  }

  /* ------------------------------ colisões ------------------------------ */

  private collide() {
    const pr = G.playerRadius;
    const pwY = this.playerWY;

    // margens / ilha / ponte
    const row = this.rowAt(pwY);
    const hitBank =
      this.px - pr < row.left + 3 ||
      this.px + pr > row.right - 3 ||
      (row.islL > 0 && this.px + pr > row.islL - 2 && this.px - pr < row.islR + 2);
    if (hitBank) {
      if (this.wShield > 0) {
        // escudo salva: empurra de volta ao canal
        const cx = (row.left + row.right) / 2;
        this.px = lerp(this.px, cx, 0.5);
        this.pvx = this.px < cx ? 160 : -160;
        this.addShake(0.15, 4);
      } else if (this.invuln <= 0) {
        this.killPlayer();
        return;
      }
    }
    // ponte intacta
    const rowIdx = Math.floor(pwY / ROW_H);
    for (let i = rowIdx - 1; i <= rowIdx + 1; i++) {
      const br = this.bridges.get(i);
      if (br && !br.destroyed) {
        if (this.wShield > 0) {
          br.hp = 0;
          br.destroyed = true;
          this.explodeAt((row.left + row.right) / 2, this.playerWY, 2);
        } else if (this.invuln <= 0) {
          this.killPlayer();
          return;
        }
      }
    }

    // rochas
    for (const r of this.rocks) {
      if (Math.hypot(r.x - this.px, r.worldY - pwY) < r.radius + pr - 3) {
        if (this.wShield > 0) {
          this.pvx = this.px < r.x ? -220 : 220;
        } else if (this.invuln <= 0) {
          this.killPlayer();
          return;
        }
      }
    }

    // inimigos (corpo a corpo)
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - this.px, e.worldY - pwY) < e.radius + pr - 4) {
        if (this.wShield > 0 || this.invuln > 0) {
          this.killEnemy(e, true);
        } else if (this.invuln <= 0) {
          this.killEnemy(e, true);
          this.killPlayer();
          return;
        }
      }
    }

    // chefe (corpo)
    if (this.boss && this.boss.dying <= 0) {
      if (
        Math.abs(this.boss.x - this.px) < 88 &&
        Math.abs(this.bossWY - pwY) < 46
      ) {
        if (this.wShield <= 0 && this.invuln <= 0) {
          this.killPlayer();
          return;
        }
      }
    }

    // itens
    for (const p of this.pickups) {
      if (Math.hypot(p.x - this.px, p.worldY - pwY) < 24 + pr - 6) {
        this.collect(p);
        p.worldY = -1e9; // marca para remoção
      }
    }
    this.pickups = this.pickups.filter((p) => p.worldY > -1e8);

    // balas do jogador × alvos
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - b.x, e.worldY - b.worldY) < e.radius + 5) {
          b.alive = false;
          e.hp -= 1;
          e.hurt = 1;
          if (e.hp <= 0) this.killEnemy(e, false);
          else this.audio.hit();
          break;
        }
      }
      if (!b.alive) continue;
      // balas × rochas (bloqueiam)
      for (const r of this.rocks) {
        if (Math.hypot(r.x - b.x, r.worldY - b.worldY) < r.radius + 4) {
          b.alive = false;
          this.sparkAt(b.x, b.worldY);
          break;
        }
      }
      if (!b.alive) continue;
      // balas × ponte
      const bRow = Math.floor(b.worldY / ROW_H);
      const br = this.bridges.get(bRow);
      if (br && !br.destroyed) {
        b.alive = false;
        br.hp -= 1;
        this.sparkAt(b.x, b.worldY);
        if (br.hp <= 0) {
          br.destroyed = true;
          this.addScore(500, b.x, b.worldY, "#fbbf24", 16);
          this.explodeAt((this.rowAt(b.worldY).left + this.rowAt(b.worldY).right) / 2, b.worldY, 2);
        }
        continue;
      }
      // balas × chefe
      if (this.boss && this.boss.dying <= 0) {
        if (
          Math.abs(this.boss.x - b.x) < 84 &&
          Math.abs(this.bossWY - b.worldY) < 42
        ) {
          b.alive = false;
          this.boss.hp -= 1;
          this.boss.hurt = 0.7;
          this.sparkAt(b.x, b.worldY);
          if (this.boss.hp <= 0) {
            this.boss.dying = 2.2;
            this.addShake(0.8, 14);
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);

    // balas inimigas × jogador
    for (const b of this.ebullets) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - this.px, b.worldY - pwY) < 8 + pr - 3) {
        b.alive = false;
        if (this.wShield > 0) {
          this.sparkAt(b.x, b.worldY);
        } else if (this.invuln <= 0) {
          this.killPlayer();
          return;
        }
      }
    }
  }

  /* ------------------------------ eventos ------------------------------ */

  private collect(p: Pickup) {
    switch (p.type) {
      case "fuel":
        this.fuel = Math.min(G.fuelMax, this.fuel + 35);
        this.fuelCollected++;
        this.addScore(80, p.x, p.worldY, "#fb923c", 14);
        this.audio.pickup();
        break;
      case "fuelGold":
        this.fuel = G.fuelMax;
        this.fuelCollected++;
        this.addScore(500, p.x, p.worldY, "#facc15", 16);
        this.audio.pickup();
        break;
      case "fakeFuel":
        this.explodeAt(p.x, p.worldY, 2);
        if (this.wShield > 0) {
          this.addScore(150, p.x, p.worldY, "#38bdf8", 14);
        } else {
          this.killPlayer();
        }
        break;
      case "shield":
        this.wShield = 8;
        this.audio.powerup();
        this.addScore(100, p.x, p.worldY, "#38bdf8", 14);
        break;
      case "triple":
        this.wTriple = 12;
        this.audio.powerup();
        this.addScore(100, p.x, p.worldY, "#f87171", 14);
        break;
      case "homing":
        this.wHoming = 10;
        this.audio.powerup();
        this.addScore(100, p.x, p.worldY, "#4ade80", 14);
        break;
      case "turbo":
        this.wTurbo = 6;
        this.audio.powerup();
        this.addScore(100, p.x, p.worldY, "#c084fc", 14);
        break;
    }
    // brilho de coleta
    this.waves.push({ x: p.x, worldY: p.worldY, r: 6, maxR: 44, life: 0.4, maxLife: 0.4 });
    this.pushHud();
  }

  private killEnemy(e: Enemy, byContact: boolean) {
    if (e.hp <= 0) return;
    e.hp = 0;
    this.enemiesKilled++;
    this.combo++;
    this.comboT = 2.5;
    const comboMult = Math.min(4, 1 + Math.floor(this.combo / 4));
    const turboMult = this.wTurbo > 0 ? 2 : 1;
    const base = { patrol: 150, balloon: 100, drone: 200, armored: 250, chopper: 300, jet: 400, turret: 350, stealth: 500 }[e.type];
    const pts = base * comboMult * turboMult;
    this.addScore(pts, e.x, e.worldY, "#fde047", 15);
    this.explodeAt(e.x, e.worldY, e.type === "armored" || e.type === "turret" ? 2 : 1);
    if (!byContact) this.audio.explode(e.type === "armored" ? 2 : 1);
  }

  private killPlayer() {
    if (!this.alive || this.invuln > 0) return;
    this.alive = false;
    this.lives--;
    this.deathTimer = 1.7;
    this.combo = 0;
    this.explodeAt(this.px, this.playerWY, 3);
    this.audio.explode(3);
    this.audio.stopEngine();
    this.addShake(0.7, 12);
    this.fuelCritical = false;
    this.pushHud();
  }

  private respawn() {
    // ressurgimento no local (estilo clássico): combustível cheio e invulnerável
    this.alive = true;
    const row = this.rowAt(this.playerWY);
    const cx = (row.left + row.right) / 2;
    this.px = clamp(this.px, row.left + 40, row.right - 40);
    if (row.islL > 0 && Math.abs(this.px - cx) < 60) this.px = cx < (row.islL + row.islR) / 2 ? row.left + (row.islL - row.left) / 2 : row.right - (row.right - row.islR) / 2;
    this.pvx = 0;
    this.fuel = G.fuelMax;
    this.invuln = G.invulnOnSpawn;
    this.wShield = 0;
    this.wTriple = 0;
    this.wHoming = 0;
    this.wTurbo = 0;
    // limpa ameaças visíveis (mundo entre as bordas da tela)
    this.enemies = this.enemies.filter(
      (e) => e.worldY < this.scroll - 60 || e.worldY > this.scroll + VH
    );
    this.ebullets = [];
    // se o chefe ainda vive, recupera parte da vida
    if (this.boss && this.boss.dying <= 0) {
      this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + this.boss.maxHp * 0.25);
    }
    this.audio.startEngine();
    this.pushHud();
  }

  private endGame() {
    if (this.over) return;
    this.over = true;
    this.audio.stopEngine();
    this.audio.stopMusic();
    const result: RunResult = {
      score: this.score,
      distanceM: Math.floor(this.distanceM),
      level: this.level,
      chapter: this.chapter,
      enemiesKilled: this.enemiesKilled,
      fuelCollected: this.fuelCollected,
    };
    // checkpoint: o ponto exato onde o piloto perdeu fica salvo (continuar)
    const s = this.getRunState();
    if (s) saveRun(s);
    this.pushHud();
    this.cb.onGameOver(result);
  }

  private addScore(pts: number, x: number, worldY: number, color: string, size: number) {
    this.score += Math.round(pts);
    this.texts.push({
      x,
      worldY,
      text: `+${Math.round(pts)}`,
      life: 0.9,
      color,
      size,
    });
  }

  private addShake(t: number, mag: number) {
    this.shake = Math.max(this.shake, t);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private explodeAt(x: number, worldY: number, size: 1 | 2 | 3) {
    const n = size * 18;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = (size * 60) * (0.4 + this.rng());
      const hot = this.rng();
      this.particles.push({
        x,
        worldY,
        vx: Math.cos(a) * sp,
        vy: this.speed * 0.55 - Math.sin(a) * sp * 0.7,
        life: 0.4 + this.rng() * 0.55,
        maxLife: 1,
        size: 2 + this.rng() * (3 + size * 1.6),
        color:
          hot > 0.7
            ? "rgba(254,240,138,0.95)"
            : hot > 0.4
              ? "rgba(249,115,22,0.9)"
              : "rgba(120,113,108,0.85)",
        fade: 1,
      });
    }
    this.waves.push({
      x,
      worldY,
      r: 6,
      maxR: 34 + size * 26,
      life: 0.42 + size * 0.08,
      maxLife: 0.5,
    });
    this.addShake(size * 0.12, size * 4);
    if (size >= 2) this.audio.explode(size);
  }

  private sparkAt(x: number, worldY: number) {
    for (let i = 0; i < 6; i++) {
      const a = this.rng() * Math.PI * 2;
      this.particles.push({
        x,
        worldY,
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        life: 0.22,
        maxLife: 0.22,
        size: 2.2,
        color: "rgba(254,240,138,0.9)",
        fade: 1,
      });
    }
  }

  private cull() {
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.bullets = this.bullets.filter((b) => b.alive);
    this.ebullets = this.ebullets.filter((b) => b.alive);
  }

  private showBanner(title: string, sub: string, color: string) {
    this.banner = { title, sub, life: 2.6, color };
  }

  /* ------------------------------ render ------------------------------ */

  private palette(): { a: string; b: string; bl: string; bd: string; foam: string; tree: string; treeDark: string; glitter: string } {
    const i = Math.min(this.palIndex, PALETTES.length - 1);
    const next = PALETTES[(i + 1) % PALETTES.length];
    const cur = PALETTES[i];
    const map = (p: Palette) => ({
      a: p.waterA,
      b: p.waterB,
      bl: p.bankLight,
      bd: p.bankDark,
      foam: p.foam,
      tree: p.tree,
      treeDark: p.treeDark,
      glitter: p.glitter,
    });
    if (this.palMix >= 1) return map(cur);
    const k = this.palMix;
    return {
      a: mixHex(cur.waterA, next.waterA, k),
      b: mixHex(cur.waterB, next.waterB, k),
      bl: mixHex(cur.bankLight, next.bankLight, k),
      bd: mixHex(cur.bankDark, next.bankDark, k),
      foam: mixHex(cur.foam, next.foam, k),
      tree: mixHex(cur.tree, next.tree, k),
      treeDark: mixHex(cur.treeDark, next.treeDark, k),
      glitter: k < 0.5 ? cur.glitter : next.glitter,
    };
  }

  private render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const pal = this.palette();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.bd;
    ctx.fillRect(0, 0, cw, ch);

    // shake
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shakeMag : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shakeMag : 0;
    const ox = (cw - VW * this.scale * this.dpr) / 2;
    const oy = (ch - VH * this.scale * this.dpr) / 2;
    ctx.setTransform(
      this.scale * this.dpr,
      0,
      0,
      this.scale * this.dpr,
      ox + shx * this.dpr,
      oy + shy * this.dpr
    );

    /* --- água --- */
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, pal.a);
    grad.addColorStop(1, pal.b);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    // ondulações animadas (varredura de brilho)
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 3;
    const wScroll = this.scroll * 0.6;
    for (let y = -40; y < VH + 40; y += 34) {
      ctx.beginPath();
      for (let x = 0; x <= VW; x += 27) {
        const yy =
          y + Math.sin(x * 0.035 + this.t * 1.6 + (y - wScroll) * 0.05) * 5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    /* --- margens e ilhas --- */
    const firstRow = Math.floor(this.scroll / ROW_H) - 1;
    const lastRow = Math.ceil((this.scroll + VH) / ROW_H) + 1;
    for (let i = firstRow; i <= lastRow; i++) {
      const r = this.rows.get(i);
      if (!r) continue;
      const y = this.sy(i * ROW_H);
      // terra
      ctx.fillStyle = pal.bl;
      ctx.fillRect(0, y, r.left, ROW_H + 0.5);
      ctx.fillRect(r.right, y, VW - r.right, ROW_H + 0.5);
      if (r.islL > 0) ctx.fillRect(r.islL, y, r.islR - r.islL, ROW_H + 0.5);
      // sombra interna (profundidade da mata)
      ctx.fillStyle = pal.bd;
      ctx.fillRect(r.left - 7, y, 7, ROW_H + 0.5);
      ctx.fillRect(r.right, y, 7, ROW_H + 0.5);
      if (r.islL > 0) {
        ctx.fillRect(r.islL - 5, y, 5, ROW_H + 0.5);
        ctx.fillRect(r.islR, y, 5, ROW_H + 0.5);
      }
      // espuma na borda
      ctx.fillStyle = pal.foam;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(r.left - 2, y, 2.5, ROW_H + 0.5);
      ctx.fillRect(r.right - 0.5, y, 2.5, ROW_H + 0.5);
      if (r.islL > 0) {
        ctx.fillRect(r.islL - 2, y, 2.5, ROW_H + 0.5);
        ctx.fillRect(r.islR - 0.5, y, 2.5, ROW_H + 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // árvores nas margens (determinísticas por linha)
    for (let i = firstRow; i <= lastRow; i++) {
      const r = this.rows.get(i);
      if (!r) continue;
      const h = Math.sin(i * 127.1) * 43758.5453;
      const frac = h - Math.floor(h);
      if (frac < 0.16 && r.left > 34) {
        const y = this.sy(i * ROW_H) + 8;
        const x = r.left - 14 - frac * 60;
        this.drawTree(ctx, x, y, pal.tree, pal.treeDark, 0.8 + frac * 2);
      }
      const h2 = Math.sin(i * 311.7) * 43758.5453;
      const frac2 = h2 - Math.floor(h2);
      if (frac2 < 0.16 && VW - r.right > 34) {
        const y = this.sy(i * ROW_H) + 8;
        const x = r.right + 14 + frac2 * 60;
        this.drawTree(ctx, x, y, pal.tree, pal.treeDark, 0.8 + frac2 * 2);
      }
    }

    /* --- rochas --- */
    for (const r of this.rocks) {
      const y = this.sy(r.worldY);
      if (y < -40 || y > VH + 40) continue;
      ctx.save();
      ctx.translate(r.x, y);
      drawRock(ctx, r.seed);
      ctx.restore();
    }

    /* --- pontes --- */
    for (const [idx, br] of this.bridges) {
      const y = this.sy(idx * ROW_H);
      if (y < -60 || y > VH + 60) continue;
      const r = this.rows.get(idx);
      if (!r) continue;
      this.drawBridge(ctx, r, y, br.destroyed);
    }

    /* --- itens --- */
    for (const p of this.pickups) {
      const y = this.sy(p.worldY);
      if (y < -50 || y > VH + 50) continue;
      ctx.save();
      ctx.translate(p.x, y + Math.sin(this.t * 2.4 + p.seed) * 3);
      drawPickup(ctx, p.type, this.t + p.seed);
      ctx.restore();
      // destaque de emergência quando combustível crítico
      if (this.fuelCritical && (p.type === "fuel" || p.type === "fuelGold")) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 9);
        ctx.strokeStyle = `rgba(239,68,68,${0.35 + pulse * 0.55})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, y, 26 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* --- inimigos --- */
    for (const e of this.enemies) {
      const y = this.sy(e.worldY);
      if (y < -60 || y > VH + 60) continue;
      ctx.save();
      ctx.translate(e.x, y);
      if (e.type === "stealth") {
        ctx.globalAlpha = 0.55 + 0.35 * Math.max(0, Math.sin(e.t * 2.2));
      }
      if (e.type === "turret") drawTurret(ctx, e.aim, e.t);
      else drawEnemy(ctx, e.type, e.t, e.hurt);
      ctx.restore();
    }

    /* --- chefe --- */
    if (this.boss) {
      const b = this.boss;
      ctx.save();
      ctx.translate(b.x, b.y);
      drawBoss(ctx, b.type, b.t, b.hurt);
      if (b.dying > 0) {
        ctx.globalAlpha = clamp(b.dying / 2.2, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-100, -50, 200, 100);
      }
      ctx.restore();
    }

    /* --- balas do jogador --- */
    for (const b of this.bullets) {
      const y = this.sy(b.worldY);
      ctx.save();
      ctx.shadowColor = b.homing ? "rgba(74,222,128,0.9)" : "rgba(253,224,71,0.9)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.homing ? "#bbf7d0" : "#fef08a";
      ctx.beginPath();
      ctx.ellipse(b.x, y, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* --- balas inimigas --- */
    for (const b of this.ebullets) {
      const y = this.sy(b.worldY);
      ctx.save();
      ctx.shadowColor = "rgba(248,113,113,0.9)";
      ctx.shadowBlur = 7;
      ctx.fillStyle = "#fca5a5";
      ctx.beginPath();
      ctx.arc(b.x, y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(b.x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* --- jogador --- */
    if (this.alive) {
      const blink = this.invuln > 0 && Math.sin(this.t * 22) < -0.2;
      if (!blink) {
        ctx.save();
        ctx.translate(this.px, G.playerY);
        const thrust = 0.7 + this.throttle * 0.5 + (this.wTurbo > 0 ? 0.6 : 0);
        drawPlayer(ctx, this.t, thrust);
        // bolha de escudo
        if (this.wShield > 0) {
          const pulse = 0.6 + 0.4 * Math.sin(this.t * 7);
          ctx.strokeStyle = `rgba(56,189,248,${pulse})`;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(0, 0, 34, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(56,189,248,${0.1 + pulse * 0.08})`;
          ctx.fill();
        }
        // rastro turbo
        if (this.wTurbo > 0) {
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `rgba(192,132,252,${0.28 - i * 0.08})`;
            ctx.beginPath();
            ctx.ellipse(0, 42 + i * 16, 5 - i, 9, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      // sombra/reflexo no água
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.px, G.playerY + 30, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* --- partículas --- */
    for (const p of this.particles) {
      const y = this.sy(p.worldY);
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* --- ondas de choque --- */
    for (const w of this.waves) {
      const y = this.sy(w.worldY);
      const a = clamp(w.life / w.maxLife, 0, 1);
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
      ctx.lineWidth = 2.6 * a + 0.6;
      ctx.beginPath();
      ctx.arc(w.x, y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* --- textos flutuantes --- */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const tx of this.texts) {
      const y = this.sy(tx.worldY);
      const a = clamp(tx.life / 0.9, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${tx.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      ctx.strokeText(tx.text, tx.x, y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, y);
    }
    ctx.globalAlpha = 1;

    /* --- brilho de "sol" na água (glitter) --- */
    const glit = 0.5 + 0.5 * Math.sin(this.t * 2);
    ctx.fillStyle = pal.glitter;
    ctx.globalAlpha = 0.12 + glit * 0.08;
    for (let i = 0; i < 26; i++) {
      const h = Math.sin(i * 269.5) * 23321.7;
      const f = h - Math.floor(h);
      const x = f * VW;
      const y = ((i * 137 + this.scroll * 0.5) % VH);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    /* --- vinheta --- */
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.34, VW / 2, VH / 2, VH * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VW, VH);

    /* --- alerta crítico de combustível (borda vermelha pulsante) --- */
    if (this.fuelCritical && this.alive) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 8);
      const edge = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.66);
      edge.addColorStop(0, "rgba(239,68,68,0)");
      edge.addColorStop(1, `rgba(239,68,68,${0.28 + pulse * 0.3})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, VW, VH);
      // texto grande no canvas
      const a = 0.75 + pulse * 0.25;
      ctx.globalAlpha = a;
      ctx.font = "900 30px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fecaca";
      ctx.strokeStyle = "rgba(127,29,29,0.9)";
      ctx.lineWidth = 5;
      const msg = "⚠ COMBUSTÍVEL CRÍTICO";
      ctx.strokeText(msg, VW / 2, 200);
      ctx.fillText(msg, VW / 2, 200);
      ctx.globalAlpha = 1;
    }

    /* --- banner de capítulo --- */
    if (this.banner) {
      const b = this.banner;
      const a = clamp(b.life / 2.6, 0, 1);
      const slide = (1 - Math.min(1, (2.6 - b.life) * 3)) * 40;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, VH * 0.3 - 46, VW, 96);
      ctx.textAlign = "center";
      ctx.font = "900 34px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = b.color;
      ctx.fillText(b.title, VW / 2 + slide, VH * 0.3 - 8);
      ctx.font = "700 17px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(b.sub, VW / 2 - slide, VH * 0.3 + 26);
      ctx.globalAlpha = 1;
    }

    /* --- barra de vida do chefe --- */
    if (this.boss && this.boss.dying <= 0) {
      const w = VW * 0.62;
      const x = (VW - w) / 2;
      const y = VH - 218;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 3, w + 6, 18, 9);
      ctx.fill();
      const pct = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      const hpGrad = ctx.createLinearGradient(x, 0, x + w, 0);
      hpGrad.addColorStop(0, "#ef4444");
      hpGrad.addColorStop(1, "#f97316");
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, w * pct, 12, 6);
      ctx.fill();
      ctx.font = "800 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fecaca";
      ctx.textAlign = "center";
      ctx.fillText(this.boss.name.toUpperCase(), VW / 2, y - 9);
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, cd: string, s: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(2, 4, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cd;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(-1.6, -1.6, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBridge(ctx: CanvasRenderingContext2D, r: RiverRow, y: number, destroyed: boolean) {
    ctx.save();
    const left = r.left - 12;
    const right = r.right + 12;
    const h = 30;
    if (!destroyed) {
      // pilares
      ctx.fillStyle = "#57534e";
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const px = lerp(left, right, i / n);
        ctx.fillRect(px - 4, y - h / 2 + 8, 8, h - 10);
      }
      // tabuleiro
      const deck = ctx.createLinearGradient(0, y - h / 2, 0, y + 4);
      deck.addColorStop(0, "#a8a29e");
      deck.addColorStop(1, "#57534e");
      ctx.fillStyle = deck;
      ctx.beginPath();
      ctx.roundRect(left, y - h / 2, right - left, 14, 3);
      ctx.fill();
      // treliça
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = left; x < right - 8; x += 12) {
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + 8, y - h / 2 + 13);
        ctx.moveTo(x + 8, y - h / 2);
        ctx.lineTo(x, y - h / 2 + 13);
      }
      ctx.stroke();
      // faixa de perigo
      ctx.fillStyle = "#facc15";
      for (let x = left; x < right; x += 22) ctx.fillRect(x, y + 4, 11, 3);
    } else {
      // destroços
      ctx.fillStyle = "#78716c";
      ctx.fillRect(left, y - 4, 26, 10);
      ctx.fillRect(right - 26, y - 4, 26, 10);
      ctx.save();
      ctx.translate(left + 40, y);
      ctx.rotate(0.5);
      ctx.fillRect(-14, -4, 28, 9);
      ctx.restore();
      ctx.save();
      ctx.translate(right - 44, y + 6);
      ctx.rotate(-0.4);
      ctx.fillRect(-14, -4, 28, 9);
      ctx.restore();
      // fumaça
      if (Math.random() < 0.12) {
        this.particles.push({
          x: lerp(left, right, Math.random()),
          worldY: this.wy(y),
          vx: (Math.random() - 0.5) * 20,
          vy: this.speed + 20, // sobe lentamente na tela
          life: 1.1,
          maxLife: 1.1,
          size: 5,
          color: "rgba(120,113,108,0.5)",
          fade: 1,
        });
      }
    }
    ctx.restore();
  }
}
