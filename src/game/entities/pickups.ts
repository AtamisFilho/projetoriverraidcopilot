/**
 * River Raid Remaster — Coletáveis
 * ----------------------------------
 * Depósitos de combustível ancorados no mundo (como no clássico: encoste
 * para reabastecer, ou atire para ganhar pontos) + power-ups flutuantes.
 *
 * Do PDF: tanques normais, raros (bônus grande) e falsos (explosivos).
 */

import type { FuelKind, PowerUpKind } from '../types';
import { POWERUP_INFO } from '../types';

export class FuelDepot {
  kind: FuelKind;
  x: number;
  worldY: number;
  active = true;
  w = 26;
  h = 52;

  constructor(kind: FuelKind, x: number, worldY: number) {
    this.kind = kind;
    this.x = x;
    this.worldY = worldY;
  }
}

export class PowerUpPickup {
  kind: PowerUpKind;
  x: number;
  worldY: number;
  active = true;
  phase = Math.random() * Math.PI * 2;

  constructor(kind: PowerUpKind, x: number, worldY: number) {
    this.kind = kind;
    this.x = x;
    this.worldY = worldY;
  }
}

export class PickupSystem {
  depots: FuelDepot[] = [];
  powerups: PowerUpPickup[] = [];

  spawnDepot(kind: FuelKind, x: number, worldY: number): void {
    this.depots.push(new FuelDepot(kind, x, worldY));
  }

  spawnPowerUp(kind: PowerUpKind, x: number, worldY: number): void {
    this.powerups.push(new PowerUpPickup(kind, x, worldY));
  }

  update(scrollY: number, H: number): void {
    const cutoff = scrollY - 200;
    this.depots = this.depots.filter((d) => d.active && d.worldY > cutoff);
    this.powerups = this.powerups.filter(
      (p) => p.active && p.worldY > cutoff && p.worldY < scrollY + H + 120
    );
  }

  draw(ctx: CanvasRenderingContext2D, scrollY: number, H: number, time: number): void {
    for (const d of this.depots) {
      const y = H - (d.worldY - scrollY);
      if (y < -80 || y > H + 80) continue;
      ctx.save();
      ctx.translate(d.x, y);

      // Sombra na água
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(2, 4, d.w * 0.62, d.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      if (d.kind === 'rare') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.shadowColor = `rgba(250, 204, 21, ${0.5 + pulse * 0.5})`;
        ctx.shadowBlur = 14 + pulse * 10;
      }

      // Torre
      const body =
        d.kind === 'normal' ? '#2f9e63' : d.kind === 'rare' ? '#d4a017' : '#b33939';
      ctx.fillStyle = body;
      const r = 6;
      ctx.beginPath();
      ctx.roundRect(-d.w / 2, -d.h / 2, d.w, d.h, r);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Faixa
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-d.w / 2, -6, d.w, 12);

      // Glifo
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.kind === 'rare' ? '★' : d.kind === 'fake' ? '!' : 'F', 0, 0);

      // Símbolo de combustível no topo
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-3, -d.h / 2 - 5, 6, 5);
      ctx.restore();
    }

    for (const p of this.powerups) {
      const y = H - (p.worldY - scrollY);
      if (y < -60 || y > H + 60) continue;
      const info = POWERUP_INFO[p.kind];
      const bob = Math.sin(time * 3 + p.phase) * 5;
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 + p.phase);
      ctx.save();
      ctx.translate(p.x, y + bob);

      // Halo
      ctx.globalAlpha = 0.28 + pulse * 0.25;
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      // Cápsula
      ctx.fillStyle = 'rgba(8, 20, 26, 0.88)';
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-13, -13, 26, 26, 7);
      ctx.fill();
      ctx.stroke();

      // Ícone vetorial por tipo
      ctx.fillStyle = info.color;
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2;
      switch (p.kind) {
        case 'shield':
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(6, -4);
          ctx.lineTo(6, 2);
          ctx.lineTo(0, 7);
          ctx.lineTo(-6, 2);
          ctx.lineTo(-6, -4);
          ctx.closePath();
          ctx.fill();
          break;
        case 'triple':
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(i * 6, 0, 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'homing':
          ctx.beginPath();
          ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -9);
          ctx.lineTo(0, -3);
          ctx.moveTo(0, 3);
          ctx.lineTo(0, 9);
          ctx.moveTo(-9, 0);
          ctx.lineTo(-3, 0);
          ctx.moveTo(3, 0);
          ctx.lineTo(9, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'turbo':
          ctx.beginPath();
          ctx.moveTo(-7, -6);
          ctx.lineTo(-1, 0);
          ctx.lineTo(-7, 6);
          ctx.closePath();
          ctx.moveTo(1, -6);
          ctx.lineTo(7, 0);
          ctx.lineTo(1, 6);
          ctx.closePath();
          ctx.fill();
          break;
      }
      ctx.restore();
    }
  }
}
