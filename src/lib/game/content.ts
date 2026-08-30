/* =========================================================================
 * River Raid Remaster — Dados de conteúdo (bestiário)
 * Usado tanto pelo motor do jogo quanto pela apresentação (briefing)
 * na tela inicial. Fonte única de verdade.
 * ========================================================================= */

import type { BossType, EnemyType, PickupType } from "./types";

export interface StatBars {
  danger: number; // 1..5 — perigo
  speed: number; // 1..5 — velocidade
  aggression: number; // 1..5 — agressividade
}

export interface EnemyInfo {
  id: EnemyType;
  name: string;
  kind: string; // classificação (aeronave / embarcação / estrutura)
  tagline: string;
  description: string;
  behavior: string;
  stats: StatBars;
  points: number;
  hp: number;
  firstChapter: number;
  accent: string; // cor de destaque para o card
}

export const ENEMY_INFO: Record<EnemyType, EnemyInfo> = {
  patrol: {
    id: "patrol",
    name: "Navio de Patrulha",
    kind: "Embarcação",
    tagline: "O sentinelas dos rios",
    description:
      "Barco de patrulha padrão da frota inimiga. Desce o rio em linha reta, sem desviar. É lento, mas bloqueia a rota e destrói quem tentar atravessá-lo de frente.",
    behavior: "Movimento retilíneo descendente, velocidade constante. Nunca atira, mas a colisão é fatal.",
    stats: { danger: 2, speed: 2, aggression: 1 },
    points: 150,
    hp: 1,
    firstChapter: 1,
    accent: "#7dd3fc",
  },
  balloon: {
    id: "balloon",
    name: "Balão de Observação",
    kind: "Aeronave",
    tagline: "Olhos do inimigo no céu",
    description:
      "Balão de reconhecimento que flutua lentamente com a correnteza. Aparência inofensiva, mas o cesto abriga um observador que guia a artilharia — derrube-o antes que ele revele sua posição.",
    behavior: "Flutua descendo devagar, oscilando suavemente de lado com o vento.",
    stats: { danger: 2, speed: 1, aggression: 1 },
    points: 100,
    hp: 1,
    firstChapter: 1,
    accent: "#fca5a5",
  },
  drone: {
    id: "drone",
    name: "Drone de Reconhecimento",
    kind: "Aeronave",
    tagline: "Ágil e imprevisível",
    description:
      "Quadricóptero armado com carga leve. Executa manobras em zigue-zague de alta frequência para dificultar a pontaria. Excelente reflexo do piloto exigido.",
    behavior: "Desce em zigue-zague rápido, invertendo a direção horizontal a cada instante.",
    stats: { danger: 3, speed: 4, aggression: 2 },
    points: 200,
    hp: 1,
    firstChapter: 1,
    accent: "#a5b4fc",
  },
  armored: {
    id: "armored",
    name: "Barco Blindado",
    kind: "Embarcação",
    tagline: "Casco reforçado, dobro de resistência",
    description:
      "Lancha com placas de blindagem. Aguenta um tiro direto antes de afundar — o segundo disparo é obrigatório. Mais veloz que a patrulha e igualmente implacável na colisão.",
    behavior: "Avança em linha reta em alta velocidade. Requer 2 acertos para ser destruído.",
    stats: { danger: 3, speed: 4, aggression: 2 },
    points: 250,
    hp: 2,
    firstChapter: 2,
    accent: "#94a3b8",
  },
  chopper: {
    id: "chopper",
    name: "Helicóptero de Ataque",
    kind: "Aeronave",
    tagline: "Persegue e atira em você",
    description:
      "Helicóptero de ataque com metralhadora giratória. Rastreia sua posição horizontal e abre fogo assim como você entra na sua linha de tiro. Prioridade máxima de eliminação.",
    behavior: "Persegue o jogador horizontalmente e dispara tiros frontais periódicos.",
    stats: { danger: 4, speed: 3, aggression: 5 },
    points: 300,
    hp: 1,
    firstChapter: 2,
    accent: "#fdba74",
  },
  jet: {
    id: "jet",
    name: "Caça Supersônico",
    kind: "Aeronave",
    tagline: "Cruza o rio em segundos",
    description:
      "Jato de combate em manobra rasante. Aparece em alta velocidade vindo de cima e cruza o campo de visão antes que você perceba. Reação instantânea ou colisão.",
    behavior: "Cruza verticalmente em velocidade extremamente alta, sem mudar de rota.",
    stats: { danger: 4, speed: 5, aggression: 3 },
    points: 400,
    hp: 1,
    firstChapter: 2,
    accent: "#f0abfc",
  },
  turret: {
    id: "turret",
    name: "Torre de Defesa",
    kind: "Estrutura",
    tagline: "Artilharia fixa que mira em você",
    description:
      "Torre automática instalada em ilhas e margens. Seu canhão gira continuamente acompanhando sua posição e dispara projéteis teleguiados balísticos. Destrua-a ou mantenha distância.",
    behavior: "Fixa no terreno; o canhão gira mirando no jogador e atira em intervalos regulares.",
    stats: { danger: 5, speed: 1, aggression: 4 },
    points: 350,
    hp: 2,
    firstChapter: 3,
    accent: "#fbbf24",
  },
  stealth: {
    id: "stealth",
    name: "Helicóptero Furtivo",
    kind: "Aeronave",
    tagline: "Quase invisível, recompensa alta",
    description:
      "Aeronave com painéis de absorção de radar — aparece e desaparece do campo de visão. Só é visível plenamente quando dispara. Difícil de acertar, mas vale muitos pontos.",
    behavior: "Movimento errático com camuflagem ativa (semitransparente); revela-se ao atirar.",
    stats: { danger: 5, speed: 4, aggression: 4 },
    points: 500,
    hp: 1,
    firstChapter: 3,
    accent: "#c084fc",
  },
};

