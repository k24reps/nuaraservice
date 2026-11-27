import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Organization } from '@/data/types';

// --- Mocks ---------------------------------------------------------------
// orgConfig pulls the active org from the session store and writes via the
// repository. Both are mocked so these tests stay pure (no IndexedDB/Supabase).

const state: { org: Organization | null } = { org: null };
const setStateMock = vi.fn((patch: { org: Organization }) => {
  state.org = patch.org;
});

vi.mock('@/stores/session', () => ({
  useSessionStore: {
    getState: () => ({ org: state.org }),
    setState: (patch: { org: Organization }) => setStateMock(patch),
  },
}));

const setSingletonMock = vi.fn(async (_name: string, value: Organization) => value);

vi.mock('@/data', () => ({
  repository: {
    setSingleton: (name: string, value: Organization) => setSingletonMock(name, value),
  },
}));

import {
  getCategories,
  getComplaintTemplatesFor,
  getLateToleranceMinutes,
  getMobileNavigation,
  getPrivacyNotice,
  getReviewUrl,
  setCategories,
  setComplaintTemplates,
  setComplaintTemplatesFor,
  setLateToleranceMinutes,
  setMobileNavigation,
  setPrivacyNotice,
  setReviewUrl,
  seedCategoriesFromLocal,
} from './orgConfig';

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'TechFix',
    address: '',
    phone: '',
    logoDataUrl: null,
    servicePrefix: 'FM',
    planType: 'trial',
    trialStartedAt: null,
    planExpiredAt: null,
    maxOutlets: 1,
    maxUsers: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Organization;
}

