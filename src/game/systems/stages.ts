/**
 * River Raid Remaster — Sistema de fases
 * ---------------------------------------
 * Correções em relação ao código original (PDF):
 *  - A dificuldade é calculada por consultas puras (funções determinísticas
 *    da fase atual). O original multiplicava a velocidade dos inimigos a
 *    CADA FRAME (`e.speed *= stage.enemySpeedMultiplier`), o que fazia a
 *    velocidade crescer exponencialmente e explodia a física em segundos.
 *  - Fronteiras de fase por distância percorrida (pontes), em vez de tempo.
 */

/** Fases de chefe: 3, 6, 9 e todas as múltiplas de 3 no modo infinito. */
export function isBossStage(stage: number): boolean {
  return stage >= 3 && stage % 3 === 0;
}

/** Comprimento (em px de mundo) de uma fase. */
export function stageLength(stage: number): number {
  return 6200 + (stage - 1) * 500;
}

/** worldY em que a fase começa (soma dos comprimentos das anteriores). */
export function stageStartY(stage: number): number {
  const n = stage - 1;
  return n * 6200 + (n * (n - 1) / 2) * 500;
}

export function stageEndY(stage: number): number {
  return stageStartY(stage) + stageLength(stage);
}

/** Posição da ponte que fecha a fase `stage` (fases sem chefe). */
export function bridgeYFor(stage: number): number {
  return stageEndY(stage) - 520;
}

/** Multiplicadores de dificuldade derivados da fase (sem efeitos colaterais). */
export function difficultyFor(stage: number): {
  scrollSpeed: number;
  spawnInterval: number;
  enemySpeed: number;
  enemyApproach: number;
} {
  return {
    // Velocidade base de rolagem do mundo (px/s)
    scrollSpeed: Math.min(150 + (stage - 1) * 9, 250),
    // Intervalo entre spawns de inimigos (s)
    spawnInterval: Math.max(1.35 - (stage - 1) * 0.07, 0.55),
    // Multiplicador de velocidade própria dos inimigos
    enemySpeed: 1 + (stage - 1) * 0.06,
    // Multiplicador da velocidade de aproximação (descida extra)
    enemyApproach: 1 + (stage - 1) * 0.08,
  };
}
