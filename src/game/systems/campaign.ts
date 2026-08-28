/**
 * River Raid Remaster — Campanha e narrativa
 * --------------------------------------------
 * História mínima em 3 capítulos + telas de alerta antes de cada chefe,
 * conforme os textos do PDF.
 */

import type { BossId } from '../types';

export interface Chapter {
  id: string;
  title: string;
  stage: number; // fase em que o capítulo começa
  lines: string[];
  quote: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    title: 'Capítulo 1 — Rio Hostil',
    stage: 1,
    lines: [
      'O Comando Aéreo detectou atividade incomum no Vale do Serpente Azul.',
      'O rio, antes seguro, agora está tomado por forças desconhecidas.',
      'Atravesse a região, sobreviva às primeiras ondas e gerencie o combustível.',
    ],
    quote: '“O Vale do Serpente Azul não é mais o que era. Algo está vindo de dentro dele.”',
  },
  {
    id: 'ch2',
    title: 'Capítulo 2 — Zona de Conflito',
    stage: 4,
    lines: [
      'As forças inimigas se reorganizaram.',
      'Novos padrões de ataque surgiram e drones avançados patrulham o rio.',
      'Relatórios indicam que um comandante inimigo coordena tudo a partir de uma fortaleza móvel.',
    ],
    quote: '“Eles não estão apenas defendendo o rio. Estão preparando algo maior.”',
  },
  {
    id: 'ch3',
    title: 'Capítulo 3 — Garganta de Ferro',
    stage: 7,
    lines: [
      'Você alcança a região final: um desfiladeiro estreito,',
      'tomado por estruturas metálicas e torres de defesa.',
      'O núcleo da operação inimiga está aqui — e o chefe supremo aguarda.',
    ],
    quote: '“Se destruirmos o núcleo, o rio volta a ser nosso.”',
  },
];

export interface BossIntro {
  title: string;
  description: string;
}

export function bossIntroFor(id: BossId): BossIntro {
  switch (id) {
    case 1:
      return {
        title: 'ALERTA DE CHEFE — SENTINELA DO VALE',
        description:
          'Você entrou na zona proibida. O Sentinela detectou sua presença e está se preparando para atacar. Neutralize-o para avançar ao coração do rio.',
      };
    case 2:
      return {
        title: 'ALERTA DE CHEFE — ARACNO-MECÂNICO',
        description:
          'A fortaleza móvel está próxima. O Aracno-Mecânico é o guardião da zona de conflito. Prepare-se para ataques em múltiplas direções.',
      };
    case 3:
      return {
        title: 'ALERTA DE CHEFE — NÚCLEO DA GARGANTA DE FERRO',
        description:
          'Você chegou ao fim. O núcleo central está ativo e direcionando todas as forças inimigas. Destrua-o e liberte o rio de vez.',
      };
  }
}

/** Capítulo vigente para uma fase (null = pós-campanha, modo infinito). */
export function chapterForStage(stage: number): Chapter | null {
  const sorted = [...CHAPTERS].sort((a, b) => b.stage - a.stage);
  return sorted.find((c) => stage >= c.stage) ?? null;
}

export const CAMPAIGN_FINAL_STAGE = 9;

export const CAMPAIGN_COMPLETE_TEXT = {
  title: 'O RIO ESTÁ LIVRE',
  description:
    'O núcleo foi destruído e as forças inimigas se dispersaram. O Vale do Serpente Azul respira novamente — mas o rio segue adiante, para quem tiver coragem de voar mais longe.',
};
