/**
 * Testes adversariais — sistemas puros do jogo
 * score, stages, missions, upgrades, campaign, audio, bullets, boss, enemies
 */

import { describe, test, expect } from 'bun:test';
import { ScoreSystem } from '@/game/systems/score';
import {
  isBossStage,
  stageLength,
  stageStartY,
  stageEndY,
  bridgeYFor,
  difficultyFor,
} from '@/game/systems/stages';
import { MissionSystem, MISSION_DEFS } from '@/game/systems/missions';
import {
  applyUpgrades,
  upgradeCost,
  UPGRADE_DEFS,
} from '@/game/systems/upgrades';
import { chapterForStage, bossIntroFor, CHAPTERS } from '@/game/systems/campaign';
import { AudioEngine } from '@/game/engine/audio';
import { BulletSystem, EnemyBulletSystem } from '@/game/entities/bullets';
import { Boss } from '@/game/entities/boss';
import { Enemy, enemyPoolForStage } from '@/game/entities/enemies';
import type { PlayerStats } from '@/game/entities/player';
import { clamp, lerp, smoothstep, angleLerp, mulberry32, randRange } from '@/game/utils';

// ---------------------------------------------------------------------------

describe('ScoreSystem', () => {
  test('add aplica o multiplicador de combo com arredondamento', () => {
    const s = new ScoreSystem();
    s.registerKill(); // combo 1.1
    expect(s.add(30)).toBe(33); // 30 * 1.1
    expect(s.points).toBe(33);
  });

  test('combo tem teto x5', () => {
    const s = new ScoreSystem();
    for (let i = 0; i < 100; i++) s.registerKill();
    expect(s.combo).toBe(5);
  });

  test('combo decai para x1 após 3s sem abates', () => {
    const s = new ScoreSystem();
    s.registerKill();
    s.update(2.9);
    expect(s.combo).toBeGreaterThan(1);
    s.update(0.2);
    expect(s.combo).toBe(1);
  });

  test('combo não volta a decair depois de resetar (timer já zerado)', () => {
    const s = new ScoreSystem();
    s.registerKill();
    s.update(5);
    s.update(5);
    expect(s.combo).toBe(1);
  });

  test('vida extra a cada 10.000 — pulo grande concede TODAS as vidas', () => {
    const s = new ScoreSystem();
    s.add(25000); // passa por 10k, 20k e chega a 25k
    let lives = 0;
    // consumeExtraLife é chamado a cada frame; um while cobre os marcos
    let guard = 0;
    while (s.consumeExtraLife() && guard++ < 10) lives++;
    expect(lives).toBe(2); // marcos 10k e 20k (25k < 30k)
    expect(s.nextLifeAt).toBe(30000);
  });

  test('vida extra não concede antes do marco', () => {
    const s = new ScoreSystem();
    s.add(9999);
    expect(s.consumeExtraLife()).toBe(false);
    s.add(1);
    expect(s.consumeExtraLife()).toBe(true);
  });
});

