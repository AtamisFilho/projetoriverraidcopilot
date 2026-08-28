/**
 * River Raid Remaster — Entrada unificada
 * ----------------------------------------
 * Correções em relação ao código original (PDF):
 *  - O gamepad é lido por polling a cada frame (o original só usava eventos
 *    `gamepadconnected`, que não refletem botões pressionados nem
 *    reconexão de controle já conectado no carregamento da página).
 *  - Zona morta no analógico (o original passava drift do stick direto
 *    para o movimento da nave).
 *  - Entradas de toque para dispositivos móveis.
 *  - Os listeners são registrados no elemento certo e removidos no
 *    `destroy()` (o original vazava listeners a cada montagem).
 */

export interface InputState {
  axisX: number; // -1..1
  axisY: number; // -1..1 (negativo = acelerar para cima)
  fire: boolean;
  pausePressed: boolean;
  mutePressed: boolean;
  confirmPressed: boolean; // espaço/enter/gamepad A — usado por cutscenes
}

const DEADZONE = 0.16;

export class InputManager {
  private keys: Record<string, boolean> = {};
  private touchAxisX = 0;
  private touchAxisY = 0;
  private touchFire = false;
  private prevPause = false;
  private prevMute = false;
  private prevConfirm = false;
  private gamepadSeen = false;

  pausePressed = false;
  confirmPressed = false;
  gamepadConnected = false;

  private onKeyDown = (e: KeyboardEvent) => {
    // Evita rolagem da página com setas/espaço enquanto o jogo roda
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        ' ',
      ].includes(e.key) &&
      e.target === document.body
    ) {
      e.preventDefault();
    }
    this.keys[e.key.toLowerCase()] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onBlur = () => {
    this.keys = {};
  };

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Chamado a cada frame antes da lógica do jogo. */
  poll(): InputState {
    // --- Teclado ---
    let kx = 0;
    let ky = 0;
    if (this.keys['arrowleft'] || this.keys['a']) kx -= 1;
    if (this.keys['arrowright'] || this.keys['d']) kx += 1;
    if (this.keys['arrowup'] || this.keys['w']) ky -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) ky += 1;
    const kFire = this.keys[' '] === true || this.keys['spacebar'] === true;

    // --- Gamepad (polling) ---
    let gx = 0;
    let gy = 0;
    let gFire = false;
    let gPause = false;
    let gConfirm = false;
    this.gamepadConnected = false;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        this.gamepadConnected = true;
        if (!this.gamepadSeen) {
          this.gamepadSeen = true;
        }
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        if (Math.abs(ax) > DEADZONE) gx = ax;
        if (Math.abs(ay) > DEADZONE) gy = ay;
        // D-pad
        if (pad.buttons[14]?.pressed) gx = -1;
        if (pad.buttons[15]?.pressed) gx = 1;
        if (pad.buttons[12]?.pressed) gy = -1;
        if (pad.buttons[13]?.pressed) gy = 1;
        // A (Xbox) / X (PS) / botão 0
        gFire = gFire || pad.buttons[0]?.pressed === true;
        // RB/LB como tiro alternativo
        gFire = gFire || pad.buttons[5]?.pressed === true || pad.buttons[4]?.pressed === true;
        gConfirm = gConfirm || pad.buttons[0]?.pressed === true;
        // Start
        gPause = gPause || pad.buttons[9]?.pressed === true;
      }
    }

    // --- Toque ---
    const tx = this.touchAxisX;
    const ty = this.touchAxisY;
    const tFire = this.touchFire;

    const axisX = clampAxis(kx + gx + tx);
    const axisY = clampAxis(ky + gy + ty);
    const fire = kFire || gFire || tFire;

    const pauseNow = this.keys['p'] || this.keys['escape'] || gPause;
    this.pausePressed = pauseNow && !this.prevPause;
    this.prevPause = pauseNow;

    const muteNow = this.keys['m'] === true;
    this.mutePressed = muteNow && !this.prevMute;
    this.prevMute = muteNow;

    const confirmNow = this.keys[' '] || this.keys['enter'] || gConfirm;
    this.confirmPressed = confirmNow && !this.prevConfirm;
    this.prevConfirm = confirmNow;

    return { axisX, axisY, fire, pausePressed: this.pausePressed, mutePressed: this.mutePressed, confirmPressed: this.confirmPressed };
  }

  // --- API para controles de toque (React) ---

  setTouchAxis(x: number, y: number): void {
    this.touchAxisX = clampAxis(x);
    this.touchAxisY = clampAxis(y);
  }

  setTouchFire(on: boolean): void {
    this.touchFire = on;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}

function clampAxis(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
