import { describe, expect, it } from 'vitest';
import pageTsx from './AttendancePage.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Absensi sejak pindah ke dens-ui (L-54). Ukuran sungguhan
 * dicek lewat Playwright dengan teks terburuk; tes ini menjaga mekanismenya.
 */
describe('halaman Absensi', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar halaman', () => {
    expect(appCss).toContain('@source "../features/attendance";');
    expect(cssModules).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toMatch(/<(Icon|Modal|Card)\b/);
    for (const [, names] of pageTsx.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
      for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        expect(['LoadState', 'loadPending']).toContain(n);
      }
    }
    expect(pageTsx).toContain('<div data-nu className="@container/absen flex flex-col gap-4 bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('rekap dan riwayat bertumpuk lewat container query terukur, bukan @media 768px', () => {
    expect(pageTsx).not.toMatch(/[\s'"`](drawer|narrow|phone|compact):/);
    // Rekap enam kolom muat sampai 490px, riwayat pemilik tujuh kolom sampai 715px.
    expect(pageTsx).toContain("'grid grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_1fr] items-center gap-3'");
    expect(pageTsx).toContain('@max-[491px]/absen:grid-cols-5');
    expect(pageTsx).toContain('@max-[491px]/absen:[&>:first-child]:col-span-full');
    expect(pageTsx).toContain("const LEDGER_STACK = '@max-[716px]/absen:grid-cols-2");
    expect(pageTsx).toContain("const LEDGER_HEAD_STACK = '@max-[716px]/absen:hidden';");
    expect(pageTsx).toContain('grid-cols-[1.2fr_1.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr]');
    // Aksi pemilik pindah ke kolom kanan saat bertumpuk.
    expect(pageTsx).toContain("const ACTIONS = 'flex items-center justify-end gap-2 @max-[716px]/absen:col-start-2';");
  });

  it('panel jam navy tanpa layar LCD; tombol absen masuk menonjol di atas navy', () => {
    expect(pageTsx).toContain('rounded-2xl bg-primary px-6 py-5 text-primary-foreground');
    expect(pageTsx).toContain('text-[length:clamp(2.4rem,7cqi,3.6rem)]');
    expect(pageTsx).toContain('<Button size="lg" variant="highlight" onClick={checkIn}');
    expect(pageTsx).not.toMatch(/readout-|scanline|text-shadow/);
  });

  it('jendela koreksi: FormDialog + Field, fokus awal lewat data-autofocus, hapus mati selama diproses', () => {
    expect(pageTsx).toContain('<FormDialog');
    expect(pageTsx).toContain('id="attendance-edit"');
    expect(pageTsx).toContain('form="attendance-edit"');
    expect(pageTsx).not.toMatch(/\bautoFocus\b/);
    expect(pageTsx.match(/data-autofocus/g)).toHaveLength(2);
    expect(pageTsx).toContain('loading={deleting}');
    expect(pageTsx).toContain('if (!toDelete || deleting) return;');
  });

  it('status hadir paling sunyi; izin, sakit, alpha berlencana', () => {
    expect(pageTsx).toContain('hadir: null,');
    expect(pageTsx).toContain("izin: 'info',");
    expect(pageTsx).toContain("sakit: 'warning',");
    expect(pageTsx).toContain("alpha: 'destructive-soft',");
  });
});