describe('stages — invariantes matemáticas', () => {
  test('isBossStage: 3, 6, 9 e múltiplos de 3 (modo infinito)', () => {
    expect(isBossStage(3)).toBe(true);
    expect(isBossStage(6)).toBe(true);
    expect(isBossStage(9)).toBe(true);
    expect(isBossStage(12)).toBe(true);
    expect(isBossStage(21)).toBe(true);
    expect(isBossStage(1)).toBe(false);
    expect(isBossStage(2)).toBe(false);
    expect(isBossStage(4)).toBe(false);
    expect(isBossStage(5)).toBe(false);
    expect(isBossStage(0)).toBe(false);
    expect(isBossStage(-3)).toBe(false);
    expect(isBossStage(-6)).toBe(false);
  });

  test('stageStartY é contínuo: fim de uma fase = início da próxima', () => {
    for (let s = 1; s <= 50; s++) {
      expect(stageStartY(s + 1)).toBe(stageStartY(s) + stageLength(s));
    }
  });

  test('stageStartY(1) = 0 e é crescente', () => {
    expect(stageStartY(1)).toBe(0);
    for (let s = 1; s <= 50; s++) {
      expect(stageStartY(s + 1)).toBeGreaterThan(stageStartY(s));
    }
  });

  test('bridgeYFor fica dentro da fase (antes do fim)', () => {
    for (let s = 1; s <= 30; s++) {
      if (isBossStage(s)) continue;
      expect(bridgeYFor(s)).toBeGreaterThan(stageStartY(s));
      expect(bridgeYFor(s)).toBeLessThan(stageEndY(s));
    }
  });

  test('difficultyFor é monotônica e limitada', () => {
    let prevScroll = 0;
    let prevSpawn = Infinity;
    for (let s = 1; s <= 200; s++) {
      const d = difficultyFor(s);
      expect(d.scrollSpeed).toBeGreaterThanOrEqual(prevScroll);
      expect(d.spawnInterval).toBeLessThanOrEqual(prevSpawn);
      expect(d.scrollSpeed).toBeLessThanOrEqual(250);
      expect(d.spawnInterval).toBeGreaterThanOrEqual(0.55);
      prevScroll = d.scrollSpeed;
      prevSpawn = d.spawnInterval;
    }
  });
});

describe('MissionSystem', () => {
  test('progress acumula e clampa no objetivo', () => {
    const m = new MissionSystem();
    m.progress('destroy_20', 19);
    expect(m.list.find((x) => x.id === 'destroy_20')!.progress).toBe(19);
    m.progress('destroy_20', 5); // clampa em 20
    const st = m.list.find((x) => x.id === 'destroy_20')!;
    expect(st.progress).toBe(20);
    expect(st.completed).toBe(true);
  });

  test('progress em missão já concluída é ignorado', () => {
    const m = new MissionSystem();
    m.complete('combo_x3');
    m.progress('combo_x3', 1);
    expect(m.list.find((x) => x.id === 'combo_x3')!.completed).toBe(true);
  });

  test('id desconhecido não lança', () => {
    const m = new MissionSystem();
    expect(() => m.progress('nao_existe', 1)).not.toThrow();
    expect(() => m.complete('nao_existe')).not.toThrow();
  });

  test('popCompleted devolve só não-recompensadas; markRewarded evita dupla entrega', () => {
    const m = new MissionSystem();
    m.complete('combo_x3');
    expect(m.popCompleted()).toHaveLength(1);
    m.markRewarded(m.list.find((x) => x.id === 'combo_x3')!);
    expect(m.popCompleted()).toHaveLength(0);
  });

  test('survive_60 progride via update(dt)', () => {
    const m = new MissionSystem();
    for (let i = 0; i < 6000; i++) m.update(0.01); // 60s
    const st = m.list.find((x) => x.id === 'survive_60')!;
    expect(st.progress).toBe(60);
    expect(st.completed).toBe(true);
  });

  test('restore com dado não-array não lança (defesa)', () => {
    const m = new MissionSystem();
    expect(() => (m as unknown as { restore(d: unknown): void }).restore(undefined)).not.toThrow();
    expect(() => (m as unknown as { restore(d: unknown): void }).restore('lixo')).not.toThrow();
  });

  test('restore com entradas inválidas ignora e mantém estado são', () => {
    const m = new MissionSystem();
    m.progress('destroy_20', 10);
    (m as unknown as { restore(d: unknown): void }).restore([
      { id: 'destroy_20', progress: 'x', completed: 'yes', rewardGiven: 1 },
      'lixo',
      null,
    ]);
    // entrada inválida não deve corromper o progresso válido
    expect(m.list.find((x) => x.id === 'destroy_20')!.progress).toBe(10);
  });

  test('serialize/restore roundtrip', () => {
    const a = new MissionSystem();
    a.progress('destroy_20', 7);
    a.complete('combo_x3');
    const data = a.serialize();
    const b = new MissionSystem();
    b.restore(data);
    expect(b.list.find((x) => x.id === 'destroy_20')!.progress).toBe(7);
    expect(b.list.find((x) => x.id === 'combo_x3')!.completed).toBe(true);
  });

  test('todas as missões têm recompensa descrita', () => {
    for (const d of MISSION_DEFS) {
      expect(d.rewardText.length).toBeGreaterThan(0);
      expect(d.goal).toBeGreaterThan(0);
    }
  });
});

