/**
 * River Raid Remaster — Orquestrador do jogo
 * ============================================
 * Máquina de estados (menu → capítulo → jogo → pausa → fim), loop com
 * timestep FIXO de 60 Hz (correção do loop original, que não limitava dt
 * e explodia a física ao voltar de uma aba em segundo plano), geração
 * procedural do rio, colisões completas (margens, pontes, inimigos,
 * projéteis, chefes) e integração de todos os sistemas.
 */

import { AudioEngine } from './engine/audio';
import { InputManager, type InputState } from './input/input';
import { ParticleSystem } from './engine/particles';
import { River } from './world/river';
import { Player } from './entities/player';
import { BulletSystem, EnemyBulletSystem } from './entities/bullets';
import { Enemy, enemyPoolForStage } from './entities/enemies';
import { Boss, BOSS_NAMES } from './entities/boss';
import { PickupSystem } from './entities/pickups';
import { ScoreSystem } from './systems/score';
import { MissionSystem } from './systems/missions';
import { applyUpgrades, UPGRADE_DEFS, upgradeCost } from './systems/upgrades';
import { SaveSystem, defaultProfile } from './systems/save';
import {
  bridgeYFor,
  difficultyFor,
  isBossStage,
  stageEndY,
  stageStartY,
} from './systems/stages';
import {
  CAMPAIGN_COMPLETE_TEXT,
  chapterForStage,
  bossIntroFor,
} from './systems/campaign';
import type {
  BossId,
  GameCallbacks,
  GameState,
  HudState,
  ProfileData,
} from './types';
import { clamp } from './utils';

interface Bridge {
  worldY: number;
  hp: number;
  maxHp: number;
  broken: boolean;
  flash: number;
  stage: number;
}

interface IntroData {
  title: string;
  lines: string[];
  quote: string;
}

export interface LastRunSummary {
  score: number;
  stage: number;
  credits: number;
  kills: number;
}

const FUEL_MAX = 100;
const FUEL_DRAIN = 3.4;
const BOSS_TRIGGER_AHEAD = 1500;

export class Game {
  private ctx: CanvasRenderingContext2D;
  W = 0;
  H = 0;

  state: GameState = 'menu';
  private input: InputManager;
  readonly audio = new AudioEngine();
  private particles = new ParticleSystem();
  private river: River;
  private player: Player;
  private bullets = new BulletSystem();
  private enemyBullets = new EnemyBulletSystem();
  private enemies: Enemy[] = [];
  private pickups = new PickupSystem();
  private boss: Boss | null = null;
  private bridge: Bridge | null = null;
  private score = new ScoreSystem();
  private missions = new MissionSystem();
  private save = new SaveSystem();
  private profile: ProfileData;

  private seed = 1;
  private scrollY = 40;
  private stage = 1;
  private fuel = FUEL_MAX;
  private lives = 3;
  private kills = 0;
  private checkpointStage = 1;

  private time = 0;
  private spawnTimer = 1.2;
  private nextDepotY = 1600;
  private nextPowerupY = 5200;
  private bossTriggered = false;
  private pendingBoss: { id: BossId; hpScale: number } | null = null;
  private pendingIntro: IntroData | null = null;
  private respawnTimer = 0;
  private gameOverTimer = 0;
  private deathTimer = 0;
  private shake = 0;
  private fuelBeepTimer = 0;
  private hitSfxTimer = 0;
  private hudTimer = 0;
  private lastRun: LastRunSummary | null = null;
  private inputState: InputState = {
    axisX: 0,
    axisY: 0,
    fire: false,
    pausePressed: false,
    mutePressed: false,
    confirmPressed: false,
  };

