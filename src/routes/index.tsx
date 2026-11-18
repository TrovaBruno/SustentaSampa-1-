import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import {
  clusterReports,
  since24hISO,
  CRITICAL_CLUSTER_COUNT,
  type ReportPoint,
  type Cluster,
} from "@/lib/floodguard-clusters";
import {
  computeWeight,
  riskFromPoints,
  type RiskLevel,
  type Trafficability,
  type WaterLevel,
} from "@/lib/floodguard-geo";
import {
  INITIAL_PROXIMITY_STATE,
  PROXIMITY,
  countNearbyRecent,
  evaluateProximity,
  type ProximityState,
} from "@/lib/proximity-alert";
import { resolveCepFromCoords, type CepLocation } from "@/lib/cep";
import { REPORT_LIMIT, formatCountdown, reportLimitStatus } from "@/lib/report-limit";
import { AVATAR_CATALOG, avatarColorFor, isAvatarUnlocked } from "@/lib/avatars";

export const Route = createFileRoute("/")({
  component: SustentaSampaGate,
});

const RISK_TOKEN: Record<RiskLevel, string> = {
  Baixo: "risk-low",
  Médio: "risk-mid",
  Alto: "risk-high",
  Crítico: "risk-critical",
};

const TRAFFIC_LABEL: Record<string, string> = {
  transitavel: "Transitável",
  veiculos_altos: "Apenas veículos altos",
  intransitavel: "Intransitável",
};

const WATER_LABEL: Record<string, string> = {
  canela: "Canela",
  joelho: "Joelho",
  acima_capo: "Acima do capô",
};

function timeAgo(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  return `há ${diffH}h`;
}

/** Redimensiona e comprime a foto no navegador antes do upload (economiza dados). */
async function compressPhoto(file: File, maxDim = 1280, quality = 0.75): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Falha ao comprimir a imagem");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.__leafletReady) return w.__leafletReady;
  w.__leafletReady = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => {
      // Plugin do mapa de calor; se falhar, o mapa ainda funciona (com círculos simples).
      const heat = document.createElement("script");
      heat.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
      heat.onload = () => resolve(w.L);
      heat.onerror = () => resolve(w.L);
      document.body.appendChild(heat);
    };
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return w.__leafletReady;
}

/**
 * Configuração do mapa de calor. O raio é fixado em ~150 m no chão (e não em pixels),
 * então a mancha acompanha o zoom. Cada reporte soma calor: poucos = amarelo/laranja,
 * muitos na mesma região = vermelho escuro.
 */
function heatOptions(zoom: number, lat: number) {
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  const radius = Math.max(14, Math.min(70, 150 / metersPerPx));
  return {
    radius,
    blur: radius * 0.8,
    maxZoom: 13,
    max: 4,
    minOpacity: 0.3,
    gradient: { 0.2: "#ffe082", 0.45: "#ffb300", 0.7: "#f4511e", 1: "#b71c1c" },
  };
}

