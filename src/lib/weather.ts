export type RiverLevel = "Baixo" | "Médio" | "Alto" | "Indisponível";

export type EnvironmentData = {
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  /** chuva medida/estimada na última hora (mm) */
  precipitation: number | null;
  isRaining: boolean;
  humidity: number | null;
  /** maior chance de chuva (%) nas próximas 3 horas */
  rainProbability: number | null;
  /** chuva acumulada nas últimas 24 h (mm) */
  rain24h: number | null;
  /** chuva prevista para as próximas 3 h (mm) */
  rainNext3h: number | null;
  /** maior volume previsto em uma hora, nas próximas 3 h (mm/h) */
  peakNext3h: number | null;
  river: {
    level: RiverLevel;
    discharge: number | null;
    average: number | null;
  };
};

export type RainSummary = {
  rain24h: number | null;
  rainNext3h: number | null;
  peakNext3h: number | null;
  probNext3h: number | null;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Resume a série horária em janelas úteis para o risco de alagamento:
 * acumulado das últimas 24 h e previsão (volume, pico e chance) das próximas 3 h.
 * `nowIso` é o horário atual no fuso do local (ex.: "2026-11-15T20:15").
 */
export function summarizeRain(
  times: string[],
  precip: Array<number | null>,
  prob: Array<number | null>,
  nowIso: string,
): RainSummary {
  const empty: RainSummary = {
    rain24h: null,
    rainNext3h: null,
    peakNext3h: null,
    probNext3h: null,
  };
  const idx = times.indexOf(`${nowIso.slice(0, 13)}:00`);
  if (idx < 0) return empty;

  const values = (series: Array<number | null>, from: number, to: number) => {
    const out: number[] = [];
    for (let i = Math.max(0, from); i <= Math.min(to, series.length - 1); i++) {
      const v = series[i];
      if (isNum(v)) out.push(v);
    }
    return out;
  };

  const past = values(precip, idx - 23, idx);
  const next = values(precip, idx + 1, idx + 3);
  const nextProb = values(prob, idx + 1, idx + 3);

  return {
    rain24h: past.length ? round1(past.reduce((a, b) => a + b, 0)) : null,
    rainNext3h: next.length ? round1(next.reduce((a, b) => a + b, 0)) : null,
    peakNext3h: next.length ? round1(Math.max(...next)) : null,
    probNext3h: nextProb.length ? Math.round(Math.max(...nextProb)) : null,
  };
}

/** Dados meteorológicos abertos (Open-Meteo, sem chave de API). */
export async function fetchEnvironment(lat: number, lng: number): Promise<EnvironmentData> {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_direction_10m` +
    `&hourly=precipitation,precipitation_probability&past_days=1&forecast_days=2&timezone=auto`;

  const floodUrl =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}` +
    `&daily=river_discharge&past_days=31&forecast_days=1`;

  const [weatherRes, floodRes] = await Promise.allSettled([
    fetch(weatherUrl).then((r) => r.json()),
    fetch(floodUrl).then((r) => r.json()),
  ]);

  const w = weatherRes.status === "fulfilled" ? weatherRes.value : null;
  // Sem dados de clima não há o que estimar: melhor mostrar erro do que um "Baixa 3%" falso.
  if (!w?.current) throw new Error("Previsão do tempo indisponível");
  const cur = w.current;

  const rain = summarizeRain(
    w.hourly?.time ?? [],
    w.hourly?.precipitation ?? [],
    w.hourly?.precipitation_probability ?? [],
    String(cur.time ?? ""),
  );

  const river = riverLevel(floodRes.status === "fulfilled" ? floodRes.value : null);

  return {
    temperature: numOrNull(cur.temperature_2m),
    windSpeed: numOrNull(cur.wind_speed_10m),
    windDirection: numOrNull(cur.wind_direction_10m),
    precipitation: numOrNull(cur.precipitation),
    isRaining: Number(cur.rain ?? cur.precipitation ?? 0) >= 0.1,
    humidity: numOrNull(cur.relative_humidity_2m),
    rainProbability: rain.probNext3h,
    rain24h: rain.rain24h,
    rainNext3h: rain.rainNext3h,
    peakNext3h: rain.peakNext3h,
    river,
  };
}

function numOrNull(v: unknown): number | null {
  return isNum(v) ? v : null;
}

function riverLevel(flood: any): EnvironmentData["river"] {
  const series: Array<number | null> = flood?.daily?.river_discharge ?? [];
  const values = series.filter((v): v is number => typeof v === "number");
  if (values.length < 5) return { level: "Indisponível", discharge: null, average: null };
  const current = values[values.length - 1]!;
  const history = values.slice(0, -1);
  const average = history.reduce((a, b) => a + b, 0) / history.length;
  const ratio = average > 0 ? current / average : 1;
  const level: RiverLevel = ratio >= 1.35 ? "Alto" : ratio <= 0.7 ? "Baixo" : "Médio";
  return { level, discharge: Number(current.toFixed(2)), average: Number(average.toFixed(2)) };
}

export function windDirectionLabel(deg: number | null): string {
  if (deg === null) return "—";
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8]!;
}
