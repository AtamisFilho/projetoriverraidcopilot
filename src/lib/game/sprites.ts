/* =========================================================================
 * River Raid Remaster — Biblioteca de sprites vetoriais (HiDPI)
 * Sprites desenhados por código (sem imagens) com gradientes, sombras e
 * animação. Usados tanto dentro do jogo quanto nos cards do briefing.
 * Todas as funções desenham CENTRALIZADAS em (0,0) em unidades lógicas.
 * ========================================================================= */

import type { BossType, EnemyType, PickupType } from "./types";

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------ JOGADOR ------------------------------ */

export function drawPlayer(ctx: Ctx, t: number, thrust = 1) {
  ctx.save();
  // Sombra suave abaixo da fuselagem
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Asas (delta)
  const wing = ctx.createLinearGradient(-26, 0, 26, 0);
  wing.addColorStop(0, "#b91c1c");
  wing.addColorStop(0.5, "#ef4444");
  wing.addColorStop(1, "#b91c1c");
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(26, 16);
  ctx.lineTo(10, 22);
  ctx.lineTo(0, 14);
  ctx.lineTo(-10, 22);
  ctx.lineTo(-26, 16);
  ctx.closePath();
  ctx.fill();

  // Cauda
  ctx.fillStyle = "#991b1b";
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(7, 24);
  ctx.lineTo(-7, 24);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";

  // Fuselagem
  const fus = ctx.createLinearGradient(-7, 0, 7, 0);
  fus.addColorStop(0, "#cbd5e1");
  fus.addColorStop(0.5, "#f8fafc");
  fus.addColorStop(1, "#94a3b8");
  ctx.fillStyle = fus;
  roundRect(ctx, -6, -24, 12, 44, 5);
  ctx.fill();

  // Ponta do nariz
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(-5, -24);
  ctx.lineTo(0, -32);
  ctx.lineTo(5, -24);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  const glass = ctx.createLinearGradient(0, -18, 0, -4);
  glass.addColorStop(0, "#bae6fd");
  glass.addColorStop(1, "#0284c7");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -11, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chamas do pós-combustor (animadas)
  const flick = Math.sin(t * 40) * 0.5 + 0.5;
  const len = (16 + flick * 10) * thrust;
  const flame = ctx.createLinearGradient(0, 22, 0, 22 + len);
  flame.addColorStop(0, "rgba(251,191,36,0.95)");
  flame.addColorStop(0.4, "rgba(249,115,22,0.75)");
  flame.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-4, 22);
  ctx.lineTo(0, 22 + len);
  ctx.lineTo(4, 22);
  ctx.closePath();
  ctx.fill();

  // Farol da ponta
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(248,113,113,${0.35 + pulse * 0.6})`;
  ctx.beginPath();
  ctx.arc(0, -30, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------ INIMIGOS ------------------------------ */

export function drawEnemy(ctx: Ctx, type: EnemyType, t: number, hurtFlash = 0) {
  if (hurtFlash > 0) {
    ctx.save();
    ctx.filter = "none";
  }
  switch (type) {
    case "patrol":
      drawPatrol(ctx, t);
      break;
    case "balloon":
      drawBalloon(ctx, t);
      break;
    case "drone":
      drawDrone(ctx, t);
      break;
    case "armored":
      drawArmored(ctx, t);
      break;
    case "chopper":
      drawChopper(ctx, t);
      break;
    case "jet":
      drawJet(ctx, t);
      break;
    case "turret":
      drawTurret(ctx, 0, t);
      break;
    case "stealth":
      drawStealth(ctx, t);
      break;
  }
  if (hurtFlash > 0) {
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, hurtFlash);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPatrol(ctx: Ctx, _t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  // Casco
  const hull = ctx.createLinearGradient(0, -10, 0, 12);
  hull.addColorStop(0, "#94a3b8");
  hull.addColorStop(1, "#475569");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-27, -8);
  ctx.lineTo(27, -8);
  ctx.lineTo(21, 12);
  ctx.lineTo(-21, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Proa
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.moveTo(27, -8);
  ctx.lineTo(33, -2);
  ctx.lineTo(27, 6);
  ctx.closePath();
  ctx.fill();
  // Convés + cabine
  ctx.fillStyle = "#334155";
  roundRect(ctx, -16, -6, 32, 8, 2);
  ctx.fill();
  const cab = ctx.createLinearGradient(0, -14, 0, -4);
  cab.addColorStop(0, "#e2e8f0");
  cab.addColorStop(1, "#94a3b8");
  ctx.fillStyle = cab;
  roundRect(ctx, -9, -15, 20, 10, 3);
  ctx.fill();
  // Canhão
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(15, -12, 3, 8);
  // Janelas
  ctx.fillStyle = "rgba(125,211,252,0.9)";
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * 5 - 1, -12, 2, 3);
  ctx.restore();
}

function drawBalloon(ctx: Ctx, t: number) {
  ctx.save();
  const sway = Math.sin(t * 2) * 3;
  ctx.translate(sway * 0.3, 0);
  // Cesto
  ctx.fillStyle = "#92400e";
  roundRect(ctx, -6, 16, 12, 8, 2);
  ctx.fill();
  // Cordas
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 16);
  ctx.lineTo(-9, 6);
  ctx.moveTo(6, 16);
  ctx.lineTo(9, 6);
  ctx.stroke();
  // Envelope
  const env = ctx.createRadialGradient(-6, -8, 4, 0, -4, 26);
  env.addColorStop(0, "#fecaca");
  env.addColorStop(0.55, "#ef4444");
  env.addColorStop(1, "#991b1b");
  ctx.fillStyle = env;
  ctx.beginPath();
  ctx.ellipse(0, -4, 18, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Faixas
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-3, -24, 6, 40);
  ctx.restore();
  // Brilho especular
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-7, -12, 5, 8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDrone(ctx: Ctx, t: number) {
  ctx.save();
  // Braços em X
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, -10);
  ctx.lineTo(16, 10);
  ctx.moveTo(16, -10);
  ctx.lineTo(-16, 10);
  ctx.stroke();
  // Rotores (discos girando)
  const spin = t * 26;
  for (const [rx, ry] of [
    [-16, -10],
    [16, -10],
    [-16, 10],
    [16, 10],
  ] as const) {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.fillStyle = "rgba(148,163,184,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(226,232,240,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const a = spin + rx;
    ctx.moveTo(-Math.cos(a) * 9, -Math.sin(a) * 2);
    ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 2);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Corpo
  const body = ctx.createLinearGradient(0, -8, 0, 8);
  body.addColorStop(0, "#64748b");
  body.addColorStop(1, "#1e293b");
  ctx.fillStyle = body;
  roundRect(ctx, -9, -8, 18, 16, 5);
  ctx.fill();
  // Câmera (olho vermelho)
  const eye = 0.5 + 0.5 * Math.sin(t * 8);
  ctx.fillStyle = `rgba(248,113,113,${0.5 + eye * 0.5})`;
  ctx.beginPath();
  ctx.arc(0, 1, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawArmored(ctx: Ctx, _t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  // Casco baixo e largo
  const hull = ctx.createLinearGradient(0, -12, 0, 14);
  hull.addColorStop(0, "#64748b");
  hull.addColorStop(1, "#0f172a");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-28, -10);
  ctx.lineTo(28, -10);
  ctx.lineTo(22, 14);
  ctx.lineTo(-22, 14);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Placas de blindagem
  ctx.strokeStyle = "rgba(148,163,184,0.5)";
  ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-24, i * 7);
    ctx.lineTo(24, i * 7);
    ctx.stroke();
  }
  // Torre dupla
  ctx.fillStyle = "#334155";
  roundRect(ctx, -12, -18, 24, 10, 3);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-9, -24, 4, 7);
  ctx.fillRect(5, -24, 4, 7);
  // Rebites
  ctx.fillStyle = "rgba(203,213,225,0.7)";
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * 8 - 1, -6, 2, 2);
  ctx.restore();
}

function drawChopper(ctx: Ctx, t: number) {
  ctx.save();
  // Rotor de cauda
  ctx.save();
  ctx.translate(-26, -4);
  ctx.rotate(t * 30);
  ctx.strokeStyle = "rgba(226,232,240,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.stroke();
  ctx.restore();
  // Cauda
  ctx.fillStyle = "#3f6212";
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.lineTo(-26, -7);
  ctx.lineTo(-26, -1);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  // Corpo
  const body = ctx.createLinearGradient(0, -12, 0, 10);
  body.addColorStop(0, "#65a30d");
  body.addColorStop(1, "#365314");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(2, 0, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Canopy
  const glass = ctx.createLinearGradient(8, -8, 16, 4);
  glass.addColorStop(0, "#bbf7d0");
  glass.addColorStop(1, "#15803d");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(11, -2, 7, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Skids
  ctx.strokeStyle = "#1a2e05";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(-14, 14);
  ctx.moveTo(10, 10);
  ctx.lineTo(16, 14);
  ctx.moveTo(-16, 14);
  ctx.lineTo(18, 14);
  ctx.stroke();
  // Metralhadora
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-2, 8, 3, 9);
  // Rotor principal (disco)
  ctx.fillStyle = "rgba(226,232,240,0.22)";
  ctx.beginPath();
  ctx.ellipse(2, -13, 22, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const a = t * 24;
  ctx.strokeStyle = "rgba(248,250,252,0.95)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(2 - Math.cos(a) * 20, -13 - Math.sin(a) * 2.6);
  ctx.lineTo(2 + Math.cos(a) * 20, -13 + Math.sin(a) * 2.6);
  ctx.stroke();
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(-3, -16, 10, 4);
  ctx.restore();
}

function drawJet(ctx: Ctx, t: number) {
  ctx.save();
  // Apontando para baixo (mergulho)
  const fus = ctx.createLinearGradient(-12, 0, 12, 0);
  fus.addColorStop(0, "#7e22ce");
  fus.addColorStop(0.5, "#d8b4fe");
  fus.addColorStop(1, "#6b21a8");
  ctx.fillStyle = fus;
  // Asas delta
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(24, 12);
  ctx.lineTo(8, 16);
  ctx.lineTo(0, 10);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-24, 12);
  ctx.closePath();
  ctx.fill();
  // Fuselagem
  ctx.fillStyle = "#a855f7";
  roundRect(ctx, -5, -26, 10, 46, 4);
  ctx.fill();
  // Cockpit
  ctx.fillStyle = "#312e81";
  ctx.beginPath();
  ctx.ellipse(0, -12, 3.4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pós-combustor para cima
  const flick = Math.sin(t * 44) * 0.5 + 0.5;
  const len = 12 + flick * 8;
  const flame = ctx.createLinearGradient(0, -26, 0, -26 - len);
  flame.addColorStop(0, "rgba(232,121,249,0.9)");
  flame.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-3.4, -26);
  ctx.lineTo(0, -26 - len);
  ctx.lineTo(3.4, -26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Torre automática: `angle` em radianos (mira) */
export function drawTurret(ctx: Ctx, angle: number, t: number) {
  ctx.save();
  // Base
  const base = ctx.createLinearGradient(0, -14, 0, 16);
  base.addColorStop(0, "#d6d3d1");
  base.addColorStop(1, "#57534e");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(-22, 16);
  ctx.lineTo(-16, -8);
  ctx.lineTo(16, -8);
  ctx.lineTo(22, 16);
  ctx.closePath();
  ctx.fill();
  // Cúpula
  const dome = ctx.createRadialGradient(-4, -14, 2, 0, -10, 14);
  dome.addColorStop(0, "#fde68a");
  dome.addColorStop(1, "#b45309");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(0, -10, 10, Math.PI, 0);
  ctx.fill();
  // Canhão girando na direção do jogador
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(angle);
  ctx.fillStyle = "#292524";
  ctx.fillRect(0, -2.6, 22, 5.2);
  ctx.fillStyle = "#78716c";
  ctx.fillRect(16, -3.4, 6, 6.8);
  ctx.restore();
  // Luz de mira
  const blink = Math.sin(t * 10) > 0 ? 1 : 0.25;
  ctx.fillStyle = `rgba(239,68,68,${blink})`;
  ctx.beginPath();
  ctx.arc(0, -12, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStealth(ctx: Ctx, t: number) {
  ctx.save();
  // Camuflagem: pulsa transparência
  const cloak = 0.35 + 0.25 * Math.sin(t * 3);
  ctx.globalAlpha = cloak;
  // Cauda angular
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-24, -8);
  ctx.lineTo(-24, 2);
  ctx.closePath();
  ctx.fill();
  // Corpo facetado
  const body = ctx.createLinearGradient(0, -10, 0, 10);
  body.addColorStop(0, "#4c1d95");
  body.addColorStop(1, "#0f172a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.lineTo(6, -10);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-12, 6);
  ctx.lineTo(2, 10);
  ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fill();
  // Painéis de absorção
  ctx.strokeStyle = "rgba(196,181,253,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Canopy
  ctx.fillStyle = "rgba(129,140,248,0.8)";
  ctx.beginPath();
  ctx.ellipse(8, -2, 5, 3.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Rotor fantasma
  const a = t * 28;
  ctx.strokeStyle = `rgba(216,180,254,${cloak + 0.3})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0 - Math.cos(a) * 18, -12 - Math.sin(a) * 2.4);
  ctx.lineTo(0 + Math.cos(a) * 18, -12 + Math.sin(a) * 2.4);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------ CHEFES ------------------------------ */

