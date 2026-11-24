import type { LucideIcon } from 'lucide-react';

export interface SettingsTabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

/**
 * Deret tab Pengaturan (L-55). Dibungkus beberapa baris, tidak digeser ke
 * samping: sembilan tab tak akan muat sebaris di 320px, dan strip geser
 * menyembunyikan tab terakhir di balik gestur yang tak terlihat. Tinggi 44px
 * di semua perangkat.
 */
export function SettingsTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: SettingsTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {tabs.map(({ id, label: text, icon: TabIcon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="group/tab inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-semibold text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary [&>svg]:size-4 [&>svg]:text-muted-foreground aria-pressed:[&>svg]:text-primary-foreground/80"
        >
          <TabIcon aria-hidden />
          {text}
        </button>
      ))}
    </div>
  );
}
