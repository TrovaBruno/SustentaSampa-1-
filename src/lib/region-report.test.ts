import { describe, expect, it } from "vitest";
import { buildRegionReport, fetchFromMs, windowStart, type RegionPoint } from "./region-report";

const NOW = new Date(2026, 10, 19, 15, 30).getTime();
const C = { lat: -23.58, lng: -46.58 };
const at = (hoursAgo: number, over: Partial<RegionPoint> = {}): RegionPoint => ({
  lat: C.lat,
  lng: C.lng,
  weight: 1,
  created_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  ...over,
});

describe("buildRegionReport", () => {
  it("conta só reportes dentro do raio e da janela", () => {
    const pts = [at(1), at(5), at(30), at(2, { lat: C.lat + 0.05 })];
    const r = buildRegionReport(pts, C, 1, "dia", NOW);
    expect(r.total).toBe(2);
    expect(r.buckets.reduce((a, b) => a + b.count, 0)).toBe(2);
    expect(r.buckets).toHaveLength(24);
  });

  it("usa 7 dias na semana, 12 meses no ano e meses do calendário no mês", () => {
    expect(buildRegionReport([], C, 1, "semana", NOW).buckets).toHaveLength(7);
    expect(buildRegionReport([], C, 1, "ano", NOW).buckets).toHaveLength(12);
    // 30 dias terminando em 19/11 cobrem 21/10 a 19/11: outubro e novembro
    const mes = buildRegionReport([at(1), at(24 * 25)], C, 1, "mes", NOW).buckets;
    expect(mes.map((b) => b.label)).toEqual(["Outubro", "Novembro"]);
    expect(mes.map((b) => b.count)).toEqual([1, 1]);
  });

  it("calcula a variação em relação ao período anterior", () => {
    const since = windowStart("semana", NOW);
    const span = NOW - since;
    const prev = (n: number): RegionPoint[] =>
      Array.from({ length: n }, () => ({
        ...at(0),
        created_at: new Date(since - span / 2).toISOString(),
      }));
    const pts = [...prev(2), at(1), at(2), at(3), at(4)];
    const r = buildRegionReport(pts, C, 1, "semana", NOW);
    expect(r.total).toBe(4);
    expect(r.previousTotal).toBe(2);
    expect(r.trendPct).toBe(100);
  });

  it("sem período anterior, a variação é nula", () => {
    expect(buildRegionReport([at(1)], C, 1, "dia", NOW).trendPct).toBeNull();
  });

  it("marca zona de risco quando o pior dia soma peso alto", () => {
    const pts = Array.from({ length: 4 }, () => at(1, { weight: 1 }));
    const r = buildRegionReport(pts, C, 1, "dia", NOW);
    expect(r.level).toBe("Crítico");
    expect(r.isRiskZone).toBe(true);
  });

  it("região sem reportes é risco baixo", () => {
    const r = buildRegionReport([], C, 1, "mes", NOW);
    expect(r.level).toBe("Baixo");
    expect(r.isRiskZone).toBe(false);
    expect(r.peakHour).toBeNull();
    expect(r.summary).toContain("Nenhum reporte");
  });

  it("agrega transitabilidade, nível da água e fotos", () => {
    const pts = [
      at(1, { trafficability: "intransitavel", water_level: "acima_capo", photo_url: "x" }),
      at(2, { trafficability: "transitavel", water_level: "canela" }),
    ];
    const r = buildRegionReport(pts, C, 1, "dia", NOW);
    expect(r.traffic.intransitavel).toBe(1);
    expect(r.traffic.transitavel).toBe(1);
    expect(r.water.acima_capo).toBe(1);
    expect(r.withPhoto).toBe(1);
  });

  it("busca uma janela anterior do mesmo tamanho", () => {
    const since = windowStart("mes", NOW);
    expect(fetchFromMs("mes", NOW)).toBe(since - (NOW - since));
  });
});
