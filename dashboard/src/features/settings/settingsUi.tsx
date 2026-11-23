import type { ReactNode } from 'react';
import { Checkbox } from '@/components/dens/checkbox';
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
  flush = false,
  danger = false,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  /** Badan tanpa padding: daftar baris yang selebar kartu. */
  flush?: boolean;
  /** Zona berbahaya: cincin merah muda, bukan cincin netral. */
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1',
        danger ? 'ring-destructive/40' : 'ring-border/60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
          {icon}
          <span className="min-w-0">{title}</span>
        </h2>
        {action}
      </div>
      <div className={flush ? undefined : 'px-5 pb-5 @max-[561px]/settings:px-4 @max-[561px]/settings:pb-4'}>{children}</div>
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

/** Chip pilihan (cabang, hari, dll.): tombol aria-pressed, 44px di layar sentuh. */
export function ToggleChip({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-xs font-medium text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:min-h-11 [&>svg]:size-3.5"
    >
      {icon}
      {children}
    </button>
  );
}

/** Satu pilihan centang berbingkai; seluruh kotak bisa diketuk. */
export function CheckOption({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-border transition-colors hover:bg-accent/40 has-[[data-state=checked]]:ring-primary/40">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
      <span className="flex flex-col gap-0.5">
        <strong className="text-sm font-semibold">{label}</strong>
        {hint ? <small className="text-xs text-muted-foreground">{hint}</small> : null}
      </span>
    </label>
  );
}
