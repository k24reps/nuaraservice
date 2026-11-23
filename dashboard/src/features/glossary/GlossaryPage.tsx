import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { GLOSSARY } from './terms';

/**
 * Kamus Istilah — lembar data istilah akuntansi yang dipakai aplikasi.
 * Tidak di sidebar: dibuka dari istilah bergaris titik (komponen `Term`) dan
 * tombol "Kamus istilah" di Laporan & Keuangan, sehingga selalu muncul di
 * konteks istilahnya. Terbuka untuk semua peran — tidak memuat angka toko.
 */
export function GlossaryPage() {
  const t = useT();
  const { hash } = useLocation();
  const active = hash.slice(1);

  // AppLayout mengembalikan scroll ke atas saat path berganti; anchor ditangani di sini.
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById(active);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.querySelector('h2')?.focus({ preventScroll: true });
  }, [active]);

  return (
    <div data-nu className="@container/glossary flex max-w-[64rem] flex-col gap-4 bg-transparent">
      <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{t('glossary.lead')}</p>
      {/* Indeks = daftar isi, dibaca ke bawah per kolom. 17rem = istilah terpanjang
          ("HPP (Harga Pokok / Harga Modal)", terukur ±270px) tetap satu baris. Di
          bawah tiga kolom (3 x 17rem + 2 jarak) indeks jadi satu baris geser: dua
          kolom pun masih 7 baris, dan satu baris mengembalikan istilah pertama ke
          layar pertama. */}
      <nav className={INDEX} aria-label={t('glossary.indexAria')}>
        {GLOSSARY.map((g, i) => (
          <Link
            key={g.id}
            to={`#${g.id}`}
            className={CHIP}
            aria-current={active === g.id ? 'location' : undefined}
          >
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground group-aria-[current=location]/chip:text-inherit" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            {g.term}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] gap-3">
        {GLOSSARY.map((g, i) => (
          <article
            key={g.id}
            id={g.id}
            className={cn(
              // Topbar menempel (+ bar demo) menutupi judul kartu bila anchor mendarat tepat di atas.
              'flex scroll-mt-36 flex-col gap-2 rounded-2xl bg-card p-4 text-card-foreground shadow-panel ring-1 ring-border/60',
              // Istilah yang dibuka dari layar: bingkai menyala.
              active === g.id && 'ring-2 ring-primary',
            )}
            aria-labelledby={`${g.id}-title`}
          >
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 id={`${g.id}-title`} className="text-lg leading-snug font-semibold outline-none" tabIndex={-1}>
                {g.term}
              </h2>
            </header>
            <p className="leading-normal font-semibold">{g.short}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{g.body}</p>
            {g.formula && (
              <div className={BLOCK}>
                <span className={KEY}>{t('glossary.formula')}</span>
                <code className="rounded-lg bg-secondary px-2.5 py-1.5 font-mono text-sm text-secondary-foreground [overflow-wrap:anywhere]">
                  {g.formula}
                </code>
              </div>
            )}
            <div className={BLOCK}>
              <span className={KEY}>{t('glossary.example')}</span>
              <p className="text-sm leading-relaxed">{g.example}</p>
            </div>
            <div className={`${BLOCK} flex-row flex-wrap items-center gap-x-3 gap-y-1.5`}>
              <span className={`${KEY} basis-full`}>{t('glossary.seenIn')}</span>
              {g.seenIn.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&>svg]:size-3.5"
                >
                  {s.label}
                  <ArrowRight aria-hidden />
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const INDEX = [
  'columns-[17rem] gap-x-5 border-b border-dashed border-border pb-3',
  '@max-[54rem]/glossary:flex @max-[54rem]/glossary:columns-auto @max-[54rem]/glossary:gap-1.5 @max-[54rem]/glossary:overflow-x-auto',
  '@max-[54rem]/glossary:p-0.5 @max-[54rem]/glossary:pb-3 @max-[54rem]/glossary:[scrollbar-width:none] @max-[54rem]/glossary:scroll-fade-x',
].join(' ');
const CHIP = [
  'group/chip flex items-baseline gap-2 break-inside-avoid rounded-md px-1.5 py-1 text-xs text-muted-foreground no-underline outline-none',
  'hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:py-3.5',
  'aria-[current=location]:bg-primary aria-[current=location]:text-primary-foreground',
  // Baris geser: chip bulat setinggi tombol.
  '@max-[54rem]/glossary:h-9 @max-[54rem]/glossary:shrink-0 @max-[54rem]/glossary:items-center @max-[54rem]/glossary:rounded-full',
  '@max-[54rem]/glossary:bg-card @max-[54rem]/glossary:px-3 @max-[54rem]/glossary:whitespace-nowrap @max-[54rem]/glossary:text-foreground @max-[54rem]/glossary:ring-1 @max-[54rem]/glossary:ring-border',
  '@max-[54rem]/glossary:pointer-coarse:h-11 @max-[54rem]/glossary:pointer-coarse:py-0',
  // Varian container datang sesudah aria-* di CSS, jadi chip aktif perlu varian gabungan.
  '@max-[54rem]/glossary:aria-[current=location]:bg-primary @max-[54rem]/glossary:aria-[current=location]:text-primary-foreground @max-[54rem]/glossary:aria-[current=location]:ring-primary',
].join(' ');
const BLOCK = 'flex flex-col gap-1 border-t border-dashed border-border pt-2';
const KEY = 'text-xs font-medium text-muted-foreground';
