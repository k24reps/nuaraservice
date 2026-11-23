import { describe, expect, it } from 'vitest';
import pageTsx from './SettingsPage.tsx?raw';
import pageCss from './SettingsPage.module.css?raw';
import tabsTsx from './SettingsTabs.tsx?raw';
import uiTsx from './settingsUi.tsx?raw';
import businessTsx from './BusinessSettings.tsx?raw';
import opsTsx from './OperationsSettings.tsx?raw';
import teamTsx from './TeamSettings.tsx?raw';
import walletTsx from './WalletSettings.tsx?raw';
import outletTsx from './OutletSettings.tsx?raw';
import navTsx from './NavigationSettings.tsx?raw';
import systemTsx from './SystemSettings.tsx?raw';
import displayTsx from './DisplayCard.tsx?raw';
import datasetsTs from './exportDatasets.ts?raw';
import selectTsx from '@/components/dens/select.tsx?raw';
import appCss from '@/styles/app.css?raw';

const migrated = [tabsTsx, uiTsx, businessTsx, opsTsx, teamTsx, walletTsx, outletTsx, navTsx, systemTsx, displayTsx];

/**
 * Pengaturan dipindah per tab (K-22): L-55 kerangka + Usaha + Operasional,
 * L-66 Tim/Wallet/Outlet/Navigasi/Sistem, L-67 Nota & Struk + Tarif. Selama itu
 * halaman masih merender tab FixMaster (Nota, Tarif) inline.
 */