export interface BossInfo {
  id: BossType;
  name: string;
  tagline: string;
  description: string;
  behavior: string;
  points: number;
  hp: number;
  accent: string;
}

export const BOSS_INFO: Record<BossType, BossInfo> = {
  destroyer: {
    id: "destroyer",
    name: "Contratorpedeiro Leviatã",
    tagline: "Guardião do Capítulo 1",
    description:
      "O primeiro guardião do rio. Um contratorpedeiro de escolta que bloqueia o canal com baterias de canhão duplas e rajadas em leque.",
    behavior: "Ocupa o centro do rio, desliza de lado e dispara leques de projéteis. Cuidado com o casco: a colisão é fatal.",
    points: 1500,
    hp: 60,
    accent: "#60a5fa",
  },
  fortress: {
    id: "fortress",
    name: "Fortaleza Voadora Águia de Ferro",
    tagline: "Guardiã do Capítulo 2",
    description:
      "Uma asa voadora colosal que sobrevoa o rio lançando bombas em cascata e mísseis de saturação. O céu inteiro vira zona de fogo.",
    behavior: "Sobrevoa em oito, bombardeando o rio; abre brechas breves no padrão para contragolpe.",
    points: 3000,
    hp: 90,
    accent: "#fb923c",
  },
  carrier: {
    id: "carrier",
    name: "Porta-Aviões Titã",
    tagline: "Guardião final",
    description:
      "O quartel-general flutuante do inimigo. Lança ondas de caças, torres de mísseis em conveses duplos e um escudo defasado que só cai em janelas específicas.",
    behavior: "Onda após onda de ataques coordenados; destrua as torres de mísseis para expor o núcleo.",
    points: 6000,
    hp: 140,
    accent: "#f87171",
  },
};

export interface ObstacleInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  effect: string; // efeito no jogador
  accent: string;
}

export const OBSTACLE_INFO: ObstacleInfo[] = [
  {
    id: "banks",
    name: "Margens do Rio",
    tagline: "O perigo mais antigo do River Raid",
    description:
      "As margens verdes que moldam o rio. Elas se estreitam, se curvam e se abrem sem aviso. Tocar em um único pixel de vegetação destrói sua aeronave instantaneamente.",
    effect: "Colisão fatal — voe sempre pelo meio do canal.",
    accent: "#4ade80",
  },
  {
    id: "bridge",
    name: "Pontes Blindadas",
    tagline: "Portais que precisam cair",
    description:
      "Pontes fortificadas atravessam o rio bloqueando totalmente a passagem. É preciso destruí-las a tiros antes de se aproximar — atravessar uma ponte intacta é fatal.",
    effect: "Bloqueio fatal; 3 tiros a destroem (bônus de 500 pontos).",
    accent: "#a16207",
  },
  {
    id: "rocks",
    name: "Rochas Submersas",
    tagline: "Dentes de pedra no meio do canal",
    description:
      "Formações rochosas que emergem no meio do rio nos trechos largos. Reduzem drasticamente o espaço de manobra e não podem ser destruídas.",
    effect: "Colisão fatal — apenas desvio resolve.",
    accent: "#94a3b8",
  },
  {
    id: "fakeFuel",
    name: "Tanque de Combustível Falso",
    tagline: "Armadilha explosiva",
    description:
      "Barris enferrujados parecidos com combustível, marcados com um ✕. Ao toque, detonam uma carga explosiva. Aprenda a distinguir: o barril falso é escuro e solta fumaça.",
    effect: "Explosão fatal no toque — fuja dos barris com ✕.",
    accent: "#ef4444",
  },
];

