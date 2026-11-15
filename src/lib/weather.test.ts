import { describe, it, expect } from "vitest";
import { summarizeRain } from "./weather";

// 72 horas: 14/11 00:00 até 16/11 23:00
const times = Array.from({ length: 72 }, (_, i) =>
  new Date(Date.UTC(2026, 10, 14, i)).toISOString().slice(0, 13).concat(":00"),
);
const NOW = "2026-11-15T20:15"; // índice 44 (24 + 20)

function series() {
  const precip: Array<number | null> = Array(72).fill(0);
  const prob: Array<number | null> = Array(72).fill(0);
  precip[20] = 100; // fora da janela de 24 h (começa no índice 21)
  precip[30] = 3;
  precip[44] = 1; // hora atual
  precip[45] = 2;
  precip[46] = 4;
  precip[47] = 0.5;
  precip[48] = 50; // fora da janela de 3 h
  prob[45] = 30;
  prob[46] = 80;
  prob[47] = 60;
  prob[48] = 100;
  return { precip, prob };
}

describe("summarizeRain", () => {
  it("soma as últimas 24 h e as próximas 3 h, respeitando as janelas", () => {
    const { precip, prob } = series();
    const r = summarizeRain(times, precip, prob, NOW);
    expect(r.rain24h).toBe(4);
    expect(r.rainNext3h).toBe(6.5);
    expect(r.peakNext3h).toBe(4);
    expect(r.probNext3h).toBe(80);
  });

  it("devolve tudo nulo quando o horário atual não está na série", () => {
    const { precip, prob } = series();
    const r = summarizeRain(times, precip, prob, "2030-01-01T00:15");
    expect(r).toEqual({ rain24h: null, rainNext3h: null, peakNext3h: null, probNext3h: null });
  });

  it("ignora valores nulos na série", () => {
    const { precip, prob } = series();
    precip[45] = null;
    const r = summarizeRain(times, precip, prob, NOW);
    expect(r.rainNext3h).toBe(4.5);
  });
});
