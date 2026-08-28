/**
 * River Raid Remaster — Pontuação e combo
 * Do PDF: multiplicador de combo que cresce a cada abate (até x5) e decai
 * após 3 segundos sem acertos.
 */

export class ScoreSystem {
  points = 0;
  combo = 1;
  comboTimer = 0;
  nextLifeAt = 10000;

  /** Adiciona pontos já multiplicados pelo combo. Retorna o ganho. */
  add(base: number): number {
    const gained = Math.round(base * this.combo);
    this.points += gained;
    return gained;
  }

  /** Registra um abate: sobe o combo. */
  registerKill(): void {
    this.combo = Math.min(5, this.combo + 0.1);
    this.comboTimer = 3;
  }

  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
  }

  /** Verifica se atingiu o marco de vida extra (a cada 10.000 pontos). */
  consumeExtraLife(): boolean {
    if (this.points >= this.nextLifeAt) {
      this.nextLifeAt += 10000;
      return true;
    }
    return false;
  }
}
