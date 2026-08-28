/**
 * River Raid Remaster — Chefes
 * ------------------------------
 * Os três chefes da campanha (PDF): Sentinela do Vale, Aracno-Mecânico e
 * Núcleo da Garganta de Ferro.
 *
 * Correções em relação ao original (PDF):
 *  - Os projéteis do chefe agora viajam NA DIREÇÃO calculada (o original
 *    chamava bullets.shoot(), que tinha vy = -speed, ou seja, os tiros
 *    subiam e nunca atingiam o jogador abaixo do chefe).
 *  - A flag de spawn do chefe é controlada pelo mundo por fase, corrigindo
 *    o bug em que `spawned` nunca era limpo (chefe só aparecia na fase 3).
 *  - Fases internas (1→2→3) conforme o HP cai, com padrões distintos:
 *    tiro único mirado, leque triplo e rajada radial (conforme o PDF).
 */

import type { BossId } from '../types';

export const BOSS_NAMES: Record<BossId, string> = {
  1: 'Sentinela do Vale',
  2: 'Aracno-Mecânico',
  3: 'Núcleo da Garganta de Ferro',
};

export interface BossUpdateCtx {
  dt: number;
  W: number;
  H: number;
  time: number;
  playerX: number;
  playerY: number;
  fire: (x: number, y: number, vx: number, vy: number) => void;
  spawnMinion: (x: number, y: number) => void;
  bulletSpeed: number;
}

export class Boss {
  id: BossId;
  hp: number;
  maxHp: number;
  x: number;
  y = -160;
  size: number;
  active = true;
  phase = 1;
  entered = false;
  dying = false;
  dieTimer = 0;
  hitFlash = 0;
  private time = 0;
  private attackTimer = 1.6;
  private minionTimer = 4;
  private targetY: number;
  private baseX: number;

  constructor(id: BossId, W: number, H: number, hpScale = 1) {
    this.id = id;
    this.maxHp = Math.round((id === 1 ? 46 : id === 2 ? 70 : 104) * hpScale);
    this.hp = this.maxHp;
    this.size = id === 1 ? 92 : id === 2 ? 104 : 118;
    this.x = W / 2;
    this.baseX = W / 2;
    this.targetY = H * 0.24;
  }

