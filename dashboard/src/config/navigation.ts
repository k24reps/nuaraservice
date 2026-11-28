import type { TranslationKey } from '@/i18n';

export interface NavItem {
  to: string;
  /** i18n key for the label. */
  labelKey: TranslationKey;
  /** Label pendek untuk slot nav bawah ponsel (±70px) bila label penuh tak muat. */
  shortLabelKey?: TranslationKey;
  icon: string;
  /** Manager-only (owner/admin). Hidden from karyawan — mirrors RLS. */
  managerOnly?: boolean;
  /** Owner-only. Hidden from admin + karyawan — mirrors RLS. */
  ownerOnly?: boolean;
  /** Grup rail: operasional harian, kantor (uang & tim), sistem. Sidebar
   *  menarik sambungan bertitik di tiap pergantian grup, jadi anggota satu
   *  grup wajib berurutan di daftar ini (dijaga tes). */
  group: NavGroup;
}

export type NavGroup = 'ops' | 'office' | 'system';

/**
 * Primary navigation. Menu Teknisi (`karyawan`) = Beranda, Servis, Tugas,
 * Absensi (PRD, P18.20 dan P18.24): Kalkulator, Kasir & Stok, Pelanggan, dan
 * Supplier hanya untuk Admin dan Pemilik (`managerOnly`). Menu Admin dan
 * Pemilik tidak berubah.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', shortLabelKey: 'nav.home', icon: 'fa-chart-pie', group: 'ops' },
  { to: '/services', labelKey: 'nav.services', icon: 'fa-screwdriver-wrench', group: 'ops' },
  { to: '/calculator', labelKey: 'nav.calculator', icon: 'fa-calculator', managerOnly: true, group: 'ops' },
  // Kasir dan Inventori satu layar: datanya sama (inventory). /inventory
  // dialihkan ke sini (appChildRoutes) agar tautan lama tetap hidup.
  { to: '/pos', labelKey: 'nav.pos', shortLabelKey: 'nav.posShort', icon: 'fa-cash-register', managerOnly: true, group: 'ops' },
  { to: '/customers', labelKey: 'nav.customers', icon: 'fa-users', managerOnly: true, group: 'ops' },
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: 'fa-truck-field', managerOnly: true, group: 'ops' },
  { to: '/finance', labelKey: 'nav.finance', icon: 'fa-wallet', managerOnly: true, group: 'office' },
  { to: '/tasks', labelKey: 'nav.tasks', icon: 'fa-list-check', group: 'office' },
  { to: '/attendance', labelKey: 'nav.attendance', icon: 'fa-calendar-check', group: 'office' },
  { to: '/reports', labelKey: 'nav.reports', icon: 'fa-chart-line', ownerOnly: true, group: 'office' },
  { to: '/activity', labelKey: 'nav.activity', icon: 'fa-list-check', ownerOnly: true, group: 'system' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'fa-gear', ownerOnly: true, group: 'system' },
];