describe('Upgrades', () => {
  test('custo cresce com o nível', () => {
    const speed = UPGRADE_DEFS.find((d) => d.id === 'speed')!;
    expect(upgradeCost(speed, 0)).toBe(150);
    expect(upgradeCost(speed, 1)).toBe(300);
    expect(upgradeCost(speed, 4)).toBe(750);
  });

  test('applyUpgrades nível 0 = stats base', () => {
    const stats: PlayerStats = {
      speed: 0,
      fireCooldown: 0,
      fuelEfficiency: 0,
      shieldBonus: 0,
    };
    applyUpgrades(stats, {});
    expect(stats.speed).toBe(340);
    expect(stats.fireCooldown).toBe(0.26);
    expect(stats.fuelEfficiency).toBe(1);
    expect(stats.shieldBonus).toBe(0);
  });

  test('applyUpgrades nível máximo dentro dos limites', () => {
    const stats: PlayerStats = {
      speed: 0,
      fireCooldown: 0,
      fuelEfficiency: 0,
      shieldBonus: 0,
    };
    applyUpgrades(stats, { speed: 5, fire_rate: 5, fuel_efficiency: 5, shield_duration: 3 });
    expect(stats.speed).toBeCloseTo(340 * 1.4, 6);
    expect(stats.fireCooldown).toBeCloseTo(0.14, 10);
    // 1 - 5×0.08 = 0.6 (o piso 0.55 só entraria no nível 6+, inatingível)
    expect(stats.fuelEfficiency).toBeCloseTo(0.6, 10);
    expect(stats.shieldBonus).toBe(4.5);
  });

  test('applyUpgrades CLAMPA níveis adulterados (defesa contra profile hackeado)', () => {
    const stats: PlayerStats = {
      speed: 0,
      fireCooldown: 0,
      fuelEfficiency: 0,
      shieldBonus: 0,
    };
    applyUpgrades(stats, { speed: 999, shield_duration: 999 });
    expect(stats.speed).toBe(340 * 1.4); // clamp no nível 5
    expect(stats.shieldBonus).toBe(4.5); // clamp no nível 3
  });

  test('applyUpgrades ignora ids desconhecidos', () => {
    const stats: PlayerStats = {
      speed: 1,
      fireCooldown: 1,
      fuelEfficiency: 1,
      shieldBonus: 1,
    };
    applyUpgrades(stats, { hacked: 99 } as Record<string, number>);
    // nada mudou além dos valores base
    expect(stats.speed).toBe(340);
  });
});

describe('Campaign', () => {
  test('capítulos mapeiam as fases corretamente', () => {
    expect(chapterForStage(1)?.id).toBe('ch1');
    expect(chapterForStage(3)?.id).toBe('ch1');
    expect(chapterForStage(4)?.id).toBe('ch2');
    expect(chapterForStage(6)?.id).toBe('ch2');
    expect(chapterForStage(7)?.id).toBe('ch3');
    expect(chapterForStage(9)?.id).toBe('ch3');
    expect(chapterForStage(10)?.id).toBe('ch3'); // pós-campanha segue no ch3
    expect(chapterForStage(100)?.id).toBe('ch3');
  });

  test('fases fora do alcance → null', () => {
    expect(chapterForStage(0)).toBeNull();
    expect(chapterForStage(-10)).toBeNull();
  });

  test('bossIntroFor cobre os 3 chefes', () => {
    expect(bossIntroFor(1).title).toContain('SENTINELA');
    expect(bossIntroFor(2).title).toContain('ARACNO');
    expect(bossIntroFor(3).title).toContain('NÚCLEO');
  });

  test('capítulos têm fases crescentes e 3 entradas', () => {
    expect(CHAPTERS).toHaveLength(3);
    expect(CHAPTERS[0].stage).toBeLessThan(CHAPTERS[1].stage);
    expect(CHAPTERS[1].stage).toBeLessThan(CHAPTERS[2].stage);
  });
});

