import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useT } from '@/i18n';
import type { TermId } from '@/features/glossary/terms';

/**
 * Istilah akuntansi yang bisa diklik: garis bawah titik + ⓘ kecil, membuka
 * entrinya di Kamus Istilah (/istilah#id). Jangan dipakai di dalam tautan lain
 * (anchor bersarang tidak sah) — beri tautan "?" di sebelahnya saja.
 *
 * Warna teks tetap milik induknya (label mono, judul, readout gelap); hanya
 * garis titik dan ⓘ yang menandai ada penjelasannya. Istilah duduk di dalam
 * label dan judul, jadi tingginya mengikuti baris teks; di layar sentuh area
 * ketuk 44px diperluas lewat ::after supaya label tidak ikut meninggi.
 */
export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const t = useT();
  return (
    <Link
      to={`/istilah#${id}`}
      className="group/term relative text-inherit underline decoration-1 decoration-dotted underline-offset-[3px] [text-decoration-color:color-mix(in_srgb,currentColor_45%,transparent)] outline-none hover:text-inherit hover:[text-decoration-color:currentColor] focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3.5 pointer-coarse:after:content-['']"
    >
      {children}
      <Info
        aria-hidden
        className="ml-[3px] inline-block size-[0.8em] align-[0.05em] opacity-60 group-hover/term:opacity-100"
      />
      <span className="sr-only">{`, ${t('glossary.explain')}`}</span>
    </Link>
  );
}
