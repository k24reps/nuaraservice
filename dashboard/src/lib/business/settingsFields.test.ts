import { describe, expect, it } from 'vitest';
import {
  LATE_TOLERANCE_MAX,
  PRIVACY_NOTICE_MAX,
  REVIEW_URL_MAX,
  cleanPrivacyNotice,
  parseLateTolerance,
  readLateTolerance,
  validateReviewUrl,
} from './settingsFields';
import {
  DEFAULT_COMPLAINTS_BY_CATEGORY,
  DEFAULT_DEVICE_CATEGORIES,
  DEVICE_HOME,
  DEVICE_HP,
  DEVICE_LAPTOP,
  resolveComplaints,
} from './complaints';

describe('validateReviewUrl', () => {
  it('kosong berarti tanpa link', () => {
    expect(validateReviewUrl('')).toEqual({ ok: true, value: '' });
    expect(validateReviewUrl('   ')).toEqual({ ok: true, value: '' });
  });

  it.each([
    'https://g.page/r/CabcXYZ/review',
    'https://search.google.com/local/writereview?placeid=ChIJ123',
    'https://maps.app.goo.gl/AbCdEf123',
  ])('menerima https yang utuh: %s', (u) => {
    expect(validateReviewUrl(u)).toEqual({ ok: true, value: u });
  });

  it('memangkas spasi tepi', () => {
    expect(validateReviewUrl('  https://g.page/nuara  ')).toEqual({ ok: true, value: 'https://g.page/nuara' });
  });

  it.each(['http://g.page/nuara', 'ftp://g.page/nuara', 'javascript:alert(1)', 'data:text/html,hai', 'g.page/nuara'])(
    'menolak yang bukan https: %s',
    (u) => {
      expect(validateReviewUrl(u)).toEqual({ ok: false, reason: 'scheme' });
    },
  );

  it.each(['https://', 'https://localhost/ulasan', 'https://user:pass@g.page/nuara', 'https://g.page/ nuara'])(
    'menolak format yang rusak: %s',
    (u) => {
      expect(validateReviewUrl(u)).toEqual({ ok: false, reason: 'format' });
    },
  );

  it('menolak yang terlalu panjang', () => {
    const long = 'https://g.page/' + 'a'.repeat(REVIEW_URL_MAX);
    expect(validateReviewUrl(long)).toEqual({ ok: false, reason: 'length' });
  });
});

describe('parseLateTolerance', () => {
  it('kosong berarti tidak diisi', () => {
    expect(parseLateTolerance('')).toEqual({ ok: true, value: null });
    expect(parseLateTolerance('  ')).toEqual({ ok: true, value: null });
  });

  it.each([
    ['0', 0],
    ['10', 10],
    ['120', 120],
  ])('menerima %s menit', (raw, n) => {
    expect(parseLateTolerance(raw)).toEqual({ ok: true, value: n });
  });

  it.each(['121', '-1', '1.5', '10 menit', 'abc', '1000'])('menolak %s', (raw) => {
    expect(parseLateTolerance(raw)).toEqual({ ok: false });
  });

  it('batas atas sama dengan konstanta', () => {
    expect(parseLateTolerance(String(LATE_TOLERANCE_MAX + 1))).toEqual({ ok: false });
  });
});

describe('readLateTolerance', () => {
  it('nilai sah dibaca apa adanya', () => {
    expect(readLateTolerance(15)).toBe(15);
    expect(readLateTolerance(0)).toBe(0);
  });

  it.each([undefined, null, '10', 10.5, -5, 121, Number.NaN])('nilai tak masuk akal dibaca 0: %s', (v) => {
    expect(readLateTolerance(v)).toBe(0);
  });
});

describe('cleanPrivacyNotice', () => {
  it('membersihkan spasi dan memotong ke batas', () => {
    expect(cleanPrivacyNotice('  Data dipakai untuk servis.  ')).toBe('Data dipakai untuk servis.');
    expect(cleanPrivacyNotice('x'.repeat(PRIVACY_NOTICE_MAX + 50))).toHaveLength(PRIVACY_NOTICE_MAX);
  });

  it('bukan teks berarti kosong', () => {
    expect(cleanPrivacyNotice(undefined)).toBe('');
    expect(cleanPrivacyNotice(42)).toBe('');
  });
});

describe('keluhan bawaan (nota landing page)', () => {
  it('tiga jenis dengan 7, 4, dan 5 keluhan: 16 butir', () => {
    expect(DEFAULT_DEVICE_CATEGORIES).toEqual([DEVICE_LAPTOP, DEVICE_HP, DEVICE_HOME]);
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_LAPTOP]).toHaveLength(7);
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_HP]).toHaveLength(4);
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_HOME]).toHaveLength(5);
    const all = Object.values(DEFAULT_COMPLAINTS_BY_CATEGORY).flat();
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);
  });

  it('memuat kalimat persis seperti di nota landing page', () => {
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_LAPTOP]).toContain('Bersihkan debu dan ganti thermal paste');
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_HP]).toContain('Bootloop atau restart sendiri');
    expect(DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_HOME]).toContain('Kulkas bermasalah (modul/kelistrikan)');
  });
});

describe('resolveComplaints', () => {
  const general = ['Umum A', 'Umum B'];

  it('daftar tersimpan untuk jenis itu menang atas isi awal', () => {
    expect(resolveComplaints(DEVICE_HP, { [DEVICE_HP]: ['Layar blank'] }, general)).toEqual(['Layar blank']);
  });

  it('isi daftar tersimpan yang bukan teks atau kosong dibuang', () => {
    const rusak = { [DEVICE_HP]: ['Layar blank', 42, '', '  ', null, 'Baterai kembung'] } as unknown as Record<string, string[]>;
    expect(resolveComplaints(DEVICE_HP, rusak, general)).toEqual(['Layar blank', 'Baterai kembung']);
  });

  it('daftar tersimpan yang kosong dihormati: Pemilik sengaja tanpa pilihan cepat', () => {
    expect(resolveComplaints(DEVICE_HP, { [DEVICE_HP]: [] }, general)).toEqual([]);
  });

  it('tanpa daftar tersimpan, jenis bawaan memakai isi awal', () => {
    expect(resolveComplaints(DEVICE_HOME, undefined, general)).toEqual([...DEFAULT_COMPLAINTS_BY_CATEGORY[DEVICE_HOME]]);
    expect(resolveComplaints(DEVICE_HOME, {}, general)).toHaveLength(5);
  });

  it('jenis lain tanpa daftar sendiri memakai daftar umum', () => {
    expect(resolveComplaints('Printer', { [DEVICE_HP]: ['x'] }, general)).toEqual(general);
  });

  it('tanpa jenis (form belum memilih) memakai daftar umum', () => {
    expect(resolveComplaints(undefined, undefined, general)).toEqual(general);
    expect(resolveComplaints('', undefined, general)).toEqual(general);
  });

  it('mengembalikan salinan: mengubah hasil tidak merusak isi awal', () => {
    const a = resolveComplaints(DEVICE_LAPTOP, undefined, general);
    a.push('lain');
    expect(resolveComplaints(DEVICE_LAPTOP, undefined, general)).toHaveLength(7);
  });
});
