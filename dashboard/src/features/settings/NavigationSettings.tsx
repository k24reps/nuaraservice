import { useState } from 'react';
import { Check, CheckCheck, LoaderCircle, Menu, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { SelectBox } from '@/components/dens/select-box';
import { NAV_ITEMS } from '@/config/navigation';
import { setMobileNavigation as saveMobileNavigation } from '@/config/orgConfig';
import { NAV_ICONS, FALLBACK_NAV_ICON } from '@/components/layout/navIcons';
import { DEFAULT_MOBILE_NAV_PATHS, sanitizeMobileNavPaths } from '@/lib/business/navigation';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';
import { SaveFoot, SettingsCard, SettingsSection } from './settingsUi';

/** Tab Navigasi (L-66): pilihan empat menu bawah di ponsel, hanya pemilik. */
export function NavigationSettings() {
  const configured = useSessionStore((state) => state.org?.settings?.mobileNavigation);
  const initial = sanitizeMobileNavPaths(configured);
  return (
    <SettingsSection>
      <MobileNavigationEditor key={initial.join('|')} initial={initial} />
    </SettingsSection>
  );
}

function MobileNavigationEditor({ initial }: { initial: string[] }) {
  const t = useT();
  const [draft, setDraft] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  const options = NAV_ITEMS.map((item) => ({ value: item.to, label: t(item.labelKey) }));

  const setSlot = (slot: number, path: string) => {
    setDraft((current) => {
      const next = [...current];
      const duplicateAt = next.indexOf(path);
      if (duplicateAt >= 0 && duplicateAt !== slot) {
        next[duplicateAt] = next[slot];
      }
      next[slot] = path;
      return sanitizeMobileNavPaths(next);
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveMobileNavigation(draft);
      toast.success(t('settings.mobileNav.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.mobileNav.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<Menu aria-hidden />} title={t('settings.mobileNav.title')}>
      <div className="mb-5 flex items-start justify-between gap-4 @max-[641px]/settings:flex-col">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
            <span aria-hidden className="size-2 rounded-full bg-highlight" />
            {t('settings.mobileNav.ownerControl')}
          </span>
          <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-muted-foreground">{t('settings.mobileNav.description')}</p>
        </div>
        <Badge variant="success" className="shrink-0">
          <CheckCheck aria-hidden />
          {t('settings.mobileNav.synced')}
        </Badge>
      </div>

      {/* Dua kolom (slot + pratinjau) hanya bila wadah cukup lebar: pratinjau butuh
          ±320px dan dua slot ±176px (FixMaster: @media 900px). */}
      <div className="grid items-start gap-6 @min-[760px]/settings:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="grid grid-cols-2 gap-3 @max-[641px]/settings:grid-cols-1">
          {draft.map((path, index) => (
            <div className="rounded-xl bg-surface p-3 ring-1 ring-border/60" key={index}>
              <span className="mb-1 block font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
              <Field label={`${t('settings.mobileNav.slot')} ${index + 1}`} id={`mobile-navigation-slot-${index + 1}`}>
                <SelectBox value={path} options={options} onValueChange={(value) => setSlot(index, value)} />
              </Field>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-border bg-background p-4">
          <span className="text-xs font-medium text-muted-foreground">{t('settings.mobileNav.preview')}</span>
          <div className="my-3 grid grid-cols-5 gap-1 rounded-2xl bg-card p-1.5 shadow-panel ring-1 ring-border/60">
            {draft.map((path, index) => {
              const item = NAV_ITEMS.find((entry) => entry.to === path) ?? NAV_ITEMS[0];
              const ItemIcon = NAV_ICONS[item.to] ?? FALLBACK_NAV_ICON;
              const label = item.to === '/' ? t('nav.home') : t(item.labelKey);
              return (
                <span
                  key={path}
                  title={label}
                  className={cn(
                    'flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground [&>svg]:size-5',
                    index === 0 && 'bg-primary text-primary-foreground',
                  )}
                >
                  <ItemIcon aria-hidden />
                  <small className="max-w-full truncate px-0.5 text-xs leading-none font-semibold">{label}</small>
                </span>
              );
            })}
            <span title={t('nav.more')} className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground [&>svg]:size-5">
              <Menu aria-hidden />
              <small className="max-w-full truncate px-0.5 text-xs leading-none font-semibold">{t('nav.more')}</small>
            </span>
          </div>
          <small className="block text-sm leading-normal text-muted-foreground">{t('settings.mobileNav.hint')}</small>
        </div>
      </div>

      <SaveFoot>
        <Button variant="outline" onClick={() => setDraft([...DEFAULT_MOBILE_NAV_PATHS])}>
          <RotateCcw aria-hidden />
          {t('settings.mobileNav.reset')}
        </Button>
        <Button onClick={save} disabled={busy} aria-busy={busy || undefined}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Check aria-hidden />}
          {t('common.save')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}
