/**
 * River Raid Remaster — Jogador
 * -------------------------------
 * Correções em relação ao original (PDF):
 *  - A nave é limitada pela tela e a colisão com as margens é
 *    responsabilidade do mundo (o original deixava a nave voar sobre a
 *    terra — no River Raid clássico, tocar a margem é fatal).
 *  - Power-ups com timers em segundos e imunidade pós-respawn.
 *  - Parâmetros de upgrades aplicados via `PlayerStats` (separação lógica
 *    vs. progressão permanente).
 */

import type { PowerUpKind } from '../types';
import { POWERUP_INFO } from '../types';
import type { InputState } from '../input/input';

export interface PlayerStats {
  speed: number; // px/s
  fireCooldown: number; // s
  fuelEfficiency: number; // multiplicador de consumo (0..1]
  shieldBonus: number; // segundos extras de escudo
}

export class Player {
  x: number;
  y: number;
  w = 34;
  h = 46;
  stats: PlayerStats = {
    speed: 340,
    fireCooldown: 0.26,
    fuelEfficiency: 1,
    shieldBonus: 0,
  };
  cooldown = 0;
  alive = true;
  visible = true;

  // Timers de power-ups (segundos)
  shield = 0;
  triple = 0;
  homing = 0;
  turbo = 0;
  invincible = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  applyPowerUp(kind: PowerUpKind): void {
    const bonus = kind === 'shield' ? this.stats.shieldBonus : 0;
    this[kind] = POWERUP_INFO[kind].duration + bonus;
  }

  hasShield(): boolean {
    return this.shield > 0 || this.invincible > 0;
  }

  update(
    dt: number,
    input: InputState,
    opts: {
      W: number;
      H: number;
      fire: (x: number, y: number) => void;
    }
  ): void {
    // Timers
    this.shield = Math.max(0, this.shield - dt);
    this.triple = Math.max(0, this.triple - dt);
    this.homing = Math.max(0, this.homing - dt);
    this.turbo = Math.max(0, this.turbo - dt);
    this.invincible = Math.max(0, this.invincible - dt);

    const speedMult = this.turbo > 0 ? 1.55 : 1;
    const speed = this.stats.speed * speedMult;

    this.x += input.axisX * speed * dt;
    this.y += input.axisY * speed * dt;

    // Limites da tela
    this.x = Math.max(this.w / 2 + 6, Math.min(opts.W - this.w / 2 - 6, this.x));
    this.y = Math.max(opts.H * 0.26, Math.min(opts.H - this.h / 2 - 26, this.y));

    // Tiro com cooldown
    this.cooldown -= dt;
    if (input.fire && this.cooldown <= 0) {
      this.cooldown = this.stats.fireCooldown;
      if (this.triple > 0) {
        opts.fire(this.x - 14, this.y - this.h / 2 + 6);
        opts.fire(this.x, this.y - this.h / 2 - 2);
        opts.fire(this.x + 14, this.y - this.h / 2 + 6);
      } else {
        opts.fire(this.x, this.y - this.h / 2 - 2);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    if (!this.visible) return;

    // Piscar durante invencibilidade
    if (this.invincible > 0 && Math.floor(time * 14) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Sombra projetada na água
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(this.x + 10, this.y + 20, this.w * 0.62, this.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y);

    // Chama do motor (maior com turbo)
    const flameLen =
      14 + Math.sin(time * 42) * 4 + (this.turbo > 0 ? 16 : 0);
    const grad = ctx.createLinearGradient(0, this.h / 2 - 4, 0, this.h / 2 + flameLen);
    grad.addColorStop(0, this.turbo > 0 ? '#a5f3fc' : '#fff7cc');
    grad.addColorStop(0.4, this.turbo > 0 ? '#38bdf8' : '#ffb347');
    grad.addColorStop(1, 'rgba(255, 82, 41, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-5, this.h / 2 - 4);
    ctx.lineTo(5, this.h / 2 - 4);
    ctx.lineTo(0, this.h / 2 + flameLen);
    ctx.closePath();
    ctx.fill();

    // Asas
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-this.w / 2 - 4, this.h * 0.34);
    ctx.lineTo(-this.w / 2 - 2, this.h * 0.44);
    ctx.lineTo(-3, this.h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.lineTo(this.w / 2 + 4, this.h * 0.34);
    ctx.lineTo(this.w / 2 + 2, this.h * 0.44);
    ctx.lineTo(3, this.h * 0.2);
    ctx.closePath();
    ctx.fill();

    // Fuselagem
    const hull = ctx.createLinearGradient(-this.w / 4, 0, this.w / 4, 0);
    hull.addColorStop(0, '#cbd5e1');
    hull.addColorStop(0.5, '#f1f5f9');
    hull.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -this.h / 2);
    ctx.lineTo(9, -this.h * 0.14);
    ctx.lineTo(10, this.h / 2 - 4);
    ctx.lineTo(-10, this.h / 2 - 4);
    ctx.lineTo(-9, -this.h * 0.14);
    ctx.closePath();
    ctx.fill();

    // Cauda
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(-11, this.h * 0.28);
    ctx.lineTo(11, this.h * 0.28);
    ctx.lineTo(7, this.h * 0.5);
    ctx.lineTo(-7, this.h * 0.5);
    ctx.closePath();
    ctx.fill();

    // Cabine
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.ellipse(0, -this.h * 0.16, 4.4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 242, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-1.4, -this.h * 0.19, 1.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Bolha de escudo
    if (this.shield > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(time * 8);
      const fade = Math.min(1, this.shield / 1.2);
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.13)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 33 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
