import { haversineKm } from "./floodguard-geo";

/** Regras do alerta de proximidade (RF: avisar quem entra numa área com muitos reportes). */
export const PROXIMITY = {
  /** Raio ao redor do usuário, em km (300 m). */
  radiusKm: 0.3,
  /** Só contam reportes feitos dentro desta janela (1 hora). */
  windowMs: 60 * 60 * 1000,
  /** O alerta dispara com MAIS de `threshold` reportes. */
  threshold: 10,
  /** Intervalo mínimo entre dois alertas. */
  cooldownMs: 30 * 60 * 1000,
} as const;

type Point = { lat: number; lng: number; created_at: string };

/** Quantos reportes recentes existem no raio ao redor da posição. */
export function countNearbyRecent(
  points: Point[],
  lat: number,
  lng: number,
  now: number,
  opts: { radiusKm: number; windowMs: number } = PROXIMITY,
): number {
  const since = now - opts.windowMs;
  let n = 0;
  for (const p of points) {
    const t = Date.parse(p.created_at);
    if (!Number.isFinite(t) || t < since || t > now + 60_000) continue;
    if (haversineKm(lat, lng, p.lat, p.lng) <= opts.radiusKm) n++;
  }
  return n;
}

export type ProximityState = { inside: boolean; lastAlertAt: number | null };
export const INITIAL_PROXIMITY_STATE: ProximityState = { inside: false, lastAlertAt: null };

/**
 * Decide se deve alertar. Dispara ao ENTRAR na área (passar de "fora" para "dentro")
 * e respeita o intervalo mínimo entre alertas. Ao sair, o alerta é rearmado.
 */
export function evaluateProximity(
  state: ProximityState,
  count: number,
  now: number,
  cfg: { threshold: number; cooldownMs: number } = PROXIMITY,
): { alert: boolean; state: ProximityState } {
  const inside = count > cfg.threshold;
  const cooled = state.lastAlertAt === null || now - state.lastAlertAt >= cfg.cooldownMs;
  const alert = inside && !state.inside && cooled;
  return {
    alert,
    state: { inside, lastAlertAt: alert ? now : state.lastAlertAt },
  };
}
