import { NavLink, useLocation } from 'react-router-dom';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { EmptyValue } from '@/components/ui/EmptyValue';
import { Button } from '@/components/dens/button';
import { getVisibleNavigation } from '@/lib/business/navigation';
import { useSessionStore } from '@/stores/session';
import { useT } from '@/i18n';
import { useNavSignals } from '@/hooks/useNavSignals';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDrawerFocus } from '@/hooks/useDrawerFocus';
import { cn } from '@/lib/utils';
import { FALLBACK_NAV_ICON, NAV_ICONS } from './navIcons';
import { NavCount, NavDot } from './navSignal';

/**
 * Di bawah lebar ini sidebar jadi laci yang digeser keluar layar (transform),
 * bukan disembunyikan: tautannya tetap ada di urutan Tab dan di pohon pembaca
 * layar. Harus SAMA PERSIS dengan varian `drawer` di styles/app.css; kalau
 * salah satunya bergeser, laci yang tampil ikut inert atau laci tersembunyi
 * tetap terjangkau (dikunci sidebarInert.test.ts). Media query, bukan
 * @container: ini menyangkut perangkat, jadi keduanya bergeser (atau tidak)
 * bersama zoom aplikasi.
 */
const DRAWER_QUERY = '(max-width: 1024px)';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  /** Id laci (dirujuk `aria-controls` tombol menu) dan tombol itu sendiri,
      tujuan fokus saat laci ditutup. */
  drawerId: string;
  toggleRef: RefObject<HTMLElement | null>;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  drawerId,
  toggleRef,
}: SidebarProps) {
  const org = useSessionStore((s) => s.org);
  const employee = useSessionStore((s) => s.currentEmployee);
  const t = useT();
  const signals = useNavSignals();
  // Laci tertutup di ponsel/tablet: inert (tak bisa difokus, tak dibacakan).
  // Di desktop (>=1025px) sidebar adalah rail tetap, termasuk saat diciutkan
  // (collapsed), jadi TIDAK pernah inert.
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const drawerClosed = isDrawer && !mobileOpen;
  const drawerOpen = isDrawer && mobileOpen;
  // Laci selalu lebar penuh: rail ciut hanya berlaku di desktop.
  const rail = collapsed && !isDrawer;
  // Terbuka: fokus masuk, Tab berputar di laci, Esc menutup. Tertutup: fokus
  // kembali ke tombol menu. Di rail desktop hook ini tak melakukan apa-apa.
  const asideRef = useRef<HTMLElement>(null);
  useDrawerFocus({
    active: drawerOpen,
    containerRef: asideRef,
    returnRef: toggleRef,
    onClose: onCloseMobile,
  });

  // Role-gating (managerOnly/ownerOnly) HIDES items — it mirrors server RLS,
  // so showing them would just lead to failures.
  const visibleNav = employee ? getVisibleNavigation(employee.role) : [];

  // Kanal aktif selalu terlihat. Di 1366×768 Log dan Pengaturan berada di bawah
  // tepi rail, jadi halaman yang sedang dibuka tak punya tanda di menu. Di ujung
  // gulir, kanal yang muat di sana ditempel ke ujung: kembali ke Servis
  // menggulir ke 0, bukan ke 28px yang memotong Dashboard. Layout effect:
  // tanpa lompatan yang sempat tergambar.
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !item) return;
    const pad = 28;
    const view = nav.clientHeight;
    const max = nav.scrollHeight - view;
    const top = item.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    const bottom = top + item.offsetHeight;
    let next = nav.scrollTop;
    if (top - next < pad) next = top - pad;
    else if (bottom - next > view - pad) next = bottom - view + pad;
    if (next === nav.scrollTop) return;
    if (bottom <= view - pad) next = 0;
    else if (top - max >= pad) next = max;
    nav.scrollTop = next;
  }, [pathname, collapsed]);

  const logo = <ShopMark name={org?.name} logo={org?.logoDataUrl} />;

  return (
    <>
      <div
        aria-hidden
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-(--z-overlay) hidden bg-[rgb(6_32_54/0.42)]',
          mobileOpen && 'drawer:block drawer:animate-fade-in',
        )}
      />
      <aside
        inert={drawerClosed}
        id={drawerId}
        ref={asideRef}
        data-nu
        data-collapsed={rail || undefined}
        className={cn(
          'fixed bottom-3.5 left-3.5 top-(--app-inset-top) z-(--z-sidebar) flex w-(--sidebar-width) flex-col overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground shadow-panel ring-1 ring-sidebar-border/70 transition-[width,transform] duration-200 ease-out-expo',
          rail && 'w-(--sidebar-collapsed)',
          'drawer:top-2 drawer:bottom-2 drawer:left-2 drawer:w-[min(var(--sidebar-width),calc(100vw-16px))] drawer:-translate-x-[calc(100%+var(--space-2))]',
          mobileOpen && 'drawer:translate-x-0 drawer:z-[calc(var(--z-overlay)+1)] drawer:shadow-raised',
        )}
      >
        {/* ---------- Identitas produk ---------- */}
        <div
          className={cn(
            'flex min-h-(--topbar-height) shrink-0 items-center gap-2 px-4 pb-4 pt-4',
            rail && 'flex-col justify-center gap-2 px-0 py-3',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src="/logo-mark.png"
              alt=""
              width="40"
              height="40"
              className="size-10 shrink-0 rounded-xl ring-1 ring-sidebar-border/70"
            />
            {!rail && (
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">
                  Nuara Service
                </strong>
                <small className="font-mono text-xs font-medium uppercase leading-5 tracking-[0.14em] text-muted-foreground">
                  Dashboard
                </small>
              </span>
            )}
          </div>
          {isDrawer ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-xl text-muted-foreground"
              onClick={onCloseMobile}
              aria-label={t('common.close')}
            >
              <X />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-xl text-muted-foreground"
              onClick={onToggleCollapse}
              aria-label={t('sidebar.collapse')}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
        </div>

        {/* ---------- Navigasi ---------- */}
        <nav
          ref={navRef}
          aria-label={t('sidebar.mainNav')}
          className={cn('flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 pb-3', rail && 'px-0')}
        >
          {visibleNav.map(({ item }, i) => {
            // Garis tipis di awal tiap grup: operasional, kantor, sistem.
            const newGroup = i > 0 && visibleNav[i - 1].item.group !== item.group;
            const ItemIcon = NAV_ICONS[item.to] ?? FALLBACK_NAV_ICON;
            const label = t(item.labelKey);
            return (
              <div key={item.to} className="contents">
                {newGroup && <div aria-hidden className={cn('mx-2 my-2 h-px shrink-0 bg-sidebar-border/70', rail && 'mx-4')} />}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onCloseMobile}
                  title={rail ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group/nav relative flex min-h-10 shrink-0 items-center gap-3 rounded-xl px-2 text-sm font-medium text-sidebar-foreground/75 outline-none transition-[background-color,color] duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:min-h-11',
                      isActive && 'bg-sidebar-accent font-semibold text-sidebar-foreground',
                      rail && 'mx-auto size-11 justify-center px-0',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-150 [&_svg]:size-[18px]',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(6_32_54/0.18)]'
                            : 'text-sidebar-foreground/70 group-hover/nav:text-sidebar-foreground',
                        )}
                      >
                        <ItemIcon strokeWidth={1.75} />
                      </span>
                      {rail ? (
                        <NavDot signal={signals[item.to]} className="absolute right-1.5 top-1.5" />
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <NavCount signal={signals[item.to]} />
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* ---------- Unit usaha (identitas toko). Satu workshop: tanpa pemilih cabang (P18.21). ---------- */}
        <div className={cn('shrink-0 border-t border-sidebar-border/70 p-3', rail && 'px-0')}>
          <div className={cn('flex items-center gap-3 p-1.5', rail && 'justify-center')}>
            {logo}
            {!rail && (
              <div className="flex min-w-0 flex-col">
                <small className="text-xs text-muted-foreground">{t('nav.mobile.businessUnit')}</small>
                <strong className="line-clamp-2 text-sm font-semibold leading-snug">
                  {org?.name ?? <EmptyValue />}
                </strong>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/** Logo toko dari Pengaturan, atau huruf pertama namanya di kotak navy. */
export function ShopMark({ name, logo, className }: { name?: string; logo?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground',
        className,
      )}
    >
      {logo ? <img src={logo} alt="" className="size-full bg-card object-contain" /> : (name ?? 'N').charAt(0).toUpperCase()}
    </span>
  );
}
