/**
 * Testes adversariais — SaveSystem (localStorage)
 * ------------------------------------------------
 * Foco: o branch REJEITADO do loadRun/loadProfile.
 * O código original só validava `typeof stage === 'number'` —
 * deixando passar NaN, 0, 1e300, lives ausente, missions ausente etc.
 * Cada teste injeta JSON adulterado direto no localStorage.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { SaveSystem, defaultProfile } from '@/game/systems/save';
import { resetStorage, setRawStorage } from './helpers';

const RUN_KEY = 'riverraid_remaster_run_v1';
const PROFILE_KEY = 'riverraid_remaster_profile_v1';

const validRun = {
  version: 1,
  seed: 12345,
  stage: 3,
  score: 5000,
  lives: 2,
  missions: [
    { id: 'destroy_20', progress: 5, completed: false, rewardGiven: false },
  ],
  savedAt: 1700000000000,
};

beforeEach(() => {
  resetStorage();
});

describe('loadRun — branch rejeitado', () => {
  test('save válido é aceito', () => {
    setRawStorage(RUN_KEY, JSON.stringify(validRun));
    const run = new SaveSystem().loadRun();
    expect(run).not.toBeNull();
    expect(run!.stage).toBe(3);
    expect(run!.score).toBe(5000);
  });

  test('sem save → null', () => {
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('JSON corrompido → null (não lança)', () => {
    setRawStorage(RUN_KEY, '{{{corrompido');
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('versão diferente → null e remove a chave', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, version: 999 }));
    expect(new SaveSystem().loadRun()).toBeNull();
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });

  test('JSON válido mas não-objeto (ex.: número) → null', () => {
    setRawStorage(RUN_KEY, '42');
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage ausente → null', () => {
    const { stage, ...rest } = validRun;
    setRawStorage(RUN_KEY, JSON.stringify(rest));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage NaN → null (typeof number passa, mas NaN corrompe o jogo)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 'NaN' }));
    // 'NaN' serializado é string; mas Number.NaN via JSON não existe —
    // injeta via objeto com campo não-padrão:
    setRawStorage(
      RUN_KEY,
      '{"version":1,"seed":1,"stage":1,"score":0,"lives":3,"missions":[],"savedAt":1,"stage":null}'
    );
    const r = new SaveSystem().loadRun();
    expect(r === null || r.stage === 1).toBe(true);
  });

  test('stage 0 → null (fase inválida; stageStartY(0) é negativo)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 0 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage negativo → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: -5 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage 1e300 → null (loop infinito no stageAt/river)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 1e300 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage float → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 2.5 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('stage acima do teto (999) → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 1000 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('score ausente → null', () => {
    const { score, ...rest } = validRun;
    setRawStorage(RUN_KEY, JSON.stringify(rest));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('score negativo → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, score: -10 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('score gigante (2e9) → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, score: 2e9 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('score float → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, score: 10.5 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('lives ausente → null (crashava o HUD e o game over)', () => {
    const { lives, ...rest } = validRun;
    setRawStorage(RUN_KEY, JSON.stringify(rest));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('lives 0 → null (começar com 0 vidas é estado inválido)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, lives: 0 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('lives 1e9 → null (vidas infinitas)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, lives: 1e9 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('seed ausente → null (River com NaN)', () => {
    const { seed, ...rest } = validRun;
    setRawStorage(RUN_KEY, JSON.stringify(rest));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('seed negativa → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, seed: -1 }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('missions ausente → null (TypeError no continueRun!)', () => {
    const { missions, ...rest } = validRun;
    setRawStorage(RUN_KEY, JSON.stringify(rest));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('missions não-array → null', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, missions: 'nope' }));
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('missions com entrada lixo → null', () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({ ...validRun, missions: [{ id: 42, progress: 'x' }] })
    );
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('missions com id desconhecido → null', () => {
    setRawStorage(
      RUN_KEY,
      JSON.stringify({
        ...validRun,
        missions: [{ id: 'hack_reward', progress: 1, completed: true, rewardGiven: false }],
      })
    );
    expect(new SaveSystem().loadRun()).toBeNull();
  });

  test('rejeição remove a chave corrompida (auto-recuperação)', () => {
    setRawStorage(RUN_KEY, JSON.stringify({ ...validRun, stage: 0 }));
    new SaveSystem().loadRun();
    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });
});

describe('loadProfile — sanitização', () => {
  const validProfile = {
    version: 1,
    credits: 500,
    bestScore: 9000,
    upgrades: { speed: 2 },
    settings: { muted: true, retro: false },
    campaignDone: false,
    localScores: [
      { name: 'A', score: 9000, stage: 3, date: '2026-01-01' },
    ],
  };

  test('profile válido é preservado', () => {
    setRawStorage(PROFILE_KEY, JSON.stringify(validProfile));
    const p = new SaveSystem().loadProfile();
    expect(p.credits).toBe(500);
    expect(p.upgrades.speed).toBe(2);
    expect(p.settings.muted).toBe(true);
  });

  test('sem profile → default', () => {
    expect(new SaveSystem().loadProfile()).toEqual(defaultProfile());
  });

  test('JSON corrompido → default (não lança)', () => {
    setRawStorage(PROFILE_KEY, '[[[nope');
    expect(new SaveSystem().loadProfile()).toEqual(defaultProfile());
  });

  test('versão diferente → default', () => {
    setRawStorage(PROFILE_KEY, JSON.stringify({ ...validProfile, version: 7 }));
    expect(new SaveSystem().loadProfile()).toEqual(defaultProfile());
  });

  test('credits NaN ("abc") → 0', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, credits: 'abc' })
    );
    expect(new SaveSystem().loadProfile().credits).toBe(0);
  });

  test('credits negativo → 0', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, credits: -999 })
    );
    expect(new SaveSystem().loadProfile().credits).toBe(0);
  });

  test('credits float → inteiro', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, credits: 123.9 })
    );
    expect(new SaveSystem().loadProfile().credits).toBe(123);
  });

  test('credits gigante → clamp em 1e9', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, credits: 5e12 })
    );
    expect(new SaveSystem().loadProfile().credits).toBe(1_000_000_000);
  });

  test('bestScore NaN-ish → 0', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, bestScore: 'x' })
    );
    expect(new SaveSystem().loadProfile().bestScore).toBe(0);
  });

  test('upgrades acima do máximo → clamp para maxLevel', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, upgrades: { speed: 99, fire_rate: 3 } })
    );
    const p = new SaveSystem().loadProfile();
    expect(p.upgrades.speed).toBe(5); // maxLevel do speed
    expect(p.upgrades.fire_rate).toBe(3);
  });

  test('upgrades com id desconhecido → descartado', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({
        ...validProfile,
        upgrades: { hacked: 5, speed: 1 },
      })
    );
    const p = new SaveSystem().loadProfile();
    expect('hacked' in p.upgrades).toBe(false);
    expect(p.upgrades.speed).toBe(1);
  });

  test('upgrades com valor não-numérico → 0', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, upgrades: { speed: 'muita' } })
    );
    expect(new SaveSystem().loadProfile().upgrades.speed).toBe(0);
  });

  test('settings parcial → merge com defaults', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, settings: { muted: true } })
    );
    const p = new SaveSystem().loadProfile();
    expect(p.settings.muted).toBe(true);
    expect(p.settings.retro).toBe(false);
  });

  test('settings com tipos errados → defaults booleanos', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({
        ...validProfile,
        settings: { muted: 'sim', retro: 1 },
      })
    );
    const p = new SaveSystem().loadProfile();
    expect(p.settings.muted).toBe(false);
    expect(p.settings.retro).toBe(false);
  });

  test('localScores com entradas inválidas → filtradas', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({
        ...validProfile,
        localScores: [
          { name: 'ok', score: 10, stage: 1, date: 'x' },
          { score: 999 }, // sem nome
          'lixo',
          null,
          { name: 'b', score: -5, stage: 1, date: 'x' },
          { name: 'c', score: 10, stage: 0, date: 'x' },
        ],
      })
    );
    const p = new SaveSystem().loadProfile();
    expect(p.localScores).toHaveLength(1);
    expect(p.localScores[0].name).toBe('ok');
  });

  test('localScores acima de 10 → cap em 10, ordenado por score desc', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({
        ...validProfile,
        localScores: Array.from({ length: 15 }, (_, i) => ({
          name: `P${i}`,
          score: i * 100,
          stage: 1,
          date: 'x',
        })),
      })
    );
    const p = new SaveSystem().loadProfile();
    expect(p.localScores).toHaveLength(10);
    expect(p.localScores[0].score).toBe(1400);
    expect(p.localScores[9].score).toBe(500);
  });

  test('campaignDone não-booleano → false', () => {
    setRawStorage(
      PROFILE_KEY,
      JSON.stringify({ ...validProfile, campaignDone: 'yes' })
    );
    expect(new SaveSystem().loadProfile().campaignDone).toBe(false);
  });
});

describe('SaveSystem — roundtrip', () => {
  test('saveRun → loadRun devolve exatamente o que foi salvo', () => {
    const s = new SaveSystem();
    s.saveRun({ ...validRun });
    const run = s.loadRun();
    expect(run).toEqual(validRun);
  });

  test('clearRun remove o save', () => {
    const s = new SaveSystem();
    s.saveRun({ ...validRun });
    s.clearRun();
    expect(s.loadRun()).toBeNull();
  });

  test('saveProfile → loadProfile roundtrip', () => {
    const s = new SaveSystem();
    const p = { ...defaultProfile(), credits: 777, bestScore: 31337 };
    s.saveProfile(p);
    expect(s.loadProfile().credits).toBe(777);
  });
});
