import { describe, expect, it } from 'vitest';
import pageTsx from './SettingsPage.tsx?raw';
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
import receiptTsx from './ReceiptTab.tsx?raw';
import quoteTsx from './QuoteRatesTab.tsx?raw';
import datasetsTs from './exportDatasets.ts?raw';
import selectTsx from '@/components/dens/select.tsx?raw';
import appCss from '@/styles/app.css?raw';

const migrated = [pageTsx, tabsTsx, uiTsx, businessTsx, opsTsx, teamTsx, walletTsx, outletTsx, navTsx, systemTsx, displayTsx, receiptTsx, quoteTsx];
// Dok pratinjau Nota dan bar simpan Tarif terikat kehadiran menu bawah (media query `phone:`); dicek terpisah.
const containerOnly = migrated.filter((src) => src !== receiptTsx && src !== quoteTsx);

/**
 * Pengaturan dipindah per tab (K-22): L-55 kerangka + Usaha + Operasional,
 * L-66 Tim/Wallet/Outlet/Navigasi/Sistem, L-67 Nota & Struk + Tarif. Sesudah
 * L-67 tak ada CSS Module tersisa dan folder utuh dipindai Tailwind.
 */
describe('Pengaturan (L-55, L-66, L-67)', () => {
  it('folder utuh dipindai Tailwind dan tak ada CSS Module tersisa', () => {
    expect(appCss).toContain('@source "../features/settings";');
    expect(Object.keys(import.meta.glob('./*.module.css'))).toEqual([]);
    for (const src of migrated) {
      expect(src).not.toContain('styles.');
      expect(src).not.toMatch(/from '@\/components\/ui'/);
      expect(src).not.toMatch(/\bautoFocus\b/);
    }
  });

  it('data-nu dan wadah settings di akar halaman, bukan per bagian', () => {
    expect(pageTsx).toContain('<div data-nu className="@container/settings flex flex-col gap-4 bg-transparent">');
    expect(pageTsx).toContain("from '@/components/dens/confirm-dialog'");
    for (const src of [tabsTsx, uiTsx, businessTsx, opsTsx, receiptTsx, quoteTsx]) expect(src).not.toMatch(/<[a-zA-Z][^<>]*\sdata-nu\b/);
    expect(uiTsx).toContain('<div className="flex flex-col gap-4">{children}</div>');
    expect(businessTsx).toContain('<SettingsSection>');
    expect(opsTsx).toContain('<SettingsSection>');
    expect(receiptTsx).toContain('<SettingsSection>');
    expect(quoteTsx).toContain('<SettingsSection>');
  });

  it('deret tab: tombol aria-pressed setinggi tab lama (44px) supaya isi tab lama tak bergeser', () => {
    expect(tabsTsx).toContain('aria-pressed={value === id}');
    expect(tabsTsx).toContain('group/tab inline-flex h-11 shrink-0');
    expect(pageTsx).toContain("<SettingsTabs tabs={visibleTabs} value={tab} onChange={setTab} label={t('settingsPage.sectionsAria')} />");
  });

  it('ambang kartu membaca wadah settings, bukan layar', () => {
    // Varian selalu menempel ke nama kelas; `phone: phone.trim()` (data profil) bukan varian.
    for (const src of containerOnly) expect(src).not.toMatch(/[\s'"`](drawer|narrow|phone|compact):[a-z[@]/);
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
    // Garansi, Absensi (toleransi terlambat, L-70), dan templat WhatsApp.
    expect(opsTsx.match(/disabled=\{saving\} aria-busy=\{saving \|\| undefined\}/g)).toHaveLength(3);
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

describe('Pengaturan L-67: Nota & Struk, Tarif', () => {
  it('kelas Tailwind ditulis utuh: tak ada awalan varian yang dirangkai dari konstanta', () => {
    // Pemindai Tailwind membaca teks sumber; `${NARROW}:grid` tak pernah menjadi kelas.
    for (const src of [receiptTsx, quoteTsx]) expect(src).not.toMatch(/\$\{\w+\}:[a-z[-]/);
  });

  it('Nota: dua kolom hanya di wadah >= 720px; di bawahnya pratinjau menjadi dok menempel di atas menu bawah', () => {
    expect(receiptTsx).toContain('@min-[720px]/settings:grid-cols-[minmax(340px,1fr)_minmax(360px,470px)]');
    expect(receiptTsx).toContain('@max-[720px]/settings:sticky @max-[720px]/settings:bottom-(--dock-bottom)');
    // Jarak dok terikat kehadiran menu bawah, bukan lebar wadah.
    expect(receiptTsx).toContain('phone:[--dock-bottom:calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]');
    // Tertutup: tak terlihat tapi tetap ter-layout (iframe mengukur tinggi isinya, meja kerja mengukur lebar untuk zoom).
    expect(receiptTsx).toContain('@max-[720px]/settings:invisible @max-[720px]/settings:max-h-0');
    expect(receiptTsx).not.toMatch(/@max-\[720px\]\/settings:hidden[^']*overflow-hidden/);
    // Urutan ponsel: kertas, apa yang dicetak, isi teks, S&K.
    expect(receiptTsx).toContain('@max-[720px]/settings:order-1');
    expect(receiptTsx).toContain('@max-[720px]/settings:order-2');
    expect(receiptTsx).toContain('@max-[720px]/settings:order-3');
    // Esc menutup panel dan mengembalikan fokus ke tombol dok.
    expect(receiptTsx).toContain("e.key !== 'Escape' || !open");
    expect(receiptTsx).toContain('peek.current?.focus()');
  });

  it('Nota: lebar kertas = RadioGroup dens; lima saklar cetak + saklar hitam-putih = Switch berlabel', () => {
    expect(receiptTsx).toContain('<RadioGroup');
    expect(receiptTsx).toContain('<RadioGroupItem value={String(w)}');
    expect(receiptTsx.match(/<Switch\b/g)).toHaveLength(2);
    expect(receiptTsx).toContain('aria-labelledby={`${s.key}-label`}');
    expect(receiptTsx).toContain('aria-describedby={`${s.key}-hint`}');
    expect(receiptTsx).toContain('aria-labelledby={bwId}');
    // Urutan penyaring penting: abu-abu dulu, lalu ambang 50%.
    expect(receiptTsx).toContain('[filter:grayscale(1)_contrast(1000)]');
  });

  it('Nota: tombol simpan mati selama menyimpan; angka S&K dan isian uang tak dikapitalkan otomatis', () => {
    expect(receiptTsx.match(/disabled=\{busy \|\| !dirty\} aria-busy=\{busy \|\| undefined\}/g)).toHaveLength(2);
    expect(receiptTsx.match(/capitalize="none"/g)).toHaveLength(3);
    expect(receiptTsx).toContain('font-mono tabular-nums');
    // Status "belum tersimpan" tetap diumumkan lewat wadah yang selalu ada.
    expect(receiptTsx).toContain('<span role="status" className="sr-only">');
  });

  it('Tarif: empat kolom baris template di wadah lapang, bertumpuk di <= 640px dan <= 420px', () => {
    expect(quoteTsx).toContain('grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]');
    expect(quoteTsx).toContain('@max-[641px]/settings:grid-cols-[minmax(0,1fr)_auto_auto]');
    expect(quoteTsx).toContain('@max-[421px]/settings:col-span-full');
    expect(quoteTsx).toContain('@max-[421px]/settings:row-start-3');
  });

  it('Tarif: saklar otomatis = Switch dengan nama chip di aria-label; hapus chip 44px di layar sentuh', () => {
    expect(quoteTsx).toContain('<Switch');
    expect(quoteTsx).toContain("aria-label={interpolate(t('quoteRates.autoAria'), { name })}");
    expect(quoteTsx).toContain("aria-label={interpolate(t('quoteRates.removeChip'), { name })}");
    expect(quoteTsx).toContain('size="icon"');
    expect(quoteTsx).toContain('pointer-coarse:h-11');
  });

  it('Tarif: bar simpan menempel hanya saat ada perubahan; fokus Tab tak mendarat di baliknya', () => {
    expect(quoteTsx).toContain("data-save-bar={dirty ? 'dirty' : undefined}");
    expect(quoteTsx).toContain('phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]');
    expect(appCss).toContain("html:has([data-save-bar='dirty'])");
    expect(quoteTsx).toContain('<Button onClick={() => void save()} disabled={busy || !dirty} aria-busy={busy || undefined}>');
    // Peringatan tinggalkan halaman selama draf berubah.
    expect(quoteTsx).toContain("window.addEventListener('beforeunload', warn)");
  });
  it('L-70: isian baru ada di tab yang direncanakan dan divalidasi sebelum menyimpan', () => {
    // Link ulasan: diperiksa sebelum template ikut disimpan, dan hanya https.
    expect(opsTsx).toContain('validateReviewUrl(reviewUrl)');
    expect(opsTsx.indexOf('validateReviewUrl(reviewUrl)')).toBeLessThan(opsTsx.indexOf('setWaTemplateOverrides(next)'));
    expect(opsTsx).toContain("t('settingsPage.linkUlasanHarusHttps')");
    // Toleransi terlambat: kartu Absensi memakai pemeriksa yang sama dengan tesnya.
    expect(opsTsx).toContain('function AttendanceCard()');
    expect(opsTsx).toContain('parseLateTolerance(value)');
    // Keluhan per jenis: pemilih jenis memakai SelectBox dens, bukan <select>.
    expect(opsTsx).toContain("t('settingsPage.keluhanJenis')");
    expect(opsTsx).toContain('<SelectBox');
    expect(opsTsx).not.toContain('<select');
    // Pemberitahuan privasi di kartu teks nota.
    expect(receiptTsx).toContain('id="receipt-privacy"');
    expect(receiptTsx).toContain('setPrivacyNotice(next.privacy)');
  });
});