describe('Pengaturan (L-55, L-66)', () => {
  it('hanya berkas tab yang sudah dipindah yang dipindai Tailwind', () => {
    for (const f of [
      'settingsUi',
      'SettingsTabs',
      'BusinessSettings',
      'OperationsSettings',
      'TeamSettings',
      'WalletSettings',
      'OutletSettings',
      'NavigationSettings',
      'SystemSettings',
      'DisplayCard',
    ]) {
      expect(appCss).toContain(`@source "../features/settings/${f}.tsx";`);
    }
    // SettingsPage.tsx masih memuat tab FixMaster: tidak boleh dipindai utuh.
    expect(appCss).not.toContain('@source "../features/settings";');
    expect(appCss).not.toContain('@source "../features/settings/SettingsPage.tsx";');
    for (const src of migrated) {
      expect(src).not.toContain('styles.');
      expect(src).not.toMatch(/from '@\/components\/ui'/);
      expect(src).not.toMatch(/\bautoFocus\b/);
    }
  });

  it('data-nu per bagian, bukan di akar halaman (tab FixMaster masih inline)', () => {
    expect(pageTsx).not.toMatch(/\bdata-nu\b/);
    expect(pageTsx).toContain('<div className={styles.wrap}>');
    expect(uiTsx).toContain('<div data-nu className="@container/settings flex flex-col gap-4 bg-transparent">');
    expect(tabsTsx).toContain('<div data-nu className="flex flex-wrap items-center gap-2 bg-transparent"');
    expect(businessTsx).toContain('<SettingsSection>');
    expect(opsTsx).toContain('<SettingsSection>');
  });

  it('sisa CSS Module = persis kelas yang masih dipakai tab FixMaster', () => {
    const defined = new Set([...pageCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const used = new Set([...pageTsx.matchAll(/styles\.(\w+)/g)].map((m) => m[1]));
    expect([...defined].filter((c) => !used.has(c)).sort()).toEqual([]);
    for (const gone of ['tabs', 'tabActive', 'logoRow', 'rentRow', 'waTextarea', 'warrantyDefaults', 'targetGrid']) {
      expect(defined.has(gone), gone).toBe(false);
    }
    // Sesudah L-66 tinggal pembungkus halaman; tab Nota dan Tarif punya CSS Module sendiri.
    expect([...defined]).toEqual(['wrap']);
    expect(Object.keys(import.meta.glob('./DisplayCard.module.css'))).toEqual([]);
  });

  it('deret tab: tombol aria-pressed setinggi tab lama (44px) supaya isi tab lama tak bergeser', () => {
    expect(tabsTsx).toContain('aria-pressed={value === id}');
    expect(tabsTsx).toContain('group/tab inline-flex h-11 shrink-0');
    expect(pageTsx).toContain("<SettingsTabs tabs={visibleTabs} value={tab} onChange={setTab} label={t('settingsPage.sectionsAria')} />");
  });

  it('ambang kartu membaca wadah settings, bukan layar', () => {
    // Varian selalu menempel ke nama kelas; `phone: phone.trim()` (data profil) bukan varian.
    for (const src of migrated) expect(src).not.toMatch(/[\s'"`](drawer|narrow|phone|compact):[a-z[@]/);
    expect(businessTsx).toContain('grid max-w-[960px] grid-cols-2 items-start gap-4 @max-[609px]/settings:grid-cols-1');
    expect(opsTsx).toContain('grid grid-cols-2 gap-3 @max-[489px]/settings:grid-cols-1');
    // Kaki simpan: tombol berbagi lebar penuh di wadah sempit.
    expect(uiTsx).toContain('@max-[609px]/settings:[&>button]:flex-1 @max-[609px]/settings:[&>span]:basis-full');
  });

  it('chip hapus 20px berarea 44px dan tak menyusut oleh isi panjang', () => {
    expect(opsTsx).toContain('relative grid size-5 shrink-0 place-items-center');
    expect(opsTsx).toContain('pointer-coarse:after:absolute pointer-coarse:after:-inset-3');
  });

  it('tombol simpan mati selama menyimpan; kolom tabel servis memakai Checkbox dens', () => {
    expect(businessTsx.match(/disabled=\{busy \|\|/g)).toHaveLength(3);
    // Garansi dan templat WhatsApp.
    expect(opsTsx.match(/disabled=\{saving\} aria-busy=\{saving \|\| undefined\}/g)).toHaveLength(2);
    expect(opsTsx).toContain('<Checkbox');
    expect(opsTsx).toContain('has-[[data-state=checked]]:ring-primary/40');
  });
});

describe('Pengaturan L-66: Tim, Wallet, Outlet, Navigasi, Sistem', () => {
  it('Tim: email tak dikapitalkan otomatis; peran terkunci tetap dijelaskan lewat title; aksi baris menumpuk di wadah sempit', () => {
    // Dulu isian email tanpa type ikut dikapitalkan Input lama.
    expect(teamTsx).toContain('type="email"');
    expect(teamTsx).toContain("<span title={lockedOwner ? t('settingsPage.lastOwnerRole') : undefined}>");
    expect(teamTsx).toContain("<span title={canTurnOff ? undefined : t('settingsPage.lastOwnerOff')}>");
    expect(teamTsx).toContain('@max-[641px]/settings:basis-full @max-[641px]/settings:flex-wrap @max-[641px]/settings:justify-end');
    expect(teamTsx).toContain('<SettingsCard flush');
    expect(teamTsx.match(/<ToggleChip /g)).toHaveLength(2);
    // Tombol Undang dan Simpan cabang mati selama diproses.
    expect(teamTsx).toContain('<Button onClick={invite} disabled={busy}');
    expect(teamTsx).toContain('disabled={busy || selected.length === 0}');
  });

  it('Wallet: tombol tambah/transfer mati selama diproses; kas tunai = CheckOption', () => {
    expect(walletTsx).toContain('disabled={adding || !canAddWallet}');
    expect(walletTsx).toContain('disabled={transferring}');
    expect(walletTsx.match(/<CheckOption/g)).toHaveLength(2);
    expect(walletTsx).toContain("const MAX_WALLETS = 99;");
    // Hapus kas tak bisa dengan saldo: pagar klien tetap ada.
    expect(walletTsx).toContain('if (wallet.balance !== 0) {');
  });

  it('Outlet: tiga kolom koordinat jadi satu kolom di wadah sempit; hapus cabang tak bisa diketuk dua kali', () => {
    expect(outletTsx).toContain("const ROW3 = 'grid grid-cols-[1fr_1fr_120px] gap-3 @max-[561px]/settings:grid-cols-1';");
    expect(outletTsx).toContain('ml-[50px]');
    expect(outletTsx).toContain('@max-[561px]/settings:ml-0');
    expect(outletTsx).toContain('loading={busy}');
    expect(outletTsx).toContain('if (busy) return;');
    expect(outletTsx).toContain("const MAX_GEOFENCE_M = 5000;");
    expect(outletTsx).toContain('aria-expanded={open}');
  });

  it('Navigasi: ikon dari NAV_ICONS (sama dengan menu bawah), dua kolom hanya di wadah >= 760px', () => {
    expect(navTsx).toContain("import { NAV_ICONS, FALLBACK_NAV_ICON } from '@/components/layout/navIcons';");
    expect(navTsx).toContain('@min-[760px]/settings:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]');
    expect(navTsx).toContain('id={`mobile-navigation-slot-${index + 1}`}');
    expect(navTsx).not.toMatch(/<Icon\b/);
    // Pratinjau: menu pertama menyala seperti item aktif menu bawah.
    expect(navTsx).toContain("index === 0 && 'bg-primary text-primary-foreground'");
  });

  it('Sistem: tiap ikon ekspor punya padanan lucide; saklar email = Switch berlabel; kartu bertumpuk di wadah <= 800px', () => {
    const names = new Set([...datasetsTs.matchAll(/icon: '([a-z-]+)'/g)].map((m) => m[1]));
    expect(names.size).toBeGreaterThan(3);
    for (const n of names) expect(systemTsx, n).toMatch(new RegExp(`'?${n}'?: [A-Z]\\w*,`));
    expect(systemTsx).toContain('aria-labelledby="backup-email-label"');
    expect(systemTsx).toContain('<Switch');
    expect(systemTsx).toContain('grid grid-cols-2 items-start gap-4 @max-[800px]/settings:grid-cols-1');
    expect(systemTsx).toContain('<SettingsCard danger');
    expect(systemTsx).toContain('loading={restoring}');
  });

  it('pemilih dens memotong nilai panjang dengan elipsis (SelectValue tanpa data-slot)', () => {
    expect(selectTsx).toContain('[&>span:first-child]:min-w-0 [&>span:first-child]:truncate');
    expect(walletTsx.match(/min-w-\[210px\] flex-1/g)).toHaveLength(4);
  });

  it('Tampilan: dua kenop berdampingan hanya di wadah >= 900px; reset memakai aria-disabled, bukan disabled', () => {
    expect(displayTsx).toContain('@min-[900px]/display:grid-cols-2');
    expect(displayTsx).toContain('aria-disabled={zoom === 1 || undefined}');
    expect(displayTsx).not.toMatch(/(?<!-)\bdisabled=\{/);
  });
});
