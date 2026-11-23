import { describe, expect, it } from 'vitest';
import pageTsx from './SuppliersPage.tsx?raw';
import supplierModalTsx from './SupplierModal.tsx?raw';
import poModalTsx from './PurchaseOrderModal.tsx?raw';
import receiveModalTsx from './ReceiveModal.tsx?raw';
import appCss from '@/styles/app.css?raw';

const all = [pageTsx, supplierModalTsx, poModalTsx, receiveModalTsx];
const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Supplier sejak pindah ke dens-ui (L-62). Ukuran sungguhan
 * dicek lewat Playwright dengan teks terburuk; tes ini menjaga mekanismenya.
 */
describe('halaman Supplier', () => {
  it('kelas Tailwind dibuat: folder di @source, tanpa CSS Module', () => {
    expect(appCss).toContain('@source "../features/suppliers";');
    expect(cssModules).toEqual([]);
    for (const src of all) {
      expect(src).not.toContain('styles.');
      for (const [, names] of src.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
        for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
          expect(['LoadState', 'loadPending']).toContain(n);
        }
      }
      // Jendela dan form: fokus awal lewat data-autofocus, bukan autoFocus.
      expect(src).not.toMatch(/\bautoFocus\b/);
    }
    expect(pageTsx).toMatch(/<div data-nu className="flex flex-col gap-4 bg-transparent">/);
  });

  it('baris PO tiga tingkat lewat container query, ambang dari kasus terburuk terukur', () => {
    // 825px satu baris (layar sentuh), 515px dua baris. FixMaster: @container
    // 848px + @media 640px (viewport, tak tahu sidebar).
    expect(pageTsx).toContain('@container/polist ');
    expect(pageTsx).toContain("[grid-template-areas:'no_info_total_right']");
    expect(pageTsx).toContain("@max-[826px]/polist:[grid-template-areas:'no_info_total'_'._right_right']");
    expect(pageTsx).toContain("@max-[516px]/polist:[grid-template-areas:'no_info'_'total_total'_'right_right']");
    expect(pageTsx).not.toMatch(/[\s'"]compact:grid-cols|max-\[640px\]/);
  });

  it('status PO = lencana dens dari PO_STATUS_BADGE, tanpa spine', () => {
    expect(pageTsx).toContain('<Badge variant={PO_STATUS_BADGE[po.status]}>');
    expect(receiveModalTsx).toContain('<Badge variant={PO_STATUS_BADGE[po.status]}>');
    expect(pageTsx).not.toContain('PO_STATUS_TONE');
  });

  it('kartu vendor tak pernah lebih lebar dari wadahnya', () => {
    expect(pageTsx).toContain('grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))]');
  });

  it('baris barang PO: kolom jumlah hilang lewat container query, isian berlabel', () => {
    expect(poModalTsx).toContain('@container/lines ');
    expect(poModalTsx).toContain('@max-[507px]/lines:grid-cols-[minmax(0,1fr)_60px_90px_40px]');
    expect(poModalTsx).toContain('@max-[507px]/lines:hidden');
    // Dulu isian qty dan harga tanpa label sama sekali.
    expect(poModalTsx).toContain('aria-label={`Jumlah ${l.name}`}');
    expect(poModalTsx).toContain('aria-label={`Harga beli ${l.name}`}');
    expect(receiveModalTsx).toContain('aria-label={`Terima ${l.name}`}');
  });

  it('batal PO tak bisa diketuk dua kali selama diproses', () => {
    expect(pageTsx).toContain('loading={voiding}');
  });
});
