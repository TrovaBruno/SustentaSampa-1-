import { describe, expect, it } from "vitest";
import {
  INITIAL_PROXIMITY_STATE,
  PROXIMITY,
  countNearbyRecent,
  evaluateProximity,
} from "./proximity-alert";

const NOW = Date.parse("2026-11-18T20:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const pt = (min: number, dLat = 0) => ({ lat: -23.55 + dLat, lng: -46.63, created_at: ago(min) });

describe("countNearbyRecent", () => {
  it("conta só reportes dentro do raio e da janela de 1 hora", () => {
    const pts = [pt(5), pt(59), pt(61), pt(10, 0.01) /* ~1,1 km */];
    expect(countNearbyRecent(pts, -23.55, -46.63, NOW)).toBe(2);
  });
  it("ignora datas inválidas", () => {
    expect(
      countNearbyRecent([{ lat: -23.55, lng: -46.63, created_at: "x" }], -23.55, -46.63, NOW),
    ).toBe(0);
  });
});

describe("evaluateProximity", () => {
  it("não alerta com 10 reportes, alerta com 11", () => {
    expect(evaluateProximity(INITIAL_PROXIMITY_STATE, 10, NOW).alert).toBe(false);
    expect(evaluateProximity(INITIAL_PROXIMITY_STATE, 11, NOW).alert).toBe(true);
  });
  it("não repete enquanto o usuário continua na área", () => {
    const a = evaluateProximity(INITIAL_PROXIMITY_STATE, 12, NOW);
    expect(evaluateProximity(a.state, 15, NOW + 60 * 60_000).alert).toBe(false);
  });
  it("respeita o intervalo mínimo ao sair e voltar", () => {
    const a = evaluateProximity(INITIAL_PROXIMITY_STATE, 12, NOW);
    const out = evaluateProximity(a.state, 0, NOW + 60_000);
    expect(evaluateProximity(out.state, 12, NOW + 5 * 60_000).alert).toBe(false);
    expect(evaluateProximity(out.state, 12, NOW + PROXIMITY.cooldownMs + 1).alert).toBe(true);
  });
});
