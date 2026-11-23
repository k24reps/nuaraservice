import { EmptyValue } from '@/components/ui/EmptyValue';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Calculator,
  Menu,
  Receipt,
  Settings,
  SlidersHorizontal,
  Store,
  Users,
  Wallet as WalletIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Badge,
  Select,
  EmptyState,
  Icon,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCollection } from '@/hooks/useCollection';
import { repository } from '@/data';
import { getCurrentPosition } from '@/lib/geo';
import { newId } from '@/lib/id';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { roleAllows } from '@/config/plans';
import {
  setMobileNavigation as saveMobileNavigation,
} from '@/config/orgConfig';
import { NAV_ITEMS } from '@/config/navigation';
import {
  DEFAULT_MOBILE_NAV_PATHS,
  sanitizeMobileNavPaths,
} from '@/lib/business/navigation';
import { useT } from '@/i18n';
import { toast } from '@/stores/toast';
import { demoGuard } from '@/stores/demo';
import { isValidInviteEmail, canChangeRole, canDeactivate } from '@/lib/business/team';
import { createTransfer } from '@/features/finance/transferActions';
import { CountModal } from '@/features/finance/CountModal';
import { createFinanceEntry } from '@/data/financeEntry';
import { localDateStr } from '@/lib/time';
import { logActivity } from '@/lib/activity';
import { useSessionStore } from '@/stores/session';
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
import type { Wallet, Outlet, Role } from '@/data/types';
import { DATASETS, downloadCsv } from './exportDatasets';
import { createBackup, downloadBackup, restoreBackup } from './backupRestore';
import { DisplayCard } from './DisplayCard';
import { BusinessSettings } from './BusinessSettings';
import { OperationsSettings } from './OperationsSettings';
import { SettingsTabs } from './SettingsTabs';
import { QuoteRatesTab } from './QuoteRatesTab';
import { ReceiptTab } from './ReceiptTab';
import { useBackupStore } from '@/stores/backup';
import {
  listCloudBackups,
  readCloudBackup,
  latestBackupRun,
  latestBackupEmail,
  type CloudBackup,
  type BackupRun,
  type BackupEmailRun,
} from '@/data/cloudBackup';
import {
  backupEmailStatus,
  countRecords,
  parseBackup,
  type BackupFrequency,
} from '@/lib/business/backup';
import {
  getLastBackupAt,
  setLastBackupAt,
  setBackupEmail,
} from '@/config/orgConfig';
import styles from './SettingsPage.module.css';
import { interpolate } from '@/lib/business/notify';
import type { TranslationKey } from '@/i18n';

type Tab =
  | 'usaha'
  | 'operasional'
  | 'nota'
  | 'tarif'
  | 'tim'
  | 'keuangan'
  | 'outlet'
  | 'navigasi'
  | 'sistem';

/**
 * Batas atas radius geofence. Di atas ini "pagar"-nya tidak menjaga apa pun —
 * ia hanya membuat absensi terlihat terjaga sambil meloloskan siapa saja.
 */
const MAX_GEOFENCE_M = 5000;

/** Pagar kewajaran jumlah akun kas, sama dengan plan_quota di server (0101). */
const MAX_WALLETS = 99;

const TAB_IDS: Tab[] = [
  'usaha',
  'operasional',
  'nota',
  'tarif',
  'tim',
  'keuangan',
  'outlet',
  'navigasi',
  'sistem',
];

