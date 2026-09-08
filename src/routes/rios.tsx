import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import { haversineKm } from "@/lib/floodguard-geo";

export const Route = createFileRoute("/rios")({
  component: RiosGate,
});

type Station = {
  codigo_estacao: string;
  nome: string;
  rio_bacia: string | null;
  municipio: string | null;
  uf: string | null;
  lat: number;
  lng: number;
};

type LevelInfo = {
  nivel_m: number | null;
  vazao_m3s: number | null;
  medido_em: string | null;
  error?: string;
  loading?: boolean;
};

function RiosGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <RiosPage />;
}

function RiosPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<(Station & { distanceKm: number })[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [searching, setSearching] = useState(false);

  const [levels, setLevels] = useState<Record<string, LevelInfo>>({});

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocalização não disponível neste navegador.");
      setLoadingNearby(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocationError("Não foi possível acessar sua localização.");
        setLoadingNearby(false);
      },
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;

    async function loadNearby() {
      setLoadingNearby(true);
      // Bounding box aproximado (~150km) pra não baixar a tabela inteira;
      // o filtro exato por distância é refinado depois, no navegador.
      const radiusKm = 150;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((coords!.lat * Math.PI) / 180));

      const { data, error } = await supabase
        .from("river_stations")
        .select("codigo_estacao,nome,rio_bacia,municipio,uf,lat,lng")
        .gte("lat", coords!.lat - latDelta)
        .lte("lat", coords!.lat + latDelta)
        .gte("lng", coords!.lng - lngDelta)
        .lte("lng", coords!.lng + lngDelta)
        .limit(500);

      if (cancelled) return;
      if (error || !data) {
        setLocationError("Não foi possível carregar as estações próximas.");
        setLoadingNearby(false);
        return;
      }

      const withDistance = (data as Station[])
        .map((s) => ({ ...s, distanceKm: haversineKm(coords!.lat, coords!.lng, s.lat, s.lng) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 8);

      setNearby(withDistance);
      setLoadingNearby(false);
    }

    loadNearby();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("river_stations")
        .select("codigo_estacao,nome,rio_bacia,municipio,uf,lat,lng")
        .or(`nome.ilike.%${term}%,rio_bacia.ilike.%${term}%,municipio.ilike.%${term}%`)
        .order("nome")
        .limit(20);
      if (!cancelled) {
        setSearchResults((data as Station[]) ?? []);
        setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function loadLevel(codigo: string) {
    setLevels((prev) => ({ ...prev, [codigo]: { ...prev[codigo], loading: true } as LevelInfo }));
    const { data, error } = await supabase.functions.invoke("ana-station-level", {
      body: { codigo },
    });
    if (error || data?.error) {
      setLevels((prev) => ({
        ...prev,
        [codigo]: { nivel_m: null, vazao_m3s: null, medido_em: null, error: "Não disponível agora." },
      }));
      return;
    }
    setLevels((prev) => ({ ...prev, [codigo]: data as LevelInfo }));
  }

  function StationRow({ station, distanceKm }: { station: Station; distanceKm?: number }) {
    const level = levels[station.codigo_estacao];
    return (
      <div className="rounded-2xl border-4 border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-black text-foreground">{station.nome}</p>
            {distanceKm != null && (
              <p className="mt-1 text-xs font-bold text-accent">{distanceKm.toFixed(1)} km daqui</p>
            )}
          </div>
        </div>

        {level ? (
          level.loading ? (
            <p className="mt-2 text-sm text-muted-foreground">Consultando...</p>
          ) : level.error ? (
            <p className="mt-2 text-sm font-bold text-danger">{level.error}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-4">
              {level.nivel_m != null ? (
                <p className="text-2xl font-black text-accent">{level.nivel_m} m</p>
              ) : (
                <p className="text-sm font-bold text-muted-foreground">
                  Sem leitura recente disponível para essa estação.
                </p>
              )}
              {level.vazao_m3s != null && (
                <p className="self-end text-sm text-muted-foreground">
                  Vazão: {level.vazao_m3s} m³/s
                </p>
              )}
              {level.medido_em && (
                <p className="w-full text-xs text-muted-foreground">Medido em {level.medido_em}</p>
              )}
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={() => loadLevel(station.codigo_estacao)}
            className="mt-3 min-h-[44px] rounded-xl border-2 border-accent px-4 text-sm font-black uppercase text-accent"
          >
            Ver nível atual
          </button>
        )}
      </div>
    );
  }

  return (
    <Page>
      <PageHeader title="Rios" subtitle="Nível de rios próximos, via ANA/SNIRH" />

      <div className="space-y-6 px-4">
        <section>
          <label htmlFor="river-search" className="sr-only">
            Buscar rio
          </label>
          <input
            id="river-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome do rio, bacia ou cidade..."
            className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-card px-4 text-base font-medium text-foreground placeholder:text-muted-foreground"
          />
          {query.trim().length >= 3 && (
            <div className="mt-3 space-y-3">
              {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}
              {!searching && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma estação encontrada.</p>
              )}
              {searchResults.map((s) => (
                <StationRow key={s.codigo_estacao} station={s} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-black text-accent">Rios próximos de você</h2>
          {loadingNearby && <p className="text-sm text-muted-foreground">Localizando...</p>}
          {locationError && <p className="text-sm font-bold text-danger">{locationError}</p>}
          {!loadingNearby && !locationError && nearby.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma estação fluviométrica encontrada num raio de 150km.
            </p>
          )}
          <div className="space-y-3 pb-4">
            {nearby.map((s) => (
              <StationRow key={s.codigo_estacao} station={s} distanceKm={s.distanceKm} />
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
