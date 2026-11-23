import { describe, expect, it } from 'vitest';
import pageTsx from './CustomersPage.tsx?raw';
import drawerTsx from './CustomerHistoryDrawer.tsx?raw';
import modalTsx from './CustomerModal.tsx?raw';
import appCss from '@/styles/app.css?raw';

const all = [pageTsx, drawerTsx, modalTsx];
const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Pelanggan sejak pindah ke dens-ui (L-51). Ukuran sungguhan
 * dicek lewat Playwright; tes ini menjaga agar mekanismenya tak hilang diam-diam.
 */
describe('halaman Pelanggan', () => {
  it('kelas Tailwind dibuat: folder di @source, tanpa CSS Module', () => {
    expect(appCss).toContain('@source "../features/customers";');
    expect(cssModules).toEqual([]);
    for (const src of all) {
      expect(src).not.toContain('styles.');
      // Dari pustaka lama hanya penanda muat dan hook tampilan yang boleh.
      for (const [, names] of src.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
        for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
          expect(['LoadState', 'loadPending', 'usePersistedView']).toContain(n);
        }
      }
    }
    expect(pageTsx).toMatch(/<div data-nu className="flex flex-col gap-4 bg-transparent">/);
  });

  it('tiga tampilan tetap ada, pilihan diingat per perangkat', () => {
    expect(pageTsx).toContain("usePersistedView('fixmaster-customers-view')");
    expect(pageTsx).toContain('<ViewToggle value={view} onChange={chooseView}');
    expect(pageTsx).toContain("view === 'tiles'");
    expect(pageTsx).toContain("view === 'list'");
  });

  it('kisi kartu dan ubin tak pernah lebih lebar dari wadahnya', () => {
    // minmax(290px, 1fr) polos meluap di wadah < 290px (ponsel 320px).
    expect(pageTsx).toContain('grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))]');
    expect(pageTsx).toContain('grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))]');
  });

  it('baris daftar tiga tingkat lewat container query, ambang dari min-content terukur', () => {
    // FixMaster: @media 768px. Di 1025-1100px (sidebar tampil) wadahnya 667px
    // untuk baris 807px; @media tak tahu lebar wadah (AGENTS §4).
    expect(pageTsx).toContain('@container/cust ');
    expect(pageTsx).toContain("[grid-template-areas:'head_contacts_activity_foot']");
    expect(pageTsx).toContain("@max-[808px]/cust:[grid-template-areas:'head_activity_foot']");
    expect(pageTsx).toContain("@max-[611px]/cust:[grid-template-areas:'head_activity'_'foot_foot']");
    // Kolom HP dan jumlah servis yang hilang lebih dulu.
    expect(pageTsx.match(/@max-\[808px\]\/cust:hidden/g)).toHaveLength(2);
    expect(pageTsx).not.toMatch(/max-\[768px\]|[\s'"]narrow:/);
  });

  it('laci riwayat = Sheet dens (fokus terkunci, Esc, fokus kembali), lencana status DBD', () => {
    expect(drawerTsx).not.toContain('createPortal');
    expect(drawerTsx).not.toContain("addEventListener('keydown'");
    expect(drawerTsx).toContain('<Sheet open={open && !!customer}');
    expect(drawerTsx).toContain('<Badge variant={STATUS_BADGE[s.status]}>');
    expect(drawerTsx).not.toContain('STATUS_TONE');
  });

  it('form pelanggan: FormDialog, fokus awal lewat data-autofocus', () => {
    expect(modalTsx).toContain('<FormDialog');
    expect(modalTsx).not.toMatch(/\bautoFocus\b/);
    expect(modalTsx).toContain('data-autofocus');
  });
});