export function SettingsPage() {
  const me = useSessionStore((s) => s.currentEmployee);
  const resetWorkspace = useSessionStore((s) => s.resetWorkspace);
  const isOwner = me ? roleAllows(me.role, '*') : false;
  const t = useT();

  const { data: wallets } = useCollection('wallets');
  const { data: outlets } = useCollection('outlets');
  const { data: employees } = useCollection('employees');

  // ?tab= membuat kartu terkunci (dan kanal terkunci di sidebar) bisa
  // menautkan langsung ke tab yang relevan. Nilai tak dikenal jatuh ke
  // Usaha; tab yang tidak boleh dilihat peran ini disaring oleh visibleTabs.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requestedTab && TAB_IDS.includes(requestedTab) ? requestedTab : 'usaha',
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const TABS: {
    id: Tab;
    label: string;
    icon: LucideIcon;
    ownerOnly?: boolean;
    cloudOnly?: boolean;
  }[] = [
    { id: 'usaha', label: t('settingsPage.tabBusiness'), icon: Store },
    { id: 'operasional', label: t('settingsPage.tabOps'), icon: SlidersHorizontal },
    { id: 'nota', label: t('receipt.tab'), icon: Receipt },
    { id: 'tarif', label: t('quoteRates.tab'), icon: Calculator, ownerOnly: true },
    { id: 'tim', label: t('settingsPage.tabTeam'), icon: Users, ownerOnly: true },
    { id: 'keuangan', label: t('settingsPage.tabWallet'), icon: WalletIcon, ownerOnly: true },
    { id: 'outlet', label: t('settingsPage.tabOutlet'), icon: Building2, ownerOnly: true },
    {
      id: 'navigasi',
      label: t('settings.mobileNav.tab'),
      icon: Menu,
      ownerOnly: true,
    },
    { id: 'sistem', label: t('settingsPage.tabSystem'), icon: Settings },
  ];
  const visibleTabs = TABS.filter(
    (item) => (!item.ownerOnly || isOwner) && (!item.cloudOnly || isSupabaseConfigured),
  );

  return (
    <div className={styles.wrap}>
      <SettingsTabs tabs={visibleTabs} value={tab} onChange={setTab} label={t('settingsPage.sectionsAria')} />

      {tab === 'usaha' && <BusinessSettings isOwner={isOwner} />}
      {tab === 'operasional' && <OperationsSettings />}
      {tab === 'nota' && <ReceiptTab />}
      {tab === 'tarif' && isOwner && <QuoteRatesTab />}
      {tab === 'tim' && isOwner && <TeamTab employees={employees} outlets={outlets} />}
      {tab === 'keuangan' && isOwner && <WalletTab wallets={wallets} outlets={outlets} />}
      {tab === 'outlet' && isOwner && <OutletTab outlets={outlets} />}
      {tab === 'navigasi' && isOwner && <MobileNavigationCard />}
      {tab === 'sistem' && (
        <SystemTab
          onReset={() => {
            if (
              demoGuard('settingsPage.resetDemo')
            )
              return;
            setConfirmReset(true);
          }}
          isOwner={isOwner}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title={t('settingsPage.resetSeluruhData')}
        message={
          isSupabaseConfigured
            ? t('settingsPage.resetCloudMsg')
            : t('settingsPage.resetLocalMsg')
        }
        confirmLabel={t('settingsPage.yaResetSemua')}
        danger
        onConfirm={async () => {
          try {
            await resetWorkspace();
            toast.success(t('settingsPage.workspaceDireset'));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('settingsPage.resetFailed'));
          } finally {
            // In cloud the workspace stays mounted (empty), so the dialog must
            // be closed explicitly — it isn't unmounted like the local wizard path.
            setConfirmReset(false);
          }
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

function MobileNavigationCard() {
  const configured = useSessionStore((state) => state.org?.settings?.mobileNavigation);
  const initial = sanitizeMobileNavPaths(configured);
  return <MobileNavigationEditor key={initial.join('|')} initial={initial} />;
}

function MobileNavigationEditor({ initial }: { initial: string[] }) {
  const t = useT();
  const [draft, setDraft] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  const options = NAV_ITEMS.map((item) => ({ value: item.to, label: t(item.labelKey) }));

  const setSlot = (slot: number, path: string) => {
    setDraft((current) => {
      const next = [...current];
      const duplicateAt = next.indexOf(path);
      if (duplicateAt >= 0 && duplicateAt !== slot) {
        next[duplicateAt] = next[slot];
      }
      next[slot] = path;
      return sanitizeMobileNavPaths(next);
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveMobileNavigation(draft);
      toast.success(t('settings.mobileNav.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.mobileNav.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accent="brand">
      <CardHeader
        icon={<Icon name="bars" aria-hidden />}
        title={t('settings.mobileNav.title')}
      />
      <CardBody>
        <div className={styles.mobileNavIntro}>
          <div>
            <span className={styles.mobileNavKicker}>
              <span aria-hidden />
              {t('settings.mobileNav.ownerControl')}
            </span>
            <p>{t('settings.mobileNav.description')}</p>
          </div>
          <span className={styles.mobileNavSync}>
            <Icon name="check-double" aria-hidden /> {t('settings.mobileNav.synced')}
          </span>
        </div>

        <div className={styles.mobileNavEditor}>
          <div className={styles.mobileNavSlots}>
            {draft.map((path, index) => (
              <div className={styles.mobileNavSlot} key={index}>
                <span className={styles.mobileNavSlotNumber}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Select
                  id={`mobile-navigation-slot-${index + 1}`}
                  label={`${t('settings.mobileNav.slot')} ${index + 1}`}
                  value={path}
                  options={options}
                  onChange={(event) => setSlot(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className={styles.mobileNavPreviewWrap}>
            <span className={styles.mobileNavPreviewLabel}>
              {t('settings.mobileNav.preview')}
            </span>
            <div className={styles.mobileNavPreview}>
              {draft.map((path, index) => {
                const item = NAV_ITEMS.find((entry) => entry.to === path) ?? NAV_ITEMS[0];
                return (
                  <span
                    className={index === 0 ? styles.mobileNavPreviewActive : ''}
                    key={path}
                  >
                    <Icon
                      name={item.icon}
                      weight={index === 0 ? 'fill' : 'regular'}
                      aria-hidden
                    />
                    <small>{item.to === '/' ? t('nav.home') : t(item.labelKey)}</small>
                  </span>
                );
              })}
              <span>
                <Icon name="bars" aria-hidden />
                <small>{t('nav.more')}</small>
              </span>
            </div>
            <small className={styles.mobileNavHint}>{t('settings.mobileNav.hint')}</small>
          </div>
        </div>

        <div className={styles.saveFoot}>
          <Button
            variant="secondary"
            onClick={() => setDraft([...DEFAULT_MOBILE_NAV_PATHS])}
            iconLeft={<Icon name="repeat" aria-hidden />}
          >
            {t('settings.mobileNav.reset')}
          </Button>
          <Button
            onClick={save}
            loading={busy}
            iconLeft={<Icon name="check" aria-hidden />}
          >
            {t('common.save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

const ROLE_LABEL: Record<string, TranslationKey> = {
  owner: 'settingsPage.owner',
  admin: 'settingsPage.admin',
  karyawan: 'settingsPage.karyawan',
};

/**
 * Inline editor to assign a staff member to one or more branches (outlets).
 * Loads the current assignment on open, toggles chips, and replaces the set
 * via the set_member_outlets RPC. Empty selection is refused (0057): with no
 * fallback in auth_outlet_ids(), it would leave the member seeing no branch.
 */
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
    <div className={styles.outletEditor}>
      <div className={styles.outletEditorHead}>
        <strong>{t('settingsPage.cabangYangDapatDiakses')}</strong>
        <small className={styles.hint}>
          Anggota ini hanya melihat &amp; mengelola data cabang terpilih.
        </small>
      </div>
      {loading ? (
        <small className={styles.hint}>{t('settingsPage.memuat')}</small>
      ) : (
        <div className={styles.tplChips}>
          {outlets.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                className={[styles.tplChip, on ? styles.tplChipOn : ''].join(' ')}
                aria-pressed={on}
                onClick={() => toggle(o.id)}
              >
                <Icon name={on ? 'check' : 'shop'} aria-hidden /> {o.name}
              </button>
            );
          })}
        </div>
      )}
      {!loading && selected.length === 0 && (
        <small className={styles.hint} role="note">
          {t('settingsPage.pPilihMinimalSatuCabang')}
        </small>
      )}
      <div className={styles.addRow}>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t('settingsPage.tutup')}
        </Button>
        <Button size="sm" onClick={save} loading={busy} disabled={selected.length === 0}>
          {t('settingsPage.simpan')}
        </Button>
      </div>
    </div>
  );
}

function TeamTab({
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
    <>
      {isSupabaseConfigured && (
        <Card>
          <CardHeader
            icon={<Icon name="user-plus" aria-hidden />}
            title={t('settingsPage.undangAnggota')}
          />
          <CardBody>
            <p className={styles.hint}>
              {t('settingsPage.pKaryawanMendaftarSendiriDengan')}
            </p>
            <div className={styles.inviteRow}>
              <Input
                placeholder={t('settingsPage.nama')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder={t('settingsPage.emailContohCom')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                className={styles.roleSelect}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                aria-label={t('settingsPage.peran')}
              >
                <option value="karyawan">{t('settingsPage.karyawan')}</option>
                <option value="admin">{t('settingsPage.admin')}</option>
              </select>
              <Button
                onClick={invite}
                loading={busy}
                iconLeft={<Icon name="paper-plane-tilt" aria-hidden />}
              >
                {t('settingsPage.undang')}
              </Button>
            </div>
            {role !== 'owner' && outlets.length > 0 && (
              <div className={styles.outletPick}>
                <span className={styles.tplLabel}>{t('settingsPage.tugaskanCabangOpsional')}</span>
                <div className={styles.tplChips}>
                  {outlets.map((o) => {
                    const on = inviteOutlets.includes(o.id);
                    return (
                      <button
                        type="button"
                        key={o.id}
                        className={[styles.tplChip, on ? styles.tplChipOn : ''].join(' ')}
                        aria-pressed={on}
                        onClick={() => toggleInviteOutlet(o.id)}
                      >
                        <Icon name={on ? 'check' : 'shop'} aria-hidden /> {o.name}
                      </button>
                    );
                  })}
                </div>
                <small className={styles.hint}>
                  {t('settingsPage.kosongkanUntukAksesSemua')}
                </small>
              </div>
            )}
            {invites.length > 0 && (
              <ul className={styles.list}>
                {invites.map((inv) => (
                  <li key={inv.id} className={styles.listItem}>
                    <span className={styles.avatar}>
                      <Icon name="envelope" aria-hidden />
                    </span>
                    <div className={styles.itemInfo}>
                      <strong>{inv.email}</strong>
                      {/* Undangan kini punya masa berlaku 14 hari (0078) —
                          sebelumnya email salah ketik pun bisa diklaim setahun
                          kemudian dan langsung membuka seluruh data toko. */}
                      <small>
                        {t(ROLE_LABEL[inv.role])} ·{' '}
                        {inv.expiresAt && new Date(inv.expiresAt) < new Date()
                          ? t('settingsPage.inviteExpired')
                          : inv.expiresAt
                            ? interpolate(t('settingsPage.inviteValidUntil'), { date: new Date(inv.expiresAt).toLocaleDateString('id-ID') })
                            : t('settingsPage.invitePending')}
                      </small>
                    </div>
                    <span className={styles.itemActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void revoke(inv.id)}
                        iconLeft={<Icon name="x" aria-hidden />}
                      >
                        {t('settingsPage.batalkan')}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader icon={<Icon name="users" aria-hidden />} title={t('settingsPage.anggotaTim')} />
        <CardBody className={styles.noPad}>
          <ul className={styles.list}>
            {employees.map((e) => {
              const isSelf = me?.id === e.id;
              // Sekali saja per baris: tombol dan tooltip-nya harus menjawab
              // dari pemeriksaan YANG SAMA, bukan dua panggilan yang bisa
              // berbeda — kontrol hidup dengan tooltip "terkunci" persis bug
              // yang blok ini perbaiki.
              const lockedOwner = e.role === 'owner' && !canChangeRole(e, 'karyawan', employees);
              const canTurnOff = canDeactivate(e, employees);
              return (
                <li key={e.id} className={styles.listItem}>
                  <span className={styles.avatar}>{e.name.charAt(0).toUpperCase()}</span>
                  <div className={styles.itemInfo}>
                    <strong>{e.name}</strong>
                    <small>{t(ROLE_LABEL[e.role])}</small>
                    {isSupabaseConfigured && e.role !== 'owner' && outlets.length > 0 && (
                      <small className={styles.memberOutlets}>
                        <Icon name="shop" aria-hidden />{' '}
                        {(memberOutlets[e.id] ?? []).length === 0
                          ? t('settingsPage.noBranch')
                          : outlets
                              .filter((o) => (memberOutlets[e.id] ?? []).includes(o.id))
                              .map((o) => o.name)
                              .join(', ')}
                      </small>
                    )}
                  </div>
                  {/* All controls live in ONE flex cell so the mobile rule can
                      drop them to their own full-width line (they used to be
                      loose siblings squeezed into the 390px row). */}
                  {isSupabaseConfigured && !isSelf && e.active ? (
                    <span className={styles.itemActions}>
                      {/* Penjaga "owner terakhir" sudah lama ada di lib dan di
                          server, tapi layar tetap membiarkan tombolnya ditekan
                          lalu menampilkan penolakan. Sekarang kontrolnya yang
                          mati, dengan alasannya. */}
                      <select
                        className={styles.roleSelect}
                        value={e.role}
                        onChange={(ev) => void changeRole(e.id, ev.target.value as Role)}
                        aria-label={interpolate(t('settingsPage.roleOf'), { name: e.name })}
                        disabled={lockedOwner}
                        title={
                          lockedOwner
                            ? t('settingsPage.lastOwnerRole')
                            : undefined
                        }
                      >
                        <option value="owner">{t('settingsPage.owner')}</option>
                        <option value="admin">{t('settingsPage.admin')}</option>
                        <option value="karyawan">{t('settingsPage.karyawan')}</option>
                      </select>
                      {e.role !== 'owner' && outlets.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditOutletsFor(editOutletsFor === e.id ? null : e.id)
                          }
                          iconLeft={<Icon name="shop" aria-hidden />}
                        >
                          {t('settingsPage.cabang')}
                        </Button>
                      ) : (
                        outlets.length > 0 && (
                          // Owner selalu mencakup semua cabang (RLS is_org_owner),
                          // jadi penugasan outlet tak berlaku untuknya. Admin kini
                          // di-scope per-cabang (0036) lewat tombol "Cabang" di atas.
                          <span title={t('settingsPage.ownerMencakupSemuaCabang')}>
                            <Badge tone="info">
                              <Icon name="boxes-stacked" aria-hidden /> Semua cabang
                            </Badge>
                          </span>
                        )
                      )}
                      <span
                        title={
                          canTurnOff
                            ? undefined
                            : t('settingsPage.lastOwnerOff')
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmOff(e.id)}
                          disabled={!canTurnOff}
                          iconLeft={<Icon name="user-minus" aria-hidden />}
                        >
                          {t('settingsPage.nonaktifkan')}
                        </Button>
                      </span>
                    </span>
                  ) : (
                    <span className={styles.itemActions}>
                      <Badge tone={e.active ? 'success' : 'neutral'}>
                        {e.active ? t('settingsPage.active') : t('settingsPage.inactive')}
                      </Badge>
                      {isSupabaseConfigured && !isSelf && !e.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(e.id)}
                          iconLeft={<Icon name="trash" aria-hidden />}
                        >
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
        </CardBody>
      </Card>

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
    </>
  );
}

function WalletTab({ wallets, outlets }: { wallets: Wallet[]; outlets: Outlet[] }) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  // Pagar kewajaran yang sama dengan server (plan_quota, 0101), dicek
  // terhadap jumlah SESUDAH penambahan.
  const canAddWallet = wallets.length + 1 <= MAX_WALLETS;
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  // Hybrid wallet (OQ Q2): a wallet is either shared org-wide (null) or tied
  // to a specific branch. '' = Bersama (shared).
  const [outletId, setOutletId] = useState('');
  // Uang fisik di laci: kembalian Kasir selalu diambil dari wallet ini (0095).
  const [isCash, setIsCash] = useState(false);
  // Transfer sub-action: move funds between two wallets.
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [adding, setAdding] = useState(false);

  const outletName = (id: string | null) =>
    id ? (outlets.find((o) => o.id === id)?.name ?? t('settingsPage.cabang')) : t('settingsPage.bersama');

  const add = async () => {
    if (!canAddWallet)
      return toast.error(
        interpolate(t('settingsPage.walletQuota'), { n: String(MAX_WALLETS) }),
      );
    if (!name.trim()) return toast.error(t('settingsPage.namaWalletWajibDiisi'));
    if (adding) return;
    setAdding(true);
    const now = new Date().toISOString();
    const initial = parseRpInput(balance);
    try {
      const walletId = newId();
      // Wallet SELALU lahir bersaldo nol. Saldo awal adalah uang yang benar-benar
      // masuk ke kas, jadi ia dicatat sebagai setoran Modal — dulu angkanya
      // langsung ditulis ke saldo dan Buku Kas tak pernah bisa menjelaskan
      // dari mana uang itu datang.
      await repository.put('wallets', {
        id: walletId,
        orgId,
        outletId: outletId || null,
        name: name.trim(),
        balance: 0,
        sortOrder: wallets.length,
        isCash,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      if (initial > 0) {
        await createFinanceEntry({
          orgId,
          kind: 'income',
          date: localDateStr(),
          category: 'Modal',
          amount: initial,
          walletId,
          description: `Saldo awal ${name.trim()}`,
          outletId: outletId || null,
        });
      }
      toast.success(
        initial > 0 ? t('settingsPage.walletAddedModal') : t('settingsPage.walletAdded'),
      );
      setName('');
      setBalance('');
      setOutletId('');
      setIsCash(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletAddFailed'));
    } finally {
      setAdding(false);
    }
  };

  const doTransfer = async () => {
    const amount = parseRpInput(transferAmount);
    const from = wallets.find((w) => w.id === fromId);
    const to = wallets.find((w) => w.id === toId);
    if (!from || !to) return toast.error(t('settingsPage.pilihWalletAsalTujuan'));
    setTransferring(true);
    try {
      // Jalur yang sama dengan Buku Kas (0086): validasi kembar server, RPC di
      // cloud, tabel wallet_transfers + log di lokal.
      await createTransfer({ wallets, fromWalletId: fromId, toWalletId: toId, amount, note: '' });
      toast.success(interpolate(t('settingsPage.transferDone'), { amount: fmtRp(amount), from: from.name, to: to.name }));
      setTransferAmount('');
      setFromId('');
      setToId('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.transferFailed'));
    } finally {
      setTransferring(false);
    }
  };


  return (
    <Card>
      <CardHeader icon={<Icon name="wallet" aria-hidden />} title={t('settingsPage.walletKas')} />
      <CardBody>
        <p className={styles.hint}>
          Kas bisa <strong>{t('settingsPage.bersama')}</strong> (dipakai semua cabang) atau dikhususkan ke
          satu cabang. Saat transaksi, hanya kas bersama + kas cabang aktif yang tampil.
        </p>
        <ul className={styles.walletList}>
          {wallets.map((w) => (
            <WalletRow key={w.id} wallet={w} outletLabel={outletName(w.outletId)} outlets={outlets} />
          ))}
        </ul>
        <div className={styles.addRow}>
          <Input
            placeholder={t('settingsPage.namaWallet')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder={t('settingsPage.saldoAwal')}
            value={balance}
            onChange={(e) => setBalance(fmtRpInput(e.target.value))}
          />
          {outlets.length > 0 && (
            <Select
              aria-label={t('settingsPage.cabangWallet')}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              options={[
                { value: '', label: 'Bersama (semua cabang)' },
                ...outlets.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          )}
          <Button
            onClick={add}
            loading={adding}
            disabled={!canAddWallet}
            iconLeft={<Icon name="plus" aria-hidden />}
          >
            {t('settingsPage.tambah')}
          </Button>
        </div>
        <label className={styles.columnOption}>
          <input type="checkbox" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} />
          <span className={styles.columnText}>
            <strong>{t('settingsPage.uangTunaiLaci')}</strong>
            <small>{t('settingsPage.kembalianKasirSelaluDiambil')}</small>
          </span>
        </label>

        {wallets.length >= 2 && (
          <div className={styles.tplGroup}>
            <span className={styles.tplLabel}>{t('settingsPage.transferSaldoAntarWallet')}</span>
            <p className={styles.tplHint}>
              {t('settingsPage.pPindahkanSaldoAntarKas')}
            </p>
            <div className={styles.addRow}>
              <Select
                aria-label={t('settingsPage.walletAsal')}
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                options={wallets.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${fmtRp(w.balance)})`,
                }))}
                placeholder={t('settingsPage.dariWallet')}
              />
              <Select
                aria-label={t('settingsPage.walletTujuan')}
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                options={wallets
                  .filter((w) => w.id !== fromId)
                  .map((w) => ({ value: w.id, label: w.name }))}
                placeholder={t('settingsPage.keWallet')}
              />
              <Input
                placeholder={t('settingsPage.nominal')}
                value={transferAmount}
                onChange={(e) => setTransferAmount(fmtRpInput(e.target.value))}
              />
              <Button
                onClick={doTransfer}
                disabled={transferring}
                iconLeft={<Icon name="arrow-right-arrow-left" aria-hidden />}
              >
                {t('settingsPage.transfer')}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Satu baris wallet: ganti nama dan hapus. Sebelumnya kas hanya bisa DITAMBAH —
 * salah ketik nama menetap selamanya, dan kas yang tak dipakai lagi tetap
 * muncul di setiap form pembayaran. Penghapusan dijaga server (0077): kas yang
 * masih memegang saldo atau masih dipakai baris kas tidak boleh hilang.
 */
function WalletRow({ wallet, outletLabel, outlets }: { wallet: Wallet; outletLabel: string; outlets: Outlet[] }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  // Kalibrasi saldo lewat jendela yang sama dengan Keuangan: selisihnya dicatat,
  // bukan saldo ditimpa diam-diam.
  const [counting, setCounting] = useState(false);
  const [name, setName] = useState(wallet.name);
  const [outletId, setOutletId] = useState(wallet.outletId ?? '');
  const [isCash, setIsCash] = useState(!!wallet.isCash);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const rename = async () => {
    if (!name.trim()) return toast.error(t('settingsPage.namaWalletWajibDiisi'));
    setBusy(true);
    try {
      await repository.put('wallets', {
        ...wallet,
        name: name.trim(),
        // Cabang & tunai bisa diatur belakangan — wallet lama lahir "Bersama".
        outletId: outletId || null,
        isCash,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t('settingsPage.walletDiperbarui'));
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletRenameFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirm(false);
    // Cermin penjagaan server, supaya alasannya muncul sebelum permintaan dikirim.
    if (wallet.balance !== 0) {
      return toast.error(
        `"${wallet.name}" masih memegang ${fmtRp(wallet.balance)}. Pindahkan saldonya lewat transfer terlebih dahulu.`,
      );
    }
    setBusy(true);
    try {
      await repository.remove('wallets', wallet.id);
      toast.success(t('settingsPage.walletDihapus'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.walletItem}>
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={interpolate(t('settingsPage.walletNameOf'), { name: wallet.name })}
          />
          {outlets.length > 0 && (
            <Select
              aria-label={interpolate(t('settingsPage.walletBranchOf'), { name: wallet.name })}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              options={[
                { value: '', label: 'Bersama (semua cabang)' },
                ...outlets.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          )}
          <label className={styles.columnOption}>
            <input type="checkbox" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} />
            <span className={styles.columnText}>
              <strong>{t('settingsPage.uangTunaiLaci')}</strong>
            </span>
          </label>
          <span className={styles.itemActions}>
            <Button size="sm" onClick={rename} loading={busy}>
              {t('settingsPage.simpan')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setName(wallet.name);
                setOutletId(wallet.outletId ?? '');
                setIsCash(!!wallet.isCash);
                setEditing(false);
              }}
            >
              {t('settingsPage.batal')}
            </Button>
          </span>
        </>
      ) : (
        <>
          <span>
            {wallet.name}
            <Badge tone={wallet.outletId ? 'info' : 'neutral'}>{outletLabel}</Badge>
            {wallet.isCash && <Badge tone="success">{t('settingsPage.tunai')}</Badge>}
          </span>
          <strong>{fmtRp(wallet.balance)}</strong>
          <span className={styles.itemActions}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCounting(true)}
              iconLeft={<Icon name="list-check" aria-hidden />}
            >
              {t('finance.countAction')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              iconLeft={<Icon name="pen" aria-hidden />}
            >
              {t('settingsPage.ubah')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirm(true)}
              disabled={busy}
              iconLeft={<Icon name="trash" aria-hidden />}
            >
              {t('settingsPage.hapus')}
            </Button>
          </span>
        </>
      )}
      <CountModal open={counting} onClose={() => setCounting(false)} wallets={[wallet]} initialWalletId={wallet.id} />
      <ConfirmDialog
        open={confirm}
        title={t('settingsPage.hapusWallet')}
        message={`"${wallet.name}" akan dihapus. Hanya bisa dihapus bila saldonya nol dan belum pernah dipakai di pemasukan atau pengeluaran.`}
        confirmLabel={t('settingsPage.hapus')}
        danger
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

function OutletTab({ outlets }: { outlets: Outlet[] }) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error(t('settingsPage.namaOutletWajibDiisi'));
    if (adding) return;
    setAdding(true);
    const now = new Date().toISOString();
    try {
      await repository.put('outlets', {
        id: newId(),
        orgId,
        outletId: null,
        name: name.trim(),
        address: address.trim(),
        isPrimary: outlets.length === 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      toast.success(t('settingsPage.outletDitambahkan'));
      setName('');
      setAddress('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.outletAddFailed'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Icon name="shop" aria-hidden />} title={t('settingsPage.outletCabang')} />
      <CardBody>
        {outlets.length === 0 ? (
          <EmptyState
            icon={<Icon name="shop" aria-hidden />}
            title={t('settingsPage.belumAdaOutletTambahan')}
            description={t('settingsPage.outletUtamaDigunakanSecara')}
          />
        ) : (
          <ul className={styles.list}>
            {outlets.map((o) => (
              <OutletRow key={o.id} outlet={o} />
            ))}
          </ul>
        )}
        <div className={styles.addRow}>
          <Input
            placeholder={t('settingsPage.namaOutlet')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder={t('settingsPage.alamat')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button
            onClick={add}
            loading={adding}
            iconLeft={<Icon name="plus" aria-hidden />}
          >
            {t('settingsPage.tambah')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * One outlet row with an expandable geofence editor. Setting coordinates +
 * radius turns on GPS-validated attendance for that outlet; leaving them empty
 * keeps clock-in unrestricted. "Gunakan lokasi saya" fills lat/lng from the
 * device GPS (owner is expected to set it while physically at the outlet).
 */
function OutletRow({ outlet }: { outlet: Outlet }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(outlet.lat != null ? String(outlet.lat) : '');
  const [lng, setLng] = useState(outlet.lng != null ? String(outlet.lng) : '');
  const [radius, setRadius] = useState(
    outlet.geofenceRadiusM != null ? String(outlet.geofenceRadiusM) : '100',
  );
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  // Nama & alamat cabang dulu tidak bisa diubah sama sekali setelah dibuat,
  // dan cabang yang tutup tidak bisa dihapus — keduanya menetap di semua
  // pemilih cabang selamanya.
  const [name, setName] = useState(outlet.name);
  const [address, setAddress] = useState(outlet.address ?? '');
  const [confirm, setConfirm] = useState(false);

  const geofenceOn =
    outlet.lat != null && outlet.lng != null && (outlet.geofenceRadiusM ?? 0) > 0;

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLat(pos.lat.toFixed(6));
      setLng(pos.lng.toFixed(6));
      const radN = Number(radius) || 0;
      // Akurasi yang lebih lebar dari radius berarti titik ini bisa meleset
      // keluar pagar — dikatakan sekarang, bukan setelah absensi ditolak.
      if (radN > 0 && pos.accuracyM > radN) {
        toast.warning(
          interpolate(t('settingsPage.gpsWide'), { acc: String(Math.round(pos.accuracyM)), radius: String(radN) }),
        );
      } else {
        toast.success(interpolate(t('settingsPage.locationFound'), { acc: String(Math.round(pos.accuracyM)) }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.locationFailed'));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const latN = lat.trim() === '' ? null : Number(lat);
    const lngN = lng.trim() === '' ? null : Number(lng);
    const radN = radius.trim() === '' ? null : Math.round(Number(radius));
    if (latN != null && (Number.isNaN(latN) || latN < -90 || latN > 90)) {
      return toast.error(t('settingsPage.latitudeTidakValid90'));
    }
    if (lngN != null && (Number.isNaN(lngN) || lngN < -180 || lngN > 180)) {
      return toast.error(t('settingsPage.longitudeTidakValid180'));
    }
    if (radN != null && (Number.isNaN(radN) || radN <= 0)) {
      return toast.error(t('settingsPage.radiusHarusLebihDari'));
    }
    // Radius sebesar satu kota bukan pagar: ia meloloskan siapa pun sambil
    // tetap terlihat seperti penjagaan.
    if (radN != null && radN > MAX_GEOFENCE_M) {
      return toast.error(
        interpolate(t('settingsPage.radiusMax'), { max: MAX_GEOFENCE_M.toLocaleString('id-ID') }),
      );
    }
    if (!name.trim()) return toast.error(t('settingsPage.namaCabangWajibDiisi'));
    setBusy(true);
    try {
      await repository.put('outlets', {
        ...outlet,
        name: name.trim(),
        address: address.trim(),
        lat: latN,
        lng: lngN,
        geofenceRadiusM: radN,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t('settingsPage.cabangDisimpan'));
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.geofenceFailed'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await repository.put('outlets', {
        ...outlet,
        lat: null,
        lng: null,
        geofenceRadiusM: null,
        updatedAt: new Date().toISOString(),
      });
      setLat('');
      setLng('');
      setRadius('100');
      toast.success(t('settingsPage.geofenceDimatikanAbsensiBebas'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.geofenceOffFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.outletItem}>
      <div className={styles.listItem}>
        <span className={styles.avatar}>
          <Icon name="shop" aria-hidden />
        </span>
        <div className={styles.itemInfo}>
          <strong>{outlet.name}</strong>
          <small>{outlet.address || <EmptyValue />}</small>
        </div>
        {geofenceOn && (
          <Badge tone="success">
            <Icon name="map-pin" aria-hidden /> {outlet.geofenceRadiusM}m
          </Badge>
        )}
        {outlet.isPrimary && <Badge tone="brand">{t('settingsPage.utama')}</Badge>}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          iconLeft={<Icon name="map-pin" aria-hidden />}
        >
          {open ? t('settingsPage.tutup') : t('settingsPage.geofence')}
        </Button>
      </div>

      {open && (
        <div className={styles.geofenceBox}>
          <div className={styles.geofenceRow}>
            <Input label={t('settingsPage.namaCabang')} value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label={t('settingsPage.alamat')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <p className={styles.geofenceHint}>
            <Icon name="info-circle" aria-hidden /> Isi koordinat + radius untuk
            mewajibkan absensi dari lokasi outlet. Kosongkan untuk absensi bebas lokasi.
            Set saat Anda sedang berada di outlet. Radius maksimal{' '}
            {MAX_GEOFENCE_M.toLocaleString('id-ID')} m.
          </p>
          <div className={styles.geofenceRow}>
            <Input
              label={t('settingsPage.latitude')}
              placeholder="-6.200000"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <Input
              label={t('settingsPage.longitude')}
              placeholder="106.816666"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
            <Input
              label={t('settingsPage.radiusM')}
              type="number"
              placeholder="100"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
          <div className={styles.geofenceActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={useMyLocation}
              loading={locating}
              iconLeft={<Icon name="map-pin" aria-hidden />}
            >
              {t('settingsPage.gunakanLokasiSaya')}
            </Button>
            <span className={styles.geofenceSpacer} />
            {!outlet.isPrimary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(true)}
                disabled={busy}
                iconLeft={<Icon name="trash" aria-hidden />}
              >
                {t('settingsPage.hapusCabang')}
              </Button>
            )}
            {geofenceOn && (
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>
                {t('settingsPage.matikan')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={save}
              loading={busy}
              iconLeft={<Icon name="check" aria-hidden />}
            >
              {t('settingsPage.simpan')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('settingsPage.hapusCabang2')}
        message={`"${outlet.name}" akan dihapus. Hanya bisa dihapus bila belum pernah dipakai transaksi, absensi, kas, atau penugasan anggota. Cabang utama tidak bisa dihapus.`}
        confirmLabel={t('settingsPage.hapus')}
        danger
        onConfirm={async () => {
          setConfirm(false);
          setBusy(true);
          try {
            await repository.remove('outlets', outlet.id);
            toast.success(t('settingsPage.cabangDihapus'));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('settingsPage.branchDeleteFailed'));
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

/** CSV export of each major dataset. Owner-only (includes finance + PII). */
function ExportDataCard() {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);

  const onExport = async (key: string, label: string) => {
    setBusy(key);
    try {
      const def = DATASETS.find((d) => d.key === key);
      if (!def) return;
      const csv = await def.toCsv();
      downloadCsv(def.label, csv);
      toast.success(interpolate(t('settingsPage.exported'), { label }));
    } catch {
      toast.error(t('settingsPage.gagalMengeksporData'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Icon name="download" aria-hidden />}
        title={t('settingsPage.exportData')}
      />
      <CardBody>
        <p className={styles.dangerNote}>
          {t('settingsPage.pUnduhDataSebagaiCsv')}
        </p>
        <div className={styles.exportGrid}>
          {DATASETS.map((d) => (
            <button
              key={d.key}
              className={styles.exportBtn}
              onClick={() => onExport(d.key, d.label)}
              disabled={busy !== null}
            >
              <Icon name={d.icon} aria-hidden />
              <span>{busy === d.key ? 'Menyiapkan…' : d.label}</span>
              <Icon name="download" aria-hidden />
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Full JSON backup + restore (local-first). Owner-only because a backup
 * contains ALL data (finance + customer PII). Unlike CSV export, the JSON is
 * lossless and restorable. Restore is REPLACE semantics and disabled in cloud
 * mode (rely on Supabase backups/PITR there).
 */
function BackupCard() {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const cloud = isSupabaseConfigured;
  const isDemo = Boolean(org?.isDemo);
  // Restore is available to every owner (this whole page is owner-only). The
  // server RPC restore_org_data (migration 0020) enforces owner + forces
  // org_id, so an owner can only ever replace THEIR OWN org's data.
  const canRestore = true;
  const frequency = useBackupStore((s) => s.frequency);
  const lastBackupAt = useBackupStore((s) => s.lastBackupAt);
  const setFrequency = useBackupStore((s) => s.setFrequency);
  const markBackedUp = useBackupStore((s) => s.markBackedUp);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  // Jumlah data di file yang menunggu konfirmasi. Dialog dulu memakai
  // kalimat statis yang tidak pernah menyebut isi file, padahal
  // countRecords() sudah ada dan diuji — hanya tidak pernah dipanggil.
  const [pendingCount, setPendingCount] = useState(0);

  // Satu pintu masuk untuk kedua sumber file (unggahan & backup cloud):
  // validasi DULU, laporkan kegagalannya saat itu juga, dan baru buka
  // dialog kalau filenya benar-benar bisa dipulihkan. Sebelumnya file
  // rusak atau kosong tetap membuka dialog merah "SEMUA data akan
  // DIGANTI", dan baru gagal setelah pengguna menekan Pulihkan.
  const stageRestore = (text: string) => {
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setPendingCount(countRecords(parsed.backup));
    setPendingText(text);
  };
  const [restoring, setRestoring] = useState(false);
  // Backup otomatis (server-scheduled) — hanya ada di mode cloud.
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [lastRun, setLastRun] = useState<BackupRun | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  // Email backup mingguan (0085). Tanpa nilai = aktif; hanya `false` mematikan.
  const emailOn = useSessionStore((s) => s.org?.settings?.backupEmail !== false);
  const [lastEmail, setLastEmail] = useState<BackupEmailRun | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!cloud || !org?.id) return;
    let cancelled = false;
    void (async () => {
      // setState-nya di dalam closure async, bukan di badan effect: yang
      // sinkron memicu render bertingkat (react-hooks/set-state-in-effect).
      setLoadingCloud(true);
      try {
        const [files, run, mail] = await Promise.all([
          listCloudBackups(org.id),
          latestBackupRun(org.id),
          latestBackupEmail(org.id).catch(() => null),
        ]);
        if (cancelled) return;
        setCloudBackups(files);
        setLastRun(run);
        setLastEmail(mail);
      } catch {
        // Kegagalan memuat daftar tidak boleh melumpuhkan kartu ini —
        // backup manual tetap harus bisa dijalankan.
      } finally {
        if (!cancelled) setLoadingCloud(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloud, org?.id]);

  // Memulihkan dari salinan cloud memakai JALUR YANG SAMA dengan file
  // lokal: ambil teksnya, lalu masuk ke dialog konfirmasi yang sudah ada.
  // Satu format, satu jalur restore, satu tempat yang bisa salah.
  const restoreFromCloud = async (backup: CloudBackup) => {
    if (demoGuard('demo.restore')) return;
    try {
      stageRestore(await readCloudBackup(backup.path));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.backupReadFailed'));
    }
  };

  const toggleBackupEmail = async () => {
    setSavingEmail(true);
    try {
      await setBackupEmail(!emailOn);
      toast.success(emailOn ? t('settingsPage.backupEmailOff') : t('settingsPage.backupEmailOn'));
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanPengaturan'));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleBackup = async () => {
    if (demoGuard('demo.backup')) return;
    setBusy(true);
    try {
      const backup = await createBackup(org?.id ?? null);
      downloadBackup(backup);
      markBackedUp();
      // Waktunya juga disimpan di baris organisasi: "kapan terakhir toko ini
      // di-backup" adalah fakta tentang TOKO, bukan tentang browser ini.
      await setLastBackupAt(new Date().toISOString()).catch(() => {
        /* pengingat lokal sudah tercatat; sinkronisasi bukan syarat backup */
      });
      toast.success(t('settingsPage.backupBerhasilDiunduh'));
    } catch {
      toast.error(t('settingsPage.gagalMembuatBackup'));
    } finally {
      setBusy(false);
    }
  };

  // Read the picked file's text, then open the replace-confirm dialog.
  const onPickFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file later
    if (!file) return;
    try {
      stageRestore(await file.text());
    } catch {
      toast.error(t('settingsPage.gagalMembacaFile'));
    }
  };

  const handleRestore = async () => {
    if (demoGuard('demo.restoreData'))
      return;
    if (pendingText === null) return;
    setRestoring(true);
    try {
      const res = await restoreBackup(pendingText);
      if (res.ok) {
        toast.success(interpolate(t('settingsPage.restored'), { n: String(res.restored) }));
        setTimeout(() => window.location.reload(), 900);
      } else {
        toast.error(res.error);
      }
    } finally {
      setRestoring(false);
      setPendingText(null);
    }
  };

  // Waktu dari baris organisasi menang: ia berlaku untuk seluruh toko, bukan
  // hanya browser yang sedang dipakai.
  const sharedBackupAt = getLastBackupAt();
  const backupHint = sharedBackupAt
    ? interpolate(t('settingsPage.lastBackupShop'), { at: new Date(sharedBackupAt).toLocaleString('id-ID') })
    : lastBackupAt
      ? interpolate(t('settingsPage.lastBackupDevice'), { at: new Date(lastBackupAt).toLocaleString('id-ID') })
      : t('settingsPage.neverBackedUp');

  return (
    <Card>
      <CardHeader
        icon={<Icon name="clock-rotate-left" aria-hidden />}
        title={t('settingsPage.backupRestore')}
      />
      <CardBody>
        <p className={styles.dangerNote}>
          {t('settingsPage.pBackupMenyimpanSeluruhData')}
        </p>
        <div className={styles.backupRow}>
          <Button
            onClick={handleBackup}
            loading={busy}
            iconLeft={<Icon name="download" aria-hidden />}
          >
            {t('settingsPage.backupSekarang')}
          </Button>
          {canRestore && (
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              iconLeft={<Icon name="clock-rotate-left" aria-hidden />}
            >
              {t('settingsPage.pulihkanDariFile')}
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onPickFile(e.currentTarget)}
            hidden
          />
        </div>
        {cloud && (
          <p className={styles.planNote}>
            <Icon name="info-circle" aria-hidden /> Restore mengganti SELURUH data
            operasional org ini dengan isi file. Tim, langganan, dan profil org TIDAK ikut
            diganti. Disarankan backup dulu sebelum memulihkan.
            {isDemo ? ' (Akun demo)' : ''}
          </p>
        )}
        {cloud && (
          <>
            <hr className={styles.dangerDivider} />
            <div className={styles.autoBackupHead}>
              <span className={styles.autoBackupLabel}>{t('settingsPage.backupOtomatis')}</span>
              {lastRun && (
                <span
                  className={styles.autoBackupStatus}
                  data-tone={lastRun.status === 'ok' ? 'ok' : 'failed'}
                >
                  <span className={styles.autoBackupLed} aria-hidden />
                  {lastRun.status === 'ok' ? 'Berjalan' : 'Gagal'}
                </span>
              )}
            </div>
            <p className={styles.planNote}>
              {t('settingsPage.pServerMembuatSalinanPenuh')}
            </p>
            {/* Kegagalan ditampilkan, bukan disembunyikan: backup yang diam-diam
                berhenti membuat pemilik merasa aman padahal tidak. */}
            {lastRun?.status === 'failed' && (
              <p className={styles.autoBackupError}>
                <Icon name="triangle-exclamation" aria-hidden /> Backup terakhir gagal
                pada {new Date(lastRun.startedAt).toLocaleString('id-ID')}
                {lastRun.error ? `: ${lastRun.error}` : ''}
              </p>
            )}
            {loadingCloud && <p className={styles.planNote}>{t('settingsPage.memuatDaftar')}</p>}
            {!loadingCloud && cloudBackups.length === 0 && (
              <p className={styles.planNote}>
                {t('settingsPage.pBelumAdaSalinanOtomatis')}
              </p>
            )}
            {cloudBackups.length > 0 && (
              <ul className={styles.autoBackupList}>
                {cloudBackups.map((b) => (
                  <li key={b.path} className={styles.autoBackupItem}>
                    <span className={styles.autoBackupWhen}>
                      {b.createdAt
                        ? new Date(b.createdAt).toLocaleString('id-ID')
                        : b.name}
                    </span>
                    <span className={styles.autoBackupSize}>
                      {Math.max(1, Math.round(b.sizeBytes / 1024))} KB
                    </span>
                    <button
                      type="button"
                      className={styles.autoBackupAction}
                      onClick={() => void restoreFromCloud(b)}
                    >
                      {t('settingsPage.pulihkan')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {cloud && !isDemo && (
          <>
            <hr className={styles.dangerDivider} />
            <div className={styles.autoBackupHead}>
              <span className={styles.autoBackupLabel}>{t('settingsPage.emailBackupMingguan')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={emailOn}
                aria-label={t('settingsPage.emailBackupMingguan')}
                className={styles.channelSwitch}
                data-on={emailOn}
                disabled={savingEmail}
                onClick={() => void toggleBackupEmail()}
              >
                <span className={styles.channelSwitchLed} aria-hidden />
                {emailOn ? t('settingsPage.active') : t('settingsPage.off')}
              </button>
            </div>
            <p className={styles.planNote}>
              {t('settingsPage.backupEmailNote')}
            </p>
            {emailOn && (
              <p
                className={
                  lastEmail?.status === 'failed' ? styles.autoBackupError : styles.planNote
                }
              >
                {backupEmailStatus(lastEmail)}
              </p>
            )}
          </>
        )}
        <hr className={styles.dangerDivider} />
        <Select
          label={t('settingsPage.pengingatBackupManualPerangkat')}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
          options={[
            { value: 'off', label: t('settingsPage.inactive') },
            { value: 'daily', label: 'Harian' },
            { value: 'weekly', label: 'Mingguan' },
            { value: 'monthly', label: 'Bulanan' },
          ]}
          hint={backupHint}
        />
      </CardBody>

      <ConfirmDialog
        open={pendingText !== null}
        title={t('settingsPage.pulihkanDariBackup')}
        message={interpolate(t('settingsPage.restoreMsg'), { n: pendingCount.toLocaleString('id-ID') })}
        confirmLabel={t(restoring ? 'settingsPage.restoring' : 'settingsPage.confirmRestore')}
        danger
        onConfirm={handleRestore}
        onCancel={() => setPendingText(null)}
      />
    </Card>
  );
}

function SystemTab({ onReset, isOwner }: { onReset: () => void; isOwner: boolean }) {
  const t = useT();
  const cloud = isSupabaseConfigured;

  return (
    <div className={styles.systemGrid}>
      <DisplayCard />

      {isOwner && <BackupCard />}

      {isOwner && <ExportDataCard />}

      {isOwner && (
        <Card accent="danger">
          <CardHeader
            icon={<Icon name="triangle-exclamation" aria-hidden />}
            title={t('settingsPage.zonaBerbahaya')}
          />
          <CardBody>
            <p className={styles.dangerNote}>
              {cloud
                ? t('settingsPage.resetCloudNote')
                : t('settingsPage.resetLocalNote')}
            </p>
            <Button
              variant="danger"
              onClick={onReset}
              iconLeft={<Icon name="trash" aria-hidden />}
            >
              {t('settingsPage.resetSeluruhData2')}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
