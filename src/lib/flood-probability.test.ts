import { describe, it, expect } from "vitest";
import { floodProbability } from "./flood-probability";
import type { EnvironmentData } from "./weather";

const base: EnvironmentData = {
  temperature: 20,
  windSpeed: 8,
  windDirection: 315,
  precipitation: 0,
  isRaining: false,
  humidity: 80,
  rainProbability: 0,
  rain24h: 0,
  rainNext3h: 0,
  peakNext3h: 0,
  river: { level: "Baixo", discharge: 6, average: 11 },
};
const env = (over: Partial<EnvironmentData> = {}): EnvironmentData => ({ ...base, ...over });

describe("floodProbability", () => {
  it("garoa fraca com 55% de chance continua Baixa (caso do print)", () => {
    const r = floodProbability(
      env({
        precipitation: 0.2,
        isRaining: true,
        rainProbability: 55,
        peakNext3h: 0.3,
        rainNext3h: 0.5,
        rain24h: 1,
      }),
    );
    expect(r.label).toBe("Baixa");
    expect(r.percent).toBeLessThan(20);
  });

  it("temporal forte com solo encharcado é Crítica", () => {
    const r = floodProbability(
      env({
        precipitation: 15,
        isRaining: true,
        rainProbability: 90,
        peakNext3h: 15,
        rainNext3h: 30,
        rain24h: 40,
        river: { level: "Médio", discharge: 12, average: 11 },
      }),
    );
    expect(r.label).toBe("Crítica");
    expect(r.token).toBe("risk-critical");
  });

  it("chuva moderada com acumulado razoável fica Média", () => {
    const r = floodProbability(
      env({
        precipitation: 3,
        isRaining: true,
        rainProbability: 70,
        peakNext3h: 5,
        rain24h: 15,
      }),
    );
    expect(r.label).toBe("Média");
  });

  it("acumulado alto sozinho já eleva o risco, mesmo sem chuva agora", () => {
    const seco = floodProbability(env());
    const encharcado = floodProbability(env({ rain24h: 50 }));
    expect(encharcado.percent).toBeGreaterThan(seco.percent);
    expect(encharcado.label).toBe("Média");
  });

  it("rio alto soma 15 pontos em relação a rio baixo", () => {
    const o = { precipitation: 5, peakNext3h: 5, rainProbability: 100, rain24h: 20 };
    const baixo = floodProbability(env(o));
    const alto = floodProbability(
      env({ ...o, river: { level: "Alto", discharge: 20, average: 11 } }),
    );
    expect(alto.percent - baixo.percent).toBe(15);
  });

  it("aceita dados ausentes sem quebrar e fica no mínimo", () => {
    const r = floodProbability(
      env({
        precipitation: null,
        rainProbability: null,
        rain24h: null,
        rainNext3h: null,
        peakNext3h: null,
        windSpeed: null,
        river: { level: "Indisponível", discharge: null, average: null },
      }),
    );
    expect(r.percent).toBe(3);
    expect(r.label).toBe("Baixa");
  });

  it("nunca passa de 99%", () => {
    const r = floodProbability(
      env({
        precipitation: 80,
        rainProbability: 100,
        peakNext3h: 80,
        rain24h: 300,
        windSpeed: 90,
        river: { level: "Alto", discharge: 99, average: 10 },
      }),
    );
    expect(r.percent).toBeLessThanOrEqual(99);
    expect(r.label).toBe("Crítica");
  });
});