export function drawBoss(ctx: Ctx, type: BossType, t: number, hurtFlash = 0) {
  ctx.save();
  if (hurtFlash > 0) {
    ctx.globalAlpha = Math.min(0.9, hurtFlash);
  }
  switch (type) {
    case "destroyer":
      drawDestroyer(ctx, t);
      break;
    case "fortress":
      drawFortress(ctx, t);
      break;
    case "carrier":
      drawCarrier(ctx, t);
      break;
  }
  if (hurtFlash > 0) {
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, hurtFlash);
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.restore();
  }
}

function drawDestroyer(ctx: Ctx, t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  // Casco longo
  const hull = ctx.createLinearGradient(0, -18, 0, 26);
  hull.addColorStop(0, "#7b8794");
  hull.addColorStop(0.6, "#3e4c59");
  hull.addColorStop(1, "#1f2933");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-80, -14);
  ctx.lineTo(80, -14);
  ctx.lineTo(66, 26);
  ctx.lineTo(-66, 26);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Convés
  ctx.fillStyle = "#52606d";
  roundRect(ctx, -70, -14, 140, 10, 4);
  ctx.fill();
  // Torre de comando
  const tower = ctx.createLinearGradient(0, -34, 0, -12);
  tower.addColorStop(0, "#e2e8f0");
  tower.addColorStop(1, "#94a3b8");
  ctx.fillStyle = tower;
  roundRect(ctx, -14, -32, 30, 18, 3);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  roundRect(ctx, -8, -40, 18, 9, 2);
  ctx.fill();
  // Mastro com radar girando
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(0, -50);
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -50);
  ctx.rotate(t * 2.2);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-8, -1.5, 16, 3);
  ctx.restore();
  // Torres de canhão duplas
  for (const gx of [-52, -24, 30, 58]) {
    ctx.save();
    ctx.translate(gx, -16);
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    const aim = Math.sin(t * 2 + gx) * 0.3;
    ctx.rotate(aim);
    ctx.fillRect(2, -2, 14, 4);
    ctx.fillRect(2, -6, 10, 3);
    ctx.restore();
  }
  // Mísseis visíveis no convés
  ctx.fillStyle = "#ef4444";
  for (let i = 0; i < 4; i++) ctx.fillRect(-40 + i * 10, -10, 6, 3);
  ctx.restore();
}

