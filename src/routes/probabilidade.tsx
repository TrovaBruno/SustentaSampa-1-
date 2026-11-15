import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import { fetchEnvironment, windDirectionLabel, type EnvironmentData } from "@/lib/weather";
import { floodProbability } from "@/lib/flood-probability";

export const Route = createFileRoute("/probabilidade")({
  component: ProbGate,
});

function ProbGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <ProbabilidadePage />;
}

const RIVER_TOKEN: Record<string, string> = {
  Baixo: "risk-low",
  Médio: "risk-mid",
  Alto: "risk-critical",
  Indisponível: "muted-foreground",
};

const DEFAULT_COORDS = { lat: -23.5505, lng: -46.6333 };
const REFRESH_MS = 10 * 60 * 1000;

const mm = (v: number | null | undefined) => (v == null ? "—" : `${v} mm`);

function ProbabilidadePage() {
  const [env, setEnv] = useState<EnvironmentData | null>(null);
  const [error, setError] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1) descobre a localização (ou cai no centro de São Paulo, avisando o usuário)
  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(DEFAULT_COORDS);
      setUsingDefault(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setCoords(DEFAULT_COORDS);
        setUsingDefault(true);
      },
      { timeout: 8000 },
    );
  }, []);

  const load = useCallback(async () => {
    if (!coords) return;
    setRefreshing(true);
    try {
      setEnv(await fetchEnvironment(coords.lat, coords.lng));
      setUpdatedAt(new Date());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [coords]);

  // 2) carrega e recarrega a cada 10 minutos
  useEffect(() => {
    if (!coords) return;
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [coords, load]);

  const prob = env ? floodProbability(env) : null;

  return (
    <Page>
      <PageHeader
        title="Probabilidade"
        subtitle={
          coords
            ? `Monitoramento em ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`
            : "Obtendo sua localização..."
        }
      />

      <div className="space-y-4 px-4">
        {usingDefault && (
          <p className="rounded-2xl border-4 border-risk-mid p-3 text-sm font-bold">
            Localização não autorizada: usando o centro de São Paulo. Libere a localização para
            dados do seu entorno.
          </p>
        )}

        {error && (
          <p className="rounded-2xl border-4 border-danger p-4 text-base font-bold">
            Não foi possível consultar os dados meteorológicos agora.
            {env ? " Os valores abaixo são da última atualização." : ""}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {updatedAt
              ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Carregando..."}{" "}
            · a cada 10 min
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing || !coords}
            className="min-h-[40px] rounded-xl border-2 border-border px-3 font-bold text-foreground disabled:opacity-60"
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {prob && (
          <section
            className="rounded-2xl border-4 bg-card p-4"
            style={{ borderColor: `var(--${prob.token})` }}
            aria-live="polite"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Probabilidade de alagamento
            </p>
            <p className="mt-1 text-4xl font-black" style={{ color: `var(--${prob.token})` }}>
              {prob.label.toUpperCase()} · {prob.percent}%
            </p>
            <p className="mt-2 text-base font-medium">{prob.reason}</p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Chovendo agora"
            value={env ? (env.isRaining ? "SIM" : "NÃO") : "..."}
            hint={env ? `${env.precipitation ?? 0} mm na última hora` : ""}
          />
          <Metric
            label="Chance de chuva"
            value={env?.rainProbability != null ? `${env.rainProbability}%` : "—"}
            hint="Máxima nas próximas 3 h"
          />
          <Metric
            label="Previsão 3 h"
            value={env ? mm(env.rainNext3h) : "..."}
            hint={env?.peakNext3h != null ? `Pico de ${env.peakNext3h} mm/h` : ""}
          />
          <Metric
            label="Acumulado 24 h"
            value={env ? mm(env.rain24h) : "..."}
            hint="Chuva nas últimas 24 horas"
          />
          <Metric
            label="Temperatura"
            value={env?.temperature != null ? `${env.temperature}°C` : "..."}
            hint={env?.humidity != null ? `Umidade ${env.humidity}%` : ""}
          />
          <Metric
            label="Vento"
            value={env?.windSpeed != null ? `${env.windSpeed} km/h` : "..."}
            hint={`Direção ${windDirectionLabel(env?.windDirection ?? null)}`}
          />
        </div>

        <section
          className="rounded-2xl border-4 bg-card p-4"
          style={{ borderColor: `var(--${RIVER_TOKEN[env?.river.level ?? "Indisponível"]})` }}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Nível do rio mais próximo
          </p>
          <p
            className="mt-1 text-3xl font-black"
            style={{ color: `var(--${RIVER_TOKEN[env?.river.level ?? "Indisponível"]})` }}
          >
            {env?.river.level ?? "..."}
          </p>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            {env?.river.discharge != null
              ? `Vazão atual ${env.river.discharge} m³/s · média do mês ${env.river.average} m³/s`
              : "Sem estação de vazão monitorada por perto."}
          </p>
        </section>

        <p className="pb-4 text-xs text-muted-foreground">
          Fontes abertas: Open-Meteo (previsão) e Open-Meteo Flood / GloFAS (vazão de rios).
          Estimativa de risco baseada em modelos; não substitui os alertas oficiais da Defesa Civil.
        </p>
      </div>
    </Page>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-4 border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
