import { describe, it, expect } from "vitest";
import { REPORT_WINDOW_MS, formatCountdown, reportLimitStatus } from "./report-limit";

const NOW = Date.parse("2026-11-15T20:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe("reportLimitStatus", () => {
  it("sem reportes recentes: 3 restantes e sem bloqueio", () => {
    expect(reportLimitStatus([], NOW)).toEqual({ left: 3, blockedUntil: null });
  });

  it("com 2 reportes na última hora sobra 1", () => {
    expect(reportLimitStatus([ago(5), ago(10)], NOW)).toEqual({ left: 1, blockedUntil: null });
  });

  it("com 3 reportes bloqueia até o mais antigo completar 1 hora", () => {
    const r = reportLimitStatus([ago(5), ago(40), ago(20)], NOW);
    expect(r.left).toBe(0);
    expect(r.blockedUntil).toBe(NOW - 40 * 60_000 + REPORT_WINDOW_MS); // daqui a 20 min
  });

  it("ignora reportes com mais de 1 hora", () => {
    const r = reportLimitStatus([ago(5), ago(61), ago(120)], NOW);
    expect(r).toEqual({ left: 2, blockedUntil: null });
  });

  it("ignora datas inválidas", () => {
    expect(reportLimitStatus(["lixo"], NOW).left).toBe(3);
  });
});

describe("formatCountdown", () => {
  it("formata mm:ss", () => {
    expect(formatCountdown(20 * 60_000)).toBe("20:00");
    expect(formatCountdown(65_000)).toBe("01:05");
  });
  it("arredonda para cima e nunca fica negativo", () => {
    expect(formatCountdown(500)).toBe("00:01");
    expect(formatCountdown(-1000)).toBe("00:00");
  });
});
