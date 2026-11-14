import { describe, it, expect } from "vitest";
import {
  clusterReports,
  CRITICAL_CLUSTER_COUNT,
  since24hISO,
  type ReportPoint,
} from "./floodguard-clusters";

const report = (i: number, over: Partial<ReportPoint> = {}): ReportPoint => ({
  id: String(i),
  lat: -23.55,
  lng: -46.63,
  weight: 0.5,
  created_at: `2026-11-01T10:${String(i).padStart(2, "0")}:00Z`,
  ...over,
});

describe("clusterReports", () => {
  it("agrupa reportes do mesmo CEP em uma única região", () => {
    const out = clusterReports([
      report(1, { cep: "01001-000" }),
      report(2, { cep: "01001-000", lat: -23.9 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.count).toBe(2);
    expect(out[0]?.cep).toBe("01001-000");
  });

  it("separa regiões distantes quando não há CEP", () => {
    const out = clusterReports([report(1), report(2, { lat: -23.7 })]);
    expect(out).toHaveLength(2);
  });

  it("marca como crítica a partir de 10 reportes", () => {
    const nove = clusterReports(
      Array.from({ length: CRITICAL_CLUSTER_COUNT - 1 }, (_, i) => report(i, { cep: "A" })),
    );
    const dez = clusterReports(
      Array.from({ length: CRITICAL_CLUSTER_COUNT }, (_, i) => report(i, { cep: "A" })),
    );
    expect(nove[0]?.critical).toBe(false);
    expect(dez[0]?.critical).toBe(true);
  });

  it("ordena do mais recente para o mais antigo e usa a foto mais recente", () => {
    const out = clusterReports([
      report(1, { cep: "A", photo_url: "velha.jpg" }),
      report(5, { cep: "A", photo_url: "nova.jpg" }),
      report(3, { cep: "A" }),
    ]);
    expect(out[0]?.reports.map((r) => r.id)).toEqual(["5", "3", "1"]);
    expect(out[0]?.photoUrl).toBe("nova.jpg");
  });

  it("calcula o peso médio da região", () => {
    const out = clusterReports([
      report(1, { cep: "A", weight: 0.35 }),
      report(2, { cep: "A", weight: 1 }),
    ]);
    expect(out[0]?.weight).toBe(0.68);
  });
});

describe("since24hISO", () => {
  it("devolve um instante cerca de 24 h no passado", () => {
    const diff = Date.now() - new Date(since24hISO()).getTime();
    expect(diff).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000);
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
  });
});