describe('AudioEngine — tempo por fase (sem ctx de áudio)', () => {
  test('setStage sobe o andamento com a fase, com teto', () => {
    const a = new AudioEngine();
    a.setStage(1);
    const t1 = (a as unknown as { tempo: number }).tempo;
    a.setStage(20);
    const t20 = (a as unknown as { tempo: number }).tempo;
    expect(t20).toBeGreaterThan(t1);
    a.setStage(500);
    expect((a as unknown as { tempo: number }).tempo).toBeLessThanOrEqual(184);
  });

  test('sair do modo chefe RESTAURA o tempo da fase (não fica 150 para sempre)', () => {
    const a = new AudioEngine();
    a.setStage(2); // tempo ~110
    const antes = (a as unknown as { tempo: number }).tempo;
    a.setBossMode(true);
    expect((a as unknown as { tempo: number }).tempo).toBeGreaterThanOrEqual(150);
    a.setBossMode(false);
    expect((a as unknown as { tempo: number }).tempo).toBe(antes);
  });

  test('init sem AudioContext disponível não lança (try/catch)', () => {
    const a = new AudioEngine();
    expect(() => a.init()).not.toThrow();
  });
});

describe('Bullets', () => {
  test('bala do jogador desativa fora da tela', () => {
    const b = new BulletSystem();
    b.shoot(100, 100, Math.PI / 2, false);
    b.list[0].y = -100;
    b.update(0.016, () => null);
    expect(b.list).toHaveLength(0);
  });

  test('míssil teleguiado converge para o alvo', () => {
    const b = new BulletSystem();
    b.shoot(100, 500, Math.PI / 2, true); // sobe
    // alvo acima e à direita
    const target = { x: 300, y: 350 };
    const distInicial = Math.hypot(target.x - b.list[0].x, target.y - b.list[0].y);
    // distância mínima ao longo da trajetória (o míssil pode passar e
    // orbitar — o que importa é que ele PERSEGUIU o alvo)
    let minDist = Infinity;
    for (let i = 0; i < 90; i++) {
      b.update(1 / 60, () => target);
      const bullet = b.list[0];
      if (!bullet) break;
      minDist = Math.min(
        minDist,
        Math.hypot(target.x - bullet.x, target.y - bullet.y)
      );
    }
    expect(minDist).toBeLessThan(distInicial * 0.35); // chegou perto de fato
    expect(b.list[0].y).toBeLessThan(500); // seguiu para cima
  });

  test('tiros inimigos têm teto de 90 simultâneos', () => {
    const e = new EnemyBulletSystem();
    for (let i = 0; i < 150; i++) e.shoot(i, i, 0, 100);
    expect(e.list.length).toBeLessThanOrEqual(90);
  });

  test('tiros inimigos desativam fora dos limites', () => {
    const e = new EnemyBulletSystem();
    e.shoot(10, 10, 0, 5000);
    e.update(1);
    expect(e.list).toHaveLength(0);
  });
});

