/**
 * River Raid Remaster — Rio procedural
 * -------------------------------------
 * O rio é gerado incrementalmente a partir de nós (control points) espaçados
 * no eixo do mundo e interpolados com smoothstep, produzindo curvas suaves,
 * variações de largura, ilhas e "lagos secretos" (trechos largos com bônus).
 *
 * Correções em relação ao código original (PDF):
 *  - O rio era puramente decorativo (jogador atravessava as margens);
 *    agora `shapeAt` alimenta a colisão real com as margens e ilhas.
 *  - O scroll não depende mais do framerate (`offset += 2` dentro do draw);
 *    o mundo avança por distância (px/s × dt).
 *  - A largura diminui com o avanço das fases (dificuldade progressiva).
 *  - Trechos de ponte/checkpoint são forçados a serem retos e sem ilha.
 */

import { clamp, lerp, mulberry32, randRange, smoothstep } from '../utils';
import { bridgeYFor, isBossStage, stageStartY } from '../systems/stages';

const NODE_STEP = 420;

interface RiverNode {
  y: number;
  center: number; // 0..1
  halfWidth: number; // 0..0.5
  islandHalf: number; // 0 = sem ilha
  lake: boolean;
}

export interface RiverShape {
  /** Limites normalizados (0..1) da água. */
  left: number;
  right: number;
  islandLeft: number; // = right quando não há ilha
  islandRight: number; // = left quando não há ilha
  hasIsland: boolean;
  halfWidth: number;
  isLake: boolean;
}

/** Decoração estática das margens (árvores, arbustos, pedras). */
export interface Decor {
  x: number; // 0..1 (posição na margem)
  side: -1 | 1;
  type: 'tree' | 'bush' | 'rock';
  scale: number;
  worldY: number;
}

const CALM_MARGIN = 560; // px de mundo ao redor de ponte/início de fase

export class River {
  private nodes: RiverNode[] = [];
  private rng: () => number;
  private lastNodeY: number;
  private nextIslandAt = 3000;
  private nextLakeAt = 5200;

  constructor(
    private seed: number,
    startY: number
  ) {
    this.rng = mulberry32(seed);
    this.lastNodeY = startY - NODE_STEP * 2;
    // Nó inicial: centrado e largo
    this.nodes.push({
      y: this.lastNodeY,
      center: 0.5,
      halfWidth: 0.34,
      islandHalf: 0,
      lake: false,
    });
    this.ensure(startY + 2600);
  }

  /** Gera nós até cobrir a coordenada pedida. */
  ensure(untilY: number): void {
    while (this.lastNodeY < untilY) {
      const y = this.lastNodeY + NODE_STEP;
      const stage = this.stageAt(y);

      // Zona calma: perto do início da fase ou da ponte → rio reto e largo
      const nearBridge =
        !isBossStage(stage) && Math.abs(y - bridgeYFor(stage)) < CALM_MARGIN;
      const nearStageStart = Math.abs(y - stageStartY(stage)) < 420;

      if (nearBridge || nearStageStart) {
        this.nodes.push({
          y,
          center: 0.5,
          halfWidth: 0.32,
          islandHalf: 0,
          lake: false,
        });
        this.lastNodeY = y;
        continue;
      }

      // Lago secreto (área bônus larga)
      if (y > this.nextLakeAt) {
        this.pushLakeRun(y);
        this.nextLakeAt = y + randRange(this.rng, 9000, 15000);
        this.lastNodeY = y;
        continue;
      }

      // Ilha
      if (y > this.nextIslandAt) {
        this.pushIslandRun(y);
        this.nextIslandAt = y + randRange(this.rng, 5200, 9800);
        this.lastNodeY = y;
        continue;
      }

      // Nó normal: caminhada aleatória suave
      const node = this.nodes[this.nodes.length - 1];
      const baseHalf = clamp(
        0.335 - (stage - 1) * 0.0042,
        0.225,
        0.335
      );
      const center = clamp(
        node.center + randRange(this.rng, -0.09, 0.09),
        0.32,
        0.68
      );
      const halfWidth = clamp(
        node.halfWidth + randRange(this.rng, -0.055, 0.055),
        baseHalf - 0.055,
        baseHalf + 0.06
      );
      this.nodes.push({ y, center, halfWidth, islandHalf: 0, lake: false });
      this.lastNodeY = y;
    }
  }

  private pushLakeRun(y: number): void {
    const len = 3; // nós de lago
    let prev = this.nodes[this.nodes.length - 1];
    for (let i = 0; i < len; i++) {
      const ny = y + i * NODE_STEP;
      const t = smoothstep(i / len);
      this.nodes.push({
        y: ny,
        center: lerp(prev.center, 0.5, 0.5 + t * 0.4),
        halfWidth: lerp(prev.halfWidth, 0.46, t),
        islandHalf: 0,
        lake: true,
      });
      prev = this.nodes[this.nodes.length - 1];
    }
    this.lastNodeY = y + (len - 1) * NODE_STEP;
    // Respiro após o lago
    this.nodes.push({
      y: this.lastNodeY + NODE_STEP,
      center: prev.center,
      halfWidth: 0.36,
      islandHalf: 0,
      lake: false,
    });
    this.lastNodeY += NODE_STEP;
  }

