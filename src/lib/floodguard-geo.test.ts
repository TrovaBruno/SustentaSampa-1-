import { describe, it, expect } from "vitest";
import { computeWeight, haversineKm, riskFromPoints } from "./floodguard-geo";

describe("computeWeight", () => {
  it("soma o peso da transitabilidade com o acréscimo do nível da água", () => {
    expect(computeWeight("transitavel", "canela")).toBe(0.35);
    expect(computeWeight("veiculos_altos", "joelho")).toBeCloseTo(0.8);
  });

  it("nunca passa de 1", () => {
    expect(computeWeight("intransitavel", "acima_capo")).toBe(1);
  });
});

describe("haversineKm", () => {
  it("retorna 0 para o mesmo ponto", () => {
    expect(haversineKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it("1 grau de latitude vale cerca de 111 km", () => {
    const d = haversineKm(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("São Paulo → Rio de Janeiro fica em torno de 360 km", () => {
    const d = haversineKm(-23.5505, -46.6333, -22.9068, -43.1729);
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(370);
  });
});

describe("riskFromPoints", () => {
  const base = { lat: -23.55, lng: -46.63 };
  const pts = (n: number, weight: number) => Array.from({ length: n }, () => ({ ...base, weight }));

  it("sem reportes por perto o risco é Baixo", () => {
    expect(riskFromPoints(base.lat, base.lng, []).level).toBe("Baixo");
  });

  it("classifica pelos limites 0.8 / 2 / 3.5", () => {
    expect(riskFromPoints(base.lat, base.lng, pts(1, 0.8)).level).toBe("Médio");
    expect(riskFromPoints(base.lat, base.lng, pts(2, 1)).level).toBe("Alto");
    expect(riskFromPoints(base.lat, base.lng, pts(4, 1)).level).toBe("Crítico");
  });

  it("ignora reportes fora do raio", () => {
    const longe = [{ lat: -23.65, lng: -46.63, weight: 1 }]; // ~11 km
    const r = riskFromPoints(base.lat, base.lng, longe, 1);
    expect(r.reportsNearby).toBe(0);
    expect(r.level).toBe("Baixo");
  });
});
