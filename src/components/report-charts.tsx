import type { Bucket } from "@/lib/region-report";

/** Faixas do índice de risco (mesmos limites de riskLevelFromScore). */
const GAUGE_MAX = 5;
const SEGMENTS = [
  { from: 0, to: 0.8, color: "var(--risk-low)" },
  { from: 0.8, to: 2, color: "var(--risk-mid)" },
  { from: 2, to: 3.5, color: "var(--risk-high)" },
  { from: 3.5, to: GAUGE_MAX, color: "var(--risk-critical)" },
];

const polar = (cx: number, cy: number, r: number, v: number) => {
  const a = Math.PI * (1 - v / GAUGE_MAX);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
};

/** Velocímetro semicircular com o índice de risco do pior dia. */
export function RiskGauge({
  score,
  label,
  color,
}: {
  score: number;
  label: string;
  color: string;
}) {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const v = Math.min(score, GAUGE_MAX);
  const [nx, ny] = polar(cx, cy, r - 18, v);
  return (
    <svg
      viewBox="0 0 200 120"
      className="mx-auto w-full max-w-[260px]"
      role="img"
      aria-label={`Índice de risco ${score} (${label})`}
    >
      {SEGMENTS.map((seg) => {
        const [x1, y1] = polar(cx, cy, r, seg.from);
        const [x2, y2] = polar(cx, cy, r, seg.to);
        return (
          <path
            key={seg.from}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
            fill="none"
            strokeWidth={14}
            strokeLinecap="butt"
            style={{ stroke: seg.color }}
            opacity={0.9}
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        strokeWidth={4}
        strokeLinecap="round"
        style={{ stroke: "var(--foreground)" }}
      />
      <circle cx={cx} cy={cy} r={7} style={{ fill: "var(--foreground)" }} />
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fontSize={11}
        style={{ fill: "var(--muted-foreground)" }}
      >
        índice do pior dia: {score}
      </text>
      <text
        x={cx}
        y={cy - 28}
        textAnchor="middle"
        fontSize={20}
        fontWeight={900}
        style={{ fill: color }}
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * Barras compactas. Com `labeled`, cada barra tem seu rótulo e o valor acima
 * (semana, mês, ano); sem ele (24 horas), só o máximo e três rótulos de tempo.
 */
export function TimelineChart({
  buckets,
  color,
  labeled,
}: {
  buckets: Bucket[];
  color: string;
  labeled: boolean;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const last = buckets.length - 1;
  const mid = Math.floor(last / 2);

  if (labeled) {
    return (
      <div role="img" aria-label="Reportes ao longo do período">
        <div className="flex h-24 items-end gap-1 border-b border-border">
          {buckets.map((b, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-bold">{b.count > 0 ? b.count : ""}</span>
              <div
                title={`${b.label}: ${b.count} reporte(s)`}
                className="w-full max-w-14 rounded-t-sm"
                style={{
                  height: b.count === 0 ? "2px" : `${Math.max(8, (b.count / max) * 70)}%`,
                  backgroundColor: b.count === 0 ? "var(--muted)" : color,
                  opacity: b.count === 0 ? 0.6 : 0.75,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {buckets.map((b, i) => (
            <span key={i} className="flex-1 truncate text-center text-[10px] text-muted-foreground">
              {b.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div role="img" aria-label="Reportes ao longo do período">
      <div className="relative h-20 border-b border-border">
        <span className="absolute left-0 top-0 text-[10px] text-muted-foreground">máx. {max}</span>
        <div className="flex h-full items-end gap-[3px]">
          {buckets.map((b, i) => (
            <div
              key={i}
              title={`${b.label}: ${b.count} reporte(s)`}
              className="flex-1 rounded-t-sm"
              style={{
                height: b.count === 0 ? "2px" : `${Math.max(8, (b.count / max) * 100)}%`,
                backgroundColor: b.count === 0 ? "var(--muted)" : color,
                opacity: b.count === 0 ? 0.6 : 0.75,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[mid]?.label}</span>
        <span>{buckets[last]?.label}</span>
      </div>
    </div>
  );
}

/** Rosca com legenda: distribuição de uma categoria. */
export function Donut({
  items,
  total,
  centerLabel,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        className="h-28 w-28 shrink-0 -rotate-90"
        role="img"
        aria-label={centerLabel}
      >
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          strokeWidth={14}
          style={{ stroke: "var(--muted)" }}
        />
        {total > 0 &&
          items.map((it) => {
            const len = (it.value / total) * C;
            const el = (
              <circle
                key={it.label}
                cx={50}
                cy={50}
                r={R}
                fill="none"
                strokeWidth={14}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                style={{ stroke: it.color }}
              />
            );
            offset += len;
            return el;
          })}
        <text
          x={50}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={22}
          fontWeight={900}
          transform="rotate(90 50 50)"
          style={{ fill: "var(--foreground)" }}
        >
          {total}
        </text>
      </svg>
      <ul className="flex-1 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: it.color }}
              />
              {it.label}
            </span>
            <span className="font-bold">
              {it.value}
              {total > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({Math.round((it.value / total) * 100)}%)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mapa de calor por hora do dia (24 células). */
export function HourStrip({ hours, color }: { hours: number[]; color: string }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div className="grid grid-cols-12 gap-1">
        {hours.map((n, h) => (
          <div
            key={h}
            title={`${String(h).padStart(2, "0")}h: ${n}`}
            className="flex h-9 items-center justify-center rounded-md text-[10px] font-bold"
            style={{
              backgroundColor: n === 0 ? "var(--muted)" : color,
              opacity: n === 0 ? 0.5 : 0.35 + 0.65 * (n / max),
              color: n === 0 ? "var(--muted-foreground)" : "var(--background)",
            }}
          >
            {String(h).padStart(2, "0")}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cor mais forte = mais reportes naquela hora do dia.
      </p>
    </div>
  );
}