  private pushIslandRun(y: number): void {
    const len = 3 + Math.floor(this.rng() * 3); // 3..5 nós
    const maxIslandHalf = randRange(this.rng, 0.07, 0.13);
    let prev = this.nodes[this.nodes.length - 1];
    for (let i = 0; i < len; i++) {
      const ny = y + i * NODE_STEP;
      const env = Math.sin((Math.PI * (i + 1)) / (len + 1));
      const halfWidth = clamp(
        prev.halfWidth + randRange(this.rng, -0.03, 0.03),
        0.3,
        0.4
      );
      this.nodes.push({
        y: ny,
        center: clamp(prev.center + randRange(this.rng, -0.05, 0.05), 0.34, 0.66),
        halfWidth,
        // A ilha só existe se sobrar canal navegável dos dois lados
        islandHalf: Math.min(maxIslandHalf * env, halfWidth - 0.13),
        lake: false,
      });
      prev = this.nodes[this.nodes.length - 1];
    }
    this.lastNodeY = y + (len - 1) * NODE_STEP;
  }

  private stageAt(worldY: number): number {
    // Busca reversa fechada: stageStartY é crescente
    let stage = 1;
    while (stageStartY(stage + 1) <= worldY) stage++;
    return stage;
  }

  private nodeIndexAt(worldY: number): number {
    // Cache sequencial não vale a pena; busca binária
    let lo = 0;
    let hi = this.nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.nodes[mid].y <= worldY) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Forma do rio em worldY (valores normalizados 0..1). */
  shapeAt(worldY: number): RiverShape {
    this.ensure(worldY + NODE_STEP * 2);
    const i = this.nodeIndexAt(worldY);
    const a = this.nodes[i];
    const b = this.nodes[Math.min(i + 1, this.nodes.length - 1)];
    const t = b.y > a.y ? smoothstep((worldY - a.y) / (b.y - a.y)) : 0;
    const center = lerp(a.center, b.center, t);
    const halfWidth = lerp(a.halfWidth, b.halfWidth, t);
    const islandHalf = Math.max(
      0,
      lerp(a.islandHalf, b.islandHalf, t)
    );
    const isLake = t < 0.5 ? a.lake : b.lake;
    return {
      left: center - halfWidth,
      right: center + halfWidth,
      islandLeft: center - islandHalf,
      islandRight: center + islandHalf,
      hasIsland: islandHalf > 0.02,
      halfWidth,
      isLake,
    };
  }

  /**
   * Retorna uma posição X segura para spawn dentro do canal (normalizada),
   * evitando ilhas e respeitando a margem.
   */
  spawnXAt(worldY: number, margin: number, rng: () => number): number {
    const s = this.shapeAt(worldY);
    if (s.hasIsland) {
      // Escolhe um dos dois canais
      const leftChannel = [s.left + margin, s.islandLeft - margin];
      const rightChannel = [s.islandRight + margin, s.right - margin];
      const channels = [leftChannel, rightChannel].filter(
        (c) => c[1] - c[0] > 0.04
      );
      if (channels.length > 0) {
        const c = channels[Math.floor(rng() * channels.length)];
        return randRange(rng, c[0], c[1]);
      }
    }
    return randRange(rng, s.left + margin, s.right - margin);
  }

  /** Decorações determinísticas para uma faixa de worldY (desenhadas pelo Game). */
  decorsFor(fromWorldY: number, toWorldY: number): Decor[] {
    const out: Decor[] = [];
    const bandSize = 130;
    const startBand = Math.floor(fromWorldY / bandSize);
    const endBand = Math.ceil(toWorldY / bandSize);
    for (let band = startBand; band <= endBand; band++) {
      const rng = mulberry32(this.seed ^ (band * 2654435761));
      const worldY = band * bandSize + rng() * bandSize;
      const shape = this.shapeAt(worldY);
      for (const side of [-1, 1] as const) {
        const count = rng() < 0.72 ? (rng() < 0.35 ? 2 : 1) : 0;
        for (let k = 0; k < count; k++) {
          const type = rng() < 0.62 ? 'tree' : rng() < 0.6 ? 'bush' : 'rock';
          // Posição na terra, a partir da margem
          const depth = 0.02 + rng() * 0.16;
          const x =
            side === -1
              ? clamp(shape.left - depth, 0.005, 1)
              : clamp(shape.right + depth, 0, 0.995);
          out.push({
            x,
            side,
            type,
            scale: 0.75 + rng() * 0.6,
            worldY,
          });
        }
      }
    }
    return out;
  }
}