function drawFortress(ctx: Ctx, t: number) {
  ctx.save();
  // Sombra no rio (grande)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 60, 80, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Asa voadora
  const wing = ctx.createLinearGradient(0, -30, 0, 30);
  wing.addColorStop(0, "#fdba74");
  wing.addColorStop(0.5, "#c2410c");
  wing.addColorStop(1, "#7c2d12");
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(88, 22);
  ctx.lineTo(40, 34);
  ctx.lineTo(0, 26);
  ctx.lineTo(-40, 34);
  ctx.lineTo(-88, 22);
  ctx.closePath();
  ctx.fill();
  // Fuselagem central
  const fus = ctx.createLinearGradient(-16, 0, 16, 0);
  fus.addColorStop(0, "#9a3412");
  fus.addColorStop(0.5, "#fdba74");
  fus.addColorStop(1, "#9a3412");
  ctx.fillStyle = fus;
  roundRect(ctx, -15, -30, 30, 64, 8);
  ctx.fill();
  // Cockpit
  ctx.fillStyle = "#7f1d1d";
  ctx.beginPath();
  ctx.ellipse(0, -18, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(254,215,170,0.8)";
  ctx.beginPath();
  ctx.ellipse(0, -20, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // 4 turbinas
  for (const ex of [-58, -30, 30, 58]) {
    ctx.fillStyle = "#431407";
    ctx.beginPath();
    ctx.ellipse(ex, 18, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const glow = 0.6 + 0.4 * Math.sin(t * 18 + ex);
    ctx.fillStyle = `rgba(251,146,60,${glow})`;
    ctx.beginPath();
    ctx.ellipse(ex, 21, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Portas de bombas (piscam ao abrir)
  const open = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(239,68,68,${0.3 + open * 0.5})`;
  for (const bx of [-18, 0, 18]) {
    roundRect(ctx, bx - 5, 4, 10, 14, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCarrier(ctx: Ctx, t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  // Convés gigante
  const deck = ctx.createLinearGradient(0, -22, 0, 24);
  deck.addColorStop(0, "#52525b");
  deck.addColorStop(1, "#18181b");
  ctx.fillStyle = deck;
  roundRect(ctx, -95, -22, 190, 46, 10);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Pista
  ctx.fillStyle = "#3f3f46";
  roundRect(ctx, -70, -14, 150, 28, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(254,240,138,0.9)";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(-64, 0);
  ctx.lineTo(74, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  // Ilha (torre)
  ctx.fillStyle = "#71717a";
  roundRect(ctx, -88, -34, 26, 16, 3);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  roundRect(ctx, -84, -42, 14, 9, 2);
  ctx.fill();
  // Radar
  ctx.save();
  ctx.translate(-76, -42);
  ctx.rotate(t * 3);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.restore();
  // Torres de míssil (2, piscam)
  for (const mx of [-20, 40]) {
    ctx.fillStyle = "#27272a";
    roundRect(ctx, mx - 8, -30, 16, 10, 2);
    ctx.fill();
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + mx));
    ctx.fillStyle = `rgba(239,68,68,${blink})`;
    ctx.fillRect(mx - 2, -34, 4, 4);
  }
  // Caças estacionados
  ctx.fillStyle = "#e4e4e7";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-50 + i * 22, -6);
    ctx.lineTo(-42 + i * 22, 6);
    ctx.lineTo(-58 + i * 22, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------ ITENS ------------------------------ */

export function drawPickup(ctx: Ctx, type: PickupType, t: number) {
  switch (type) {
    case "fuel":
      drawFuelDrum(ctx, t, false);
      break;
    case "fuelGold":
      drawFuelDrum(ctx, t, true);
      break;
    case "fakeFuel":
      drawFakeFuel(ctx, t);
      break;
    case "shield":
      drawShieldOrb(ctx, t);
      break;
    case "triple":
      drawTripleIcon(ctx, t);
      break;
    case "homing":
      drawHomingIcon(ctx, t);
      break;
    case "turbo":
      drawTurboIcon(ctx, t);
      break;
  }
}

function drawFuelDrum(ctx: Ctx, t: number, gold: boolean) {
  ctx.save();
  // Brilho pulsante para chamar atenção
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.shadowColor = gold ? `rgba(250,204,21,${0.5 + pulse * 0.5})` : `rgba(249,115,22,${0.35 + pulse * 0.4})`;
  ctx.shadowBlur = 10 + pulse * 8;
  // Barril
  const drum = ctx.createLinearGradient(-14, 0, 14, 0);
  if (gold) {
    drum.addColorStop(0, "#a16207");
    drum.addColorStop(0.5, "#fde047");
    drum.addColorStop(1, "#a16207");
  } else {
    drum.addColorStop(0, "#9a3412");
    drum.addColorStop(0.5, "#fb923c");
    drum.addColorStop(1, "#9a3412");
  }
  ctx.fillStyle = drum;
  roundRect(ctx, -13, -16, 26, 32, 5);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Aros
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-13, -6);
  ctx.lineTo(13, -6);
  ctx.moveTo(-13, 6);
  ctx.lineTo(13, 6);
  ctx.stroke();
  // Letra F
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(gold ? "F+" : "F", 0, 1);
  // Brilho varrendo (efeito premium)
  ctx.globalAlpha = 0.35 + 0.3 * pulse;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(-13 + pulse * 16, -16, 4, 32);
  ctx.restore();
}

function drawFakeFuel(ctx: Ctx, t: number) {
  ctx.save();
  // Fumaça sutil
  const smoke = 0.5 + 0.5 * Math.sin(t * 7);
  ctx.fillStyle = `rgba(120,113,108,${0.25 + smoke * 0.2})`;
  ctx.beginPath();
  ctx.arc(6, -22 - smoke * 4, 5 + smoke * 2, 0, Math.PI * 2);
  ctx.fill();
  // Barril enferrujado
  const drum = ctx.createLinearGradient(-14, 0, 14, 0);
  drum.addColorStop(0, "#44403c");
  drum.addColorStop(0.5, "#78716c");
  drum.addColorStop(1, "#44403c");
  ctx.fillStyle = drum;
  roundRect(ctx, -13, -16, 26, 32, 5);
  ctx.fill();
  // Manchas de ferrugem
  ctx.fillStyle = "rgba(120,53,15,0.6)";
  ctx.beginPath();
  ctx.arc(-6, -10, 3.4, 0, Math.PI * 2);
  ctx.arc(7, 8, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // ✕ vermelho
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, 6);
  ctx.moveTo(6, -6);
  ctx.lineTo(-6, 6);
  ctx.stroke();
  // Faísca de aviso
  const spark = Math.sin(t * 12) > 0;
  if (spark) {
    ctx.fillStyle = "rgba(239,68,68,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
  }
  ctx.restore();
}

function drawShieldOrb(ctx: Ctx, t: number) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  // Aura
  ctx.shadowColor = "rgba(56,189,248,0.8)";
  ctx.shadowBlur = 14 + pulse * 8;
  const orb = ctx.createRadialGradient(-4, -4, 3, 0, 0, 16);
  orb.addColorStop(0, "#e0f2fe");
  orb.addColorStop(0.6, "#38bdf8");
  orb.addColorStop(1, "#0369a1");
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Escudo interno
  ctx.strokeStyle = "rgba(224,242,254,0.95)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(7, -5);
  ctx.lineTo(7, 3);
  ctx.lineTo(0, 9);
  ctx.lineTo(-7, 3);
  ctx.lineTo(-7, -5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawTripleIcon(ctx: Ctx, t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(248,113,113,0.7)";
  ctx.shadowBlur = 10;
  const bob = Math.sin(t * 5) * 1.5;
  ctx.fillStyle = "#ef4444";
  roundRect(ctx, -18, -16 + bob, 36, 32, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Três projéteis
  ctx.fillStyle = "#fee2e2";
  for (const [px, py] of [
    [0, -7],
    [-6, 5],
    [6, 5],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 3.2, py + 4);
    ctx.lineTo(px - 3.2, py + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHomingIcon(ctx: Ctx, t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(74,222,128,0.7)";
  ctx.shadowBlur = 10;
  const bob = Math.sin(t * 5 + 1) * 1.5;
  ctx.fillStyle = "#16a34a";
  roundRect(ctx, -18, -16 + bob, 36, 32, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Míssil apontando para cima com trilha
  ctx.fillStyle = "#dcfce7";
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(4, -2);
  ctx.lineTo(4, 7);
  ctx.lineTo(-4, 7);
  ctx.lineTo(-4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(8, 6);
  ctx.lineTo(4, 5);
  ctx.closePath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-8, 6);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  // Chama
  const flick = Math.sin(t * 30) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(251,191,36,${0.6 + flick * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(-2.4, 7);
  ctx.lineTo(0, 7 + 6 + flick * 3);
  ctx.lineTo(2.4, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTurboIcon(ctx: Ctx, t: number) {
  ctx.save();
  ctx.shadowColor = "rgba(192,132,252,0.7)";
  ctx.shadowBlur = 10;
  const bob = Math.sin(t * 5 + 2) * 1.5;
  ctx.fillStyle = "#7c3aed";
  roundRect(ctx, -18, -16 + bob, 36, 32, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Raio
  const bolt = ctx.createLinearGradient(0, -10, 0, 12);
  bolt.addColorStop(0, "#f5d0fe");
  bolt.addColorStop(1, "#c084fc");
  ctx.fillStyle = bolt;
  ctx.beginPath();
  ctx.moveTo(3, -10);
  ctx.lineTo(-5, 1);
  ctx.lineTo(-1, 1);
  ctx.lineTo(-4, 12);
  ctx.lineTo(6, -1);
  ctx.lineTo(1, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------ CENÁRIO ------------------------------ */

export function drawRock(ctx: Ctx, seed: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const rock = ctx.createLinearGradient(-16, -18, 12, 16);
  rock.addColorStop(0, "#94a3b8");
  rock.addColorStop(0.55, "#64748b");
  rock.addColorStop(1, "#334155");
  ctx.fillStyle = rock;
  ctx.beginPath();
  // Contorno irregular determinístico por seed
  const pts = 8;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r =
      17 +
      5 * Math.sin(a * 3 + seed * 13.7) +
      3 * Math.cos(a * 5 + seed * 7.3);
    const x = Math.cos(a) * r * 1.15;
    const y = Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // Brilho de topo
  ctx.fillStyle = "rgba(226,232,240,0.35)";
  ctx.beginPath();
  ctx.ellipse(-4, -8, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Meia-extensão dos sprites — usada para enquadrar previews do briefing */
export const SPRITE_HALF: Record<string, [number, number]> = {
  player: [30, 34],
  patrol: [34, 16],
  balloon: [20, 26],
  drone: [28, 14],
  armored: [30, 26],
  chopper: [28, 18],
  jet: [26, 30],
  turret: [24, 18],
  stealth: [26, 14],
  destroyer: [84, 52],
  fortress: [90, 36],
  carrier: [98, 44],
  fuel: [15, 18],
  fuelGold: [15, 18],
  fakeFuel: [16, 22],
  shield: [16, 16],
  triple: [19, 18],
  homing: [19, 18],
  turbo: [19, 18],
  rock: [22, 16],
  bridge: [90, 24],
};

/** Desenha sprite genérico pelo id (usado no briefing) */
export function drawEntityById(
  ctx: Ctx,
  id: string,
  t: number,
  aimAngle = 0
) {
  if (id === "player") return drawPlayer(ctx, t);
  if (id === "rock") return drawRock(ctx, 3.7);
  if (id === "bridge") return drawBridgeIcon(ctx, t);
  if (id === "banks") return drawBanksIcon(ctx, t);
  if (id === "destroyer" || id === "fortress" || id === "carrier")
    return drawBoss(ctx, id as BossType, t);
  if (
    ["fuel", "fuelGold", "fakeFuel", "shield", "triple", "homing", "turbo"].includes(id)
  )
    return drawPickup(ctx, id as PickupType, t);
  if (id === "turret") return drawTurret(ctx, aimAngle || t * 0.6 - Math.PI / 2, t);
  return drawEnemy(ctx, id as EnemyType, t);
}

/* Ícones compostos do briefing (obstáculos) */

function drawBridgeIcon(ctx: Ctx, _t: number) {
  ctx.save();
  // Pilares
  ctx.fillStyle = "#78716c";
  for (const px of [-70, -35, 0, 35, 70]) ctx.fillRect(px - 5, -6, 10, 28);
  // Tabuleiro
  const deck = ctx.createLinearGradient(0, -14, 0, 2);
  deck.addColorStop(0, "#a8a29e");
  deck.addColorStop(1, "#57534e");
  ctx.fillStyle = deck;
  roundRect(ctx, -84, -14, 168, 14, 3);
  ctx.fill();
  // Treliça
  ctx.strokeStyle = "#292524";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let x = -80; x < 80; x += 12) {
    ctx.moveTo(x, -14);
    ctx.lineTo(x + 8, -2);
    ctx.moveTo(x + 8, -14);
    ctx.lineTo(x, -2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBanksIcon(ctx: Ctx, t: number) {
  ctx.save();
  // Faixa de rio entre margens
  const water = ctx.createLinearGradient(0, -30, 0, 30);
  water.addColorStop(0, "#0e7490");
  water.addColorStop(1, "#155e75");
  ctx.fillStyle = water;
  roundRect(ctx, -18, -32, 36, 64, 8);
  ctx.fill();
  // Margens verdes
  const grass = ctx.createLinearGradient(0, -34, 0, 0);
  grass.addColorStop(0, "#166534");
  grass.addColorStop(1, "#22c55e");
  ctx.fillStyle = grass;
  roundRect(ctx, -90, -34, 64, 68, 6);
  ctx.fill();
  roundRect(ctx, 26, -34, 64, 68, 6);
  ctx.fill();
  // Jato em perigo
  ctx.save();
  ctx.translate(0, -10);
  ctx.scale(0.55, 0.55);
  drawPlayer(ctx, t);
  ctx.restore();
  // Ondas
  ctx.strokeStyle = "rgba(165,243,252,0.6)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-12, y);
    ctx.quadraticCurveTo(-4, y + 3, 0, y);
    ctx.quadraticCurveTo(6, y - 3, 12, y);
    ctx.stroke();
  }
  ctx.restore();
}