describe('Boss', () => {
  test('fases internas por faixa de HP', () => {
    const boss = new Boss(1, 960, 600);
    boss.entered = true;
    boss.hp = boss.maxHp;
    (boss as unknown as { update(ctx: unknown): void }).update({
      dt: 0.016, W: 960, H: 600, time: 1, playerX: 480, playerY: 500,
      fire: () => {}, spawnMinion: () => {}, bulletSpeed: 250,
    });
    expect(boss.phase).toBe(1);
    boss.hp = Math.floor(boss.maxHp * 0.5);
    (boss as unknown as { update(ctx: unknown): void }).update({
      dt: 0.016, W: 960, H: 600, time: 1, playerX: 480, playerY: 500,
      fire: () => {}, spawnMinion: () => {}, bulletSpeed: 250,
    });
    expect(boss.phase).toBe(2);
    boss.hp = Math.floor(boss.maxHp * 0.2);
    (boss as unknown as { update(ctx: unknown): void }).update({
      dt: 0.016, W: 960, H: 600, time: 1, playerX: 480, playerY: 500,
      fire: () => {}, spawnMinion: () => {}, bulletSpeed: 250,
    });
    expect(boss.phase).toBe(3);
  });

  test('hit reduz HP; HP 0 entra em agonia e expira', () => {
    const boss = new Boss(1, 960, 600); // HP 46
    const maxHp = boss.maxHp;
    for (let i = 0; i < maxHp; i++) boss.hit(1);
    expect(boss.hp).toBe(0);
    expect(boss.dying).toBe(true);
    boss.entered = true;
    for (let i = 0; i < 200; i++) {
      (boss as unknown as { update(ctx: unknown): void }).update({
        dt: 0.016, W: 960, H: 600, time: 1, playerX: 0, playerY: 0,
        fire: () => {}, spawnMinion: () => {}, bulletSpeed: 250,
      });
    }
    expect(boss.active).toBe(false);
  });

  test('hit durante agonia é ignorado', () => {
    const boss = new Boss(1, 960, 600);
    const maxHp = boss.maxHp;
    for (let i = 0; i < maxHp + 50; i++) boss.hit(1);
    expect(boss.hp).toBe(0);
  });

  test('hpScale escala o HP (modo infinito)', () => {
    const base = new Boss(1, 960, 600, 1);
    const scaled = new Boss(1, 960, 600, 1.35);
    expect(scaled.maxHp).toBe(Math.round(base.maxHp * 1.35));
  });

  test('tiros do boss miram PARA BAIXO na direção do jogador', () => {
    const shots: { x: number; y: number; vx: number; vy: number }[] = [];
    const boss = new Boss(1, 960, 600);
    boss.entered = true;
    boss.hp = boss.maxHp; // fase 1 = tiro único mirado
    boss.y = 100;
    (boss as unknown as { attack(ctx: unknown): void }).attack({
      playerX: 480, playerY: 500, fire: (x: number, y: number, vx: number, vy: number) =>
        shots.push({ x, y, vx, vy }),
      bulletSpeed: 250,
    });
    expect(shots).toHaveLength(1);
    expect(shots[0].vy).toBeGreaterThan(0); // desce em direção ao jogador
  });
});

