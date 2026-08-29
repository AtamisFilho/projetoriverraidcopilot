/**
 * Harness de testes — stubs de browser para rodar o motor do jogo
 * (TypeScript puro) sob `bun test`, sem DOM real.
 */

// ---------------------------------------------------------------------------
// localStorage em memória (determinístico, resetável entre testes)
// ---------------------------------------------------------------------------

const store = new Map<string, string>();

const memoryLocalStorage: Storage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};

function installGlobal(name: string, value: unknown): void {
  try {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {
    // alguns globais do bun são somente-leitura; ignora
  }
}

installGlobal('localStorage', memoryLocalStorage);

export function resetStorage(): void {
  store.clear();
}

/** Injeta JSON cru no localStorage (simula adulteração pelo usuário). */
export function setRawStorage(key: string, value: string): void {
  store.set(key, value);
}

// ---------------------------------------------------------------------------
// window / rAF (o InputManager e o Game usam no construtor)
// ---------------------------------------------------------------------------

const noop = () => {};
installGlobal('window', {
  devicePixelRatio: 1,
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: noop,
  matchMedia: () => ({
    matches: false,
    addEventListener: noop,
    removeEventListener: noop,
  }),
  AudioContext: undefined,
});
installGlobal('requestAnimationFrame', () => 1);
installGlobal('cancelAnimationFrame', noop);

// ---------------------------------------------------------------------------
// Canvas 2D "anything" proxy — todos os métodos são no-op encadeáveis
// ---------------------------------------------------------------------------

function makeAnything(): any {
  const fn: any = () => makeAnything();
  return new Proxy(fn, {
    get: (_t, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      return makeAnything();
    },
    set: () => true,
    apply: () => makeAnything(),
  });
}

export function makeCanvas(w = 960, h = 600): HTMLCanvasElement {
  const canvas: any = {
    width: 0,
    height: 0,
    getContext: () => makeAnything(),
    getBoundingClientRect: () => ({ width: w, height: h, top: 0, left: 0 }),
    addEventListener: noop,
    removeEventListener: noop,
    focus: noop,
  };
  return canvas as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// Harness do Game — cria a instância e dirige o loop manualmente
// ---------------------------------------------------------------------------

import type { Game } from '@/game/Game';
import type { GameState, HudState } from '@/game/types';

export interface GameHarness {
  game: Game;
  states: GameState[];
  huds: HudState[];
  toasts: { title: string; description?: string }[];
  /** Avança N ticks de simulação (60 Hz). */
  step(frames?: number, dt?: number): void;
  state(): GameState;
  lastHud(): HudState;
}

export async function createGame(
  w = 960,
  h = 600
): Promise<GameHarness> {
  const { Game: GameClass } = await import('@/game/Game');
  const states: GameState[] = [];
  const huds: HudState[] = [];
  const toasts: { title: string; description?: string }[] = [];

  const game = new GameClass(makeCanvas(w, h), {
    onHud: (hud) => huds.push(hud),
    onToast: (title, description) => toasts.push({ title, description }),
    onStateChange: (s) => states.push(s),
  });

  return {
    game,
    states,
    huds,
    toasts,
    step(frames = 1, dt = 1 / 60) {
      for (let i = 0; i < frames; i++) {
        (game as unknown as { update(dt: number): void }).update(dt);
      }
    },
    state() {
      return (game as unknown as { state: GameState }).state;
    },
    lastHud() {
      return huds[huds.length - 1];
    },
  };
}

/** Acesso a membros privados para dirigir cenários de teste. */
export function priv<T>(game: Game): T {
  return game as unknown as T;
}
