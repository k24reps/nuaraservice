import { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Download,
  History,
  Info,
  LoaderCircle,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { Field } from '@/components/dens/field';
import { SelectBox } from '@/components/dens/select-box';
import { Switch } from '@/components/dens/switch';
import { getLastBackupAt, setLastBackupAt, setBackupEmail } from '@/config/orgConfig';
import { isSupabaseConfigured } from '@/data/supabase-client';
import {
  listCloudBackups,
  readCloudBackup,
  latestBackupRun,
  latestBackupEmail,
  type CloudBackup,
  type BackupRun,
  type BackupEmailRun,
} from '@/data/cloudBackup';
import { backupEmailStatus, countRecords, parseBackup, type BackupFrequency } from '@/lib/business/backup';
import { interpolate } from '@/lib/business/notify';
import { useT } from '@/i18n';
import { useBackupStore } from '@/stores/backup';
import { demoGuard } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { DATASETS, downloadCsv } from './exportDatasets';
import { createBackup, downloadBackup, restoreBackup } from './backupRestore';
import { DisplayCard } from './DisplayCard';
import { SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

/* Nama ikon di exportDatasets.ts memakai set ikon FixMaster; dipetakan ke lucide di sini. */
const DATASET_ICONS: Record<string, LucideIcon> = {
  'screwdriver-wrench': Wrench,
  'cash-register': ShoppingCart,
  users: Users,
  'boxes-stacked': Boxes,
  wallet: Wallet,
};

/** Tab Sistem (L-66): tampilan perangkat (semua peran), lalu backup, ekspor, dan reset (pemilik). */
export function SystemSettings({ onReset, isOwner }: { onReset: () => void; isOwner: boolean }) {
  const t = useT();
  const cloud = isSupabaseConfigured;

  return (
    <SettingsSection>
      {/* Dua kolom hanya bila wadah cukup lebar; kartu Tampilan selalu selebar penuh. */}
      <DisplayCard />
      <div className="grid grid-cols-2 items-start gap-4 @max-[800px]/settings:grid-cols-1">
        {isOwner && <BackupCard />}
        {isOwner && <ExportDataCard />}
        {isOwner && (
          <SettingsCard danger icon={<TriangleAlert aria-hidden />} title={t('settingsPage.zonaBerbahaya')}>
            <SettingsHint>{cloud ? t('settingsPage.resetCloudNote') : t('settingsPage.resetLocalNote')}</SettingsHint>
            <Button variant="destructive" onClick={onReset}>
              <Trash2 aria-hidden />
              {t('settingsPage.resetSeluruhData2')}
            </Button>
          </SettingsCard>
        )}
      </div>
    </SettingsSection>
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
    <SettingsCard icon={<Download aria-hidden />} title={t('settingsPage.exportData')}>
      <SettingsHint>{t('settingsPage.pUnduhDataSebagaiCsv')}</SettingsHint>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-2">
        {DATASETS.map((d) => {
          const DatasetIcon = DATASET_ICONS[d.icon] ?? Download;
          return (
            <Button
              key={d.key}
              variant="outline"
              className="justify-start"
              onClick={() => onExport(d.key, d.label)}
              disabled={busy !== null}
            >
              {busy === d.key ? <Spinner /> : <DatasetIcon aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-left">{busy === d.key ? 'Menyiapkan…' : d.label}</span>
              <Download aria-hidden className="text-muted-foreground" />
            </Button>
          );
        })}
      </div>
    </SettingsCard>
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
    <SettingsCard icon={<History aria-hidden />} title={t('settingsPage.backupRestore')}>
      <SettingsHint>{t('settingsPage.pBackupMenyimpanSeluruhData')}</SettingsHint>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button onClick={handleBackup} disabled={busy} aria-busy={busy || undefined}>
          {busy ? <Spinner /> : <Download aria-hidden />}
          {t('settingsPage.backupSekarang')}
        </Button>
        {canRestore && (
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <History aria-hidden />
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
        <p className={NOTE_ICON}>
          <Info aria-hidden />
          <span>
            Restore mengganti SELURUH data operasional org ini dengan isi file. Tim, langganan, dan profil org TIDAK ikut
            diganti. Disarankan backup dulu sebelum memulihkan.
            {isDemo ? ' (Akun demo)' : ''}
          </span>
        </p>
      )}
      {cloud && (
        <>
          <hr className={HR} />
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={KICKER}>{t('settingsPage.backupOtomatis')}</span>
            {lastRun && (
              <Badge variant={lastRun.status === 'ok' ? 'success' : 'destructive-soft'}>
                {lastRun.status === 'ok' ? 'Berjalan' : 'Gagal'}
              </Badge>
            )}
          </div>
          <p className={NOTE}>{t('settingsPage.pServerMembuatSalinanPenuh')}</p>
          {/* Kegagalan ditampilkan, bukan disembunyikan: backup yang diam-diam berhenti
              membuat pemilik merasa aman padahal tidak. */}
          {lastRun?.status === 'failed' && (
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-destructive [&>svg]:mt-1 [&>svg]:size-4 [&>svg]:shrink-0">
              <TriangleAlert aria-hidden />
              <span>
                Backup terakhir gagal pada {new Date(lastRun.startedAt).toLocaleString('id-ID')}
                {lastRun.error ? `: ${lastRun.error}` : ''}
              </span>
            </p>
          )}
          {loadingCloud && <p className={NOTE}>{t('settingsPage.memuatDaftar')}</p>}
          {!loadingCloud && cloudBackups.length === 0 && <p className={NOTE}>{t('settingsPage.pBelumAdaSalinanOtomatis')}</p>}
          {cloudBackups.length > 0 && (
            <ul className="mt-3 flex flex-col">
              {cloudBackups.map((b) => (
                <li key={b.path} className="flex items-center gap-3 border-b border-dashed border-border py-2 last:border-b-0">
                  <span className="min-w-0 flex-1 font-mono text-sm tabular-nums [overflow-wrap:anywhere]">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString('id-ID') : b.name}
                  </span>
                  <span className="font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                    {Math.max(1, Math.round(b.sizeBytes / 1024))} KB
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void restoreFromCloud(b)}>
                    {t('settingsPage.pulihkan')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {cloud && !isDemo && (
        <>
          <hr className={HR} />
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={KICKER} id="backup-email-label">
              {t('settingsPage.emailBackupMingguan')}
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={emailOn}
                onCheckedChange={() => void toggleBackupEmail()}
                disabled={savingEmail}
                aria-labelledby="backup-email-label"
              />
              {emailOn ? t('settingsPage.active') : t('settingsPage.off')}
            </span>
          </div>
          <p className={NOTE}>{t('settingsPage.backupEmailNote')}</p>
          {emailOn && (
            <p className={lastEmail?.status === 'failed' ? 'mt-2 text-sm leading-relaxed text-destructive' : NOTE}>
              {backupEmailStatus(lastEmail)}
            </p>
          )}
        </>
      )}
      <hr className={HR} />
      <Field label={t('settingsPage.pengingatBackupManualPerangkat')} hint={backupHint}>
        <SelectBox
          value={frequency}
          onValueChange={(v) => setFrequency(v as BackupFrequency)}
          options={[
            { value: 'off', label: t('settingsPage.inactive') },
            { value: 'daily', label: 'Harian' },
            { value: 'weekly', label: 'Mingguan' },
            { value: 'monthly', label: 'Bulanan' },
          ]}
        />
      </Field>

      <ConfirmDialog
        open={pendingText !== null}
        title={t('settingsPage.pulihkanDariBackup')}
        message={interpolate(t('settingsPage.restoreMsg'), { n: pendingCount.toLocaleString('id-ID') })}
        confirmLabel={t(restoring ? 'settingsPage.restoring' : 'settingsPage.confirmRestore')}
        danger
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setPendingText(null)}
      />
    </SettingsCard>
  );
}

const NOTE = 'text-sm leading-normal text-muted-foreground';
const NOTE_ICON = `${NOTE} flex items-start gap-2 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0`;
const HR = 'my-4 border-t border-dashed border-border';
const KICKER = 'text-xs font-semibold text-muted-foreground';