describe('orgConfig device categories (cloud-backed, 0032)', () => {
  beforeEach(() => {
    state.org = makeOrg();
    setStateMock.mockClear();
    setSingletonMock.mockClear();
    localStorage.clear();
  });

  it('reads categories from the org settings (cloud) when present', () => {
    state.org = makeOrg({ settings: { deviceCategories: ['Laptop', 'HP'] } });
    expect(getCategories()).toEqual(['Laptop', 'HP']);
  });

  it('falls back to legacy per-device localStorage when cloud is empty', () => {
    localStorage.setItem('fixmaster-categories-org-1', JSON.stringify(['Printer']));
    expect(getCategories()).toEqual(['Printer']);
  });

  it('falls back to the default starter list when neither cloud nor local has data', () => {
    expect(getCategories()).toEqual(['Laptop/PC', 'HP', 'Elektronik rumah tangga']);
  });

  it('treats an empty configured cloud list as unconfigured (returns defaults)', () => {
    state.org = makeOrg({ settings: { deviceCategories: [] } });
    expect(getCategories()).toEqual(['Laptop/PC', 'HP', 'Elektronik rumah tangga']);
  });

  it('persists categories to the org row and refreshes the session store', async () => {
    await setCategories(['Tablet', 'Konsol']);
    expect(setSingletonMock).toHaveBeenCalledTimes(1);
    const [name, value] = setSingletonMock.mock.calls[0];
    expect(name).toBe('organization');
    expect(value.settings?.deviceCategories).toEqual(['Tablet', 'Konsol']);
    // Store updated so readers react immediately.
    expect(setStateMock).toHaveBeenCalledTimes(1);
    expect(getCategories()).toEqual(['Tablet', 'Konsol']);
  });

  it('preserves other settings keys when writing categories', async () => {
    state.org = makeOrg({ settings: { deviceCategories: ['A'] } });
    await setCategories(['A', 'B']);
    const [, value] = setSingletonMock.mock.calls[0];
    expect(value.settings?.deviceCategories).toEqual(['A', 'B']);
  });

  describe('seedCategoriesFromLocal', () => {
    it('lifts a legacy local list into the cloud when cloud is empty', async () => {
      localStorage.setItem('fixmaster-categories-org-1', JSON.stringify(['Laptop']));
      const seeded = await seedCategoriesFromLocal();
      expect(seeded).toBe(true);
      expect(setSingletonMock).toHaveBeenCalledTimes(1);
      expect(getCategories()).toEqual(['Laptop']);
    });

    it('is a no-op when the cloud copy already exists', async () => {
      state.org = makeOrg({ settings: { deviceCategories: ['Laptop'] } });
      localStorage.setItem('fixmaster-categories-org-1', JSON.stringify(['Stale']));
      const seeded = await seedCategoriesFromLocal();
      expect(seeded).toBe(false);
      expect(setSingletonMock).not.toHaveBeenCalled();
    });

    it('is a no-op when there is nothing local to seed', async () => {
      const seeded = await seedCategoriesFromLocal();
      expect(seeded).toBe(false);
      expect(setSingletonMock).not.toHaveBeenCalled();
    });
  });

  describe('mobile navigation', () => {
    it('reads the shared layout and normalizes missing slots', () => {
      state.org = makeOrg({ settings: { mobileNavigation: ['/finance', '/services'] } });
      expect(getMobileNavigation()).toEqual(['/finance', '/services', '/', '/pos']);
    });

    it('persists a clean layout without replacing other org settings', async () => {
      state.org = makeOrg({ settings: { deviceCategories: ['Laptop'] } });
      await setMobileNavigation(['/services', '/services', '/pos', '/suppliers']);

      const [, value] = setSingletonMock.mock.calls[0];
      expect(value.settings?.deviceCategories).toEqual(['Laptop']);
      expect(value.settings?.mobileNavigation).toEqual(['/services', '/pos', '/suppliers', '/']);
      expect(setStateMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('orgConfig isian Pengaturan L-70 (tersimpan di baris toko)', () => {
  beforeEach(() => {
    localStorage.clear();
    state.org = makeOrg();
    setStateMock.mockClear();
    setSingletonMock.mockClear();
  });

  it('keluhan: tanpa simpanan, jenis bawaan memakai isi awal landing page', () => {
    expect(getComplaintTemplatesFor('HP')).toHaveLength(4);
    expect(getComplaintTemplatesFor('Laptop/PC')).toHaveLength(7);
    expect(getComplaintTemplatesFor('Elektronik rumah tangga')).toHaveLength(5);
  });

  it('keluhan: jenis tanpa isi awal memakai daftar umum yang sudah ada', async () => {
    await setComplaintTemplates(['Umum A']);
    expect(getComplaintTemplatesFor('Printer')).toEqual(['Umum A']);
    expect(getComplaintTemplatesFor(undefined)).toEqual(['Umum A']);
  });

  it('keluhan: menyimpan satu jenis tidak mengubah jenis lain dan tidak menghapus pengaturan lain', async () => {
    state.org = makeOrg({ settings: { deviceCategories: ['HP'], waTemplates: { selesai: 'x' } } });
    await setComplaintTemplatesFor('HP', ['Layar blank']);
    expect(getComplaintTemplatesFor('HP')).toEqual(['Layar blank']);
    expect(getComplaintTemplatesFor('Laptop/PC')).toHaveLength(7);
    expect(state.org?.settings?.deviceCategories).toEqual(['HP']);
    expect(state.org?.settings?.waTemplates).toEqual({ selesai: 'x' });
    expect(setSingletonMock).toHaveBeenCalledWith('organization', expect.anything());
  });

  it('keluhan: daftar kosong yang disimpan dihormati, bukan diganti isi awal', async () => {
    await setComplaintTemplatesFor('HP', []);
    expect(getComplaintTemplatesFor('HP')).toEqual([]);
  });

  it('privasi: kosong sampai diisi, dibersihkan, dan bisa dikosongkan lagi', async () => {
    expect(getPrivacyNotice()).toBe('');
    await setPrivacyNotice('  Data dipakai untuk servis.  ');
    expect(getPrivacyNotice()).toBe('Data dipakai untuk servis.');
    await setPrivacyNotice('   ');
    expect(getPrivacyNotice()).toBe('');
    expect(state.org?.settings?.privacyNotice).toBeUndefined();
  });

  it('link ulasan: kosong sampai diisi, https diterima, selain itu ditolak dan tak tersimpan', async () => {
    expect(getReviewUrl()).toBe('');
    await setReviewUrl('https://g.page/r/abc/review');
    expect(getReviewUrl()).toBe('https://g.page/r/abc/review');
    setSingletonMock.mockClear();
    await expect(setReviewUrl('http://g.page/abc')).rejects.toThrow(/https/);
    expect(setSingletonMock).not.toHaveBeenCalled();
    expect(getReviewUrl()).toBe('https://g.page/r/abc/review');
    await setReviewUrl('');
    expect(getReviewUrl()).toBe('');
  });

  it('link ulasan: nilai tersimpan yang bukan https dibaca kosong', () => {
    state.org = makeOrg({ settings: { reviewUrl: 'javascript:alert(1)' } });
    expect(getReviewUrl()).toBe('');
  });

  it('toleransi terlambat: tanpa isian 0, menyimpan 0 sampai 120, di luar itu ditolak', async () => {
    expect(getLateToleranceMinutes()).toBe(0);
    await setLateToleranceMinutes(10);
    expect(getLateToleranceMinutes()).toBe(10);
    await setLateToleranceMinutes(120);
    expect(getLateToleranceMinutes()).toBe(120);
    setSingletonMock.mockClear();
    await expect(setLateToleranceMinutes(121)).rejects.toThrow();
    await expect(setLateToleranceMinutes(-1)).rejects.toThrow();
    await expect(setLateToleranceMinutes(1.5)).rejects.toThrow();
    expect(setSingletonMock).not.toHaveBeenCalled();
    await setLateToleranceMinutes(null);
    expect(getLateToleranceMinutes()).toBe(0);
  });
});