  private raf = 0;
  private lastT = 0;
  private accumulator = 0;
  private renderScale = 1;
  private retro = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks
  ) {
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D não suportado');
    this.input = new InputManager(canvas);
    this.profile = this.save.loadProfile() ?? defaultProfile();
    this.audio.setMuted(this.profile.settings.muted);
    this.retro = this.profile.settings.retro;

    this.seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    this.river = new River(this.seed, 0);
    this.player = new Player(300, 500);
    this.applyUpgradeStats();

    this.resize();
    this.raf = requestAnimationFrame(this.frame);
    this.syncHud(true);
  }

  // ------------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------------

  private frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.lastT === 0) this.lastT = t;
    let delta = (t - this.lastT) / 1000;
    this.lastT = t;
    // Clamp: evita "salto" gigante ao voltar de aba em segundo plano
    delta = Math.min(delta, 0.1);
    this.accumulator += delta;
    const step = 1 / 60;
    let steps = 0;
    while (this.accumulator >= step && steps < 6) {
      this.update(step);
      this.accumulator -= step;
      steps++;
    }
    if (steps === 6) this.accumulator = 0;
    this.render();
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.audio.destroy();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(320, rect.width);
    const cssH = Math.max(320, rect.height);
    this.renderScale = this.retro ? 0.55 : Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssW * this.renderScale);
    this.canvas.height = Math.round(cssH * this.renderScale);
    this.ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    this.W = cssW;
    this.H = cssH;
    this.player.x = clamp(this.player.x, 20, this.W - 20);
    this.player.y = clamp(this.player.y, this.H * 0.26, this.H - 50);
  }

  ensureAudio(): void {
    this.audio.init();
  }

  // ------------------------------------------------------------------
  // Controle de estado (API para a UI React)
  // ------------------------------------------------------------------

  getProfile(): ProfileData {
    return this.profile;
  }

  getLastRun(): LastRunSummary | null {
    return this.lastRun;
  }

  hasSavedRun(): boolean {
    return this.save.loadRun() !== null;
  }

  getIntroData(): IntroData | null {
    return this.pendingIntro;
  }

  getBossIntroData(): { title: string; description: string; name: string } | null {
    if (!this.pendingBoss) return null;
    const intro = bossIntroFor(this.pendingBoss.id);
    return { ...intro, name: BOSS_NAMES[this.pendingBoss.id] };
  }

  newGame(): void {
    this.ensureAudio();
    this.seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    this.river = new River(this.seed, 0);
    this.score = new ScoreSystem();
    this.missions = new MissionSystem();
    this.resetRunState(1);
    this.applyUpgradeStats();
    const ch = chapterForStage(1);
    this.pendingIntro = ch
      ? { title: ch.title, lines: ch.lines, quote: ch.quote }
      : null;
    this.setState('chapterIntro');
    this.syncHud(true);
  }

  continueRun(): void {
    this.ensureAudio();
    const run = this.save.loadRun();
    if (!run) return;
    this.seed = run.seed;
    this.river = new River(this.seed, 0);
    this.score = new ScoreSystem();
    this.missions = new MissionSystem();
    this.resetRunState(run.stage);
    this.score.points = run.score;
    this.score.nextLifeAt =
      Math.floor(run.score / 10000) * 10000 + 10000;
    this.lives = run.lives;
    this.missions.restore(run.missions);
    this.applyUpgradeStats();
    const ch = chapterForStage(run.stage);
    if (ch && ch.stage === run.stage) {
      this.pendingIntro = { title: ch.title, lines: ch.lines, quote: ch.quote };
      this.setState('chapterIntro');
    } else {
      this.setState('playing');
      this.audio.startMusic();
    }
    this.syncHud(true);
  }

  private resetRunState(stage: number): void {
    this.stage = stage;
    this.checkpointStage = stage;
    this.scrollY = stageStartY(stage) + 40;
    this.fuel = FUEL_MAX;
    this.lives = 3;
    this.kills = 0;
    this.enemies = [];
    this.bullets.list = [];
    this.enemyBullets.list = [];
    this.pickups = new PickupSystem();
    this.particles = new ParticleSystem();
    this.boss = null;
    this.bossTriggered = false;
    this.pendingBoss = null;
    this.respawnTimer = 0;
    this.gameOverTimer = 0;
    this.deathTimer = 0;
    this.spawnTimer = 1.4;
    this.nextDepotY = this.scrollY + 1500;
    this.nextPowerupY = this.scrollY + 4200;
    this.player.alive = true;
    this.player.visible = true;
    this.player.invincible = 2;
    this.player.shield = 0;
    this.player.triple = 0;
    this.player.homing = 0;
    this.player.turbo = 0;
    this.player.cooldown = 0;
    this.placePlayerInRiver();
    this.audio.setStage(stage);
    this.audio.setBossMode(false);
    this.createBridgeFor(stage);
  }

  private placePlayerInRiver(): void {
    const worldY = this.scrollY + this.H * 0.25;
    const shape = this.river.shapeAt(worldY);
    this.player.x = ((shape.left + shape.right) / 2) * this.W;
    this.player.y = this.H * 0.75;
  }

  confirmIntro(): void {
    this.ensureAudio();
    if (this.state === 'chapterIntro') {
      this.pendingIntro = null;
      this.setState('playing');
      this.audio.startMusic();
      this.syncHud(true);
    } else if (this.state === 'bossIntro' && this.pendingBoss) {
      this.spawnBoss();
      this.setState('playing');
      this.audio.setBossMode(true);
      this.audio.play('bossAlert');
      this.syncHud(true);
    }
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.audio.stopMusic();
    this.syncHud(true);
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('playing');
    this.audio.startMusic();
    this.syncHud(true);
  }

  /** Salva a partida e volta ao menu. */
  saveAndExit(): void {
    if (this.state === 'paused' || this.state === 'playing') {
      this.saveCheckpoint();
    }
    this.setState('menu');
    this.audio.stopMusic();
    this.audio.setBossMode(false);
    this.syncHud(true);
  }

  toMenu(): void {
    this.setState('menu');
    this.audio.stopMusic();
    this.audio.setBossMode(false);
    this.syncHud(true);
  }

  setMuted(m: boolean): void {
    this.profile.settings.muted = m;
    this.audio.setMuted(m);
    this.save.saveProfile(this.profile);
  }

  setRetro(r: boolean): void {
    this.profile.settings.retro = r;
    this.retro = r;
    this.save.saveProfile(this.profile);
    this.resize();
  }

  buyUpgrade(id: string): boolean {
    const def = UPGRADE_DEFS.find((d) => d.id === id);
    if (!def) return false;
    const level = this.profile.upgrades[id] ?? 0;
    if (level >= def.maxLevel) return false;
    const cost = upgradeCost(def, level);
    if (this.profile.credits < cost) return false;
    this.profile.credits -= cost;
    this.profile.upgrades[id] = level + 1;
    this.save.saveProfile(this.profile);
    this.applyUpgradeStats();
    this.audio.play('ui');
    this.syncHud(true);
    return true;
  }

  private applyUpgradeStats(): void {
    applyUpgrades(this.player.stats, this.profile.upgrades);
  }

  /** Acesso para controles de toque (React). */
  getInput(): InputManager {
    return this.input;
  }

  private setState(s: GameState): void {
    if (this.state === s) return;
    this.state = s;
    this.callbacks.onStateChange(s);
  }

  // ------------------------------------------------------------------
  // Atualização
  // ------------------------------------------------------------------

  private update(dt: number): void {
    this.time += dt;
    this.inputState = this.input.poll();
    this.hitSfxTimer = Math.max(0, this.hitSfxTimer - dt);

    // Tecla M liga/desliga o som em qualquer estado
    if (this.inputState.mutePressed) {
      this.setMuted(!this.profile.settings.muted);
    }

    switch (this.state) {
      case 'menu':
        this.scrollY += 26 * dt;
        this.river.ensure(this.scrollY + this.H * 2);
        this.particles.update(dt);
        this.shake = Math.max(0, this.shake - 24 * dt);
        break;
      case 'chapterIntro':
      case 'bossIntro':
        if (this.inputState.confirmPressed) this.confirmIntro();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'paused':
        if (this.inputState.pausePressed) this.resume();
        break;
      case 'gameover':
        this.particles.update(dt);
        this.shake = Math.max(0, this.shake - 24 * dt);
        break;
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.syncHud();
    }
  }

  private get scrollSpeed(): number {
    const d = difficultyFor(this.stage);
    // Acelerador: quanto mais alto na tela, mais rápido o mundo avança
    const throttle = 1 + ((this.H * 0.74 - this.player.y) / this.H) * 0.55;
    const turbo = this.player.turbo > 0 ? 1.7 : 1;
    return Math.max(60, d.scrollSpeed * clamp(throttle, 0.7, 1.45) * turbo);
  }

  private updatePlaying(dt: number): void {
    // Pausa
    if (this.inputState.pausePressed) {
      this.pause();
      return;
    }

    // Morte em andamento (aguarda respawn ou game over)
    if (!this.player.alive) {
      this.deathTimer -= dt;
      this.particles.update(dt);
      this.shake = Math.max(0, this.shake - 26 * dt);
      if (this.deathTimer <= 0) {
        if (this.lives > 0) this.respawn();
        else this.finishGameOver();
      }
      return;
    }

    // Avanço do mundo
    const scroll = this.scrollSpeed;
    this.scrollY += scroll * dt;
    this.river.ensure(this.scrollY + this.H * 2);

    // Jogador
    this.player.update(dt, this.inputState, {
      W: this.W,
      H: this.H,
      fire: (x, y) => {
        this.bullets.shoot(x, y, Math.PI / 2, this.player.homing > 0);
        this.audio.play('shoot');
      },
    });

    // Colisão com margens (essência do River Raid)
    const playerWorldY = this.scrollY + (this.H - this.player.y);
    const shape = this.river.shapeAt(playerWorldY);
    const margin = 10;
    const leftPx = shape.left * this.W + margin;
    const rightPx = shape.right * this.W - margin;
    const onIsland =
      shape.hasIsland &&
      this.player.x > shape.islandLeft * this.W + margin &&
      this.player.x < shape.islandRight * this.W - margin;
    const outOfWater =
      this.player.x < leftPx || this.player.x > rightPx || onIsland;
    if (outOfWater && !this.player.hasShield()) {
      this.particles.splash(this.player.x, this.player.y + 16, 1.2);
      this.crash();
      return;
    }

    // Combustível
    const turboPenalty = this.player.turbo > 0 ? 1.5 : 1;
    this.fuel -=
      FUEL_DRAIN *
      this.player.stats.fuelEfficiency *
      turboPenalty *
      (1 + (scroll - 150) / 500) *
      dt;
    if (this.fuel < 25 && this.fuel > 0) {
      this.fuelBeepTimer -= dt;
      if (this.fuelBeepTimer <= 0) {
        this.fuelBeepTimer = 1.1;
        this.audio.play('ui');
      }
    }
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.crash();
      return;
    }

    // Sistemas
    this.score.update(dt);
    this.missions.update(dt);
    if (this.score.combo >= 3) this.missions.complete('combo_x3');

    // Entidades
    const enemyCtx = {
      dt,
      W: this.W,
      H: this.H,
      time: this.time,
      scrollY: this.scrollY,
      playerX: this.player.x,
      playerY: this.player.y,
      speedMultiplier: difficultyFor(this.stage).enemySpeed,
      approachMultiplier: difficultyFor(this.stage).enemyApproach,
      shapeAt: (wy: number) => this.river.shapeAt(wy),
      fire: (x: number, y: number, vx: number, vy: number) => {
        this.enemyBullets.shoot(x, y, vx, vy);
      },
    };
    for (const e of this.enemies) e.update(enemyCtx);
    this.enemies = this.enemies.filter((e) => e.active);

    this.bullets.update(dt, (b) => this.nearestTargetTo(b.x, b.y));
    this.enemyBullets.update(dt);
    this.pickups.update(this.scrollY, this.H);
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - 26 * dt);

    // Chefe
    this.updateBossLogic(dt);

    // Spawns
    this.updateSpawns(dt);

    // Colisões
    this.updateCollisions();

    // Missões: recompensas
    for (const m of this.missions.popCompleted()) {
      if (m.reward.score) this.score.points += m.reward.score;
      if (m.reward.fuel) this.fuel = Math.min(FUEL_MAX, this.fuel + m.reward.fuel);
      if (m.rewardPowerup) this.player.applyPowerUp(m.rewardPowerup);
      this.missions.markRewarded(m);
      this.callbacks.onToast('Missão concluída!', `${m.description} — ${m.rewardText}`);
      this.audio.play('powerup');
    }

    // Vida extra a cada 10.000 pontos
    if (this.score.consumeExtraLife()) {
      if (this.lives < 6) {
        this.lives++;
        this.callbacks.onToast('Vida extra!', 'A cada 10.000 pontos');
        this.audio.play('extraLife');
      }
    }
  }

  private nearestTargetTo(
    x: number,
    y: number
  ): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD2 = Infinity;
    for (const e of this.enemies) {
      const sy = this.H - (e.worldY - this.scrollY);
      if (sy < -40 || sy > this.H + 40) continue;
      const dx = e.x - x;
      const dy = sy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { x: e.x, y: sy };
      }
    }
    if (this.boss && this.boss.entered && !this.boss.dying) {
      const dx = this.boss.x - x;
      const dy = this.boss.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) best = { x: this.boss.x, y: this.boss.y };
    }
    return best;
  }

  // ------------------------------------------------------------------
  // Spawns
  // ------------------------------------------------------------------

  private updateSpawns(dt: number): void {
    const d = difficultyFor(this.stage);

    // Inimigos
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < 16) {
      this.spawnEnemy();
      const bossFactor = this.boss ? 1.6 : 1;
      this.spawnTimer =
        d.spawnInterval * (0.7 + Math.random() * 0.6) * bossFactor;
    }

    // Depósitos de combustível
    if (this.scrollY + this.H + 120 > this.nextDepotY) {
      this.spawnDepotAt(this.nextDepotY);
      this.nextDepotY += 2300 + Math.random() * 700 + this.stage * 25;
    }

    // Power-ups
    if (this.scrollY + this.H + 120 > this.nextPowerupY) {
      const shape = this.river.shapeAt(this.nextPowerupY);
      const x =
        shape.left * this.W +
        Math.random() * (shape.right - shape.left) * this.W;
      const kinds = ['shield', 'triple', 'homing', 'turbo'] as const;
      this.pickups.spawnPowerUp(
        kinds[Math.floor(Math.random() * kinds.length)],
        x,
        this.nextPowerupY
      );
      this.nextPowerupY += 7000 + Math.random() * 6500;
    }
  }

  private spawnEnemy(): void {
    const pool = enemyPoolForStage(this.stage);
    const kind = pool[Math.floor(Math.random() * pool.length)];
    let worldY = this.scrollY + this.H + 70;
    // Evita nascer colado na ponte
    if (
      this.bridge &&
      !this.bridge.broken &&
      Math.abs(worldY - this.bridge.worldY) < 170
    ) {
      worldY += 240;
    }
    if (kind === 'turret') {
      const shape = this.river.shapeAt(worldY);
      const leftOk = shape.left > 0.1;
      const rightOk = shape.right < 0.9;
      if (!leftOk && !rightOk) return;
      const side = leftOk && rightOk ? (Math.random() < 0.5 ? -1 : 1) : leftOk ? -1 : 1;
      const x =
        side === -1
          ? (shape.left - 0.014) * this.W
          : (shape.right + 0.014) * this.W;
      this.enemies.push(new Enemy('turret', x, worldY, this.stage));
      return;
    }
    const x = this.river.spawnXAt(worldY, 0.035, Math.random) * this.W;
    this.enemies.push(new Enemy(kind, x, worldY, this.stage));
  }

  private spawnDepotAt(worldY: number): void {
    const shape = this.river.shapeAt(worldY);
    if (shape.isLake) {
      // Área secreta: cluster de bônus
      const cx = ((shape.left + shape.right) / 2) * this.W;
      const spread = Math.min((shape.right - shape.left) * this.W * 0.3, 130);
      this.pickups.spawnDepot('normal', cx - spread, worldY - 60);
      this.pickups.spawnDepot('rare', cx, worldY);
      this.pickups.spawnDepot('normal', cx + spread, worldY + 60);
      return;
    }
    const roll = Math.random();
    const kind =
      roll < 0.16 ? 'rare' : this.stage >= 5 && roll < 0.3 ? 'fake' : 'normal';
    const x = this.river.spawnXAt(worldY, 0.05, Math.random) * this.W;
    this.pickups.spawnDepot(kind, x, worldY);
  }

  // ------------------------------------------------------------------
  // Chefe
  // ------------------------------------------------------------------

  private updateBossLogic(dt: number): void {
    // Gatilho de chegada do chefe
    if (
      !this.boss &&
      !this.bossTriggered &&
      isBossStage(this.stage) &&
      this.scrollY > stageEndY(this.stage) - BOSS_TRIGGER_AHEAD - this.H
    ) {
      this.bossTriggered = true;
      const bossStageNum = this.stage / 3; // 3, 6, 9, 12...
      const id = (((bossStageNum - 1) % 3) + 1) as BossId;
      const cycle = Math.floor((bossStageNum - 1) / 3);
      this.pendingBoss = { id, hpScale: 1 + cycle * 0.35 };
      this.audio.play('bossAlert');
      this.setState('bossIntro');
      this.syncHud(true);
      return;
    }

    if (!this.boss) return;

    this.boss.update({
      dt,
      W: this.W,
      H: this.H,
      time: this.time,
      playerX: this.player.x,
      playerY: this.player.y,
      bulletSpeed: 250 + this.stage * 8,
      fire: (x, y, vx, vy) => this.enemyBullets.shoot(x, y, vx, vy),
      spawnMinion: (x, y) => {
        if (this.enemies.length < 14) {
          this.enemies.push(
            new Enemy('drone', x, this.scrollY + (this.H - y), this.stage)
          );
        }
      },
    });

    // Explosões contínuas durante a morte
    if (this.boss.dying) {
      this.deathTimer = Math.max(this.deathTimer, 0);
      if (Math.random() < dt * 9) {
        const p = this.boss.deathExplosionPoint();
        this.particles.explode(p.x, p.y, 0.9);
        this.shake = Math.max(this.shake, 8);
      }
    }

    if (!this.boss.active) {
      this.onBossDefeated();
    }
  }

  private spawnBoss(): void {
    if (!this.pendingBoss) return;
    this.boss = new Boss(
      this.pendingBoss.id,
      this.W,
      this.H,
      this.pendingBoss.hpScale
    );
    this.pendingBoss = null;
  }

  private onBossDefeated(): void {
    const wasFinalStage = this.stage === 9;
    const name = this.boss ? BOSS_NAMES[this.boss.id] : 'Chefe';
    this.boss = null;
    this.audio.setBossMode(false);
    this.audio.play('bigExplosion');
    this.shake = 16;
    this.score.add(2000);
    this.kills++;
    this.missions.progress('first_boss');
    this.callbacks.onToast(`${name} derrotado!`, '+2.000 pontos');
    if (wasFinalStage) {
      this.profile.campaignDone = true;
      this.save.saveProfile(this.profile);
    }
    this.advanceStage(true);
    if (wasFinalStage) {
      this.pendingIntro = {
        title: CAMPAIGN_COMPLETE_TEXT.title,
        lines: [CAMPAIGN_COMPLETE_TEXT.description],
        quote: 'Campanha concluída — modo infinito desbloqueado.',
      };
      this.setState('chapterIntro');
    }
  }

  // ------------------------------------------------------------------
  // Pontes e avanço de fase
  // ------------------------------------------------------------------

  private createBridgeFor(stage: number): void {
    if (isBossStage(stage)) {
      this.bridge = null;
      return;
    }
    this.bridge = {
      worldY: bridgeYFor(stage),
      hp: 3,
      maxHp: 3,
      broken: false,
      flash: 0,
      stage,
    };
  }

  private advanceStage(fromBoss = false): void {
    const prevStage = this.stage;
    this.stage++;
    this.checkpointStage = this.stage;
    this.audio.setStage(this.stage);
    this.createBridgeFor(this.stage);
    this.saveCheckpoint();
    const ch = chapterForStage(this.stage);
    if (ch && ch.stage === this.stage) {
      this.pendingIntro = { title: ch.title, lines: ch.lines, quote: ch.quote };
      this.setState('chapterIntro');
    } else if (!fromBoss || prevStage !== 9) {
      this.callbacks.onToast(
        `Fase ${this.stage}`,
        'Checkpoint salvo — bom voo, piloto.'
      );
    }
    this.syncHud(true);
  }

  private saveCheckpoint(): void {
    this.save.saveRun({
      version: 1,
      seed: this.seed,
      stage: this.stage,
      score: this.score.points,
      lives: this.lives,
      missions: this.missions.serialize(),
      savedAt: Date.now(),
    });
  }

  // ------------------------------------------------------------------
  // Colisões
  // ------------------------------------------------------------------

  private updateCollisions(): void {
    const screenYOf = (wy: number) => this.H - (wy - this.scrollY);

    // Tiros do jogador → inimigos
    for (const b of this.bullets.list) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const sy = screenYOf(e.worldY);
        const dx = b.x - e.x;
        const dy = b.y - sy;
        if (Math.abs(dx) < e.size * 0.45 && Math.abs(dy) < e.size * 0.55) {
          b.active = false;
          e.hp--;
          if (e.hp <= 0) {
            this.destroyEnemy(e, sy);
          } else if (this.hitSfxTimer <= 0) {
            this.hitSfxTimer = 0.09;
            this.audio.play('hit');
          }
          break;
        }
      }
    }

    // Tiros do jogador → depósitos
    for (const b of this.bullets.list) {
      if (!b.active) continue;
      for (const d of this.pickups.depots) {
        if (!d.active) continue;
        const sy = screenYOf(d.worldY);
        if (
          Math.abs(b.x - d.x) < d.w / 2 + 4 &&
          Math.abs(b.y - sy) < d.h / 2 + 6
        ) {
          b.active = false;
          d.active = false;
          this.particles.explode(d.x, sy, d.kind === 'fake' ? 1.3 : 0.9);
          this.audio.play('explosion');
          const pts =
            d.kind === 'rare' ? 120 : d.kind === 'fake' ? 60 : 80;
          this.score.add(pts);
          this.score.registerKill();
          break;
        }
      }
    }

    // Tiros do jogador → chefe
    if (this.boss && this.boss.entered && !this.boss.dying) {
      for (const b of this.bullets.list) {
        if (!b.active) continue;
        const dx = b.x - this.boss.x;
        const dy = b.y - this.boss.y;
        const r = this.boss.size * 0.46;
        if (dx * dx + dy * dy < r * r) {
          b.active = false;
          this.boss.hit(1);
          if (this.hitSfxTimer <= 0) {
            this.hitSfxTimer = 0.09;
            this.audio.play('hit');
          }
        }
      }
    }

    // Tiros do jogador → ponte
    if (this.bridge && !this.bridge.broken) {
      const by = screenYOf(this.bridge.worldY);
      if (by > -60 && by < this.H + 60) {
        const shape = this.river.shapeAt(this.bridge.worldY);
        const leftPx = (shape.left - 0.02) * this.W;
        const rightPx = (shape.right + 0.02) * this.W;
        for (const b of this.bullets.list) {
          if (!b.active) continue;
          if (
            Math.abs(b.y - by) < 16 &&
            b.x > leftPx &&
            b.x < rightPx
          ) {
            b.active = false;
            this.bridge.hp--;
            this.bridge.flash = 0.12;
            this.audio.play('hit');
            if (this.bridge.hp <= 0) this.destroyBridge();
            break;
          }
        }
      }
    }

    // Inimigos → jogador
    for (const e of this.enemies) {
      if (!e.active) continue;
      const sy = screenYOf(e.worldY);
      const dx = e.x - this.player.x;
      const dy = sy - this.player.y;
      const r = e.size * 0.42 + 15;
      if (dx * dx + dy * dy < r * r) {
        if (this.player.shield > 0) {
          this.destroyEnemy(e, sy);
        } else if (this.player.invincible > 0) {
          // Proteção de respawn: destrói o inimigo sem pontuar
          e.active = false;
          this.particles.explode(e.x, sy, 0.7);
        } else {
          this.crash();
          return;
        }
      }
    }

    // Chefe → jogador (contato)
    if (this.boss && this.boss.entered && !this.boss.dying) {
      const dx = this.boss.x - this.player.x;
      const dy = this.boss.y - this.player.y;
      const r = this.boss.size * 0.44 + 16;
      if (
        dx * dx + dy * dy < r * r &&
        this.player.shield <= 0 &&
        this.player.invincible <= 0
      ) {
        this.crash();
        return;
      }
    }

    // Tiros inimigos → jogador
    for (const b of this.enemyBullets.list) {
      if (!b.active) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      if (dx * dx + dy * dy < 18 * 18) {
        b.active = false;
        if (this.player.hasShield()) {
          this.particles.explode(b.x, b.y, 0.35);
        } else {
          this.crash();
          return;
        }
      }
    }

    // Depósitos → jogador (reabastecimento)
    for (const d of this.pickups.depots) {
      if (!d.active) continue;
      const sy = screenYOf(d.worldY);
      if (
        Math.abs(d.x - this.player.x) < d.w / 2 + 14 &&
        Math.abs(sy - this.player.y) < d.h / 2 + 16
      ) {
        d.active = false;
        if (d.kind === 'fake') {
          if (this.player.shield > 0) {
            this.particles.explode(d.x, sy, 1);
            this.audio.play('explosion');
            this.score.add(60);
          } else {
            this.fuel = Math.max(0, this.fuel - 32);
            this.particles.explode(d.x, sy, 1.2);
            this.shake = Math.max(this.shake, 9);
            this.audio.play('explosion');
            this.callbacks.onToast('Tanque falsificado!', '-32 de combustível');
          }
        } else {
          const amount = d.kind === 'rare' ? 70 : 35;
          this.fuel = Math.min(FUEL_MAX, this.fuel + amount);
          this.missions.progress('collect_5_fuel');
          this.particles.splash(d.x, sy, 0.7);
          this.audio.play('refuel');
          if (d.kind === 'rare') this.score.add(150);
        }
      }
    }

    // Power-ups → jogador
    for (const p of this.pickups.powerups) {
      if (!p.active) continue;
      const sy = screenYOf(p.worldY);
      const dx = p.x - this.player.x;
      const dy = sy + Math.sin(this.time * 3 + p.phase) * 5 - this.player.y;
      if (dx * dx + dy * dy < 30 * 30) {
        p.active = false;
        this.player.applyPowerUp(p.kind);
        this.audio.play('powerup');
        const label =
          p.kind === 'shield' ? 'Escudo' :
          p.kind === 'triple' ? 'Tiro Triplo' :
          p.kind === 'homing' ? 'Míssil Teleguiado' : 'Turbo';
        this.callbacks.onToast(label, 'Power-up ativado');
      }
    }

    // Ponte → jogador (atravessar ponte intacta é fatal)
    if (this.bridge && !this.bridge.broken) {
      const by = screenYOf(this.bridge.worldY);
      if (
        Math.abs(this.player.y - by) < 24 &&
        this.player.invincible <= 0 &&
        this.player.shield <= 0
      ) {
        this.crash();
        return;
      }
    }

    this.bullets.list = this.bullets.list.filter((b) => b.active);
    this.pickups.depots = this.pickups.depots.filter((d) => d.active);
    this.pickups.powerups = this.pickups.powerups.filter((p) => p.active);
  }

  private destroyEnemy(e: Enemy, sy: number): void {
    e.active = false;
    this.kills++;
    this.particles.explode(e.x, sy, e.kind === 'turret' ? 1.1 : 0.85);
    this.audio.play('explosion');
    this.score.add(e.points);
    this.score.registerKill();
    this.missions.progress('destroy_20');
    this.shake = Math.max(this.shake, 5);
  }

  private destroyBridge(): void {
    if (!this.bridge) return;
    this.bridge.broken = true;
    const by = this.H - (this.bridge.worldY - this.scrollY);
    const shape = this.river.shapeAt(this.bridge.worldY);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      this.particles.explode(
        shape.left * this.W + (shape.right - shape.left) * this.W * t,
        by + (Math.random() - 0.5) * 18,
        1.1
      );
    }
    this.audio.play('bridge');
    this.shake = 12;
    this.score.add(500);
    this.score.registerKill();
    this.callbacks.onToast('Ponte destruída!', '+500 pontos');
    this.advanceStage();
  }

  // ------------------------------------------------------------------
  // Morte / respawn / fim de jogo
  // ------------------------------------------------------------------

  private crash(): void {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.player.visible = false;
    this.particles.explode(this.player.x, this.player.y, 1.6);
    this.audio.play('bigExplosion');
    this.shake = 14;
    this.lives--;
    this.deathTimer = this.lives > 0 ? 1.3 : 1.7;
    this.syncHud(true);
  }

  private respawn(): void {
    this.scrollY = stageStartY(this.stage) + 40;
    this.enemies = [];
    this.enemyBullets.list = [];
    this.pickups.powerups = [];
    this.bullets.list = [];
    this.boss = null;
    this.bossTriggered = false;
    this.pendingBoss = null;
    this.fuel = FUEL_MAX;
    this.player.alive = true;
    this.player.visible = true;
    this.player.invincible = 2.6;
    this.placePlayerInRiver();
    this.nextDepotY = Math.max(this.nextDepotY, this.scrollY + 1400);
    this.nextPowerupY = Math.max(this.nextPowerupY, this.scrollY + 3000);
    this.audio.setBossMode(false);
    this.syncHud(true);
  }

  private finishGameOver(): void {
    const creditsEarned = Math.floor(this.score.points / 50);
    this.profile.credits += creditsEarned;
    this.profile.bestScore = Math.max(this.profile.bestScore, this.score.points);
    this.profile.localScores.unshift({
      name: 'Piloto',
      score: this.score.points,
      stage: this.stage,
      date: new Date().toISOString(),
    });
    this.profile.localScores = this.profile.localScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    this.save.saveProfile(this.profile);
    this.save.clearRun();
    this.lastRun = {
      score: this.score.points,
      stage: this.stage,
      credits: creditsEarned,
      kills: this.kills,
    };
    this.audio.stopMusic();
    this.audio.setBossMode(false);
    this.audio.play('gameOver');
    this.setState('gameover');
    this.syncHud(true);
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------

  private syncHud(force = false): void {
    if (!force && this.hudTimer > 0 && this.state !== 'playing') return;
    const chapter = chapterForStage(this.stage);
    const hud: HudState = {
      state: this.state,
      score: this.score.points,
      hiScore: Math.max(this.profile.bestScore, this.score.points),
      credits: this.profile.credits,
      fuel: this.fuel,
      fuelMax: FUEL_MAX,
      lives: this.lives,
      stage: this.stage,
      chapterTitle: chapter ? chapter.title : 'Modo Infinito',
      combo: this.score.combo,
      comboActive: this.score.comboTimer > 0 && this.score.combo > 1,
      speedKmh: Math.round(this.scrollSpeed * 1.15),
      powerUps: (
        [
          ['shield', this.player.shield],
          ['triple', this.player.triple],
          ['homing', this.player.homing],
          ['turbo', this.player.turbo],
        ] as const
      )
        .filter(([, t]) => t > 0)
        .map(([kind, t]) => ({
          kind,
          timeLeft: t,
          duration:
            kind === 'shield'
              ? 6 + this.player.stats.shieldBonus
              : kind === 'turbo'
                ? 5
                : 8,
        })),
      boss:
        this.boss && !this.boss.dying
          ? {
              name: BOSS_NAMES[this.boss.id],
              hp: this.boss.hp,
              maxHp: this.boss.maxHp,
            }
          : null,
      missions: this.missions.toHud(),
      checkpointStage: this.checkpointStage,
      runActive: this.state === 'playing' || this.state === 'paused',
      canContinue: this.save.loadRun() !== null,
      upgrades: { ...this.profile.upgrades },
      settings: { ...this.profile.settings },
      campaignDone: this.profile.campaignDone,
      gamepadConnected: this.input.gamepadConnected,
      localScores: [...this.profile.localScores],
    };
    this.callbacks.onHud(hud);
  }

  // ------------------------------------------------------------------
  // Renderização
  // ------------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }

    this.drawWorld(ctx);
    this.pickups.draw(ctx, this.scrollY, this.H, this.time);

    if (this.bridge && !this.bridge.broken) {
      this.drawBridge(ctx);
    }

    for (const e of this.enemies) {
      const sy = this.H - (e.worldY - this.scrollY);
      if (sy > -80 && sy < this.H + 80) e.draw(ctx, sy, this.time);
    }

    if (this.boss) this.boss.draw(ctx);

    if (this.state !== 'menu' && this.player.visible) {
      this.player.draw(ctx, this.time);
    }

    this.bullets.draw(ctx);
    this.enemyBullets.draw(ctx);
    this.particles.draw(ctx);

    // Aviso de combustível baixo
    if (
      (this.state === 'playing' || this.state === 'paused') &&
      this.fuel < 25 &&
      this.player.alive
    ) {
      const pulse = 0.25 + 0.2 * Math.sin(this.time * 6);
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse + 0.15})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, this.W - 10, this.H - 10);
    }

    ctx.restore();
  }

  private drawWorld(ctx: CanvasRenderingContext2D): void {
    const { W, H } = this;
    const screenYOf = (wy: number) => H - (wy - this.scrollY);

    // Terra base
    ctx.fillStyle = '#1e4a2b';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Água em faixas (margens curvas suaves)
    const band = 6;
    const waterGrad = ctx.createLinearGradient(0, 0, 0, H);
    waterGrad.addColorStop(0, '#12586c');
    waterGrad.addColorStop(1, '#0a3a4a');
    ctx.fillStyle = waterGrad;
    for (let y = -band; y < H + band; y += band) {
      const wy = this.scrollY + (H - y);
      const s = this.river.shapeAt(wy);
      ctx.fillRect(s.left * W, y, (s.right - s.left) * W, band + 1);
      if (s.hasIsland) {
        ctx.fillStyle = '#1e4a2b';
        ctx.fillRect(s.islandLeft * W, y, (s.islandRight - s.islandLeft) * W, band + 1);
        ctx.fillStyle = waterGrad;
      }
    }

    // Margens: linha de lama + grama + espuma
    const step = 12;
    const drawEdge = (
      edgeFn: (s: ReturnType<River['shapeAt']>) => number,
      normalSign: number
    ) => {
      ctx.beginPath();
      for (let y = -step; y <= H + step; y += step) {
        const wy = this.scrollY + (H - y);
        const s = this.river.shapeAt(wy);
        const x = edgeFn(s) * W + normalSign * 4 + Math.sin(this.time * 1.8 + y * 0.05) * 1.6;
        if (y === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#2f6b3c';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    drawEdge((s) => s.left, 1);
    drawEdge((s) => s.right, -1);

    // Brilho na água (linhas onduladas ancoradas no mundo)
    ctx.strokeStyle = 'rgba(173, 226, 255, 0.09)';
    ctx.lineWidth = 2;
    const rowH = 46;
    const firstRow = Math.floor(this.scrollY / rowH) * rowH;
    for (let wy = firstRow; wy < this.scrollY + H + rowH; wy += rowH) {
      const y = screenYOf(wy);
      const rng = mulberry(wy);
      const x0 = rng() * W;
      const len = 24 + rng() * 70;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + len, y + Math.sin(this.time * 2 + wy) * 2);
      ctx.stroke();
    }

    // Decorações nas margens
    const decors = this.river.decorsFor(this.scrollY - 80, this.scrollY + H + 80);
    for (const d of decors) {
      const y = screenYOf(d.worldY);
      if (y < -40 || y > H + 40) continue;
      const x = d.x * W;
      ctx.save();
      ctx.translate(x, y);
      const s = d.scale;
      if (d.type === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(3, 4, 9 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5b3d20';
        ctx.fillRect(-1.6 * s, -2 * s, 3.2 * s, 7 * s);
        ctx.fillStyle = '#2d6a3f';
        ctx.beginPath();
        ctx.moveTo(0, -20 * s);
        ctx.lineTo(8 * s, -2 * s);
        ctx.lineTo(-8 * s, -2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3d8a51';
        ctx.beginPath();
        ctx.moveTo(0, -16 * s);
        ctx.lineTo(6 * s, -4 * s);
        ctx.lineTo(-6 * s, -4 * s);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === 'bush') {
        ctx.fillStyle = '#356e42';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7 * s, 4.4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#46855a';
        ctx.beginPath();
        ctx.ellipse(-2 * s, -2 * s, 4 * s, 2.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath();
        ctx.ellipse(-1.4 * s, -1.4 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawBridge(ctx: CanvasRenderingContext2D): void {
    const b = this.bridge;
    if (!b) return;
    const by = this.H - (b.worldY - this.scrollY);
    if (by < -80 || by > this.H + 80) return;
    const shape = this.river.shapeAt(b.worldY);
    const left = (shape.left - 0.025) * this.W;
    const right = (shape.right + 0.025) * this.W;
    const w = right - left;

    ctx.save();
    // Pilares na água
    ctx.fillStyle = '#4a3320';
    const pylons = 4;
    for (let i = 0; i <= pylons; i++) {
      const px = left + (w / pylons) * i;
      ctx.fillRect(px - 5, by - 26, 10, 52);
    }
    // Tabuleiro
    const grad = ctx.createLinearGradient(0, by - 16, 0, by + 16);
    grad.addColorStop(0, '#a86f38');
    grad.addColorStop(0.5, '#8a5a2b');
    grad.addColorStop(1, '#5d3b1a');
    ctx.fillStyle = grad;
    ctx.fillRect(left, by - 15, w, 30);
    // Guarda-corpo
    ctx.fillStyle = '#c98f4e';
    ctx.fillRect(left, by - 19, w, 4);
    ctx.fillRect(left, by + 15, w, 4);
    for (let i = 0; i <= 14; i++) {
      const px = left + (w / 14) * i;
      ctx.fillRect(px - 1.5, by - 19, 3, 38);
    }
    // Dano acumulado
    const dmg = 1 - b.hp / b.maxHp;
    if (dmg > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const holes = Math.round(dmg * 5);
      for (let i = 0; i < holes; i++) {
        const hx = left + ((i * 0.23 + 0.12) % 1) * w;
        ctx.beginPath();
        ctx.arc(hx, by + Math.sin(i * 5) * 6, 6 + dmg * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Luzes de alerta piscando
    const blink = Math.floor(this.time * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ff5b47' : '#7f1d1d';
    for (const px of [left + 8, right - 8]) {
      ctx.beginPath();
      ctx.arc(px, by - 22, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flash de dano
    if (b.flash > 0) {
      b.flash = Math.max(0, b.flash - 0.016);
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 4})`;
      ctx.fillRect(left, by - 19, w, 38);
    }
    ctx.restore();
  }
}

/** Hash determinístico barato para decorar a água. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
