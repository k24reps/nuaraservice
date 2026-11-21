import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bingkai layar sebelum aplikasi (masuk, daftar, reset password, PIN): logo
 * dan nama toko di atas satu kartu di tengah (keputusan P16.1). Tanpa panel
 * merek: alat internal, dibuka staf setiap hari.
 */
export function AuthShell({
  children,
  title,
  className,
}: {
  children: ReactNode;
  /** Nama di samping logo; bawaan "Nuara Service". */
  title?: string;
  className?: string;
}) {
  return (
    <div data-nu className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 compact:justify-start compact:pt-8">
      <div className="mb-6 flex items-center gap-3">
        <img
          src="/logo-mark.png"
          alt=""
          width="44"
          height="44"
          className="size-11 rounded-xl shadow-panel ring-1 ring-border/60"
        />
        <span className="text-lg font-semibold tracking-[-0.015em]">{title ?? 'Nuara Service'}</span>
      </div>
      <main
        className={cn(
          'w-full max-w-md rounded-3xl bg-card px-6 py-7 text-card-foreground shadow-panel ring-1 ring-border/60 compact:px-5',
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
