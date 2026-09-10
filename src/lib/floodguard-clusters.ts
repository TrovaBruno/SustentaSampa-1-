export type ReportPoint = {
  id: string;
  lat: number;
  lng: number;
  weight: number;
  created_at: string;
  cep?: string | null;
  photo_url?: string | null;
  trafficability?: string | null;
  water_level?: string | null;
};

export type Cluster = {
  key: string;
  lat: number;
  lng: number;
  count: number;
  weight: number;
  /** CEP predominante da região, quando disponível */
  cep: string | null;
  /** foto do reporte mais recente da região (usada como miniatura no mapa) */
  photoUrl: string | null;
  /** todos os reportes dessa região, do mais recente para o mais antigo */
  reports: ReportPoint[];
  /** true quando 10 ou mais reportes na mesma região → vermelho piscando */
  critical: boolean;
};

/** Tamanho da célula da grade em graus (~550 m). */
const CELL = 0.005;

/** Limite de reportes na mesma região para virar vermelho piscante. */
export const CRITICAL_CLUSTER_COUNT = 10;

/** Agrupa reportes por CEP (ou por região da grade quando não há CEP). */
export function clusterReports(points: ReportPoint[]): Cluster[] {
  const cells = new Map<
    string,
    {
      lat: number;
      lng: number;
      count: number;
      weight: number;
      ceps: Map<string, number>;
      reports: ReportPoint[];
    }
  >();
  for (const p of points) {
    const key = p.cep
      ? `cep:${p.cep}`
      : `${Math.round(p.lat / CELL)}:${Math.round(p.lng / CELL)}`;
    const cur =
      cells.get(key) ?? {
        lat: 0,
        lng: 0,
        count: 0,
        weight: 0,
        ceps: new Map<string, number>(),
        reports: [] as ReportPoint[],
      };
    cur.lat += p.lat;
    cur.lng += p.lng;
    cur.count += 1;
    cur.weight += p.weight;
    if (p.cep) cur.ceps.set(p.cep, (cur.ceps.get(p.cep) ?? 0) + 1);
    cur.reports.push(p);
    cells.set(key, cur);
  }
  return Array.from(cells.entries()).map(([key, c]) => {
    const sortedReports = c.reports
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return {
      key,
      lat: c.lat / c.count,
      lng: c.lng / c.count,
      count: c.count,
      weight: Number((c.weight / c.count).toFixed(2)),
      cep: Array.from(c.ceps.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      photoUrl: sortedReports.find((r) => r.photo_url)?.photo_url ?? null,
      reports: sortedReports,
      critical: c.count >= CRITICAL_CLUSTER_COUNT,
    };
  });
}

/** ISO do instante 24 h atrás — reportes mais antigos somem do mapa. */
export function since24hISO(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
