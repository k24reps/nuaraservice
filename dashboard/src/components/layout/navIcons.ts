import {
  CalendarCheck,
  Calculator,
  ChartLine,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ikon lucide untuk tiap menu di kerangka dens-ui (L-47). `NavItem.icon` di
 * config/navigation.ts masih nama ikon Phosphor untuk kode FixMaster yang
 * belum dipindah; kerangka baru membaca peta ini berdasarkan rute.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/services': Wrench,
  '/calculator': Calculator,
  '/pos': Store,
  '/customers': Users,
  '/suppliers': Truck,
  '/finance': Wallet,
  '/tasks': ListChecks,
  '/attendance': CalendarCheck,
  '/reports': ChartLine,
  '/activity': History,
  '/settings': Settings,
};

/** Cadangan bila rute baru belum punya ikon di peta. */
export const FALLBACK_NAV_ICON = LayoutDashboard;
