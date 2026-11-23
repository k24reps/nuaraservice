import { describe, expect, it } from 'vitest';
import pageTsx from './SettingsPage.tsx?raw';
import pageCss from './SettingsPage.module.css?raw';
import tabsTsx from './SettingsTabs.tsx?raw';
import uiTsx from './settingsUi.tsx?raw';
import businessTsx from './BusinessSettings.tsx?raw';
import opsTsx from './OperationsSettings.tsx?raw';
import appCss from '@/styles/app.css?raw';

const migrated = [tabsTsx, uiTsx, businessTsx, opsTsx];

/**
 * Pengaturan dipindah per tab (K-22): L-55 kerangka + Usaha + Operasional,
 * L-66 Tim/Wallet/Outlet/Navigasi/Sistem, L-67 Nota & Struk + Tarif. Selama itu
 * halaman masih merender tab FixMaster inline.
 */
describe('Pengaturan (L-55)', () => {
  it('hanya berkas tab yang sudah dipindah yang dipindai Tailwind', () => {
    for (const f of ['settingsUi', 'SettingsTabs', 'BusinessSettings', 'OperationsSettings']) {
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
