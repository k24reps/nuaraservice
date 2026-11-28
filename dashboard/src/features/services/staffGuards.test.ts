import { describe, expect, it } from 'vitest';
import servicesPageRaw from './ServicesPage.tsx?raw';
import detailPageRaw from './ServiceDetailPage.tsx?raw';
import serviceModalRaw from './ServiceModal.tsx?raw';
import dashboardRaw from '@/features/dashboard/DashboardPage.tsx?raw';

// Checkout Windows (core.autocrlf) memberi CRLF pada ?raw.
const lf = (s: string) => s.replace(/\r\n/g, '\n');
const servicesPage = lf(servicesPageRaw);
const detailPage = lf(detailPageRaw);
const serviceModal = lf(serviceModalRaw);
const dashboard = lf(dashboardRaw);

/**
 * Teknisi: tanpa Servis Baru, tanpa nomor WA, hanya tiket yang ditugaskan (P18.3).
 * Tes bentuk-sumber, seperti settingsLayout.test.ts: komponennya terlalu berat
 * untuk dirender di sini, dan yang dijaga adalah SYARAT yang membungkus tiap
 * kontrol. Logika hak aksesnya diuji murni di staffAccess.test.ts.
 */
describe('Servis (daftar)', () => {
  it('semua pintu Servis Baru dijaga canCreate: tombol, dok jempol, pintasan N, ?new=1', () => {
    expect(servicesPage).toContain("canCreate && searchParams.get('new') === '1'");
    expect(servicesPage).toContain('if (!canCreate) return;');
    expect(servicesPage).toMatch(/if \(\s*!canCreate \|\| e\.key\.toLowerCase\(\) !== 'n'/);
    expect(servicesPage).toMatch(/\{canCreate && \(\s*<Button className="ml-auto phone:hidden" onClick=\{openNew\}>/);
    expect(servicesPage).toMatch(/\{canCreate && \(\s*<ThumbDock>/);
    expect(servicesPage).toContain("canCreate ? 'services.emptyFirst' : 'services.emptyFirstStaff'");
  });

  it('nomor WA, tombol WA, dan pencarian nomor hanya untuk yang boleh melihatnya', () => {
    expect(servicesPage).toMatch(/\{canSeePhone && \(\s*<small/);
    expect(servicesPage).toMatch(/\{canSeePhone && \(\s*<Button[^>]*onClick=\{\(\) => \{\s*setNotifyTarget\(s\)/);
    expect(servicesPage).toContain('matchesQuery(s, query, { phone: canSeePhone })');
  });

  it('aksi per baris hanya untuk tiket yang boleh diubah', () => {
    expect(servicesPage).toContain('const canWork = (s: Service) => canWorkOnService(me, s);');
    expect(servicesPage).toMatch(/!canWork\(s\) \? \(\s*statusBadge\(s\)/);
    expect(servicesPage).toMatch(/canWork\(s\) && canQuickAddParts\(s\.status\)/);
    expect(servicesPage).toMatch(/\{canWork\(s\) && \(\s*<Button[^>]*onClick=\{\(\) => \{\s*setEditing\(s\)/);
  });
});

describe('Detail tiket', () => {
  it('nomor, tombol WhatsApp, dan klaim garansi dijaga peran', () => {
    expect(detailPage).toMatch(/\{canSeePhone && \(\s*<p className="font-mono text-sm text-muted-foreground">/);
    expect(detailPage).toMatch(/\{canSeePhone && \(\s*<Button variant="outline" size="sm" onClick=\{\(\) => setNotifyOpen\(true\)\}>/);
    expect(detailPage).toContain('const claimable = canCreateService(role) && ');
  });

  it('Ubah, Update status, sparepart, dan hapus baris hanya untuk tiket yang boleh diubah', () => {
    expect(detailPage).toContain('const canWork = canWorkOnService(me, service);');
    expect(detailPage).toMatch(/\.\.\.\(canWork\s*\? \[\{ key: 'edit'/);
    expect(detailPage).toMatch(/\.\.\.\(canWork && !isTerminal\(service\.status\)/);
    expect(detailPage).toContain('const canAddParts = canWork && ');
    expect(detailPage).toMatch(/\{canWork && !cancelled && !\(manual && !isManager\)/);
  });

  it('tiket orang lain: catatan penugasan menggantikan tombol', () => {
    expect(detailPage).toMatch(/\{!canWork && \(\s*<p[^>]*role="note"/);
    expect(detailPage).toContain("t('serviceDetail.staffUnassigned')");
    expect(detailPage).toContain("t('serviceDetail.staffAssigned')");
  });
});

describe('Formulir tiket', () => {
  it('Teknisi mengubah tiketnya lewat formulir terbatas: tanpa pelanggan, teknisi, tabel pelanggan', () => {
    expect(serviceModal).toContain('const identityLocked = !!editing && !canEditServiceIdentity(me?.role);');
    expect(serviceModal).toContain('if (!identityLocked && !customerName.trim())');
    expect(serviceModal).toContain('if (!identityLocked && !customerPhone.trim())');
    expect(serviceModal).toMatch(/if \(!identityLocked\) \{\s*const candidates/);
    expect(serviceModal).toMatch(/\{!identityLocked && \(\s*<div className=\{row\}>/);
    expect(serviceModal).toMatch(/\{!identityLocked && \(\s*<Field label=\{t\('serviceForm\.technician'\)\}>/);
    expect(serviceModal).toContain('...(identityLocked ? {} : { technicianId:');
  });

  it('tiket baru tanpa pelanggan tidak pernah disimpan diam-diam', () => {
    expect(serviceModal).toContain("if (!customer) throw new Error('Pelanggan tiket baru tidak terbentuk');");
  });
});

describe('Beranda', () => {
  it('Servis Baru dan Kasir tidak tampil untuk Teknisi, juga peringatan stok', () => {
    expect(dashboard).toContain('const canCreate = canCreateService(me?.role);');
    expect(dashboard).toMatch(/\{isMgr && \(\s*<div className="ml-auto flex gap-2/);
    expect(dashboard).toMatch(/canCreate \? \(\s*<Link className=\{primaryLink\} to="\/services\?new=1">/);
    expect(dashboard).toMatch(/\{canCreate && \(\s*<ThumbDock>/);
    expect(dashboard).toContain("useCollection('inventory', { enabled: isMgr })");
    expect(dashboard).toContain('isMgr ? inventory : []');
  });
});
