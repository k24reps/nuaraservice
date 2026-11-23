import { useCallback, useEffect, useState } from 'react';
import { Boxes, Check, LoaderCircle, Mail, Send, Store, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useCollection } from '@/hooks/useCollection';
import { interpolate } from '@/lib/business/notify';
import { isValidInviteEmail, canChangeRole, canDeactivate } from '@/lib/business/team';
import { logActivity } from '@/lib/activity';
import { useT, type TranslationKey } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import {
  isSupabaseConfigured,
  inviteMember,
  listPendingInvites,
  revokeInvite,
  setMemberRole,
  setMemberOutlets,
  getMemberOutlets,
  getOrgMemberOutlets,
  deactivateMember,
  deleteMember,
  type PendingInvite,
} from '@/data/supabase-client';
import type { Outlet, Role } from '@/data/types';
import { SettingsCard, SettingsHint, SettingsSection, ToggleChip } from './settingsUi';

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

const ROLE_LABEL: Record<string, TranslationKey> = {
  owner: 'settingsPage.owner',
  admin: 'settingsPage.admin',
  karyawan: 'settingsPage.karyawan',
};

function MemberOutletsEditor({
  memberId,
  outlets,
  onClose,
}: {
  memberId: string;
  outlets: Outlet[];
  onClose: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMemberOutlets(memberId)
      .then((ids) => {
        if (!cancelled) setSelected(ids);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : t('settingsPage.loadBranchesFailed')),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, t]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const save = async () => {
    setBusy(true);
    try {
      await setMemberOutlets(memberId, selected);
      toast.success(t('settingsPage.penugasanCabangDisimpan'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.saveBranchesFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface px-5 py-4 @max-[561px]/settings:px-4">
      <div className="flex flex-col gap-0.5">
        <strong className="text-sm font-semibold">{t('settingsPage.cabangYangDapatDiakses')}</strong>
        <small className="text-sm text-muted-foreground">Anggota ini hanya melihat &amp; mengelola data cabang terpilih.</small>
      </div>
      {loading ? (
        <small className="text-sm text-muted-foreground">{t('settingsPage.memuat')}</small>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {outlets.map((o) => {
            const on = selected.includes(o.id);
            return (
              <ToggleChip key={o.id} on={on} onClick={() => toggle(o.id)} icon={on ? <Check aria-hidden /> : <Store aria-hidden />}>
                {o.name}
              </ToggleChip>
            );
          })}
        </div>
      )}
      {!loading && selected.length === 0 && (
        <small className="text-sm text-muted-foreground" role="note">
          {t('settingsPage.pPilihMinimalSatuCabang')}
        </small>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('settingsPage.tutup')}
        </Button>
        <Button size="sm" onClick={save} disabled={busy || selected.length === 0} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {t('settingsPage.simpan')}
        </Button>
      </div>
    </div>
  );
}

/** Tab Tim (L-66): undang anggota, daftar anggota, peran, dan penugasan cabang. */
export function TeamSettings({
  employees,
  outlets,
}: {
  employees: ReturnType<typeof useCollection<'employees'>>['data'];
  outlets: Outlet[];
}) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const me = useSessionStore((s) => s.currentEmployee);

  const { refetch } = useCollection('employees');

  const [confirmOff, setConfirmOff] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('karyawan');
  // Outlets to assign on invite (empty = all, decided at claim time).
  const [inviteOutlets, setInviteOutlets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Per-member outlet assignment editor (memberId being edited).
  const [editOutletsFor, setEditOutletsFor] = useState<string | null>(null);
  // membership_id -> assigned outlet ids, for the at-a-glance summary per row.
  const [memberOutlets, setMemberOutlets2] = useState<Record<string, string[]>>({});

  const loadMemberOutlets = useCallback(async () => {
    if (!isSupabaseConfigured || !orgId) return;
    try {
      setMemberOutlets2(await getOrgMemberOutlets(orgId));
    } catch {
      // Non-fatal: the summary is informational; editor still works.
    }
  }, [orgId]);

  const toggleInviteOutlet = (id: string) =>
    setInviteOutlets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const loadInvites = useCallback(async () => {
    if (!isSupabaseConfigured || !orgId) return;
    try {
      setInvites(await listPendingInvites(orgId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.loadInvitesFailed'));
    }
  }, [orgId, t]);

  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    let cancelled = false;
    listPendingInvites(orgId)
      .then((data) => {
        if (!cancelled) setInvites(data);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : t('settingsPage.loadInvitesFailed')),
      );
    return () => {
      cancelled = true;
    };
  }, [orgId, t]);

  // Load the per-member outlet assignment summary (for the team list badges).
  // Inline .then() with a cancelled guard — mirrors the invites effect so the
  // setState is not flagged as synchronous-in-effect.
  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;
    let cancelled = false;
    getOrgMemberOutlets(orgId)
      .then((m) => {
        if (!cancelled) setMemberOutlets2(m);
      })
      .catch(() => {
        // Non-fatal: summary is informational; editor still works.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Jumlah anggota tidak dibatasi sejak harga per unit (0101).
  const invite = async () => {
    if (!name.trim()) return toast.error(t('settingsPage.namaWajibDiisi'));
    if (!isValidInviteEmail(email)) return toast.error(t('settingsPage.emailTidakValid'));
    setBusy(true);
    try {
      await inviteMember({ orgId, email, name, role, outletIds: inviteOutlets });
      // Tindakan kewenangan dicatat: siapa menambah siapa, dengan peran apa.
      logActivity({
        action: 'member.invite',
        entityType: 'member',
        entityLabel: name.trim(),
        meta: { email: email.trim(), role },
      });
      toast.success(interpolate(t('settingsPage.inviteCreated'), { email: email.trim() }));
      setName('');
      setEmail('');
      setRole('karyawan');
      setInviteOutlets([]);
      await loadInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      const target = invites.find((i) => i.id === id);
      await revokeInvite(id);
      logActivity({
        action: 'invite.revoke',
        entityType: 'invite',
        entityId: id,
        entityLabel: target?.email ?? '',
        meta: { name: target?.name ?? '', role: target?.role ?? null },
      });
      await loadInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.cancelInviteFailed'));
    }
  };

  const changeRole = async (memberId: string, newRole: Role) => {
    try {
      await setMemberRole(memberId, newRole);
      logActivity({
        action: 'member.role',
        entityType: 'member',
        entityId: memberId,
        entityLabel: employees.find((e) => e.id === memberId)?.name ?? '',
        meta: { role: newRole },
      });
      toast.success(t('settingsPage.peranDiperbarui'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.roleFailed'));
    }
  };

  const deactivate = async (memberId: string) => {
    setConfirmOff(null);
    try {
      await deactivateMember(memberId);
      logActivity({
        action: 'member.deactivate',
        entityType: 'member',
        entityId: memberId,
        entityLabel: employees.find((e) => e.id === memberId)?.name ?? '',
      });
      toast.success(t('settingsPage.anggotaDinonaktifkan'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.deactivateFailed'));
    }
  };

  const deleteMemberAction = async (memberId: string) => {
    setConfirmDelete(null);
    try {
      const gone = employees.find((e) => e.id === memberId);
      await deleteMember(memberId);
      logActivity({
        action: 'member.delete',
        entityType: 'member',
        entityId: memberId,
        entityLabel: gone?.name ?? '',
        meta: { role: gone?.role ?? null },
      });
      toast.success(t('settingsPage.anggotaDihapusPermanen'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settingsPage.removeMemberFailed'));
    }
  };
  return (
    <SettingsSection>
      {isSupabaseConfigured && (
        <SettingsCard icon={<UserPlus aria-hidden />} title={t('settingsPage.undangAnggota')}>
          <SettingsHint>{t('settingsPage.pKaryawanMendaftarSendiriDengan')}</SettingsHint>
          {/* Di wadah sempit peran berbagi baris dan tombol Undang selebar kartu (FixMaster: @media 640px). */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[160px] flex-1">
              <TextInput placeholder={t('settingsPage.nama')} aria-label={t('settingsPage.nama')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <TextInput
                type="email"
                inputMode="email"
                placeholder={t('settingsPage.emailContohCom')}
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="@max-[641px]/settings:min-w-[120px] @max-[641px]/settings:flex-1">
              <SelectBox
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                aria-label={t('settingsPage.peran')}
                options={[
                  { value: 'karyawan', label: t('settingsPage.karyawan') },
                  { value: 'admin', label: t('settingsPage.admin') },
                ]}
              />
            </div>
            <Button onClick={invite} disabled={busy} aria-busy={busy || undefined} className="@max-[641px]/settings:w-full">
              {busy ? <Spinner /> : <Send aria-hidden />}
              {t('settingsPage.undang')}
            </Button>
          </div>
          {role !== 'owner' && outlets.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 border-t border-dashed border-border pt-3">
              <span className="text-sm font-semibold">{t('settingsPage.tugaskanCabangOpsional')}</span>
              <div className="flex flex-wrap gap-1.5">
                {outlets.map((o) => {
                  const on = inviteOutlets.includes(o.id);
                  return (
                    <ToggleChip key={o.id} on={on} onClick={() => toggleInviteOutlet(o.id)} icon={on ? <Check aria-hidden /> : <Store aria-hidden />}>
                      {o.name}
                    </ToggleChip>
                  );
                })}
              </div>
              <small className="text-sm text-muted-foreground">{t('settingsPage.kosongkanUntukAksesSemua')}</small>
            </div>
          )}
          {invites.length > 0 && (
            <ul>
              {invites.map((inv) => (
                <li key={inv.id} className={ROW}>
                  <span className={AVATAR}>
                    <Mail aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm font-semibold [overflow-wrap:anywhere]">{inv.email}</strong>
                    {/* Undangan kini punya masa berlaku 14 hari (0078) — sebelumnya
                        email salah ketik pun bisa diklaim setahun kemudian dan langsung
                        membuka seluruh data toko. */}
                    <small className="text-xs text-muted-foreground">
                      {t(ROLE_LABEL[inv.role])} ·{' '}
                      {inv.expiresAt && new Date(inv.expiresAt) < new Date()
                        ? t('settingsPage.inviteExpired')
                        : inv.expiresAt
                          ? interpolate(t('settingsPage.inviteValidUntil'), { date: new Date(inv.expiresAt).toLocaleDateString('id-ID') })
                          : t('settingsPage.invitePending')}
                    </small>
                  </div>
                  <span className={ACTIONS}>
                    <Button variant="ghost" size="sm" onClick={() => void revoke(inv.id)}>
                      <X aria-hidden />
                      {t('settingsPage.batalkan')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      )}

      <SettingsCard flush icon={<Users aria-hidden />} title={t('settingsPage.anggotaTim')}>
        <ul>
          {employees.map((e) => {
            const isSelf = me?.id === e.id;
            // Sekali saja per baris: tombol dan tooltip-nya harus menjawab dari
            // pemeriksaan YANG SAMA, bukan dua panggilan yang bisa berbeda —
            // kontrol hidup dengan tooltip "terkunci" persis bug yang blok ini perbaiki.
            const lockedOwner = e.role === 'owner' && !canChangeRole(e, 'karyawan', employees);
            const canTurnOff = canDeactivate(e, employees);
            return (
              <li key={e.id} className={`${ROW} px-5 @max-[561px]/settings:px-4`}>
                <span className={AVATAR}>{e.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold [overflow-wrap:anywhere]">{e.name}</strong>
                  <small className="text-xs text-muted-foreground">{t(ROLE_LABEL[e.role])}</small>
                  {isSupabaseConfigured && e.role !== 'owner' && outlets.length > 0 && (
                    <small className="mt-0.5 flex max-w-full items-center gap-1.5 font-mono text-xs text-muted-foreground [&>svg]:size-3 [&>svg]:shrink-0">
                      <Store aria-hidden />
                      <span className="truncate">
                        {(memberOutlets[e.id] ?? []).length === 0
                          ? t('settingsPage.noBranch')
                          : outlets
                              .filter((o) => (memberOutlets[e.id] ?? []).includes(o.id))
                              .map((o) => o.name)
                              .join(', ')}
                      </span>
                    </small>
                  )}
                </div>
                {/* Semua kontrol dalam SATU sel supaya di wadah sempit turun ke
                    baris sendiri selebar kartu (dulu saudara lepas yang berdesakan
                    di baris 390px). */}
                {isSupabaseConfigured && !isSelf && e.active ? (
                  <span className={ACTIONS}>
                    {/* Penjaga "owner terakhir" sudah lama ada di lib dan di server,
                        tapi layar tetap membiarkan tombolnya ditekan lalu menampilkan
                        penolakan. Sekarang kontrolnya yang mati, dengan alasannya. */}
                    <span title={lockedOwner ? t('settingsPage.lastOwnerRole') : undefined}>
                      <SelectBox
                        size="sm"
                        className="w-auto"
                        value={e.role}
                        onValueChange={(v) => void changeRole(e.id, v as Role)}
                        aria-label={interpolate(t('settingsPage.roleOf'), { name: e.name })}
                        disabled={lockedOwner}
                        options={[
                          { value: 'owner', label: t('settingsPage.owner') },
                          { value: 'admin', label: t('settingsPage.admin') },
                          { value: 'karyawan', label: t('settingsPage.karyawan') },
                        ]}
                      />
                    </span>
                    {e.role !== 'owner' && outlets.length > 0 ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditOutletsFor(editOutletsFor === e.id ? null : e.id)}>
                        <Store aria-hidden />
                        {t('settingsPage.cabang')}
                      </Button>
                    ) : (
                      outlets.length > 0 && (
                        // Owner selalu mencakup semua cabang (RLS is_org_owner), jadi
                        // penugasan outlet tak berlaku untuknya. Admin di-scope per
                        // cabang (0036) lewat tombol "Cabang" di atas.
                        <span title={t('settingsPage.ownerMencakupSemuaCabang')}>
                          <Badge variant="info">
                            <Boxes aria-hidden />
                            Semua cabang
                          </Badge>
                        </span>
                      )
                    )}
                    <span title={canTurnOff ? undefined : t('settingsPage.lastOwnerOff')}>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmOff(e.id)} disabled={!canTurnOff}>
                        <UserMinus aria-hidden />
                        {t('settingsPage.nonaktifkan')}
                      </Button>
                    </span>
                  </span>
                ) : (
                  <span className={ACTIONS}>
                    <Badge variant={e.active ? 'success' : 'secondary'}>
                      {e.active ? t('settingsPage.active') : t('settingsPage.inactive')}
                    </Badge>
                    {isSupabaseConfigured && !isSelf && !e.active && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(e.id)}>
                        <Trash2 aria-hidden />
                        {t('settingsPage.hapus')}
                      </Button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {editOutletsFor && (
          <MemberOutletsEditor
            key={editOutletsFor}
            memberId={editOutletsFor}
            outlets={outlets}
            onClose={() => {
              setEditOutletsFor(null);
              void loadMemberOutlets();
            }}
          />
        )}
      </SettingsCard>

      <ConfirmDialog
        open={confirmOff !== null}
        title={t('settingsPage.nonaktifkanAnggota')}
        message={t('settingsPage.anggotaTidakAkanBisa')}
        confirmLabel={t('settingsPage.nonaktifkan')}
        danger
        onConfirm={() => confirmOff && void deactivate(confirmOff)}
        onCancel={() => setConfirmOff(null)}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('settingsPage.hapusAnggotaPermanen')}
        message={t('settingsPage.anggotaAkanDihapusDari')}
        confirmLabel={t('settingsPage.hapusPermanen')}
        danger
        onConfirm={() => confirmDelete && void deleteMemberAction(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </SettingsSection>
  );
}

const ROW = 'flex items-center gap-3 border-b border-dashed border-border py-3 last:border-b-0 @max-[641px]/settings:flex-wrap @max-[641px]/settings:gap-y-2';
const ACTIONS = 'ml-auto flex items-center gap-2 @max-[641px]/settings:basis-full @max-[641px]/settings:flex-wrap @max-[641px]/settings:justify-end';
const AVATAR = 'grid size-[38px] shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground';
