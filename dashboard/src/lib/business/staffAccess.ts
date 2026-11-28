import { isManager } from '@/config/plans';
import type { Role, Service } from '@/data/types';

/**
 * Siapa boleh apa pada tiket servis, sebagai cermin keputusan Pemilik P18.3
 * (PRD F-01.1, F-02.3, F-05.1): Teknisi (`karyawan`) tidak membuat tiket, tidak
 * melihat nomor WA pelanggan, dan hanya mengubah tiket yang ditugaskan kepadanya.
 * Penegak sebenarnya adalah RLS dan trigger di database (L-71b); fungsi ini
 * menjaga layar agar tidak menampilkan kontrol yang pasti ditolak.
 */

type MaybeRole = Role | null | undefined;

/** Servis Baru, termasuk klaim garansi (membuat tiket baru). */
export function canCreateService(role: MaybeRole): boolean {
  return !!role && isManager(role);
}

/** Nomor WA pelanggan: di daftar, detail, pesan, dan hasil pencarian. */
export function canSeeCustomerPhone(role: MaybeRole): boolean {
  return !!role && isManager(role);
}

/** Nama dan nomor pelanggan, penugasan teknisi, dan pilihan cabang di formulir tiket. */
export function canEditServiceIdentity(role: MaybeRole): boolean {
  return !!role && isManager(role);
}

interface Actor {
  id: string;
  role: Role;
}

/**
 * Mengubah tahap, sparepart, dan data kerja sebuah tiket. Admin dan Pemilik
 * semua tiket; Teknisi hanya yang `technicianId`-nya dirinya. Nama teknisi pada
 * tiket lama tanpa id tidak dihitung: server hanya membaca id.
 */
export function canWorkOnService(actor: Actor | null | undefined, service: Pick<Service, 'technicianId'>): boolean {
  if (!actor) return false;
  if (isManager(actor.role)) return true;
  return !!service.technicianId && service.technicianId === actor.id;
}

export type AssignmentNote = { kind: 'unassigned' } | { kind: 'assigned'; name: string };

/** Keterangan untuk Teknisi yang membuka tiket yang bukan miliknya. */
export function assignmentNote(service: Pick<Service, 'technicianId' | 'technicianName'>): AssignmentNote {
  const name = (service.technicianName ?? '').trim();
  if (!service.technicianId && !name) return { kind: 'unassigned' };
  return { kind: 'assigned', name: name || '-' };
}
