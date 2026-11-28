import { describe, expect, it } from 'vitest';
import sidebarRaw from './Sidebar.tsx?raw';
import appCssRaw from '@/styles/app.css?raw';
import topbarRaw from './Topbar.tsx?raw';
import layoutRaw from './AppLayout.tsx?raw';
import mobileNavRaw from './MobileBottomNav.tsx?raw';

// Checkout Windows (core.autocrlf) memberi CRLF pada ?raw.
const lf = (s: string) => s.replace(/\r\n/g, '\n');
const sidebar = lf(sidebarRaw);
const appCss = lf(appCssRaw);
const topbar = lf(topbarRaw);
const layout = lf(layoutRaw);
const mobileNav = lf(mobileNavRaw);
const count = (s: string, needle: string) => s.split(needle).length - 1;

/**
 * Laci sidebar di <=1024px disembunyikan dengan transform (digeser keluar layar),
 * bukan display:none, jadi belasan tautannya tetap terjangkau Tab dan terbaca
 * pembaca layar saat laci tertutup. `inert` menutupnya, tetapi HANYA saat benar-
 * benar laci tertutup: di desktop sidebar adalah rail tetap (juga saat
 * diciutkan) dan tak boleh inert. Tes ini mengunci kopling itu tanpa merender
 * Sidebar (butuh router + store + data); perilaku nyatanya diukur di browser.
 */
describe('sidebar: inert hanya saat laci ponsel tertutup', () => {
  it('aside inert = (lebar laci) DAN (laci tidak terbuka); collapsed tak ikut menentukan', () => {
    expect(sidebar).toContain('const drawerClosed = isDrawer && !mobileOpen;');
    expect(sidebar).toMatch(/<aside\s+inert=\{drawerClosed\}/);
    // Mode ciut (desktop) bukan alasan inert.
    expect(sidebar).not.toMatch(/inert=\{[^}]*collapsed/);
  });

  it('kueri laci di TSX sama persis dengan varian `drawer` di styles/app.css', () => {
    const q = sidebar.match(/const DRAWER_QUERY = '(\([^']+\))';/);
    expect(q, 'DRAWER_QUERY tak ditemukan').not.toBeNull();
    expect(appCss).toContain(`@custom-variant drawer (@media ${q![1]});`);
  });

  it('aside digeser keluar layar HANYA lewat varian drawer, dan kembali saat laci terbuka', () => {
    expect(sidebar).toContain('drawer:-translate-x-[calc(100%+var(--space-2))]');
    expect(sidebar).toMatch(/mobileOpen && 'drawer:translate-x-0/);
    // Rail desktop tak boleh tersembunyi: tiap pergeseran negatif berawalan drawer:.
    const shifts = sidebar.match(/\S*-translate-x-\S*/g) ?? [];
    expect(shifts.length).toBeGreaterThan(0);
    for (const cls of shifts) expect(cls, cls).toMatch(/^'?drawer:/);
  });
});

/**
 * `inert` hanya menutup laci yang TERTUTUP. Sisi terbukanya (fokus masuk, Tab
 * berputar, Esc, fokus kembali) ada di useDrawerFocus, yang perilakunya diuji
 * sungguhan di useDrawerFocus.test.tsx. Di sini hanya kabelnya yang dikunci,
 * karena merender Sidebar butuh router + store + data.
 */
describe('sidebar: pengelolaan fokus laci terpasang', () => {
  it('hook aktif tepat saat lebar laci DAN laci terbuka (lawan dari inert)', () => {
    expect(sidebar).toContain('const drawerOpen = isDrawer && mobileOpen;');
    expect(sidebar).toMatch(/useDrawerFocus\(\{\s*active: drawerOpen,/);
    // Rail desktop tak boleh punya perangkap fokus: `active` tak boleh hanya mobileOpen.
    expect(sidebar).not.toMatch(/useDrawerFocus\(\{\s*active: mobileOpen/);
  });

  it('tombol menu dan laci saling merujuk, dan ref tombolnya sampai ke laci', () => {
    expect(topbar).toContain('aria-expanded={mobileOpen}');
    expect(topbar).toContain('aria-controls={drawerId}');
    expect(topbar).toContain('ref={toggleRef}');
    expect(sidebar).toContain('id={drawerId}');
    expect(sidebar).toContain('returnRef: toggleRef');
    // AppLayout memberi Sidebar dan Topbar id dan ref yang SAMA.
    expect(count(layout, 'drawerId={drawerId}')).toBe(2);
    expect(count(layout, 'toggleRef={toggleRef}')).toBe(2);
    expect(layout).toContain('mobileOpen={mobileOpen}');
  });

  it('pemilih cabang tidak tampil di sidebar maupun menu Lainnya: satu workshop (P18.21)', () => {
    expect(sidebar).not.toContain('BranchSelector');
    expect(sidebar).not.toContain('setActiveOutlet');
    expect(mobileNav).not.toContain('mobile-outlet');
    expect(mobileNav).not.toContain('setActiveOutlet');
  });
});
