/** Limite de reportes por usuário (o banco aplica o mesmo limite via trigger, migration 0007). */
export const REPORT_LIMIT = 3;
export const REPORT_WINDOW_MS = 60 * 60 * 1000;

export type ReportLimitStatus = {
  /** quantos reportes ainda podem ser enviados agora */
  left: number;
  /** instante (ms) em que o próximo reporte será liberado; null se já pode reportar */
  blockedUntil: number | null;
};

/**
 * Calcula o estado do limite a partir das datas dos reportes do próprio usuário.
 * Só contam os reportes da última hora; quando o limite é atingido, o próximo
 * reporte é liberado assim que o reporte mais antigo da janela completar 1 hora.
 */
export function reportLimitStatus(createdAt: string[], nowMs: number): ReportLimitStatus {
  const times = createdAt
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t) && t > nowMs - REPORT_WINDOW_MS)
    .sort((a, b) => a - b);

  const left = Math.max(0, REPORT_LIMIT - times.length);
  if (times.length < REPORT_LIMIT) return { left, blockedUntil: null };

  const releasing = times[times.length - REPORT_LIMIT] ?? nowMs;
  return { left: 0, blockedUntil: releasing + REPORT_WINDOW_MS };
}

/** "mm:ss" a partir de milissegundos restantes. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
