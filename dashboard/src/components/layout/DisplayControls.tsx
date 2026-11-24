import { useRef, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import {
  DENSITIES,
  isBelowTextFloor,
  useZoomStore,
  ZOOM_LEVELS,
  type Density,
} from '@/stores/zoom';
import { usePointerFine, zoomPercent, zoomTone } from './zoomDisplay';

/**
 * Kontrol dua kenop tampilan (lihat stores/zoom.ts). Dipakai di Pengaturan ›
 * Sistem › Tampilan (gauge lengkap) dan menu Lainnya di ponsel (stepper).
 */

/** Roving focus untuk radiogroup: panah, Home, End. */
function radioStep(key: string, index: number, last: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return Math.min(last, index + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return Math.max(0, index - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/** Titik dan teks rona: hijau di 100%, navy saat diperbesar, jingga saat teks jatuh di bawah lantai 12px. */
const TONE_DOT = { nominal: 'bg-success-foreground', up: 'bg-primary', below: 'bg-highlight' } as const;
const TONE_TEXT = { nominal: 'text-success-foreground', up: 'text-primary', below: 'text-warning-foreground' } as const;

/**
 * Pembesaran: lima pilihan 90·100·110·125·150 dalam satu rel. Readout besar di
 * atasnya selalu menyebut keadaan (standar, diperbesar, atau di bawah lantai
 * teks), bukan hanya angka.
 */
export function ZoomGauge() {
  const t = useT();
  const zoom = useZoomStore((s) => s.zoom);
  const setZoom = useZoomStore((s) => s.setZoom);
  const ticks = useRef<(HTMLButtonElement | null)[]>([]);
  const tone = zoomTone(zoom);
  const index = ZOOM_LEVELS.indexOf(zoom);
  const toneLabel =
    tone === 'below'
      ? t('display.zoom.belowFloor')
      : tone === 'nominal'
        ? t('display.zoom.standard')
        : t('display.zoom.magnified');

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = radioStep(e.key, index, ZOOM_LEVELS.length - 1);
    if (next === null) return;
    e.preventDefault();
    setZoom(ZOOM_LEVELS[next]);
    ticks.current[next]?.focus();
  };

  return (
    <div data-tone={tone} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-2.5 font-mono text-3xl leading-none font-bold tabular-nums">
          <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', TONE_DOT[tone])} />
          {zoomPercent(zoom)}
        </span>
        <span className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{toneLabel}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('display.zoom.title')}
        className="grid grid-cols-[repeat(5,minmax(44px,1fr))] gap-1 rounded-full bg-muted p-1"
        onKeyDown={onKeyDown}
      >
        {ZOOM_LEVELS.map((level, i) => {
          const checked = level === zoom;
          return (
            <button
              key={level}
              ref={(el) => {
                ticks.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={level === 1 ? `100% · ${t('display.zoom.standard')}` : zoomPercent(level)}
              tabIndex={checked ? 0 : -1}
              data-below={isBelowTextFloor(level) || undefined}
              className="grid min-h-11 place-items-center rounded-full font-mono text-sm tabular-nums text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-card aria-checked:font-bold aria-checked:text-foreground aria-checked:shadow-sm data-[below]:text-warning-foreground"
              onClick={() => setZoom(level)}
            >
              <span aria-hidden>{Math.round(level * 100)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pilihan kerapatan: dua kartu pilihan. Padat terkunci di layar sentuh. */
export function DensitySwitch() {
  const t = useT();
  const density = useZoomStore((s) => s.density);
  const setDensity = useZoomStore((s) => s.setDensity);
  const pointerFine = usePointerFine();
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const index = DENSITIES.indexOf(density);
  const available = (d: Density) => d === 'lapang' || pointerFine;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = radioStep(e.key, index, DENSITIES.length - 1);
    if (next === null) return;
    e.preventDefault();
    if (!available(DENSITIES[next])) return;
    setDensity(DENSITIES[next]);
    cells.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('display.density.title')}
      // Menumpuk sendiri saat kartu sempit, tanpa breakpoint.
      className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-2"
      onKeyDown={onKeyDown}
    >
      {DENSITIES.map((d, i) => {
        const checked = d === density;
        const enabled = available(d);
        return (
          <button
            key={d}
            ref={(el) => {
              cells.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={!enabled || undefined}
            tabIndex={checked ? 0 : -1}
            className="grid min-h-11 gap-1 rounded-xl px-4 py-3 text-left ring-1 ring-border outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-soft/40 aria-checked:ring-2 aria-checked:ring-primary/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
            onClick={() => enabled && setDensity(d)}
          >
            <span className="text-sm font-semibold">
              {t(d === 'lapang' ? 'display.density.lapang' : 'display.density.padat')}
            </span>
            <span className="text-sm leading-normal text-muted-foreground">
              {t(d === 'lapang' ? 'display.density.lapangHint' : 'display.density.padatHint')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Stepper ringkas untuk menu Lainnya: − / readout / +. Readout menjadi tombol
 * "kembali ke 100%" saat tidak standar. Ujung rentang memakai aria-disabled,
 * bukan disabled, supaya fokus keyboard tidak terlempar ke body.
 */
export function ZoomStepper() {
  const t = useT();
  const zoom = useZoomStore((s) => s.zoom);
  const stepZoom = useZoomStore((s) => s.stepZoom);
  const resetZoom = useZoomStore((s) => s.resetZoom);
  const atMin = zoom === ZOOM_LEVELS[0];
  const atMax = zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const pct = zoomPercent(zoom);
  const tone = zoomTone(zoom);
  const stepClass = 'size-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-45';

  return (
    <div
      data-tone={tone}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface py-1 pl-3 pr-1 ring-1 ring-border/70"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            tone === 'below' ? 'bg-highlight' : tone === 'up' ? 'bg-primary' : 'bg-success-foreground',
          )}
        />
        {t('display.zoom.title')}
      </span>
      <div className="flex items-center gap-1" role="group" aria-label={t('display.zoom.title')}>
        <Button
          variant="outline"
          size="icon"
          className={stepClass}
          aria-label={t('display.zoom.out')}
          aria-disabled={atMin || undefined}
          onClick={() => !atMin && stepZoom(-1)}
        >
          <Minus />
        </Button>
        {zoom === 1 ? (
          <span className="grid h-11 min-w-16 place-items-center font-mono text-sm font-semibold tabular-nums">{pct}</span>
        ) : (
          <Button
            variant="ghost"
            className="h-11 min-w-16 px-2 font-mono tabular-nums"
            aria-label={`${pct}. ${t('display.zoom.reset')}`}
            title={t('display.zoom.reset')}
            onClick={resetZoom}
          >
            {pct}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className={stepClass}
          aria-label={t('display.zoom.in')}
          aria-disabled={atMax || undefined}
          onClick={() => !atMax && stepZoom(1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

/**
 * Pengumuman perubahan pembesaran untuk pembaca layar. Satu-satunya live
 * region pembesaran: gauge, stepper, chip, dan pintasan keyboard semuanya
 * lewat sini supaya tidak terbaca dua kali. Isi awal tidak diumumkan.
 */
export function ZoomAnnouncer() {
  const t = useT();
  const zoom = useZoomStore((s) => s.zoom);
  return (
    <span className="sr-only" aria-live="polite">
      {`${t('display.zoom.title')} ${zoomPercent(zoom)}`}
    </span>
  );
}
