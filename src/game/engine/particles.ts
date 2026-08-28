/**
 * River Raid Remaster — Sistema de partículas
 * Correção: vida em segundos (não em frames), arrasto e gravidade em
 * unidades por segundo — independente do framerate.
 */

export type ParticleType = 'spark' | 'smoke' | 'ring' | 'debris' | 'foam';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: ParticleType;
  drag: number;
  grav: number;
}

const FIRE_PALETTE = ['#ffd166', '#ff9f43', '#ff6b35', '#ff4757', '#fff3b0'];

export class ParticleSystem {
  list: Particle[] = [];

  explode(x: number, y: number, scale = 1): void {
    // Faíscas
    const n = Math.round(14 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 220) * scale;
      this.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4,
        size: (2 + Math.random() * 3.5) * scale,
        color: FIRE_PALETTE[Math.floor(Math.random() * FIRE_PALETTE.length)],
        type: 'spark',
        drag: 2.2,
        grav: 60,
      });
    }
    // Fumaça
    for (let i = 0; i < Math.round(7 * scale); i++) {
      const a = Math.random() * Math.PI * 2;
      this.push({
        x: x + (Math.random() - 0.5) * 14 * scale,
        y: y + (Math.random() - 0.5) * 14 * scale,
        vx: Math.cos(a) * 30 * scale,
        vy: Math.sin(a) * 30 * scale - 20,
        life: 0.7 + Math.random() * 0.6,
        size: (6 + Math.random() * 10) * scale,
        color: '#5c677d',
        type: 'smoke',
        drag: 1.4,
        grav: -26,
      });
    }
    // Detritos
    for (let i = 0; i < Math.round(6 * scale); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 180) * scale;
      this.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.5,
        size: (2 + Math.random() * 2.5) * scale,
        color: '#8d99ae',
        type: 'debris',
        drag: 1.2,
        grav: 340,
      });
    }
    // Onda de choque
    this.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.4,
      size: 10 * scale,
      color: '#ffffff',
      type: 'ring',
      drag: 0,
      grav: 0,
    });
  }

  splash(x: number, y: number, scale = 1): void {
    for (let i = 0; i < Math.round(10 * scale); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = (70 + Math.random() * 160) * scale;
      this.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.3,
        size: (1.5 + Math.random() * 2) * scale,
        color: '#bfe8ff',
        type: 'foam',
        drag: 1.8,
        grav: 300,
      });
    }
  }

  private push(p: Particle): void {
    if (this.list.length > 600) return; // teto de segurança
    this.list.push({ ...p, maxLife: p.life });
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.grav * dt;
      const dragF = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragF;
      p.vy *= dragF;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      if (p.type === 'ring') {
        const r = p.size + (1 - t) * 60;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * t + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - t) * 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.type === 'foam' ? t : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
