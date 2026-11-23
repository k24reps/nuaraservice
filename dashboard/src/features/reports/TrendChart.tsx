import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmtRp, fmtRpCompact } from '@/lib/format';
import { trendGeometry, type TrendPoint } from '@/lib/business/reports';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

const AXIS_LABEL = 'fill-muted-foreground font-mono text-xs';
const SWATCH = 'h-[3px] w-3.5 rounded-full';
const LINE = { strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

interface TrendChartProps {
  points: TrendPoint[];
}

/**
 * Grafik garis ganda (pemasukan vs pengeluaran) SVG murni dengan garis bidik
 * saat disorot. Tanpa pustaka grafik supaya bundel tetap ramping. viewBox selebar
 * wadahnya yang terukur,
 * bukan 720 tetap: dulu SVG diskalakan turun, dan label sumbu di ponsel
 * tinggal ±5px (diukur 7px tinggi kotaknya di 390px).
 *
 * Geometrinya datang dari `trendGeometry`, yang juga dipakai grafik di laporan
 * PDF — supaya keduanya tidak bisa menggambar bentuk yang berbeda.
 */
export function TrendChart({ points }: TrendChartProps) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const hasPoints = points.length > 0;
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setMeasured(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasPoints]);
  const width = measured > 0 ? measured : undefined;
  // Grafik sempit dibuat sedikit lebih pendek supaya tidak menjadi menara.
  const height = measured > 0 && measured < 480 ? 200 : undefined;
  const g = useMemo(() => trendGeometry(points, { width, height }), [points, width, height]);

  if (points.length === 0) return null;

  const { width: W, height: H, pad: PAD, plotW, plotH, x, y: yInc } = g;
  const yExp = yInc;
  // Compact gridline labels ("2,45 jt") — full "Rp 2.450.000" overflows
  // PAD.left and renders clipped.
  const gridYs = g.gridYs.map((row) => ({ y: row.y, label: fmtRpCompact(row.value) }));

  const active = hover != null ? points[hover] : null;
  // Ringkasan untuk pembaca layar: role="img" dengan judul saja tidak
  // menyampaikan satu angka pun dari grafik.
  const past = points.filter((p) => !p.future);
  const peak = past.reduce((best, p) => (p.income > best.income ? p : best), past[0] ?? points[0]);
  const summary = interpolate(t('reports.chartSummary'), {
    income: fmtRp(past.reduce((sum, p) => sum + p.income, 0)),
    expense: fmtRp(past.reduce((sum, p) => sum + p.expense, 0)),
    peak: fmtRp(peak.income),
    label: peak.label,
  });

  return (
    <div className="flex flex-col gap-3" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${t('reports.chartAria')}. ${summary}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        {/* Gridlines + y labels */}
        {gridYs.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} strokeWidth={1} className="stroke-border" />
            <text x={PAD.left - 8} y={g.y + 3} className={AXIS_LABEL} textAnchor="end">
              {g.label}
            </text>
          </g>
        ))}

        {/* x labels */}
        {g.xLabels.map((l) => (
          <text key={l.x} x={l.x} y={H - 8} className={AXIS_LABEL} textAnchor="middle">
            {l.label}
          </text>
        ))}

        {/* Hari yang belum terjadi: diarsir, bukan digambar sebagai nol. */}
        {g.nowX != null && (
          <g>
            <rect
              x={g.nowX}
              y={PAD.top}
              width={W - PAD.right - g.nowX}
              height={plotH}
              className="fill-secondary opacity-60"
            />
            <line x1={g.nowX} y1={PAD.top} x2={g.nowX} y2={PAD.top + plotH} strokeWidth={1} strokeDasharray="2 3" className="stroke-muted-foreground/60" />
          </g>
        )}

        {/* Area under income for depth */}
        <path d={g.incArea} className="fill-success" />

        {/* Lines */}
        {/* Pengeluaran = garis putus tinta kedua, bukan merah: arus keluar rutin
            bukan kegagalan, dan garis putus sudah membedakan seri tanpa warna. */}
        <path d={g.expPath} {...LINE} strokeWidth={2} strokeDasharray="4 3" className="stroke-muted-foreground" fill="none" />
        <path d={g.incPath} {...LINE} strokeWidth={2.5} className="stroke-success-foreground" fill="none" />

        {/* Hover hit areas + crosshair */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (plotW / Math.max(1, points.length)) / 2}
            y={PAD.top}
            width={plotW / Math.max(1, points.length)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {active && hover != null && (
          <g>
            <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + plotH} strokeWidth={1} strokeDasharray="3 3" className="stroke-muted-foreground/60" />
            {!active.future && (
              <>
                <circle cx={x(hover)} cy={yInc(active.income)} r={4} strokeWidth={2} className="fill-success-foreground stroke-card" />
                <circle cx={x(hover)} cy={yExp(active.expense)} r={4} strokeWidth={2} className="fill-muted-foreground stroke-card" />
              </>
            )}
          </g>
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <i className={`${SWATCH} bg-success-foreground`} /> {t('reports.pemasukan')}
        </span>
        <span className="inline-flex items-center gap-2">
          <i className={`${SWATCH} bg-muted-foreground`} /> {t('reports.pengeluaran')}
        </span>
        {g.nowX != null && (
          <span className="inline-flex items-center gap-2">
            <i className="h-2.5 w-3.5 rounded-xs border border-dashed border-muted-foreground/60 bg-secondary" /> {t('reports.chartFuture')}
          </span>
        )}
        {active && (
          <span className="ml-auto font-mono text-xs tabular-nums">
            {active.label}:{' '}
            {active.future ? (
              t('reports.chartFuture')
            ) : (
              <>
                <strong className="text-success-foreground">{fmtRp(active.income)}</strong> ·{' '}
                <strong className="text-foreground">{fmtRp(active.expense)}</strong>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
