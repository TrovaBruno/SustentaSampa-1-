import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import {
  clusterReports,
  since24hISO,
  CRITICAL_CLUSTER_COUNT,
  type ReportPoint,
} from "@/lib/floodguard-clusters";
import {
  computeWeight,
  riskFromPoints,
  type RiskLevel,
  type Trafficability,
  type WaterLevel,
} from "@/lib/floodguard-geo";
import { resolveCepFromCoords, type CepLocation } from "@/lib/cep";
import { AVATAR_CATALOG, avatarColorFor, isAvatarUnlocked } from "@/lib/avatars";

export const Route = createFileRoute("/")({
  component: SustentaSampaGate,
});

const RISK_TOKEN: Record<RiskLevel, string> = {
  Baixo: "risk-low",
  "Médio": "risk-mid",
  Alto: "risk-high",
  "Crítico": "risk-critical",
};

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
    s.onload = () => resolve(w.L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return w.__leafletReady;
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
  const emergencyRef = useRef(false);

  useEffect(() => {
    emergencyRef.current = emergency;
  }, [emergency]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("flood_reports")
      .select("lat,lng,weight,created_at,cep,photo_url")
      .is("hidden_at", null)
      .gte("created_at", since24hISO())
      .order("created_at", { ascending: false })
      .limit(2000);
    const points = (data ?? []) as ReportPoint[];
    const clusters = clusterReports(points);
    setHotspots(clusters.filter((c) => c.critical).length);

    const L = (window as any).L;
    if (L && mapRef.current) {
      if (layerRef.current) mapRef.current.removeLayer(layerRef.current);
      const group = L.layerGroup();
      for (const c of clusters) {
        const color = c.critical ? "#F44336" : "#FF9800";
        L.circle([c.lat, c.lng], {
          radius: 260 + Math.min(240, c.count * 20),
          color,
          weight: 3,
          fillColor: color,
          fillOpacity: c.critical ? 0.45 : 0.3,
          className: c.critical ? "cluster-critical" : "cluster-warning",
        })
          .bindPopup(
            `<b>${c.count} reporte(s)</b> nas últimas 24h<br/>${
              c.cep ? `CEP ${c.cep}<br/>` : ""
            }${c.critical ? "Região crítica (10+ reportes)" : "Região em atenção"}${
              c.photoUrl
                ? `<br/><img src="${c.photoUrl}" alt="Foto do reporte mais recente" style="width:100%;max-width:220px;border-radius:8px;margin-top:6px" />`
                : ""
            }`,
          )
          .addTo(group);
      }
      group.addTo(mapRef.current);
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

  useEffect(() => {
    let cancelled = false;
    loadProfile();
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: false }).setView(
        [coordsRef.current.lat, coordsRef.current.lng],
        15,
      );
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      refresh();

      if (navigator.geolocation) {
        setCepLoading(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            coordsRef.current = c;
            setCoords(c);
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
          { timeout: 8000 },
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
        lat: cepInfo?.lat ?? coords.lat,
        lng: cepInfo?.lng ?? coords.lng,
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
      await Promise.all([refresh(), loadProfile()]);
    } catch {
      setToast("Não foi possível enviar o reporte. Tente novamente.");
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
    const lat = (cepInfo?.lat ?? coords.lat).toFixed(5);
    const lng = (cepInfo?.lng ?? coords.lng).toFixed(5);
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
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_color: id })
      .eq("id", userId);
    setAvatarSaving(false);
    if (!error) {
      setProfile((p) => (p ? { ...p, avatar_color: id } : p));
      setToast("Avatar atualizado!");
      setTimeout(() => setToast(null), 2500);
    }
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
            <div ref={mapEl} className="h-[52vh] min-h-[320px] w-full" />
          </div>

          <div className="flex flex-wrap gap-3 pb-2 text-sm font-bold">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-4 w-4 rounded-full"
                style={{ background: "#FF9800" }}
              />
              Menos de {CRITICAL_CLUSTER_COUNT} reportes
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
          className="fixed bottom-24 right-4 z-[1550] min-h-[64px] rounded-2xl bg-danger px-6 text-lg font-black uppercase text-foreground shadow-2xl"
        >
          + Reportar Alagamento
        </button>

        {toast && (
          <div className="fixed bottom-44 left-1/2 z-[1700] w-[90%] max-w-sm -translate-x-1/2 rounded-xl border-2 border-accent bg-card p-4 text-center text-base font-bold text-accent">
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
                Cores desbloqueadas conforme você acumula pontos reportando alagamentos. Você
                tem {profile?.points ?? 0} pts.
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

              {step === 1 && (
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

              {step === 2 && (
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

              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">3. Foto do local (obrigatória)</p>
                  <p className="text-sm text-muted-foreground">
                    A foto ajuda a comunidade a confirmar o reporte. Tire uma foto do
                    alagamento ou envie uma da galeria.
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

                  {photoError && (
                    <p className="text-sm font-bold text-danger">{photoError}</p>
                  )}

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

              {step > 1 && (
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
