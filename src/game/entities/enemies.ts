/**
 * River Raid Remaster — Inimigos
 * --------------------------------
 * Inclui os tipos pedidos na especificação (PDF): barcos, barcos blindados,
 * helicópteros, helicópteros furtivos, jatos, drones perseguidores,
 * zigue-zague e torres automáticas nas margens.
 *
 * Correções em relação ao original (PDF):
 *  - Inimigos nascem DENTRO do rio (o original sorteava x em toda a largura
 *    da tela, criando inimigos em cima da terra).
 *  - Nada de `window.innerHeight` dentro dos módulos: limites vêm por
 *    contexto injetado.
 *  - Velocidade multiplicada UMA vez no spawn (o original multiplicava a
 *    cada frame).
 */

import type { EnemyKind } from '../types';
import type { RiverShape } from '../world/river';

export interface EnemyUpdateCtx {
  dt: number;
  W: number;
  H: number;
  time: number;
  scrollY: number;
  playerX: number;
  playerY: number;
  speedMultiplier: number;
  approachMultiplier: number;
  shapeAt: (worldY: number) => RiverShape;
  fire: (x: number, y: number, vx: number, vy: number) => void;
}

export class Enemy {
  kind: EnemyKind;
  x: number;
  worldY: number;
  hp: number;
  points: number;
  size: number;
  active = true;
  private vx = 0;
  private phase = 0;
  private fireTimer = 0;
  private approach: number;
  side: -1 | 1 = -1; // lado da margem (torres)

  constructor(kind: EnemyKind, x: number, worldY: number, stage: number) {
    this.kind = kind;
    this.x = x;
    this.worldY = worldY;
    this.phase = Math.random() * Math.PI * 2;
    switch (kind) {
      case 'boat':
        this.hp = 1;
        this.points = 30;
        this.size = 30;
        this.vx = (Math.random() < 0.5 ? -1 : 1) * (46 + Math.random() * 30);
        this.approach = 0;
        break;
      case 'armored':
        this.hp = 2;
        this.points = 60;
        this.size = 36;
        this.vx = (Math.random() < 0.5 ? -1 : 1) * (34 + Math.random() * 22);
        this.approach = 0;
        break;
      case 'heli':
        this.hp = 1;
        this.points = 60;
        this.size = 30;
        this.approach = 26 + Math.random() * 18;
        break;
      case 'stealth':
        this.hp = 1;
        this.points = 90;
        this.size = 28;
        this.approach = 48 + Math.random() * 22;
        break;
      case 'jet':
        this.hp = 1;
        this.points = 100;
        this.size = 26;
        this.approach = 200 + Math.random() * 90;
        break;
      case 'drone':
        this.hp = 1;
        this.points = 80;
        this.size = 26;
        this.approach = 60 + Math.random() * 30;
        break;
      case 'zigzag':
        this.hp = 1;
        this.points = 80;
        this.size = 26;
        this.approach = 55 + Math.random() * 25;
        break;
      case 'turret':
        this.hp = 3;
        this.points = 120;
        this.size = 30;
        this.approach = 0;
        this.side = x < 0.5 ? -1 : 1;
        this.fireTimer = 1.2 + Math.random() * 1.2;
        break;
    }
    // Escalonamento por fase aplicado UMA vez (não por frame)
    if (kind !== 'turret') {
      this.approach *= 1 + (stage - 1) * 0.08;
    }
  }

  get isWorldAnchored(): boolean {
    return this.kind === 'turret';
  }

  update(ctx: EnemyUpdateCtx): void {
    const { dt, W, H, scrollY } = ctx;
    const screenY = H - (this.worldY - scrollY);

    // Aproximação do jogador (worldY diminui = desce mais rápido na tela)
    if (this.approach > 0) {
      this.worldY -= this.approach * ctx.approachMultiplier * dt;
    }

    switch (this.kind) {
      case 'boat':
      case 'armored': {
        // Patrulha horizontal quicando nas margens/ilha
        this.x += this.vx * ctx.speedMultiplier * dt;
        const shape = ctx.shapeAt(this.worldY);
        const center = (shape.left + shape.right) / 2;
        // Barco fica no canal em que está: à esquerda do centro quica em
        // [left, islandLeft]; à direita, em [islandRight, right].
        // (Antes o intervalo cruzava a ilha e o barco "navegava" por
        // cima da terra.)
        const inLeft = this.x / W < center;
        const lo = inLeft
          ? shape.left
          : shape.hasIsland
            ? shape.islandRight
            : shape.left;
        const hi = inLeft
          ? shape.hasIsland
            ? shape.islandLeft
            : shape.right
          : shape.right;
        if (this.x / W < lo + 0.02) this.vx = Math.abs(this.vx);
        if (this.x / W > hi - 0.02) this.vx = -Math.abs(this.vx);
        break;
      }
      case 'heli':
        this.x += Math.sin(ctx.time * 1.6 + this.phase) * 46 * dt;
        break;
      case 'stealth':
        this.x += Math.sin(ctx.time * 2.4 + this.phase) * 70 * dt;
        break;
      case 'jet':
        // Jato faz curva suave em direção ao jogador
        this.x += Math.sign(ctx.playerX - this.x) * 34 * dt;
        break;
      case 'drone': {
        // Persegue a posição X do jogador
        const dir = Math.sign(ctx.playerX - this.x);
        this.x += dir * 78 * ctx.speedMultiplier * dt;
        break;
      }
      case 'zigzag':
        this.x += Math.sin(ctx.time * 5.2 + this.phase) * 190 * dt;
        break;
      case 'turret': {
        // Torre fixa na margem; atira no jogador
        const dx = ctx.playerX - this.x;
        const dy = ctx.playerY - screenY;
        this.setTurretAim(dx, dy);
        const dist = Math.hypot(dx, dy);
        this.fireTimer -= dt;
        if (
          this.fireTimer <= 0 &&
          dist < H * 0.75 &&
          screenY > -40 &&
          screenY < H
        ) {
          const speed = 235 + ctx.approachMultiplier * 12;
          const inv = dist > 1 ? 1 / dist : 0;
          ctx.fire(this.x, screenY, dx * inv * speed, dy * inv * speed);
          this.fireTimer = 2.1 + Math.random() * 0.9;
        }
        break;
      }
    }

    // Mantém dentro das margens (exceto torres, que ficam na terra)
    if (this.kind !== 'turret') {
      const shape = ctx.shapeAt(this.worldY);
      const margin = 0.018;
      this.x = Math.max(
        (shape.left + margin) * W,
        Math.min((shape.right - margin) * W, this.x)
      );
    }

    // Despawn ao sair por baixo (passou do jogador)
    if (screenY > H + 110) this.active = false;
  }

