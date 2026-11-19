import { haversineKm, riskLevelFromScore, type RiskLevel } from "./floodguard-geo";

export type Period = "dia" | "semana" | "mes" | "ano";

export const PERIODS: { id: Period; label: string; long: string }[] = [
  { id: "dia", label: "Dia", long: "últimas 24 horas" },
  { id: "semana", label: "Semana", long: "últimos 7 dias" },
  { id: "mes", label: "Mês", long: "últimos 30 dias" },
  { id: "ano", label: "Ano", long: "últimos 12 meses" },
];

export const RADIUS_OPTIONS_KM = [0.5, 1, 2, 5] as const;

export type RegionPoint = {
  lat: number;
  lng: number;
  weight: number;
  created_at: string;
  photo_url?: string | null;
  trafficability?: string | null;
  water_level?: string | null;
};

export type Bucket = { label: string; count: number };

export type RegionReport = {
  period: Period;
  /** Início da janela analisada (ms). */
  since: number;
  total: number;
  previousTotal: number;
  /** Variação em relação ao período anterior de mesmo tamanho; null se não houver base. */
  trendPct: number | null;
  buckets: Bucket[];
  traffic: { transitavel: number; veiculos_altos: number; intransitavel: number };
  water: { canela: number; joelho: number; acima_capo: number };
  withPhoto: number;
  /** Reportes por hora do dia (0–23). */
  hours: number[];
  /** Hora do dia (0–23) com mais reportes; null sem reportes. */
  peakHour: number | null;
  /** Soma dos pesos do dia mais crítico do período. */
  peakDayScore: number;
  peakDayLabel: string | null;
  level: RiskLevel;
  isRiskZone: boolean;
  summary: string;
};

/** Quanto dados buscar: a janela atual + uma janela anterior do mesmo tamanho. */
export function fetchFromMs(period: Period, now: number): number {
  const since = windowStart(period, now);
  return since - (now - since);
}

export function windowStart(period: Period, now: number): number {
  return bucketStarts(period, now)[0] ?? now;
}

function bucketStarts(period: Period, now: number): number[] {
  const d = new Date(now);
  const out: number[] = [];
  if (period === "dia") {
    for (let k = 23; k >= 0; k--) {
      out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - k).getTime());
    }
  } else if (period === "semana") {
    for (let k = 6; k >= 0; k--) {
      out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() - k).getTime());
    }
  } else if (period === "mes") {
    // Janela de 30 dias, agrupada por mês do calendário (1 ou 2 barras).
    const since = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29);
    out.push(since.getTime());
    for (let m = since.getMonth() + 1; ; m++) {
      const first = new Date(since.getFullYear(), m, 1).getTime();
      if (first > now) break;
      out.push(first);
    }
  } else {
    for (let k = 11; k >= 0; k--) {
      out.push(new Date(d.getFullYear(), d.getMonth() - k, 1).getTime());
    }
  }
  return out;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function bucketLabel(period: Period, start: number): string {
  const d = new Date(start);
  if (period === "dia") return `${String(d.getHours()).padStart(2, "0")}h`;
  if (period === "ano") {
    return cap(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
  }
  if (period === "mes") return cap(d.toLocaleDateString("pt-BR", { month: "long" }));
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${cap(wd)} ${String(d.getDate()).padStart(2, "0")}`;
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function buildRegionReport(
  points: RegionPoint[],
  center: { lat: number; lng: number },
  radiusKm: number,
  period: Period,
  now: number,
): RegionReport {
  const starts = bucketStarts(period, now);
  const since = starts[0] ?? now;
  const prevSince = since - (now - since);

  const buckets: Bucket[] = starts.map((s) => ({ label: bucketLabel(period, s), count: 0 }));
  const traffic = { transitavel: 0, veiculos_altos: 0, intransitavel: 0 };
  const water = { canela: 0, joelho: 0, acima_capo: 0 };
  const hours = new Array<number>(24).fill(0);
  const perDay = new Map<string, { score: number; t: number }>();
  let total = 0;
  let previousTotal = 0;
  let withPhoto = 0;

  for (const p of points) {
    const t = Date.parse(p.created_at);
    if (!Number.isFinite(t) || t > now + 60_000) continue;
    if (haversineKm(center.lat, center.lng, p.lat, p.lng) > radiusKm) continue;
    if (t >= prevSince && t < since) {
      previousTotal++;
      continue;
    }
    if (t < since) continue;

    total++;
    let idx = starts.length - 1;
    while (idx > 0 && (starts[idx] ?? 0) > t) idx--;
    const bucket = buckets[idx];
    if (bucket) bucket.count++;

    if (p.trafficability && p.trafficability in traffic) {
      traffic[p.trafficability as keyof typeof traffic]++;
    }
    if (p.water_level && p.water_level in water) {
      water[p.water_level as keyof typeof water]++;
    }
    if (p.photo_url) withPhoto++;
    const hr = new Date(t).getHours();
    hours[hr] = (hours[hr] ?? 0) + 1;

    const k = dayKey(t);
    const cur = perDay.get(k) ?? { score: 0, t };
    cur.score += p.weight;
    perDay.set(k, cur);
  }

  let peakDayScore = 0;
  let peakDayLabel: string | null = null;
  for (const { score, t } of perDay.values()) {
    if (score > peakDayScore) {
      peakDayScore = score;
      peakDayLabel = new Date(t).toLocaleDateString("pt-BR");
    }
  }
  peakDayScore = Number(peakDayScore.toFixed(2));

  const maxHour = Math.max(...hours);
  const peakHour = total > 0 ? hours.indexOf(maxHour) : null;
  const trendPct =
    previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const level = riskLevelFromScore(peakDayScore);
  const isRiskZone = level === "Alto" || level === "Crítico";

  const long = PERIODS.find((x) => x.id === period)?.long ?? "";
  const summary =
    total === 0
      ? `Nenhum reporte de alagamento nesta região nos ${long}.`
      : `${total} reporte(s) nesta região nos ${long}. ` +
        (isRiskZone
          ? `A região é considerada zona de risco (${level.toLowerCase()}), com pico em ${peakDayLabel}.`
          : level === "Médio"
            ? `A região merece atenção (risco médio), com pico em ${peakDayLabel}.`
            : "Não há indício de zona de risco relevante no período.");

  return {
    period,
    since,
    total,
    previousTotal,
    trendPct,
    buckets,
    traffic,
    water,
    withPhoto,
    hours,
    peakHour,
    peakDayScore,
    peakDayLabel,
    level,
    isRiskZone,
    summary,
  };
}