describe('Enemies', () => {
  function ctxWithShape(shape: {
    left: number; right: number;
    islandLeft?: number; islandRight?: number; hasIsland?: boolean;
  }) {
    return {
      dt: 1 / 60,
      W: 1000,
      H: 600,
      time: 0,
      scrollY: 0,
      playerX: 500,
      playerY: 500,
      speedMultiplier: 1,
      approachMultiplier: 1,
      shapeAt: () => ({
        left: shape.left,
        right: shape.right,
        islandLeft: shape.islandLeft ?? shape.right,
        islandRight: shape.islandRight ?? shape.left,
        hasIsland: shape.hasIsland ?? false,
        halfWidth: (shape.right - shape.left) / 2,
        isLake: false,
      }),
      fire: () => {},
    };
  }

  test('barco no canal ESQUERDO quica na ilha (não atravessa)', () => {
    const e = new Enemy('boat', 300, 1000, 1); // x=300 → 0.3 (canal esquerdo)
    // vx inicial aleatório; força para a direita (rumo à ilha)
    (e as unknown as { vx: number }).vx = 60;
    const ctx = ctxWithShape({
      left: 0.2, right: 0.8,
      islandLeft: 0.45, islandRight: 0.55, hasIsland: true,
    });
    for (let i = 0; i < 600; i++) e.update(ctx); // 10s
    expect(e.x / ctx.W).toBeLessThanOrEqual(0.45); // nunca passou da ilha
  });

  test('barco no canal DIREITO quica na ilha (não atravessa)', () => {
    const e = new Enemy('boat', 700, 1000, 1); // 0.7 → canal direito
    (e as unknown as { vx: number }).vx = -60; // rumo à ilha
    const ctx = ctxWithShape({
      left: 0.2, right: 0.8,
      islandLeft: 0.45, islandRight: 0.55, hasIsland: true,
    });
    for (let i = 0; i < 600; i++) e.update(ctx);
    expect(e.x / ctx.W).toBeGreaterThanOrEqual(0.55);
  });

  test('barco sem ilha quica nas margens', () => {
    const e = new Enemy('boat', 300, 1000, 1);
    (e as unknown as { vx: number }).vx = -80;
    const ctx = ctxWithShape({ left: 0.2, right: 0.8 });
    for (let i = 0; i < 600; i++) e.update(ctx);
    expect(e.x / ctx.W).toBeGreaterThanOrEqual(0.2 - 0.02);
  });

  test('torre atira na direção do jogador', () => {
    const shots: { vx: number; vy: number }[] = [];
    // worldY 300 → screenY = 600-300 = 300 (dentro da tela)
    const e = new Enemy('turret', 100, 300, 1);
    const ctx = {
      ...ctxWithShape({ left: 0.1, right: 0.9 }),
      playerX: 500,
      playerY: 400,
      fire: (_x: number, _y: number, vx: number, vy: number) =>
        shots.push({ vx, vy }),
    };
    (e as unknown as { fireTimer: number }).fireTimer = 0;
    e.update(ctx);
    expect(shots).toHaveLength(1);
    expect(shots[0].vx).toBeGreaterThan(0); // jogador à direita
    expect(shots[0].vy).toBeGreaterThan(0); // jogador abaixo
  });

  test('despawn ao passar do jogador (screenY > H+110)', () => {
    const e = new Enemy('boat', 300, -800, 1); // worldY muito abaixo
    const ctx = ctxWithShape({ left: 0.1, right: 0.9 });
    e.update(ctx);
    expect(e.active).toBe(false);
  });

  test('pool por fase cresce e nunca fica vazio', () => {
    for (let s = 1; s <= 20; s++) {
      const pool = enemyPoolForStage(s);
      expect(pool.length).toBeGreaterThanOrEqual(2);
      expect(pool.every((k) => typeof k === 'string')).toBe(true);
    }
  });

  test('escalonamento de approach é aplicado uma vez no spawn', () => {
    const origRandom = Math.random;
    Math.random = () => 0.5; // determinístico
    try {
      const s1 = new Enemy('heli', 300, 1000, 1);
      const s10 = new Enemy('heli', 300, 1000, 10);
      const a1 = (s1 as unknown as { approach: number }).approach;
      const a10 = (s10 as unknown as { approach: number }).approach;
      expect(a10).toBeGreaterThan(a1);
      // ratio exato: 1 + 9*0.08 = 1.72
      expect(a10 / a1).toBeCloseTo(1.72, 5);
    } finally {
      Math.random = origRandom;
    }
  });
});

describe('utils', () => {
  test('clamp', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  test('clamp com NaN não propaga NaN (defesa)', () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
  });

  test('lerp e smoothstep', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
  });

  test('angleLerp menor caminho', () => {
    expect(angleLerp(0.1, 0.2, 1)).toBeCloseTo(0.2, 10);
    // girar de +3.0 para -3.0 deve ir pelo caminho curto (via ±π)
    const r = angleLerp(3.0, -3.0, 0.5);
    expect(Math.abs(r)).toBeGreaterThan(3.0 - 0.35);
    expect(Math.abs(r)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  test('mulberry32 determinístico e no range [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const va = a();
      expect(va).toBe(b());
      expect(va).toBeGreaterThanOrEqual(0);
      expect(va).toBeLessThan(1);
    }
  });

  test('randRange respeita limites', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = randRange(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});
