import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Kerangka kartu Pengaturan versi dens-ui (L-55). Tab yang sudah dipindah
 * dibungkus `SettingsSection` (akar `data-nu` sendiri): selama L-55 s.d. L-67
 * halaman ini masih merender tab FixMaster inline, jadi `data-nu` dipasang per
 * bagian, bukan di akar halaman (pola Kasir L-50).
 */

/** Wadah satu tab. Ambang di dalamnya membaca wadah `settings`, bukan layar. */
export function SettingsSection({ children }: { children: ReactNode }) {
  return <div data-nu className="@container/settings flex flex-col gap-4 bg-transparent">{children}</div>;
}

export function SettingsCard({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
          {icon}
          <span className="min-w-0">{title}</span>
        </h2>
        {action}
      </div>
      <div className="px-5 pb-5 @max-[561px]/settings:px-4 @max-[561px]/settings:pb-4">{children}</div>
    </section>
  );
}

/** Kalimat pengantar di bawah judul kartu. */
export function SettingsHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-4 text-sm leading-normal text-muted-foreground', className)}>{children}</p>;
}

/**
 * Baris simpan di dasar kartu, selalu kanan bawah; `note` (bila ada) duduk di
 * kiri. Di wadah sempit tombolnya berbagi lebar penuh dan catatan naik ke baris
 * sendiri (FixMaster: @media 640px).
 */
export function SaveFoot({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-dashed border-border pt-4 @max-[609px]/settings:[&>button]:flex-1 @max-[609px]/settings:[&>span]:basis-full">
      {note ? <span className="mr-auto text-sm leading-normal text-muted-foreground">{note}</span> : null}
      {children}
    </div>
  );
}

/** Satu kelompok isian dalam kartu; kelompok berurutan dipisah garis putus. */
export const SETTINGS_GROUP =
  'flex flex-col gap-2 [&+&]:mt-4 [&+&]:border-t [&+&]:border-dashed [&+&]:border-border [&+&]:pt-4';
export const SETTINGS_LABEL = 'text-sm font-semibold';