/** Cria (ou move) o ponto azul "você está aqui". */
function placeUserDot(L: any, map: any, ref: { current: any }, lat: number, lng: number) {
  if (ref.current) {
    ref.current.setLatLng([lat, lng]);
    return;
  }
  ref.current = L.marker([lat, lng], {
    icon: L.divIcon({
      className: "user-dot-wrap",
      html: '<div class="user-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 1000,
  }).addTo(map);
}

function SustentaSampaGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <SustentaSampa userId={userId} />;
}

function SustentaSampa({ userId }: { userId: string }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [activeRegions, setActiveRegions] = useState<number | null>(null);
  const coordsRef = useRef({ lat: -23.5505, lng: -46.6333 });
  const [coords, setCoords] = useState({ lat: -23.5505, lng: -46.6333 });
  const [risk, setRisk] = useState<ReturnType<typeof riskFromPoints> | null>(null);
  const [hotspots, setHotspots] = useState(0);
  const [emergency, setEmergency] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [traffic, setTraffic] = useState<Trafficability | null>(null);
  const [water, setWater] = useState<WaterLevel | null>(null);
  const [profile, setProfile] = useState<{
    display_name: string;
    points: number;
    is_admin: boolean;
    avatar_color: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [limitUntil, setLimitUntil] = useState<number | null>(null);
  const [reportsLeft, setReportsLeft] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cepInfo, setCepInfo] = useState<CepLocation | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCopied, setSosCopied] = useState(false);
  const [avatarShopOpen, setAvatarShopOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const clustersRef = useRef<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const emergencyRef = useRef(false);
  const pointsRef = useRef<ReportPoint[]>([]);
  const proximityRef = useRef<ProximityState>(INITIAL_PROXIMITY_STATE);
  const [proximityAlert, setProximityAlert] = useState<number | null>(null);

  useEffect(() => {
    emergencyRef.current = emergency;
  }, [emergency]);

  // Alerta de proximidade: acompanha a posição e avisa ao entrar numa área com muitos reportes.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const check = (lat: number, lng: number) => {
      const now = Date.now();
      const count = countNearbyRecent(pointsRef.current, lat, lng, now);
      const r = evaluateProximity(proximityRef.current, count, now);
      proximityRef.current = r.state;
      if (!r.alert) return;
      setProximityAlert(count);
      try {
        navigator.vibrate?.([200, 100, 200]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Cuidado: área com alagamentos", {
            body: `${count} reportes na última hora num raio de ${PROXIMITY.radiusKm * 1000} m.`,
          });
        }
      } catch {
        /* notificação do sistema é opcional */
      }
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => check(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("flood_reports")
      .select("id,lat,lng,weight,created_at,cep,photo_url,trafficability,water_level")
      .is("hidden_at", null)
      .gte("created_at", since24hISO())
      .order("created_at", { ascending: false })
      .limit(2000);
    const points = (data ?? []) as ReportPoint[];
    pointsRef.current = points;
    const clusters = clusterReports(points);
    setHotspots(clusters.filter((c) => c.critical).length);
    setActiveRegions(clusters.length);
    clustersRef.current = clusters;
    setSelectedCluster((prev) =>
      prev ? (clusters.find((c) => c.key === prev.key) ?? null) : prev,
    );

    const L = (window as any).L;
    if (L && mapRef.current) {
      const map = mapRef.current;
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.layerGroup();
      heatRef.current = null;

      if (L.heatLayer) {
        const heat = L.heatLayer(
          points.map((p) => [p.lat, p.lng, p.weight]),
          heatOptions(map.getZoom(), map.getCenter().lat),
        );
        heat.addTo(group);
        heatRef.current = heat;
      } else {
        for (const c of clusters) {
          L.circle([c.lat, c.lng], {
            radius: 200,
            stroke: false,
            fillColor: c.critical ? "#f44336" : "#ff9800",
            fillOpacity: 0.35,
            interactive: false,
          }).addTo(group);
        }
      }

      // Alvos de toque: o calor não é clicável, então cada região ganha um alvo
      // (invisível, ou um ponto vermelho piscando quando crítica) que abre a galeria.
      for (const c of clusters) {
        const hit = c.critical
          ? L.marker([c.lat, c.lng], {
              icon: L.divIcon({
                className: "cluster-icon",
                html: '<div class="cluster-pin cluster-pin--critical" style="width:26px;height:26px"></div>',
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              }),
            })
          : L.circleMarker([c.lat, c.lng], {
              radius: 22,
              stroke: false,
              fillColor: "#000",
              fillOpacity: 0.001,
              className: "heat-hit",
            });
        hit
          .bindTooltip(`${c.count} reporte(s) nesta região`)
          .on("click", () => setSelectedCluster(c))
          .addTo(group);
      }

      group.addTo(map);
      layerRef.current = group;
    }
    const radiusKm = emergencyRef.current ? 2.5 : 1;
    setRisk(riskFromPoints(coordsRef.current.lat, coordsRef.current.lng, points, radiusKm));
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name,points,is_admin,avatar_color")
      .eq("id", userId)
      .maybeSingle();
    if (data) setProfile(data);
  }, [userId]);

  /** Consulta os reportes do próprio usuário na última hora e calcula o limite. */
  const checkLimit = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("flood_reports")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since);
    if (!data) return;
    const status = reportLimitStatus(
      data.map((r) => r.created_at),
      Date.now(),
    );
    setReportsLeft(status.left);
    setLimitUntil(status.blockedUntil);
  }, [userId]);

  useEffect(() => {
    void checkLimit();
  }, [checkLimit]);

  // contagem regressiva: atualiza a cada segundo e libera sozinho no fim
  useEffect(() => {
    if (limitUntil === null) return;
    setNowMs(Date.now());
    const id = setInterval(() => {
      const n = Date.now();
      setNowMs(n);
      if (n >= limitUntil) {
        setLimitUntil(null);
        void checkLimit();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [limitUntil, checkLimit]);

  const limited = limitUntil !== null && nowMs < limitUntil;
  const remainingMs = limitUntil !== null ? Math.max(0, limitUntil - nowMs) : 0;

  useEffect(() => {
    let cancelled = false;
    loadProfile();
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: false }).setView(
        [coordsRef.current.lat, coordsRef.current.lng],
        12,
      );
      L.control.zoom({ position: "topright" }).addTo(map);
      // Mapa-base: OpenStreetMap com filtro escuro (definido em styles.css).
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
        className: "tiles-osm-dark",
      }).addTo(map);
      mapRef.current = map;
      map.on("zoomend", () => {
        heatRef.current?.setOptions(heatOptions(map.getZoom(), map.getCenter().lat));
      });
      refresh();

      if (navigator.geolocation) {
        setCepLoading(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            coordsRef.current = c;
            setCoords(c);
            placeUserDot(L, map, userMarkerRef, c.lat, c.lng);
            map.setView([c.lat, c.lng], 15);
            refresh();
            resolveCepFromCoords(c.lat, c.lng)
              .then((info) => {
                if (!cancelled) setCepInfo(info);
              })
              .finally(() => {
                if (!cancelled) setCepLoading(false);
              });
          },
          () => setCepLoading(false),
          { timeout: 10000, enableHighAccuracy: true },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, loadProfile]);

  // Atualização periódica do mapa: a cada 60s no normal, a cada 15s no
  // modo emergência (chuva forte muda o cenário rápido demais pra esperar).
  useEffect(() => {
    const intervalMs = emergency ? 15_000 : 60_000;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [emergency, refresh]);

  function resetReportForm() {
    setStep(1);
    setTraffic(null);
    setWater(null);
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoError(null);
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecione um arquivo de imagem.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function submitReport() {
    if (!traffic || !water || !photoFile) {
      setPhotoError("A foto é obrigatória para enviar o reporte.");
      return;
    }
    if (limitUntil !== null && Date.now() < limitUntil) return;
    setSending(true);
    try {
      const compressed = await compressPhoto(photoFile);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("flood-reports")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("flood-reports").getPublicUrl(path);

      const { error } = await supabase.from("flood_reports").insert({
        user_id: userId,
        // posição real do aparelho; o CEP só serve para agrupar por região
        lat: coords.lat,
        lng: coords.lng,
        cep: cepInfo?.cep ?? null,
        trafficability: traffic,
        water_level: water,
        weight: computeWeight(traffic, water),
        photo_url: publicUrl,
      });
      if (error) throw error;

      setToast("Reporte enviado! +10 pontos");
      setModal(false);
      resetReportForm();
      await Promise.all([refresh(), loadProfile(), checkLimit()]);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      if (message.includes("RATE_LIMIT_EXCEEDED")) {
        await checkLimit();
        setToast("Limite de reportes atingido. Veja o tempo restante para reportar de novo.");
      } else {
        setToast("Não foi possível enviar o reporte. Tente novamente.");
      }
    } finally {
      setSending(false);
    }
    setTimeout(() => setToast(null), 3500);
  }

  async function clearAllReportsFromMap() {
    if (!profile?.is_admin) return;
    const confirmed = window.confirm(
      "Isso vai esconder TODOS os reportes do mapa, para todos os usuários. Os dados continuam salvos no banco. Confirmar?",
    );
    if (!confirmed) return;
    setAdminBusy(true);
    const { error } = await supabase
      .from("flood_reports")
      .update({ hidden_at: new Date().toISOString() })
      .is("hidden_at", null);
    setAdminBusy(false);
    if (error) {
      setToast("Não foi possível limpar os reportes.");
    } else {
      setToast("Reportes escondidos do mapa (continuam salvos no banco).");
      await refresh();
    }
    setTimeout(() => setToast(null), 3500);
  }

  function locationText() {
    const lat = coords.lat.toFixed(5);
    const lng = coords.lng.toFixed(5);
    const cepPart = cepInfo?.cep ? ` · CEP ${cepInfo.cep}` : "";
    const labelPart = cepInfo?.label ? ` · ${cepInfo.label}` : "";
    return `Minha localização: ${lat}, ${lng}${cepPart}${labelPart} — https://www.google.com/maps?q=${lat},${lng}`;
  }

  async function openSOS() {
    setSosOpen(true);
    setSosCopied(false);
    try {
      await navigator.clipboard.writeText(locationText());
      setSosCopied(true);
    } catch {
      setSosCopied(false);
    }
  }

  function smsHref(body: string) {
    // iOS exige "&" antes de "body", Android exige "?". Sem número de
    // destino: o app de mensagens do usuário abre o seletor de contato.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const sep = isIOS ? "&" : "?";
    return `sms:${sep}body=${encodeURIComponent(body)}`;
  }

  async function selectAvatar(id: string) {
    const option = AVATAR_CATALOG.find((a) => a.id === id);
    if (!option || !profile || !isAvatarUnlocked(option, profile.points)) return;
    setAvatarSaving(true);
    const { error } = await supabase.from("profiles").update({ avatar_color: id }).eq("id", userId);
    setAvatarSaving(false);
    if (!error) {
      setProfile((p) => (p ? { ...p, avatar_color: id } : p));
      setToast("Avatar atualizado!");
      setTimeout(() => setToast(null), 2500);
    }
  }

  function locateMe() {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;
    if (!navigator.geolocation) {
      setToast("Seu navegador não permite obter a localização.");
      setTimeout(() => setToast(null), 3500);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = c;
        setCoords(c);
        placeUserDot(L, map, userMarkerRef, c.lat, c.lng);
        map.setView([c.lat, c.lng], 15);
        refresh();
        setCepLoading(true);
        resolveCepFromCoords(c.lat, c.lng)
          .then(setCepInfo)
          .finally(() => setCepLoading(false));
      },
      () => {
        setToast("Não foi possível obter sua localização. Verifique a permissão do navegador.");
        setTimeout(() => setToast(null), 3500);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  const riskToken = risk ? RISK_TOKEN[risk.level] : "risk-low";

  return (
    <div className={emergency ? "emergency" : undefined}>
      <Page>
        <PageHeader
          title="SustentaSampa"
          subtitle={`${profile?.display_name ?? "Nome"} · ${profile?.points ?? 0} pts`}
          avatar={
            <button
              type="button"
              onClick={() => setAvatarShopOpen(true)}
              aria-label="Personalizar avatar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-border text-lg font-black text-background"
              style={{ backgroundColor: avatarColorFor(profile?.avatar_color ?? "default") }}
            >
              {(profile?.display_name ?? "?").trim().charAt(0).toUpperCase()}
            </button>
          }
          actions={
            <button
              type="button"
              onClick={openSOS}
              className="min-h-[48px] rounded-xl bg-danger px-4 text-sm font-black uppercase text-foreground"
            >
              🆘 SOS
            </button>
          }
        />

        <div className="space-y-3 px-4">
          <section
            className="rounded-2xl border-4 p-4"
            style={{ borderColor: `var(--${riskToken})`, backgroundColor: "var(--card)" }}
            aria-live="polite"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Status do Entorno (raio {emergency ? "2,5" : "1"} km · últimas 24h)
            </p>
            <p
              className="mt-1 text-4xl font-black leading-none"
              style={{ color: `var(--${riskToken})` }}
            >
              {risk ? `RISCO ${risk.level.toUpperCase()}` : "CARREGANDO..."}
            </p>
            <p className="mt-2 text-base font-medium text-foreground">
              {risk
                ? `${risk.reportsNearby} reporte(s) ativo(s) por perto · índice ${risk.score}`
                : "Buscando sua localização"}
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: "var(--risk-critical)" }}>
              {hotspots > 0
                ? `${hotspots} região(ões) crítica(s) piscando no mapa (${CRITICAL_CLUSTER_COUNT}+ reportes)`
                : ""}
            </p>
          </section>

          <button
            type="button"
            onClick={() => setEmergency((v) => !v)}
            className="min-h-[56px] w-full rounded-2xl border-4 border-accent text-lg font-black uppercase tracking-wide text-accent transition-colors data-[on=true]:bg-accent data-[on=true]:text-background"
            data-on={emergency}
          >
            {emergency ? "Modo Emergência ATIVO" : "Ativar Modo Emergência / Chuva Forte"}
          </button>

          {profile?.is_admin && (
            <button
              type="button"
              onClick={clearAllReportsFromMap}
              disabled={adminBusy}
              className="min-h-[48px] w-full rounded-2xl border-4 border-danger text-sm font-black uppercase tracking-wide text-danger disabled:opacity-60"
            >
              {adminBusy ? "Limpando..." : "🛡️ Admin: limpar reportes do mapa"}
            </button>
          )}

          <div className="relative overflow-hidden rounded-2xl border-4 border-border">
            <div ref={mapEl} className="h-[56vh] min-h-[340px] w-full" />
            {activeRegions === 0 && (
              <p className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-xl border-2 border-border bg-background/90 px-3 py-2 text-sm font-bold text-foreground">
                Nenhum reporte nas últimas 24 h
              </p>
            )}
            <button
              type="button"
              onClick={locateMe}
              aria-label="Centralizar no meu local"
              title="Centralizar no meu local"
              className="absolute bottom-3 left-3 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border-4 border-border bg-background text-xl shadow-lg"
            >
              📍
            </button>
          </div>

          <div className="flex flex-wrap gap-3 pb-2 text-sm font-bold">
            <span className="flex items-center gap-2">
              Menos
              <span
                aria-hidden
                className="inline-block h-3 w-24 rounded-full"
                style={{ background: "linear-gradient(90deg,#ffe082,#ffb300,#f4511e,#b71c1c)" }}
              />
              Mais reportes
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="legend-blink inline-block h-4 w-4 rounded-full"
                style={{ background: "#F44336" }}
              />
              {CRITICAL_CLUSTER_COUNT}+ reportes (crítico)
            </span>
            <span className="text-muted-foreground">Reportes somem após 24h</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModal(true)}
          className={`fixed bottom-24 right-4 z-[1550] min-h-[64px] rounded-2xl px-6 text-lg font-black uppercase shadow-2xl ${
            limited ? "border-4 border-danger bg-card text-danger" : "bg-danger text-foreground"
          }`}
        >
          {limited ? `Próximo reporte em ${formatCountdown(remainingMs)}` : "+ Reportar Alagamento"}
        </button>

        {proximityAlert !== null && (
          <div
            role="alert"
            className="fixed left-1/2 top-4 z-[1950] w-[92%] max-w-sm -translate-x-1/2 rounded-xl border-2 border-danger bg-card p-4 text-base font-bold text-danger"
          >
            <div className="mb-1 text-lg font-black">Cuidado: área com alagamentos</div>
            <div className="text-foreground">
              {proximityAlert} reportes na última hora num raio de {PROXIMITY.radiusKm * 1000} m de
              você. Evite a região e redobre a atenção.
            </div>
            <button
              type="button"
              onClick={() => setProximityAlert(null)}
              className="mt-3 min-h-[44px] w-full rounded-lg bg-danger px-3 text-foreground"
            >
              Entendi
            </button>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-44 left-1/2 z-[1900] w-[90%] max-w-sm -translate-x-1/2 rounded-xl border-2 border-accent bg-card p-4 text-center text-base font-bold text-accent">
            {toast}
          </div>
        )}

        {sosOpen && (
          <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/80 p-3">
            <div className="w-full max-w-md rounded-3xl border-4 border-danger bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-danger">Emergência</h2>
                <button
                  type="button"
                  onClick={() => setSosOpen(false)}
                  className="min-h-[44px] px-3 text-base font-bold text-muted-foreground"
                >
                  Fechar
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                {sosCopied
                  ? "Sua localização foi copiada — cole no chat ou SMS ao pedir ajuda."
                  : "Não foi possível copiar a localização automaticamente. Copie manualmente abaixo."}
              </p>

              <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-border bg-background p-3">
                <p className="flex-1 truncate text-xs text-muted-foreground">{locationText()}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(locationText());
                      setSosCopied(true);
                    } catch {
                      setSosCopied(false);
                    }
                  }}
                  className="min-h-[36px] rounded-lg border-2 border-border px-3 text-xs font-bold text-foreground"
                >
                  Copiar
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <a
                  href="tel:199"
                  className="flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-danger text-lg font-black uppercase text-foreground"
                >
                  📞 Defesa Civil · 199
                </a>
                <a
                  href="tel:193"
                  className="flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-danger text-lg font-black uppercase text-foreground"
                >
                  🚒 Bombeiros · 193
                </a>
                <p className="pt-1 text-xs text-muted-foreground">
                  Defesa Civil e Bombeiros atendem só por ligação. Pra avisar um contato de
                  confiança por mensagem:
                </p>
                <a
                  href={smsHref(locationText())}
                  className="flex min-h-[64px] w-full items-center justify-center rounded-2xl border-4 border-danger text-lg font-black uppercase text-danger"
                >
                  ✉️ Enviar localização por SMS
                </a>
              </div>
            </div>
          </div>
        )}

        {avatarShopOpen && (
          <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/80 p-3">
            <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-accent">Personalizar avatar</h2>
                <button
                  type="button"
                  onClick={() => setAvatarShopOpen(false)}
                  className="min-h-[44px] px-3 text-base font-bold text-muted-foreground"
                >
                  Fechar
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Cores desbloqueadas conforme você acumula pontos reportando alagamentos. Você tem{" "}
                {profile?.points ?? 0} pts.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {AVATAR_CATALOG.map((option) => {
                  const unlocked = isAvatarUnlocked(option, profile?.points ?? 0);
                  const selected = profile?.avatar_color === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!unlocked || avatarSaving}
                      onClick={() => selectAvatar(option.id)}
                      className="flex flex-col items-center gap-2 rounded-2xl border-4 border-border p-3 text-center data-[selected=true]:border-accent disabled:opacity-40"
                      data-selected={selected}
                    >
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-background"
                        style={{ backgroundColor: option.color }}
                      >
                        {unlocked ? "" : "🔒"}
                      </span>
                      <span className="text-sm font-bold text-foreground">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {unlocked
                          ? selected
                            ? "Selecionado"
                            : "Desbloqueado"
                          : `Faltam ${option.threshold - (profile?.points ?? 0)} pts`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedCluster && (
          <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/80 p-3">
            <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border-4 border-accent bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-accent">
                    {selectedCluster.count} reporte(s) nesta região
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedCluster.cep ? `CEP ${selectedCluster.cep} · ` : ""}
                    {selectedCluster.critical ? "Região crítica" : "Região em atenção"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCluster(null)}
                  className="min-h-[44px] px-3 text-base font-bold text-muted-foreground"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
                {selectedCluster.reports.map((r) => (
                  <div key={r.id} className="rounded-2xl border-2 border-border p-3">
                    {r.photo_url && (
                      <img
                        src={r.photo_url}
                        alt="Foto do reporte"
                        className="mb-2 max-h-48 w-full rounded-xl object-cover"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      <span className="rounded-lg border-2 border-border px-2 py-0.5">
                        {(r.trafficability && TRAFFIC_LABEL[r.trafficability]) ?? "—"}
                      </span>
                      <span className="rounded-lg border-2 border-border px-2 py-0.5">
                        Água: {(r.water_level && WATER_LABEL[r.water_level]) ?? "—"}
                      </span>
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/80 p-3">
            <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-accent">Reporte Rápido</h2>
                <button
                  type="button"
                  onClick={() => {
                    setModal(false);
                    resetReportForm();
                  }}
                  className="min-h-[44px] px-3 text-base font-bold text-muted-foreground"
                >
                  Fechar
                </button>
              </div>

              {limited ? (
                <div role="alert" className="mb-2 rounded-2xl border-4 border-danger p-4">
                  <p className="text-lg font-black text-danger">Limite de reportes atingido</p>
                  <p className="mt-1 text-sm font-medium">
                    Você já enviou {REPORT_LIMIT} reportes na última hora. O limite evita spam e
                    mantém o mapa confiável.
                  </p>
                  <p className="mt-3 text-4xl font-black tabular-nums text-foreground">
                    {formatCountdown(remainingMs)}
                  </p>
                  <p className="text-sm text-muted-foreground">até poder reportar de novo</p>
                </div>
              ) : (
                reportsLeft !== null && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Reportes restantes nesta hora: {reportsLeft} de {REPORT_LIMIT}
                  </p>
                )
              )}

              {!limited && step === 1 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">1. Transitabilidade</p>
                  {(
                    [
                      ["transitavel", "Transitável"],
                      ["veiculos_altos", "Apenas Veículos Altos"],
                      ["intransitavel", "Intransitável"],
                    ] as Array<[Trafficability, string]>
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setTraffic(v);
                        setStep(2);
                      }}
                      className="min-h-[56px] w-full rounded-2xl border-4 border-border px-4 text-lg font-bold data-[sel=true]:border-accent data-[sel=true]:text-accent"
                      data-sel={traffic === v}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {!limited && step === 2 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">2. Nível da água</p>
                  {(
                    [
                      ["canela", "Canela"],
                      ["joelho", "Joelho"],
                      ["acima_capo", "Acima do Capô"],
                    ] as Array<[WaterLevel, string]>
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setWater(v);
                        setStep(3);
                      }}
                      className="min-h-[56px] w-full rounded-2xl border-4 border-border px-4 text-lg font-bold data-[sel=true]:border-accent data-[sel=true]:text-accent"
                      data-sel={water === v}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {!limited && step === 3 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">3. Foto do local (obrigatória)</p>
                  <p className="text-sm text-muted-foreground">
                    A foto ajuda a comunidade a confirmar o reporte. Tire uma foto do alagamento ou
                    envie uma da galeria.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <label
                      htmlFor="report-photo-camera"
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-2xl border-4 border-dashed border-border px-2 text-center text-base font-bold text-muted-foreground data-[has=true]:border-accent data-[has=true]:text-accent"
                      data-has={!!photoFile}
                    >
                      📷 Tirar foto
                    </label>
                    <label
                      htmlFor="report-photo-gallery"
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-2xl border-4 border-dashed border-border px-2 text-center text-base font-bold text-muted-foreground data-[has=true]:border-accent data-[has=true]:text-accent"
                      data-has={!!photoFile}
                    >
                      🖼️ Da galeria
                    </label>
                  </div>
                  {/* capture="environment" força a câmera a abrir direto no Android;
                      o input sem capture abre o seletor de arquivos/galeria normal. */}
                  <input
                    id="report-photo-camera"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onPhotoSelected}
                    className="sr-only"
                  />
                  <input
                    id="report-photo-gallery"
                    type="file"
                    accept="image/*"
                    onChange={onPhotoSelected}
                    className="sr-only"
                  />

                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Pré-visualização da foto do reporte"
                      className="max-h-56 w-full rounded-2xl border-4 border-border object-cover"
                    />
                  )}

                  {photoError && <p className="text-sm font-bold text-danger">{photoError}</p>}

                  <p className="text-sm text-muted-foreground">
                    {cepLoading
                      ? "Detectando o CEP da sua localização..."
                      : cepInfo?.cep
                        ? `CEP detectado: ${cepInfo.cep}${cepInfo.label ? ` · ${cepInfo.label}` : ""}`
                        : "CEP não identificado — será usada a região aproximada da sua localização."}
                  </p>

                  <button
                    type="button"
                    disabled={sending || !photoFile}
                    onClick={submitReport}
                    className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
                  >
                    {sending ? "Enviando..." : "Enviar Reporte (+10 pts)"}
                  </button>
                </div>
              )}

              {!limited && step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="mt-4 min-h-[48px] w-full rounded-xl border-2 border-border text-base font-bold text-muted-foreground"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
