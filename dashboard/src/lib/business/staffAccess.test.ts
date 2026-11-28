import { describe, expect, it } from 'vitest';
import {
  assignmentNote,
  canCreateService,
  canEditServiceIdentity,
  canSeeCustomerPhone,
  canWorkOnService,
} from './staffAccess';
import type { Role } from '@/data/types';

const ROLES: Role[] = ['owner', 'admin', 'karyawan'];

describe('hak Teknisi atas tiket (P18.3)', () => {
  it.each([
    ['owner', true],
    ['admin', true],
    ['karyawan', false],
  ] as const)('%s: membuat tiket, melihat nomor WA, mengubah identitas = %s', (role, ok) => {
    expect(canCreateService(role)).toBe(ok);
    expect(canSeeCustomerPhone(role)).toBe(ok);
    expect(canEditServiceIdentity(role)).toBe(ok);
  });

  it('tanpa peran (belum masuk) tidak boleh apa pun', () => {
    for (const fn of [canCreateService, canSeeCustomerPhone, canEditServiceIdentity]) {
      expect(fn(undefined)).toBe(false);
      expect(fn(null)).toBe(false);
    }
  });
});

describe('canWorkOnService', () => {
  const rizal = { id: 'u-rizal', role: 'karyawan' as const };
  const dimas = { id: 'u-dimas', role: 'karyawan' as const };

  it('Admin dan Pemilik mengubah semua tiket, ditugaskan atau tidak', () => {
    for (const role of ['owner', 'admin'] as const) {
      const actor = { id: 'u-x', role };
      expect(canWorkOnService(actor, { technicianId: null })).toBe(true);
      expect(canWorkOnService(actor, { technicianId: 'u-rizal' })).toBe(true);
    }
  });

  it('Teknisi hanya tiket yang ditugaskan kepadanya', () => {
    expect(canWorkOnService(rizal, { technicianId: 'u-rizal' })).toBe(true);
    expect(canWorkOnService(dimas, { technicianId: 'u-rizal' })).toBe(false);
  });

  it('tiket belum ditugaskan: Teknisi hanya melihat sampai Admin menugaskan', () => {
    expect(canWorkOnService(dimas, { technicianId: null })).toBe(false);
    expect(canWorkOnService(dimas, { technicianId: '' })).toBe(false);
  });

  it('belum masuk = tidak boleh', () => {
    expect(canWorkOnService(null, { technicianId: 'u-rizal' })).toBe(false);
    expect(canWorkOnService(undefined, { technicianId: null })).toBe(false);
  });

  it('peran dibaca dari semua nilai Role', () => {
    const allowed = ROLES.filter((role) => canWorkOnService({ id: 'x', role }, { technicianId: null }));
    expect(allowed).toEqual(['owner', 'admin']);
  });
});

describe('assignmentNote', () => {
  it('tiket tanpa teknisi', () => {
    expect(assignmentNote({ technicianId: null, technicianName: '' })).toEqual({ kind: 'unassigned' });
    expect(assignmentNote({ technicianId: null, technicianName: '   ' })).toEqual({ kind: 'unassigned' });
  });

  it('tiket bernama teknisi', () => {
    expect(assignmentNote({ technicianId: 'u-rizal', technicianName: ' Rizal Pratama ' })).toEqual({
      kind: 'assigned',
      name: 'Rizal Pratama',
    });
  });

  it('tiket lama hanya bernama, tanpa id', () => {
    expect(assignmentNote({ technicianId: null, technicianName: 'Rizal' })).toEqual({ kind: 'assigned', name: 'Rizal' });
  });

  it('id ada tetapi namanya hilang: tampil tanda pisah, bukan kosong', () => {
    expect(assignmentNote({ technicianId: 'u-1', technicianName: '' })).toEqual({ kind: 'assigned', name: '-' });
  });
});
