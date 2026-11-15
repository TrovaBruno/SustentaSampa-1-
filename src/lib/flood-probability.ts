import type { EnvironmentData } from "./weather";

export type FloodProbability = {
  percent: number;
  label: "Baixa" | "Média" | "Alta" | "Crítica";
  token: "risk-low" | "risk-mid" | "risk-high" | "risk-critical";
  reason: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Estimativa heurística (0–99%) do risco de alagamento. Os pesos são uma
 * calibração inicial, não um modelo estatístico: o que alaga é principalmente
 * a intensidade da chuva, o que ainda vai cair e o solo já encharcado.
 *
 *   chuva agora (mm/h)         até 25 pts  (10 mm/h = máximo)
 *   pico previsto em 3 h       até 25 pts, ponderado pela chance de chuva
 *   acumulado em 24 h (mm)     até 25 pts  (50 mm = máximo)
 *   vazão do rio (GloFAS)      até 15 pts  (modelo de grade grossa, peso menor)
 *   vento forte (> 35 km/h)    5 pts
 */
export function floodProbability(env: EnvironmentData): FloodProbability {
  const now = env.precipitation ?? 0;
  const peak = env.peakNext3h ?? 0;
  const prob = env.rainProbability ?? 0;
  const acc24 = env.rain24h ?? 0;

  const nowPts = clamp(now * 2.5, 0, 25);
  const forecastPts = clamp(peak * 2.5, 0, 25) * Math.max(0.3, prob / 100);
  const soilPts = clamp(acc24 * 0.5, 0, 25);
  const riverPts = env.river.level === "Alto" ? 15 : env.river.level === "Médio" ? 5 : 0;
  const windPts = (env.windSpeed ?? 0) > 35 ? 5 : 0;

  const score = nowPts + forecastPts + soilPts + riverPts + windPts;
  const percent = clamp(Math.round(score), 3, 99);

  const label: FloodProbability["label"] =
    percent >= 70 ? "Crítica" : percent >= 45 ? "Alta" : percent >= 20 ? "Média" : "Baixa";
  const token: FloodProbability["token"] =
    percent >= 70
      ? "risk-critical"
      : percent >= 45
        ? "risk-high"
        : percent >= 20
          ? "risk-mid"
          : "risk-low";

  const parts = [now >= 0.1 ? `Chovendo agora (${now} mm/h)` : "Sem chuva no momento"];
  if (peak >= 1) parts.push(`pico previsto de ${peak} mm/h nas próximas 3 h`);
  if (acc24 >= 10) parts.push(`${acc24} mm acumulados em 24 h`);
  if (env.river.level === "Alto" || env.river.level === "Médio") {
    parts.push(`rio ${env.river.level.toLowerCase()}`);
  }
  if (parts.length === 1 && now < 0.1) parts.push("sem sinais relevantes de risco");

  return { percent, label, token, reason: parts.join(" · ") };
}
