import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast as sonner } from 'sonner';
import { demoGuard, useDemoStore } from './demo';
import { useSettingsStore } from './settings';
import { translate } from '@/i18n';

/**
 * Penjaga demo menerima KUNCI kamus atau `{ text }` untuk teks yang sudah
 * diterjemahkan. Pembedanya dijaga tes karena `tsc` tak bisa: string polos yang
 * salah ketik sebagai teks akan tampil ke pengguna sebagai kuncinya sendiri.
 */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** Semua pesan yang dikirim ke sonner, apa pun nadanya, sesuai urutan. */
const messages = () =>
  (['success', 'error', 'warning', 'info'] as const)
    .flatMap((tone) => vi.mocked(sonner[tone]).mock.invocationCallOrder.map((order, i) => ({
      order,
      message: vi.mocked(sonner[tone]).mock.calls[i][0] as string,
    })))
    .sort((a, b) => a.order - b.order)
    .map((m) => m.message);

beforeEach(() => {
  vi.clearAllMocks();
  useDemoStore.setState({ isDemo: true });
  useSettingsStore.setState({ language: 'id' });
});

describe('demoGuard', () => {
  it('di luar demo tidak memblokir dan tidak menampilkan apa pun', () => {
    useDemoStore.setState({ isDemo: false });
    expect(demoGuard('demo.logout')).toBe(false);
    expect(demoGuard({ text: 'apa saja' })).toBe(false);
    expect(messages()).toEqual([]);
  });

  it('tanpa argumen memakai pesan bawaan dari kamus', () => {
    expect(demoGuard()).toBe(true);
    expect(messages()).toEqual([translate('id', 'demo.default')]);
  });

  it('kunci diterjemahkan ke bahasa yang sedang aktif', () => {
    useSettingsStore.setState({ language: 'en' });
    expect(demoGuard('demo.logout')).toBe(true);
    expect(messages()).toEqual([translate('en', 'demo.logout')]);
    expect(messages()[0]).not.toBe(translate('id', 'demo.logout'));
  });

  it('{ text } ditampilkan apa adanya, tak dicari di kamus', () => {
    expect(demoGuard({ text: 'Cetak nota tersedia di versi penuh.' })).toBe(true);
    expect(messages()).toEqual(['Cetak nota tersedia di versi penuh.']);
  });
});
