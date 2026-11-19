import { PERIODS, type RegionReport } from "./region-report";

export type NearbyRiver = { nome: string; rio_bacia: string | null; distanceKm: number };

export type ReportPdfInput = {
  regionName: string;
  radiusKm: number;
  report: RegionReport;
  rivers: NearbyRiver[];
  generatedAt: Date;
};

type RGB = [number, number, number];

const LEVEL_RGB: Record<string, RGB> = {
  Baixo: [46, 160, 67],
  Médio: [214, 168, 0],
  Alto: [219, 109, 24],
  Crítico: [207, 34, 46],
};
const GREEN: RGB = [46, 160, 67];
const ORANGE: RGB = [219, 109, 24];
const RED: RGB = [207, 34, 46];
const DARK: RGB = [38, 38, 38];
const YELLOW: RGB = [250, 204, 21];
const GREY: RGB = [110, 110, 110];
const LIGHT: RGB = [244, 244, 244];

/** Gera e baixa o relatório da região em PDF (jsPDF é carregado só quando o usuário exporta). */
export async function exportReportPdf(input: ReportPdfInput): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { regionName, radiusKm, report: r, rivers, generatedAt } = input;
  const period = PERIODS.find((p) => p.id === r.period);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  const CW = W - 2 * M;
  const rgb = LEVEL_RGB[r.level] ?? GREY;
  let y = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const ensure = (h: number) => {
    if (y + h > 272) {
      doc.addPage();
      y = 16;
    }
  };
  const section = (title: string) => {
    ensure(14);
    fill(rgb);
    doc.rect(M, y - 4.5, 1.6, 6.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(12.5);
    ink(DARK);
    doc.text(title, M + 4, y);
    y += 7;
  };
  const text = (t: string, size = 10, color: RGB = [60, 60, 60]) => {
    doc.setFont("helvetica", "normal").setFontSize(size);
    ink(color);
    for (const l of doc.splitTextToSize(t, CW) as string[]) {
      ensure(6);
      doc.text(l, M, y);
      y += 5.2;
    }
  };

  // Faixa de cabeçalho
  fill(DARK);
  doc.rect(0, 0, W, 30, "F");
  fill(YELLOW);
  doc.rect(0, 30, W, 1.6, "F");
  doc.setFont("helvetica", "bold").setFontSize(22);
  ink(YELLOW);
  doc.text("SustentaSampa", M, 13);
  doc.setFont("helvetica", "normal").setFontSize(11);
  ink([230, 230, 230]);
  doc.text("Relatório de alagamentos por região", M, 20);
  doc.setFontSize(8.5);
  ink([170, 170, 170]);
  doc.text(
    `Gerado em ${generatedAt.toLocaleString("pt-BR")} · Período: ${period?.long ?? ""}`,
    M,
    26,
  );
  y = 41;

  // Região
  doc.setFont("helvetica", "bold").setFontSize(16);
  ink(DARK);
  doc.text(regionName, M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(10);
  ink(GREY);
  doc.text(`Raio de análise: ${radiusKm < 1 ? `${radiusKm * 1000} m` : `${radiusKm} km`}`, M, y);
  y += 6;

  // Veredito
  fill(rgb);
  doc.roundedRect(M, y, CW, 26, 3, 3, "F");
  doc.setFont("helvetica", "bold").setFontSize(16);
  ink([255, 255, 255]);
  doc.text(
    r.isRiskZone ? `ZONA DE RISCO · ${r.level.toUpperCase()}` : `RISCO ${r.level.toUpperCase()}`,
    M + 6,
    y + 10,
  );
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  doc.text(doc.splitTextToSize(r.summary, CW - 12) as string[], M + 6, y + 17);
  y += 34;

  // Indicadores (4 caixas)
  const kpis: [string, string, string][] = [
    ["REPORTES NO PERÍODO", String(r.total), `${r.withPhoto} com foto`],
    ["HORÁRIO DE PICO", r.peakHour === null ? "—" : `${String(r.peakHour).padStart(2, "0")}h`, ""],
  ];
  const gap = 3;
  const kw = (CW - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([label, value, sub], i) => {
    const x = M + i * (kw + gap);
    fill(LIGHT);
    doc.roundedRect(x, y, kw, 24, 2, 2, "F");
    fill(rgb);
    doc.rect(x, y, kw, 1.4, "F");
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    ink(GREY);
    doc.text(label, x + 3, y + 7);
    doc.setFontSize(18);
    ink(DARK);
    doc.text(value, x + 3, y + 15);
    doc.setFont("helvetica", "normal").setFontSize(7);
    ink(GREY);
    doc.text(sub, x + 3, y + 20.5);
  });
  y += 32;

  // Gráfico de barras
  section("Reportes ao longo do período");
  ensure(52);
  const chartH = 30;
  const labelW = 6;
  const plotW = CW - labelW;
  const max = Math.max(1, ...r.buckets.map((b) => b.count));
  const bw = plotW / r.buckets.length;
  doc.setDrawColor(215, 215, 215).setLineWidth(0.2);
  for (const g of [0, 0.5, 1]) {
    const gy = y + chartH * (1 - g);
    doc.line(M + labelW, gy, M + CW, gy);
    doc.setFont("helvetica", "normal").setFontSize(7);
    ink(GREY);
    doc.text(String(Math.round(max * g)), M + labelW - 1.5, gy + 1, { align: "right" });
  }
  fill(rgb);
  r.buckets.forEach((b, i) => {
    if (b.count === 0) return;
    const bh = Math.max(0.8, (b.count / max) * (chartH - 2));
    const barW = Math.min(bw * 0.72, 16);
    const bx = M + labelW + i * bw + (bw - barW) / 2;
    doc.roundedRect(bx, y + chartH - bh, barW, bh, 0.6, 0.6, "F");
    if (r.buckets.length <= 12) {
      doc.setFont("helvetica", "bold").setFontSize(7.5);
      ink(DARK);
      doc.text(String(b.count), bx + barW / 2, y + chartH - bh - 1, { align: "center" });
    }
  });
  doc.setFontSize(7);
  ink(GREY);
  const step = r.buckets.length <= 12 ? 1 : Math.ceil(r.buckets.length / 8);
  r.buckets.forEach((b, i) => {
    if (i % step === 0) {
      doc.text(b.label, M + labelW + i * bw + bw / 2, y + chartH + 4, { align: "center" });
    }
  });
  y += chartH + 12;

  // Barras horizontais coloridas
  const hbars = (title: string, items: [string, number, RGB][]) => {
    section(title);
    const tot = Math.max(1, ...items.map((i) => i[1]));
    for (const [label, value, color] of items) {
      ensure(9);
      doc.setFont("helvetica", "normal").setFontSize(9.5);
      ink([60, 60, 60]);
      doc.text(label, M, y + 3.4);
      fill([228, 228, 228]);
      doc.roundedRect(M + 42, y, CW - 62, 4.6, 2.3, 2.3, "F");
      if (value > 0) {
        fill(color);
        doc.roundedRect(M + 42, y, Math.max(3, ((CW - 62) * value) / tot), 4.6, 2.3, 2.3, "F");
      }
      doc.setFont("helvetica", "bold");
      ink(DARK);
      doc.text(String(value), M + CW, y + 3.6, { align: "right" });
      y += 7;
    }
    y += 2;
  };
  hbars("Transitabilidade", [
    ["Transitável", r.traffic.transitavel, GREEN],
    ["Só veículos altos", r.traffic.veiculos_altos, ORANGE],
    ["Intransitável", r.traffic.intransitavel, RED],
  ]);
  hbars("Nível da água", [
    ["Canela", r.water.canela, [120, 190, 235]],
    ["Joelho", r.water.joelho, [50, 125, 215]],
    ["Acima do capô", r.water.acima_capo, [70, 60, 170]],
  ]);

  // Rios próximos
  section("Rios próximos");
  if (rivers.length === 0) text("Nenhuma estação fluviométrica encontrada num raio de 15 km.");
  for (const rv of rivers) {
    ensure(10);
    fill(LIGHT);
    doc.roundedRect(M, y - 4, CW, 8.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    ink(DARK);
    doc.text(rv.nome, M + 3, y + 1);
    if (rv.rio_bacia) {
      doc.setFont("helvetica", "normal").setFontSize(8);
      ink(GREY);
      doc.text(rv.rio_bacia, M + 3 + doc.getTextWidth(rv.nome) + 3, y + 1);
    }
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    ink(DARK);
    doc.text(`${rv.distanceKm.toFixed(1)} km`, M + CW - 3, y + 1, { align: "right" });
    y += 10;
  }
  y += 4;

  // Aviso fixo no rodapé da última página
  const fy = 284;
  doc.setDrawColor(210, 210, 210).setLineWidth(0.3);
  doc.line(M, fy - 5, W - M, fy - 5);
  doc.setFont("helvetica", "italic").setFontSize(7.5);
  ink(GREY);
  let ly = fy;
  for (const l of doc.splitTextToSize(
    "Os dados vêm de reportes colaborativos de usuários do SustentaSampa e podem conter imprecisões. " +
      "O relatório não substitui os alertas oficiais da Defesa Civil (199) e do Corpo de Bombeiros (193).",
    CW,
  ) as string[]) {
    doc.text(l, M, ly);
    ly += 3.6;
  }

  const safe = regionName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`relatorio-${safe || "regiao"}-${r.period}.pdf`);
}