export interface ItemInfo {
  id: PickupType;
  name: string;
  tagline: string;
  description: string;
  effect: string;
  durationS?: number;
  accent: string;
}

export const ITEM_INFO: ItemInfo[] = [
  {
    id: "fuel",
    name: "Barril de Combustível",
    tagline: "Recarregue o tanque",
    description:
      "Barril laranja com a letra F. Cada barril recuperado devolve 35 pontos de combustível ao seu tanque. Vigiados de perto: combustível é vida.",
    effect: "+35 de combustível · +80 pontos",
    accent: "#fb923c",
  },
  {
    id: "fuelGold",
    name: "Combustível Dourado",
    tagline: "Raro e valioso",
    description:
      "Barril dourado raro. Enche o tanque por completo e concede um bônus gordo de pontuação. Aparece pouco — quando avistar, não pense duas vezes.",
    effect: "Tanque cheio · +500 pontos",
    accent: "#facc15",
  },
  {
    id: "shield",
    name: "Escudo Defletor",
    tagline: "Invulnerabilidade temporária",
    description:
      "Bolha de energia que absorve qualquer dano — colisões, tiros e explosões — por 8 segundos. Ideal para atravessar trechos estreitos e as rajadas dos chefes.",
    effect: "Invulnerável por 8 segundos",
    durationS: 8,
    accent: "#38bdf8",
  },
  {
    id: "triple",
    name: "Tiro Triplo",
    tagline: "Três canos, triplo de dano",
    description:
      "Upgrade de armamento que instala dois canhões extras nas asas. Por 12 segundos, cada disparo sai em leque — perfeito para varrer pontes e frotas.",
    effect: "Disparo triplo por 12 segundos",
    durationS: 12,
    accent: "#f87171",
  },
  {
    id: "homing",
    name: "Míssil Teleguiado",
    tagline: "Persegue o alvo sozinho",
    description:
      "Mísseis com busca de calor: curvam no ar atrás do inimigo mais próximo. Por 10 segundos você não precisa mais mirar — apenas dispare e desvie.",
    effect: "Mísseis com busca por 10 segundos",
    durationS: 10,
    accent: "#4ade80",
  },
  {
    id: "turbo",
    name: "Turbo",
    tagline: "Velocidade e pontos em dobro",
    description:
      "Pós-combustor militar: dobra a velocidade de cruzeiro por 6 segundos e TODO ponto ganho vale em dobro. Risco e recompensa na mesma dose.",
    effect: "2× velocidade e 2× pontos por 6 segundos",
    durationS: 6,
    accent: "#c084fc",
  },
];

export interface ChapterInfo {
  n: number;
  name: string;
  description: string;
  fromM: number;
  boss: BossType;
}

export const CHAPTERS: ChapterInfo[] = [
  {
    n: 1,
    name: "Nascente do Rio",
    description: "Águas abertas, patrulhas leves e balões de observação. Aquecimento de rotina.",
    fromM: 0,
    boss: "destroyer",
  },
  {
    n: 2,
    name: "Desfiladeiro Rubro",
    description: "O rio estreita entre paredes de rocha. Blindados, helicópteros e caças supersônicos.",
    fromM: 3000,
    boss: "fortress",
  },
  {
    n: 3,
    name: "Delta Noturno",
    description: "Escuridão total sobre o delta. Torres automáticas e helicópteros furtivos caçam pelo radar.",
    fromM: 7000,
    boss: "carrier",
  },
];
