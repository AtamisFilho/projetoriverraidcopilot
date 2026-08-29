/**
 * River Raid Remaster — Projéteis
 * Correções em relação ao original (PDF):
 *  - Tiros do jogador e do inimigo são sistemas separados com direção
 *    arbitrária (o original fazia tiros do boss subirem, sem nunca acertar
 *    o jogador que está abaixo).
 *  - Cooldown centralizado e upgrádável.
 */

export interface PlayerBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homing: boolean;
  active: boolean;
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export class BulletSystem {
  list: PlayerBullet[] = [];

  shoot(x: number, y: number, angle: number, homing: boolean, speed = 780): void {
    this.list.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      homing,
      active: true,
    });
  }

  /**
   * @param nearestTarget retorna o alvo mais próximo de uma bala (ou null)
   */
  update(
    dt: number,
    nearestTarget: (b: PlayerBullet) => { x: number; y: number } | null
  ): void {
    for (const b of this.list) {
      if (b.homing) {
        const target = nearestTarget(b);
        if (target) {
          // Vira suavemente em direção ao alvo
          const speed = Math.hypot(b.vx, b.vy);
          const desired = Math.atan2(-(target.y - b.y), target.x - b.x);
          const current = Math.atan2(-b.vy, b.vx);
          let d = desired - current;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = Math.max(-6 * dt, Math.min(6 * dt, d));
          const angle = current + turn;
          b.vx = Math.cos(angle) * speed;
          b.vy = -Math.sin(angle) * speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.y > 1200 || b.x < -60 || b.x > 2200) b.active = false;
    }
    this.list = this.list.filter((b) => b.active);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.list) {
      const len = 16;
      const ang = Math.atan2(-b.vy, b.vx);
      const tx = b.x - Math.cos(ang) * len;
      const ty = b.y + Math.sin(ang) * len;
      const grad = ctx.createLinearGradient(b.x, b.y, tx, ty);
      const main = b.homing ? '#e9d5ff' : '#ffe98a';
      const tail = b.homing ? 'rgba(192,132,252,0)' : 'rgba(255,233,138,0)';
      grad.addColorStop(0, main);
      grad.addColorStop(1, tail);
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.homing ? 4 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class EnemyBulletSystem {
  list: EnemyBullet[] = [];

  shoot(x: number, y: number, vx: number, vy: number): void {
    // >= (não >): o teto era 91 por causa de um off-by-one
    if (this.list.length >= 90) return;
    this.list.push({ x, y, vx, vy, active: true });
  }

  update(dt: number): void {
    for (const b of this.list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > 1400 || b.y < -200 || b.x < -100 || b.x > 2400) b.active = false;
    }
    this.list = this.list.filter((b) => b.active);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.list) {
      ctx.fillStyle = 'rgba(255, 90, 71, 0.35)';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5b47';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd9d2';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
