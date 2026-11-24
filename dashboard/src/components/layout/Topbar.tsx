import type { RefObject } from 'react';
import { LogOut, Menu, RotateCcw } from 'lucide-react';
import { Button } from '@/components/dens/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/dens/dropdown-menu';
import { useZoomStore } from '@/stores/zoom';
import { ZoomAnnouncer } from './DisplayControls';
import { zoomPercent, zoomTone } from './zoomDisplay';
import { useRealtimeStore } from '@/stores/realtime';
import { useSessionStore } from '@/stores/session';
import { useAuthStore } from '@/stores/auth';
import { demoGuard } from '@/stores/demo';
import { isSupabaseConfigured } from '@/data/supabase-client';
import { useT, type TranslationKey } from '@/i18n';
import { interpolate } from '@/lib/business/notify';
import { cn } from '@/lib/utils';
import { ROLE_LABEL } from './roleLabel';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onToggleMobile: () => void;
  /** Keadaan laci sidebar, untuk aria-expanded; ref-nya dipakai laci untuk
      mengembalikan fokus ke tombol ini saat ditutup. */
  mobileOpen: boolean;
  drawerId: string;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

type SyncStatus = 'connecting' | 'live' | 'offline';

const SYNC_LABEL: Record<SyncStatus, TranslationKey> = {
  connecting: 'topbar.syncConnecting',
  live: 'topbar.syncLive',
  offline: 'topbar.syncOffline',
};

const SYNC_TITLE: Record<SyncStatus, TranslationKey> = {
  connecting: 'topbar.syncConnectingTitle',
  live: 'topbar.syncLiveTitle',
  offline: 'topbar.syncOfflineTitle',
};

const SYNC_TONE: Record<SyncStatus, string> = {
  connecting: 'bg-highlight-soft text-foreground [&>span]:bg-highlight',
  live: 'bg-success text-success-foreground [&>span]:bg-success-foreground',
  offline: 'bg-destructive-soft text-destructive [&>span]:bg-destructive',
};

/**
 * Status sambungan realtime. Hanya tampil di mode server setelah kanal
 * melapor (`active`), jadi sesi lokal tetap bersih.
 */
function SyncBadge() {
  const status = useRealtimeStore((s) => s.status);
  const active = useRealtimeStore((s) => s.active);
  const t = useT();
  if (!active) return null;
  return (
    <span
      data-status={status}
      title={t(SYNC_TITLE[status])}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-mono text-xs font-semibold tracking-[0.08em]',
        SYNC_TONE[status],
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', status === 'connecting' && 'animate-pulse')} />
      <span className="compact:sr-only">{t(SYNC_LABEL[status])}</span>
    </span>
  );
}

/**
 * Penanda pembesaran: hanya muncul saat tampilan TIDAK di 100%, supaya
 * pengguna yang membandingkan layar dengan rekan tahu sebabnya dan bisa
 * kembali dengan satu klik. Level diatur di Pengaturan › Sistem › Tampilan,
 * menu Lainnya, dan pintasan Ctrl+Alt + = / − / 0.
 */
function ZoomChip() {
  const t = useT();
  const zoom = useZoomStore((s) => s.zoom);
  const resetZoom = useZoomStore((s) => s.resetZoom);
  if (zoom === 1) return null;
  const pct = zoomPercent(zoom);
  return (
    <Button
      variant="outline"
      size="sm"
      data-tone={zoomTone(zoom)}
      onClick={resetZoom}
      aria-label={`${t('display.zoom.title')} ${pct}. ${t('display.zoom.reset')}`}
      title={t('display.zoom.reset')}
      className="font-mono tabular-nums phone:hidden data-[tone=below]:ring-1 data-[tone=below]:ring-highlight"
    >
      {pct}
      <RotateCcw className="text-muted-foreground" />
    </Button>
  );
}

/**
 * Akun: avatar membuka nama, peran, dan Keluar. Di ponsel (<=720px)
 * disembunyikan: Keluar sudah ada di menu Lainnya.
 */
function AccountMenu() {
  const employee = useSessionStore((s) => s.currentEmployee);
  const signOut = useSessionStore((s) => s.signOutEmployee);
  const authSignOut = useAuthStore((s) => s.signOut);
  const t = useT();

  if (!employee) return null;
  const role = t(ROLE_LABEL[employee.role]);

  // Cloud: true sign-out of the Supabase account (→ AuthPage).
  // Local: switch user (re-enter PIN) — there is no cloud account.
  const handleLogout = () => {
    if (demoGuard('demo.logout')) return;
    if (isSupabaseConfigured) void authSignOut();
    else signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="phone:hidden"
          aria-label={interpolate(t('topbar.account'), { name: employee.name })}
          title={`${employee.name} · ${role}`}
        >
          <Avatar name={employee.name} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex flex-col gap-0.5 px-2.5 pb-2 pt-1.5">
          <strong className="truncate text-sm font-semibold">{employee.name}</strong>
          <small className="text-xs text-muted-foreground">{role}</small>
        </div>
        <div aria-hidden className="-mx-1 my-1 h-px bg-border" />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inisial staf di lingkaran navy, dengan titik hijau "sedang masuk". */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground',
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success-foreground ring-2 ring-card" />
    </span>
  );
}

export function Topbar({
  title,
  subtitle,
  onToggleMobile,
  mobileOpen,
  drawerId,
  toggleRef,
}: TopbarProps) {
  const t = useT();

  return (
    <header
      data-nu
      className="sticky top-(--app-inset-top) z-(--z-sticky) mx-4 mt-3.5 flex h-(--topbar-height) items-center gap-4 rounded-2xl bg-card px-5 shadow-panel ring-1 ring-border/60 compact:top-2 compact:mx-2 compact:mt-2 compact:h-[60px] compact:gap-3 compact:px-3"
    >
      <Button
        ref={toggleRef}
        variant="ghost"
        size="icon"
        className="-ml-1.5 hidden drawer:inline-flex phone:hidden"
        onClick={onToggleMobile}
        aria-label={t('topbar.menu')}
        aria-expanded={mobileOpen}
        aria-controls={drawerId}
      >
        <Menu />
      </Button>

      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-xl font-semibold leading-tight tracking-[-0.015em] narrow:text-lg">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground narrow:hidden">{subtitle}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SyncBadge />
        <ZoomChip />
        <ZoomAnnouncer />
        <AccountMenu />
      </div>
    </header>
  );
}
