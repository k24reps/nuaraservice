import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Ellipsis, LogOut, X } from 'lucide-react';
import { EmptyValue } from '@/components/ui/EmptyValue';
import { Button } from '@/components/dens/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/dens/drawer';
import { Label } from '@/components/dens/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/dens/select';
import { useCollection } from '@/hooks/useCollection';
import { useNavSignals } from '@/hooks/useNavSignals';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { demoGuard } from '@/stores/demo';
import { isSupabaseConfigured } from '@/data/supabase-client';
import { getVisibleNavigation, resolveMobileNavigation, type ResolvedNavItem } from '@/lib/business/navigation';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { ZoomStepper } from './DisplayControls';
import { FALLBACK_NAV_ICON, NAV_ICONS } from './navIcons';
import { NavCount } from './navSignal';
import { ROLE_LABEL } from './roleLabel';
import { ShopMark } from './Sidebar';
import { Avatar } from './Topbar';

/** Nilai Select untuk "Semua Outlet": Radix Select tidak menerima nilai kosong. */
const ALL_OUTLETS = '__all__';

function pathIsActive(path: string, pathname: string): boolean {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

/**
 * Navigasi bawah ponsel (<=720px) dan menu Lainnya. Selektor
 * `nav[aria-label="Navigasi utama seluler"]`, `button[aria-controls="mobile-more-sheet"]`
 * dan `#mobile-more-sheet` dipakai probe scripts/audit-mobile.mjs.
 */
export function MobileBottomNav() {
  const location = useLocation();
  const org = useSessionStore((state) => state.org);
  const employee = useSessionStore((state) => state.currentEmployee);
  const activeOutletId = useSessionStore((state) => state.activeOutletId);
  const allowedOutletIds = useSessionStore((state) => state.allowedOutletIds);
  const setActiveOutlet = useSessionStore((state) => state.setActiveOutlet);
  const signOutEmployee = useSessionStore((state) => state.signOutEmployee);
  const authSignOut = useAuthStore((state) => state.signOut);
  const { data: outlets } = useCollection('outlets');
  const signals = useNavSignals();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  const visibleNavigation = useMemo(
    () => (employee ? getVisibleNavigation(employee.role) : []),
    [employee],
  );
  const primaryNavigation = useMemo(
    () => resolveMobileNavigation(org?.settings?.mobileNavigation, visibleNavigation),
    [org?.settings?.mobileNavigation, visibleNavigation],
  );
  const primaryPaths = new Set(primaryNavigation.map(({ item }) => item.to));
  const moreNavigation = visibleNavigation.filter(({ item }) => !primaryPaths.has(item.to));
  const moreIsActive = moreNavigation.some(({ item }) => pathIsActive(item.to, location.pathname));
  const reachableOutlets = allowedOutletIds.length
    ? outlets.filter((outlet) => allowedOutletIds.includes(outlet.id))
    : outlets;

  const handleLogout = () => {
    if (demoGuard('demo.logout')) return;
    setMoreOpen(false);
    if (isSupabaseConfigured) void authSignOut();
    else signOutEmployee();
  };

  const mobileLabelFor = (item: ResolvedNavItem['item']) => t(item.shortLabelKey ?? item.labelKey);

  return (
    <>
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent
          id="mobile-more-sheet"
          aria-describedby={undefined}
          // Tombol Lainnya bukan DrawerTrigger (id dan aria-controls-nya tetap
          // untuk probe), jadi fokus dikembalikan ke sana secara manual.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moreRef.current?.focus();
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
            <DrawerTitle>{t('nav.mobile.moreTitle')}</DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 size-11 text-muted-foreground"
              aria-label={t('common.close')}
              onClick={() => setMoreOpen(false)}
            >
              <X />
            </Button>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-[calc(var(--space-5)+env(safe-area-inset-bottom))]">
            {moreNavigation.length > 0 && (
              <nav aria-label={t('nav.more')} className="grid grid-cols-2 gap-2">
                {moreNavigation.map(({ item }) => {
                  const active = pathIsActive(item.to, location.pathname);
                  const ItemIcon = NAV_ICONS[item.to] ?? FALLBACK_NAV_ICON;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex min-h-14 items-center gap-2.5 rounded-xl bg-card px-2.5 text-sm font-medium ring-1 ring-border/70 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                        active && 'bg-sidebar-accent font-semibold ring-transparent',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]',
                          active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground/75',
                        )}
                      >
                        <ItemIcon strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                      <NavCount signal={signals[item.to]} />
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
              <div className="flex items-center gap-3">
                <ShopMark name={org?.name} logo={org?.logoDataUrl} className="size-10 rounded-xl" />
                <span className="flex min-w-0 flex-col">
                  <small className="text-xs text-muted-foreground">{t('nav.mobile.businessUnit')}</small>
                  <strong className="line-clamp-2 text-sm font-semibold leading-snug">
                    {org?.name ?? <EmptyValue />}
                  </strong>
                </span>
              </div>

              {reachableOutlets.length > 0 && (
                <div className="grid gap-1.5">
                  <Label htmlFor="mobile-outlet">{t('nav.mobile.activeOutlet')}</Label>
                  <Select
                    value={activeOutletId ?? ALL_OUTLETS}
                    onValueChange={(value) => setActiveOutlet(value === ALL_OUTLETS ? null : value)}
                  >
                    <SelectTrigger id="mobile-outlet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_OUTLETS}>{t('nav.mobile.allOutlets')}</SelectItem>
                      {reachableOutlets.map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <ZoomStepper />

              {employee && (
                <div className="flex items-center gap-3 border-t border-border/70 pt-3">
                  <Avatar name={employee.name} className="size-10" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="truncate text-sm font-semibold">{employee.name}</strong>
                    <small className="text-xs text-muted-foreground">{t(ROLE_LABEL[employee.role])}</small>
                  </span>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut />
                    {t('auth.logout')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <nav
        data-nu
        aria-label={t('nav.mobile.primary')}
        style={{ gridTemplateColumns: `repeat(${primaryNavigation.length + 1}, minmax(0, 1fr))` }}
        className="fixed inset-x-2 bottom-2 z-[calc(var(--z-overlay)+2)] hidden min-h-(--mobile-nav-height) items-stretch gap-0.5 rounded-2xl bg-card p-1.5 pb-[calc(var(--space-1)+env(safe-area-inset-bottom))] shadow-raised ring-1 ring-border/60 phone:grid"
      >
        {primaryNavigation.map(({ item }) => {
          const active = pathIsActive(item.to, location.pathname);
          const ItemIcon = NAV_ICONS[item.to] ?? FALLBACK_NAV_ICON;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              title={t(item.labelKey)}
              className={bottomItemClass(active)}
            >
              <BottomIcon active={active}>
                <ItemIcon strokeWidth={active ? 2.1 : 1.75} />
                <NavCount signal={signals[item.to]} className="absolute -right-2.5 -top-2 h-5 min-w-5 px-1" />
              </BottomIcon>
              <span className="max-w-full truncate">{mobileLabelFor(item)}</span>
            </Link>
          );
        })}
        <button
          ref={moreRef}
          type="button"
          className={bottomItemClass(moreOpen || moreIsActive)}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <BottomIcon active={moreOpen || moreIsActive}>
            <Ellipsis strokeWidth={moreOpen || moreIsActive ? 2.1 : 1.75} />
          </BottomIcon>
          <span className="max-w-full truncate">{t('nav.more')}</span>
        </button>
      </nav>
    </>
  );
}

function bottomItemClass(active: boolean) {
  return cn(
    'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-xs font-medium leading-none text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
    active && 'font-semibold text-foreground',
  );
}

/** Ikon menu bawah; menu aktif mendapat pil biru muda di belakang ikonnya. */
function BottomIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'relative grid h-7 w-12 place-items-center rounded-full transition-colors duration-150 [&_svg]:size-5',
        active && 'bg-sidebar-accent text-foreground',
      )}
    >
      {children}
    </span>
  );
}
