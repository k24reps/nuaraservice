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
import styles from './DisplayControls.module.css';

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

/**
 * Gauge pembesaran: skala bertakik 90·100·110·125·150 dengan detent STANDAR di
 * 100 dan zona jingga di bawahnya (lantai teks). Readout mono besar di atasnya
 * selalu menyebut keadaan, bukan hanya angka.
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
    <div className={styles.gauge} data-tone={tone}>
      <div className={styles.readoutRow}>
        <span className={styles.readout}>
          <span className={styles.led} aria-hidden />
          {zoomPercent(zoom)}
        </span>
        <span className={styles.toneLabel}>{toneLabel}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('display.zoom.title')}
        className={styles.scale}
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
              aria-label={
                level === 1 ? `100% · ${t('display.zoom.standard')}` : zoomPercent(level)
              }
              tabIndex={checked ? 0 : -1}
              className={styles.tick}
              data-detent={level === 1 || undefined}
              data-below={isBelowTextFloor(level) || undefined}
              onClick={() => setZoom(level)}
            >
              <span className={styles.tickMark} aria-hidden />
              <span className={styles.tickLabel} aria-hidden>
                {Math.round(level * 100)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pilihan kerapatan: dua sel bertanda LED. Padat terkunci di layar sentuh. */
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
      className={styles.density}
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
            className={styles.densityCell}
            onClick={() => enabled && setDensity(d)}
          >
            <span className={styles.densityName}>
              <span className={styles.densityLed} aria-hidden />
              {t(d === 'lapang' ? 'display.density.lapang' : 'display.density.padat')}
            </span>
            <span className={styles.densityHint}>
              {t(
                d === 'lapang'
                  ? 'display.density.lapangHint'
                  : 'display.density.padatHint',
              )}
            </span>
            <span className={styles.densityGlyph} data-density={d} aria-hidden>
              <span />
              <span />
              <span />
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
    <span className="fm-visually-hidden" aria-live="polite">
      {`${t('display.zoom.title')} ${zoomPercent(zoom)}`}
    </span>
  );
}
