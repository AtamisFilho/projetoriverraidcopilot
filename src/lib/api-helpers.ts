/**
 * Helpers da API de ranking — funções puras extraídas da rota para
 * serem testáveis isoladamente (a rota fica fina e o comportamento
 * crítico ganha cobertura direta).
 *
 * Portado do endurecimento da revisão adversarial (commit 3fbfe85 do
 * repositório) para a implementação remaster.
 */

/**
 * Rate-limit por chave com janela deslizante e proteção de memória:
 *  - entradas expiradas são podadas quando o mapa enche;
 *  - sob inundação de chaves únicas (XFF spoofado), o mapa é
 *    reiniciado em vez de crescer sem limite (anti-OOM).
 * O slot é consumido em TODA tentativa (válida ou não) — spam de
 * payloads inválidos também é limitado.
 */
export class RateLimiter {
  private last = new Map<string, number>();

  constructor(
    private windowMs = 5000,
    private maxKeys = 1024
  ) {}

  /** Retorna true se a chave pode agir agora (e consome o slot). */
  tryAcquire(key: string, now = Date.now()): boolean {
    this.prune(now);
    const last = this.last.get(key);
    if (last !== undefined && now - last < this.windowMs) return false;
    if (this.last.size >= this.maxKeys && !this.last.has(key)) {
      // Map cheio mesmo depois de podar = inundação de chaves únicas.
      // Reinicia (auto-recuperação) em vez de crescer sem limite.
      this.last.clear();
    }
    this.last.set(key, now);
    return true;
  }

  private prune(now: number): void {
    if (this.last.size < this.maxKeys) return;
    for (const [k, t] of this.last) {
      if (now - t >= this.windowMs) this.last.delete(k);
    }
  }

  get size(): number {
    return this.last.size;
  }
}

/**
 * Sanitiza o parâmetro `limit` do GET:
 *  - ausente/inválido → fallback;
 *  - não-inteiro (ex.: "2.5") → truncado (o Prisma exige Int em `take`);
 *  - fora da faixa → clamp [min, max].
 */
export function sanitizeLimit(
  raw: string | null,
  fallback = 10,
  min = 1,
  max = 50
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  // Só NaN (sem número algum) cai no fallback; ±Infinity respeita a
  // intenção explícita do cliente e clampa no máximo/mínimo
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/**
 * Extrai o IP do cliente do `x-forwarded-for` (primeiro hop).
 * Valores ausentes, vazios ou absurdamente longos (tentativa de
 * criar chaves gigantes no rate-limit) caem no bucket "local".
 */
export function clientIpFrom(xff: string | null): string {
  if (!xff) return "local";
  const first = xff.split(",")[0]?.trim() ?? "";
  if (first.length === 0 || first.length > 64) return "local";
  return first;
}
