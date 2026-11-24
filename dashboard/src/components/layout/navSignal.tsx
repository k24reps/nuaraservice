import { cn } from '@/lib/utils';
import type { NavSignal } from '@/hooks/useNavSignals';

/*
 * Nada jumlah di menu (useNavSignals) ke warna DBD: merah lembut untuk yang
 * mendesak (stok habis, tugas terlambat), amber untuk yang perlu tindakan
 * (menunggu konfirmasi, stok menipis), biru info dan hijau untuk sisanya.
 */
const TONE_CLASS: Record<Exclude<NavSignal['tone'], 'idle'>, string> = {
  crit: 'bg-destructive-soft text-destructive',
  warn: 'bg-highlight text-highlight-foreground',
  info: 'bg-info text-info-foreground',
  good: 'bg-success text-success-foreground',
};

const DOT_CLASS: Record<Exclude<NavSignal['tone'], 'idle'>, string> = {
  crit: 'bg-destructive',
  warn: 'bg-highlight',
  info: 'bg-primary',
  good: 'bg-success-foreground',
};

/** Jumlah di samping label menu. Tidak tampil saat nadanya idle. */
export function NavCount({ signal, className }: { signal: NavSignal | undefined; className?: string }) {
  if (!signal || signal.tone === 'idle') return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-xs font-semibold tabular-nums',
        TONE_CLASS[signal.tone],
        className,
      )}
    >
      {signal.count}
    </span>
  );
}

/** Titik pengganti jumlah saat rail diciutkan; jumlahnya dibacakan lewat teks tersembunyi. */
export function NavDot({ signal, className }: { signal: NavSignal | undefined; className?: string }) {
  if (!signal || signal.tone === 'idle') return null;
  return (
    <>
      <span aria-hidden className={cn('size-2 rounded-full ring-2 ring-sidebar', DOT_CLASS[signal.tone], className)} />
      <span className="sr-only">{signal.count}</span>
    </>
  );
}
