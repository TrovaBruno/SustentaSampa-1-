import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import { haversineKm, type RiskLevel } from "@/lib/floodguard-geo";
import { searchPlaces, type Place } from "@/lib/geocode";
import {
  PERIODS,
  RADIUS_OPTIONS_KM,
  buildRegionReport,
  fetchFromMs,
  type Period,
  type RegionPoint,
} from "@/lib/region-report";
import { Donut, HourStrip, RiskGauge, TimelineChart } from "@/components/report-charts";
import { exportReportPdf, type NearbyRiver } from "@/lib/report-pdf";

export const Route = createFileRoute("/relatorio")({
  component: RelatorioGate,
});

function RelatorioGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <RelatorioPage />;
}

const RISK_TOKEN: Record<RiskLevel, string> = {
  Baixo: "risk-low",
  Médio: "risk-mid",
  Alto: "risk-high",
  Crítico: "risk-critical",
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const RIVER_RADIUS_KM = 15;

async function fetchRegionPoints(
  center: { lat: number; lng: number },
  radiusKm: number,
  fromMs: number,
): Promise<RegionPoint[]> {
  const latD = radiusKm / 111;
  const lngD = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  const all: RegionPoint[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("flood_reports")
      .select("lat,lng,weight,created_at,photo_url,trafficability,water_level")
      .is("hidden_at", null)
      .gte("created_at", new Date(fromMs).toISOString())
      .gte("lat", center.lat - latD)
      .lte("lat", center.lat + latD)
      .gte("lng", center.lng - lngD)
      .lte("lng", center.lng + lngD)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as RegionPoint[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all;
}

async function fetchRivers(center: { lat: number; lng: number }): Promise<NearbyRiver[]> {
  const latD = RIVER_RADIUS_KM / 111;
  const lngD = RIVER_RADIUS_KM / (111 * Math.cos((center.lat * Math.PI) / 180));
  const { data } = await supabase
    .from("river_stations")
    .select("nome,rio_bacia,lat,lng")
    .gte("lat", center.lat - latD)
    .lte("lat", center.lat + latD)
    .gte("lng", center.lng - lngD)
    .lte("lng", center.lng + lngD)
    .limit(200);
  return (data ?? [])
    .map((s) => ({
      nome: s.nome,
      rio_bacia: s.rio_bacia,
      distanceKm: haversineKm(center.lat, center.lng, s.lat, s.lng),
    }))
    .filter((s) => s.distanceKm <= RIVER_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);
}

function RelatorioPage() {
  const [place, setPlace] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [period, setPeriod] = useState<Period>("semana");
  const [points, setPoints] = useState<RegionPoint[] | null>(null);
  const [rivers, setRivers] = useState<NearbyRiver[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  function useMyLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Geolocalização não disponível neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPlace({
          label: "Minha localização",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setLocError("Não foi possível acessar sua localização. Busque um bairro pelo nome."),
      { timeout: 10000 },
    );
  }

  useEffect(useMyLocation, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (found.length === 0) setSearchError("Nenhum lugar encontrado. Tente outro nome.");
    } catch {
      setSearchError("Não foi possível buscar agora. Tente de novo em instantes.");
    } finally {
      setSearching(false);
    }
  }

  // Carrega os reportes da região (janela atual + período anterior para a tendência).
  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    setPoints(null);
    setLoadError(null);
    const now = Date.now();
    Promise.all([fetchRegionPoints(place, radiusKm, fetchFromMs(period, now)), fetchRivers(place)])
      .then(([pts, rv]) => {
        if (cancelled) return;
        setPoints(pts);
        setRivers(rv);
        setLoadedAt(now);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar os reportes desta região.");
      });
    return () => {
      cancelled = true;
    };
  }, [place, radiusKm, period]);

  const report = useMemo(
    () => (place && points ? buildRegionReport(points, place, radiusKm, period, loadedAt) : null),
    [place, points, radiusKm, period, loadedAt],
  );
  const token = report ? RISK_TOKEN[report.level] : "risk-low";

  async function onExport() {
    if (!place || !report) return;
    setExporting(true);
    try {
      await exportReportPdf({
        regionName: place.label,
        radiusKm,
        report,
        rivers,
        generatedAt: new Date(),
      });
    } finally {
      setExporting(false);
    }
  }

  const chip = (active: boolean) =>
    `min-h-[44px] flex-1 rounded-xl px-3 text-sm font-bold transition-colors ${
      active ? "bg-accent text-background shadow" : "text-muted-foreground"
    }`;
  const card = "rounded-3xl border-2 border-border bg-card p-5";
  const cardTitle = "mb-4 flex items-center gap-2 text-lg font-black";

  return (
    <Page>
      <PageHeader title="Relatório" subtitle="Como está uma região, segundo os reportes" />
      <div className="space-y-4 px-4 pb-40">
        <section className={`${card} space-y-3`}>
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔎  Bairro ou rua (ex.: Vila Prudente)"
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 text-base"
            />
            <button
              type="submit"
              disabled={searching || query.trim().length < 3}
              className="min-h-[48px] rounded-xl bg-accent px-5 font-black text-background disabled:opacity-40"
            >
              {searching ? "…" : "Buscar"}
            </button>
          </form>
          {searchError && <p className="text-sm text-risk-critical">{searchError}</p>}
          {results.length > 0 && (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlace(r);
                      setResults([]);
                    }}
                    className="w-full rounded-xl border-2 border-border bg-background p-3 text-left text-sm"
                  >
                    📍 {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={useMyLocation}
            className="min-h-[44px] w-full rounded-xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground"
          >
            🎯 Usar minha localização
          </button>
          {locError && <p className="text-sm text-risk-critical">{locError}</p>}

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Período
            </p>
            <div
              className="flex gap-1 rounded-2xl bg-background p-1"
              role="group"
              aria-label="Período"
            >
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={chip(period === p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Raio
            </p>
            <div
              className="flex gap-1 rounded-2xl bg-background p-1"
              role="group"
              aria-label="Raio"
            >
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setRadiusKm(km)}
                  className={chip(radiusKm === km)}
                >
                  {km < 1 ? `${km * 1000} m` : `${km} km`}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!place && !locError && (
          <p className="text-center text-muted-foreground">Obtendo sua localização…</p>
        )}
        {place && !report && !loadError && (
          <div className="space-y-4" aria-busy="true">
            <div className="h-56 animate-pulse rounded-3xl bg-card" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-card" />
              ))}
            </div>
          </div>
        )}
        {loadError && <p className="text-center font-bold text-risk-critical">{loadError}</p>}

        {place && report && (
          <>
            <section
              className="rounded-3xl border-4 p-5"
              style={{
                borderColor: `var(--${token})`,
                background: `linear-gradient(160deg, color-mix(in oklch, var(--${token}) 26%, var(--card)) 0%, var(--card) 70%)`,
              }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                📍 {place.label} · raio de{" "}
                {radiusKm < 1 ? `${radiusKm * 1000} m` : `${radiusKm} km`}
              </p>
              <span
                className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-background"
                style={{ backgroundColor: `var(--${token})` }}
              >
                {report.isRiskZone
                  ? "⚠ Zona de risco"
                  : report.level === "Médio"
                    ? "Atenção"
                    : "Sem risco relevante"}
              </span>
              <RiskGauge
                score={report.peakDayScore}
                label={report.level}
                color={`var(--${token})`}
              />
              <p className="mt-1 text-center text-sm">{report.summary}</p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div
                className={`${card} p-4`}
                style={{ borderTopColor: `var(--${token})`, borderTopWidth: 4 }}
              >
                <p className="text-sm text-muted-foreground">📍 Reportes</p>
                <p className="text-4xl font-black">{report.total}</p>
                <p className="text-xs text-muted-foreground">{report.withPhoto} com foto</p>
              </div>
              <div
                className={`${card} p-4`}
                style={{ borderTopColor: "var(--accent)", borderTopWidth: 4 }}
              >
                <p className="text-sm text-muted-foreground">⏰ Horário de pico</p>
                <p className="text-4xl font-black">
                  {report.peakHour === null ? "—" : `${String(report.peakHour).padStart(2, "0")}h`}
                </p>
              </div>
            </section>

            <section className={card}>
              <h2 className={cardTitle}>📊 Reportes no período</h2>
              <TimelineChart
                buckets={report.buckets}
                color={`var(--${token})`}
                labeled={period !== "dia"}
              />
            </section>

            <section className={`${card} space-y-6`}>
              <div>
                <h2 className={cardTitle}>🚗 Transitabilidade</h2>
                <Donut
                  total={report.total}
                  centerLabel="Transitabilidade dos reportes"
                  items={[
                    {
                      label: "Transitável",
                      value: report.traffic.transitavel,
                      color: "var(--risk-low)",
                    },
                    {
                      label: "Só veículos altos",
                      value: report.traffic.veiculos_altos,
                      color: "var(--risk-high)",
                    },
                    {
                      label: "Intransitável",
                      value: report.traffic.intransitavel,
                      color: "var(--risk-critical)",
                    },
                  ]}
                />
              </div>
              <div>
                <h2 className={cardTitle}>💧 Nível da água</h2>
                <Donut
                  total={report.total}
                  centerLabel="Nível da água nos reportes"
                  items={[
                    { label: "Canela", value: report.water.canela, color: "oklch(0.82 0.1 230)" },
                    { label: "Joelho", value: report.water.joelho, color: "oklch(0.66 0.16 245)" },
                    {
                      label: "Acima do capô",
                      value: report.water.acima_capo,
                      color: "oklch(0.5 0.2 275)",
                    },
                  ]}
                />
              </div>
            </section>

            <section className={card}>
              <h2 className={cardTitle}>🕒 Quando acontece</h2>
              <HourStrip hours={report.hours} color={`var(--${token})`} />
            </section>

            <section className={card}>
              <h2 className={cardTitle}>🌊 Rios próximos</h2>
              {rivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma estação num raio de {RIVER_RADIUS_KM} km.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rivers.map((r) => (
                    <li
                      key={`${r.nome}-${r.distanceKm}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-background p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">{r.nome}</p>
                        {r.rio_bacia && (
                          <p className="truncate text-xs text-muted-foreground">{r.rio_bacia}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-black text-background">
                        {r.distanceKm.toFixed(1)} km
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-center text-xs text-muted-foreground">
              Dados colaborativos; não substituem os alertas da Defesa Civil (199).
            </p>
          </>
        )}
      </div>

      {report && (
        <div className="fixed bottom-16 left-0 right-0 z-[1500] bg-gradient-to-t from-background via-background to-transparent px-4 pb-3 pt-6">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black text-background shadow-lg disabled:opacity-60"
          >
            {exporting ? "Gerando PDF…" : "📄 Exportar relatório em PDF"}
          </button>
        </div>
      )}
    </Page>
  );
}