  draw(ctx: CanvasRenderingContext2D, screenY: number, time: number): void {
    ctx.save();
    ctx.translate(this.x, screenY);

    switch (this.kind) {
      case 'boat':
      case 'armored': {
        const armored = this.kind === 'armored';
        // Esteira na água
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.ellipse(0, this.size * 0.7, this.size * 0.55, this.size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        // Casco
        ctx.fillStyle = armored ? '#7d8a97' : '#b0483e';
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.6, -6);
        ctx.lineTo(this.size * 0.6, -6);
        ctx.lineTo(this.size * 0.42, 10);
        ctx.lineTo(-this.size * 0.42, 10);
        ctx.closePath();
        ctx.fill();
        // Cabine
        ctx.fillStyle = armored ? '#aeb9c4' : '#d98a3f';
        ctx.fillRect(-this.size * 0.22, -16, this.size * 0.44, 12);
        if (armored) {
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 2;
          ctx.strokeRect(-this.size * 0.22, -16, this.size * 0.44, 12);
          ctx.fillStyle = this.hp > 1 ? '#22c55e' : '#ef4444';
          ctx.beginPath();
          ctx.arc(0, -10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'heli':
      case 'stealth': {
        const stealth = this.kind === 'stealth';
        if (stealth) ctx.globalAlpha = 0.62;
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(3, 12, this.size * 0.5, this.size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // Corpo
        ctx.fillStyle = stealth ? '#3f4756' : '#4a7c59';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.42, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cauda
        ctx.fillStyle = stealth ? '#333a47' : '#3a6349';
        ctx.fillRect(-2.5, -this.size * 0.85, 5, this.size * 0.4);
        // Rotor girando
        const spin = time * 26;
        ctx.strokeStyle = 'rgba(230,240,255,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const rx = Math.cos(spin) * this.size * 0.75;
        ctx.moveTo(-rx, -this.size * 0.28);
        ctx.lineTo(rx, -this.size * 0.28);
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, -this.size * 0.28, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'jet': {
        ctx.fillStyle = '#37424e';
        ctx.beginPath();
        ctx.moveTo(0, this.size * 0.7);
        ctx.lineTo(this.size * 0.5, -this.size * 0.4);
        ctx.lineTo(0, -this.size * 0.55);
        ctx.lineTo(-this.size * 0.5, -this.size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-2, -this.size * 0.55, 4, 6);
        break;
      }
      case 'drone':
      case 'zigzag': {
        const zig = this.kind === 'zigzag';
        ctx.fillStyle = zig ? '#8b5cf6' : '#0ea5a4';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.38, 0, Math.PI * 2);
        ctx.fill();
        // 4 rotores
        const spin = time * 30;
        for (let i = 0; i < 4; i++) {
          const a = spin + (Math.PI / 2) * i;
          const ox = Math.cos(a) * this.size * 0.55;
          const oy = Math.sin(a) * this.size * 0.55;
          ctx.fillStyle = 'rgba(226,232,240,0.9)';
          ctx.beginPath();
          ctx.arc(ox, oy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        // "Olho"
        ctx.fillStyle = zig ? '#f5d0fe' : '#ccfbf1';
        ctx.beginPath();
        ctx.arc(0, 2, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'turret': {
        // Base
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.arc(0, -3, this.size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        // Canhão apontando para o jogador (calculado pelo chamador via angle)
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.turretAimX * this.size * 0.55, this.turretAimY * this.size * 0.55);
        ctx.stroke();
        // Luz
        ctx.fillStyle = this.hp > 1 ? '#fbbf24' : '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  turretAimX = 0;
  turretAimY = 1;

  setTurretAim(nx: number, ny: number): void {
    const len = Math.hypot(nx, ny) || 1;
    this.turretAimX = nx / len;
    this.turretAimY = ny / len;
  }
}

export function enemyPoolForStage(stage: number): EnemyKind[] {
  const pool: EnemyKind[] = ['boat', 'boat'];
  if (stage >= 2) pool.push('heli', 'zigzag', 'boat');
  if (stage >= 3) pool.push('drone', 'jet');
  if (stage >= 4) pool.push('stealth', 'armored', 'heli');
  if (stage >= 5) pool.push('turret', 'drone');
  if (stage >= 6) pool.push('jet', 'stealth', 'armored');
  return pool;
}
