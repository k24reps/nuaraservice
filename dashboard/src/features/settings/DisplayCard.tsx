import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { DensitySwitch, ZoomGauge } from '@/components/layout/DisplayControls';
import { usePointerFine } from '@/components/layout/zoomDisplay';
import { useT } from '@/i18n';
import { useZoomStore } from '@/stores/zoom';
import { SettingsCard } from './settingsUi';

/**
 * Pengaturan › Sistem › Tampilan: dua kenop yang terpisah, Pembesaran dan
 * Kerapatan (stores/zoom.ts). Untuk semua peran — setelan ini milik perangkat,
 * bukan usaha, jadi tidak tersinkron dan tidak butuh izin owner.
 */
export function DisplayCard() {
  const t = useT();
  const zoom = useZoomStore((s) => s.zoom);
  const resetZoom = useZoomStore((s) => s.resetZoom);
  const pointerFine = usePointerFine();

  return (
    <SettingsCard icon={<SlidersHorizontal aria-hidden />} title={t('display.title')}>
      {/* Dua kenop berdampingan seperti dua instrumen di satu panel, dan menumpuk saat
          kartunya sendiri sempit. Ambang = dua kolom yang masing-masing masih memuat dua
          sel Kerapatan (2 x 190px + celah) plus padding kartu. */}
      <div className="@container/display">
        <div className="grid gap-6 @min-[900px]/display:grid-cols-2 @min-[900px]/display:gap-0">
          <section className="flex min-w-0 flex-col gap-4 @min-[900px]/display:pr-6" aria-labelledby="display-zoom">
            <div className="grid gap-1">
              <h3 id="display-zoom" className="text-base font-semibold">
                {t('display.zoom.title')}
              </h3>
              <p className="max-w-[60ch] text-sm leading-normal text-muted-foreground">{t('display.zoom.hint')}</p>
            </div>
            <ZoomGauge />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {pointerFine && (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="sr-only">{t('display.zoom.shortcut')}: </span>
                  <kbd className={KBD}>Ctrl</kbd>
                  <kbd className={KBD}>Alt</kbd>
                  <span className="inline-flex gap-1 border-l border-dashed border-border pl-1.5" aria-hidden>
                    <kbd className={KBD}>=</kbd>
                    <kbd className={KBD}>−</kbd>
                    <kbd className={KBD}>0</kbd>
                  </span>
                  <span className="sr-only">= − 0</span>
                </span>
              )}
              {/* aria-disabled, bukan disabled: tombol yang baru diklik lalu jadi disabled
                  melempar fokus keyboard ke body. */}
              <Button
                variant="outline"
                size="sm"
                className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                onClick={() => zoom !== 1 && resetZoom()}
                aria-disabled={zoom === 1 || undefined}
              >
                <RotateCcw aria-hidden />
                {t('display.zoom.reset')}
              </Button>
            </div>
          </section>

          <section
            className="flex min-w-0 flex-col gap-4 border-t border-dashed border-border pt-5 @min-[900px]/display:border-t-0 @min-[900px]/display:border-l @min-[900px]/display:pt-0 @min-[900px]/display:pl-6"
            aria-labelledby="display-density"
          >
            <div className="grid gap-1">
              <h3 id="display-density" className="text-base font-semibold">
                {t('display.density.title')}
              </h3>
              <p className="max-w-[60ch] text-sm leading-normal text-muted-foreground">{t('display.density.hint')}</p>
            </div>
            <DensitySwitch />
            {!pointerFine && <p className="text-sm leading-normal text-muted-foreground">{t('display.density.touch')}</p>}
          </section>
        </div>

        <p className="mt-5 border-t border-dashed border-border pt-4 text-sm leading-normal text-muted-foreground">
          {t('display.deviceNote')}
        </p>
      </div>
    </SettingsCard>
  );
}

// Tuts mekanis kecil, pola yang sama dengan petunjuk "/" di Kasir.
const KBD =
  'inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-md border border-b-[3px] border-border bg-surface px-1.5 font-mono text-xs text-muted-foreground';