  hit(dmg = 1): void {
    if (this.dying) return;
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.dieTimer = 1.7;
    }
  }

  update(ctx: BossUpdateCtx): void {
    const { dt, W, H } = ctx;
    this.time += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.dying) {
      this.dieTimer -= dt;
      if (this.dieTimer <= 0) this.active = false;
      return;
    }

    // Entrada
    if (!this.entered) {
      this.y += (this.targetY - this.y) * Math.min(1, dt * 1.6);
      if (Math.abs(this.y - this.targetY) < 6) this.entered = true;
      return;
    }

    // Fases internas por HP (PDF)
    const ratio = this.hp / this.maxHp;
    this.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    // Movimento senoidal
    this.x =
      this.baseX + Math.sin(this.time * 0.65) * Math.min(W * 0.28, 260);
    this.y = this.targetY + Math.sin(this.time * 1.25) * 16;

    // Ataques
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attack(ctx);
      this.attackTimer =
        this.phase === 1 ? 1.15 : this.phase === 2 ? 0.78 : 0.52;
    }

    // Subordinados a partir da fase 2
    if (this.phase >= 2) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        ctx.spawnMinion(
          this.x + (Math.random() - 0.5) * this.size,
          this.y + 20
        );
        this.minionTimer = 3.4 - this.phase * 0.4;
      }
    }
  }

  private attack(ctx: BossUpdateCtx): void {
    const speed = ctx.bulletSpeed + (this.phase - 1) * 30;
    const dx = ctx.playerX - this.x;
    const dy = ctx.playerY - (this.y + this.size * 0.3);
    const baseAngle = Math.atan2(dy, dx);

    if (this.phase === 1) {
      // Tiro único mirado
      ctx.fire(
        this.x,
        this.y + this.size * 0.3,
        Math.cos(baseAngle) * speed,
        Math.sin(baseAngle) * speed
      );
    } else if (this.phase === 2) {
      // Leque triplo
      for (const off of [-0.24, 0, 0.24]) {
        ctx.fire(
          this.x,
          this.y + this.size * 0.3,
          Math.cos(baseAngle + off) * speed,
          Math.sin(baseAngle + off) * speed
        );
      }
    } else {
      // Rajada radial (12 tiros) + par mirado
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + this.time;
        ctx.fire(
          this.x,
          this.y,
          Math.cos(a) * speed * 0.82,
          Math.sin(a) * speed * 0.82
        );
      }
      ctx.fire(
        this.x,
        this.y + this.size * 0.3,
        Math.cos(baseAngle) * speed,
        Math.sin(baseAngle) * speed
      );
    }
  }

  /** Centro das explosões durante a morte (para o mundo animar). */
  deathExplosionPoint(): { x: number; y: number } {
    return {
      x: this.x + (Math.random() - 0.5) * this.size * 0.9,
      y: this.y + (Math.random() - 0.5) * this.size * 0.9,
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(6, this.size * 0.42, this.size * 0.5, this.size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const flash = this.hitFlash > 0;
    const bodyColor = flash ? '#ffffff' : this.phase === 3 ? '#b91c1c' : this.phase === 2 ? '#c2410c' : '#9f1239';
    const trimColor = flash ? '#fca5a5' : '#f43f5e';
    const glow =
      this.phase === 1 ? '#fbbf24' : this.phase === 2 ? '#fb923c' : '#ef4444';

    if (this.id === 1) {
      // Sentinela: drone blindado hexagonal com olho central
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = Math.cos(a) * this.size * 0.52;
        const py = Math.sin(a) * this.size * 0.52;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 4;
      ctx.stroke();
      // Propulsores laterais
      ctx.fillStyle = '#334155';
      ctx.fillRect(-this.size * 0.62, -10, 14, 26);
      ctx.fillRect(this.size * 0.62 - 14, -10, 14, 26);
      // Olho
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.id === 2) {
      // Aracno-Mecânico: núcleo circular com 6 pernas articuladas
      const legs = 6;
      ctx.strokeStyle = flash ? '#fff' : '#475569';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (let i = 0; i < legs; i++) {
        const a = (Math.PI * 2 * i) / legs + Math.sin(this.time * 2 + i) * 0.18;
        const jx = Math.cos(a) * this.size * 0.55;
        const jy = Math.sin(a) * this.size * 0.55;
        const ex = Math.cos(a + 0.5) * this.size * 0.95;
        const ey = Math.sin(a + 0.5) * this.size * 0.95;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(jx, jy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = trimColor;
        ctx.beginPath();
        ctx.arc(jx, jy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 4;
      ctx.stroke();
      // Núcleo girando
      ctx.save();
      ctx.rotate(this.time * 2.4);
      ctx.fillStyle = glow;
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.ellipse(0, -this.size * 0.16, this.size * 0.07, this.size * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // Núcleo da Garganta de Ferro: massa circular com anéis rotativos
      ctx.save();
      ctx.rotate(this.time * 0.8);
      ctx.strokeStyle = flash ? '#fff' : '#57534e';
      ctx.lineWidth = 10;
      ctx.setLineDash([26, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.save();
      ctx.rotate(-this.time * 1.4);
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        ctx.rotate((Math.PI * 2) / 8);
        ctx.beginPath();
        ctx.moveTo(this.size * 0.42, 0);
        ctx.lineTo(this.size * 0.58, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 7);
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 22 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.18 * (0.8 + 0.2 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Dano: rachaduras quando o HP cai
    if (this.hp / this.maxHp < 0.5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.2, -this.size * 0.1);
      ctx.lineTo(-this.size * 0.05, this.size * 0.12);
      ctx.lineTo(this.size * 0.16, -this.size * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }
}
