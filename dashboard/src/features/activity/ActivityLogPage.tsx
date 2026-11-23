import { EmptyValue } from '@/components/ui/EmptyValue';
import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardList,
  History,
  Info,
  ListChecks,
  LoaderCircle,
  LogIn,
  LogOut,
  Package,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { SelectBox } from '@/components/dens/select-box';
import { SummaryStrip } from '@/components/dens/summary-strip';
import { TextInput } from '@/components/dens/text-input';
import { cn } from '@/lib/utils';
import { useCollectionRange, rangeForTimestamp } from '@/hooks/useCollectionRange';
import { actionMeta, roleLabel, filterActivity, groupedActionOptions } from '@/lib/business/activity';
import { fmtDate, localDateOf, localDateStr, localTimeStr } from '@/lib/time';
import { purgeActivityLogs } from '@/data/supabase-client';
import { isCloudMode } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { Role } from '@/data/types';

/** "HH:MM" local time via localTimeStr — NOT toLocaleTimeString (see time.ts:
 * known Chrome/Edge Windows bug rendering 11AM as 23). */
function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return localTimeStr(d);
}

// Derived from ACTION_META (single source of truth) so every recorded verb is
// filterable — a hand-copied list here kept falling behind new verbs.
const ACTION_ALL = [{ value: 'all', label: 'Semua aksi' }];
const ACTION_GROUPS = groupedActionOptions();

/** DOM cap: only the newest rows are rendered (matches FinancePage's cap). */
const MAX_RENDERED = 300;

/**
 * Berapa lama jejak audit disimpan saat pemilik memangkasnya. Tabel ini
 * append-only dan tumbuh selamanya; pemangkasannya sengaja tindakan sadar
 * pemilik, bukan pembersihan otomatis di belakangnya (server menolak di bawah
 * 90 hari, dan mencatat pemangkasannya sendiri — 0076).
 */
const KEEP_DAYS = 365;

const ROLE_OPTIONS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua peran' },
  { value: 'owner', label: 'Pemilik' },
  { value: 'admin', label: 'Admin' },
  { value: 'karyawan', label: 'Karyawan' },
];

/**
 * Jejak audit khusus pemilik: ringkasan jumlah event, saringan, lalu event per
 * hari, terbaru di atas. Akses baca ditegakkan RLS di server (migrasi 0019);
 * halaman ini juga dijaga OwnerRoute.
 */
export function ActivityLogPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [action, setAction] = useState<string>('all');
  // Berapa bulan ke belakang yang ikut dimuat. 0 = bulan ini saja.
  const [monthsBack, setMonthsBack] = useState(0);

  // EGRESS: `activity_logs` bersifat append-only, tumbuh selamanya, dan tiap
  // baris membawa `meta jsonb`. Sebelumnya halaman ini memakai useCollection
  // yang menarik SELURUH tabel (dibatasi diam-diam oleh cap max_rows PostgREST
  // 1000 baris — artinya event lama pun tak pernah benar-benar terjangkau).
  // Kini jendelanya difilter DI QUERY, jadi egress ikut turun, bukan cuma DOM.
  // Pola sama dengan FinancePage yang sudah memakai jalur ini untuk `activity`.
  const fetchFrom = useMemo(() => {
    const d = new Date();
    return localDateStr(new Date(d.getFullYear(), d.getMonth() - monthsBack, 1));
  }, [monthsBack]);
  const [actFrom, actTo] = useMemo(
    () => rangeForTimestamp(fetchFrom, localDateStr(new Date())),
    [fetchFrom],
  );
  const { data: logs, loading, refetch } = useCollectionRange('activity', 'createdAt', actFrom, actTo);

  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [purging, setPurging] = useState(false);

  const purge = async () => {
    if (purging) return;
    setConfirmPurge(false);
    setPurging(true);
    try {
      const removed = await purgeActivityLogs({ orgId, keepDays: KEEP_DAYS });
      toast.success(
        removed > 0
          ? `${removed} event lama dipangkas`
          : `Tidak ada event lebih lama dari ${KEEP_DAYS} hari`,
      );
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memangkas log');
    } finally {
      setPurging(false);
    }
  };

  const filtered = useMemo(
    () => filterActivity(logs, { query, role, action }),
    [logs, query, role, action],
  );

  // Distinct actors among the filtered set = number of "channels" recorded.
  const channels = useMemo(
    () => new Set(filtered.map((l) => l.actorId ?? l.actorName)).size,
    [filtered],
  );

  // Cap the DOM at the newest rows — filterActivity already sorts newest-first.
  const visible = useMemo(() => filtered.slice(0, MAX_RENDERED), [filtered]);

  // Group rows by calendar day (date label) for the recorder tape segments.
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const l of visible) {
      const day = l.createdAt ? localDateOf(l.createdAt) : '';
      const list = map.get(day) ?? [];
      list.push(l);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [visible]);

  const hasFilter = query !== '' || role !== 'all' || action !== 'all';

  return (
    <div data-nu className="@container/log flex flex-col gap-4 bg-transparent">
      {/* "Termuat", bukan "Total": angkanya jumlah event dalam jendela waktu yang
          dimuat, bukan seluruh riwayat. Melabelinya total akan menyesatkan —
          pemilik bisa menyimpulkan timnya lebih sepi dari kenyataan hanya karena
          jendelanya sempit. */}
      <SummaryStrip
        label="Jejak Audit · Khusus Pemilik"
        items={[
          { label: 'Termuat', value: logs.length },
          { label: 'Tampil', value: filtered.length },
          { label: 'Kanal', value: channels },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1 @max-[641px]/log:min-w-0 @max-[641px]/log:basis-full">
          <TextInput
            placeholder="Cari nama atau objek…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            start={<Search aria-hidden />}
            aria-label="Cari aktivitas"
          />
        </div>
        <SelectBox
          className="w-auto @max-[641px]/log:w-full"
          value={role}
          onValueChange={(v) => setRole(v as Role | 'all')}
          options={ROLE_OPTIONS}
          aria-label="Filter peran"
        />
        <SelectBox
          className="w-auto @max-[641px]/log:w-full"
          value={action}
          onValueChange={setAction}
          options={ACTION_ALL}
          groups={ACTION_GROUPS}
          aria-label="Filter aksi"
        />
        {hasFilter && (
          <Button
            variant="outline"
            className="@max-[641px]/log:w-full"
            onClick={() => {
              setQuery('');
              setRole('all');
              setAction('all');
            }}
          >
            <X aria-hidden />
            Reset
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">
        {loading ? (
          <p className={NOTE}>
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            Memuat…
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Activity aria-hidden />}
            title={hasFilter ? 'Tidak ada event cocok' : 'Belum ada aktivitas'}
            description={
              hasFilter ? 'Coba longgarkan filter pencarian.' : 'Jejak aktivitas tim akan terekam di sini saat mereka bekerja.'
            }
          />
        ) : (
          <div>
            {filtered.length > MAX_RENDERED && (
              <p className={NOTE} role="note">
                Menampilkan {MAX_RENDERED} event terbaru dari {filtered.length}. Persempit filter untuk melihat event lama.
              </p>
            )}
            {groups.map(([day, rows]) => (
              <section key={day} className="border-b border-border last:border-b-0">
                <div className="sticky top-0 z-[2] flex items-center gap-2 border-b border-dashed border-border bg-surface px-5 py-2.5 text-xs font-medium text-muted-foreground @max-[641px]/log:px-4 [&>svg]:size-3.5">
                  <CalendarDays aria-hidden />
                  {fmtDate(day)}
                  <span className="ml-auto tabular-nums">{rows.length} event</span>
                </div>
                <ul className="py-1">
                  {rows.map((log) => {
                    const meta = actionMeta(log.action);
                    const ActionIcon = ICONS[meta.icon] ?? Info;
                    return (
                      <li key={log.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/40 @max-[641px]/log:px-4">
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full [&>svg]:size-4', TONE[meta.tone] ?? TONE.neutral)} aria-hidden>
                          <ActionIcon />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <strong className="text-sm font-semibold">{meta.label}</strong>
                            {log.entityLabel && (
                              <span className="min-w-0 rounded-md bg-secondary px-1.5 font-mono text-xs text-secondary-foreground [overflow-wrap:anywhere]">
                                {log.entityLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 [&>svg]:size-3">
                              <User aria-hidden />
                              {log.actorName || <EmptyValue />}
                            </span>
                            <Badge variant="secondary">{roleLabel(log.actorRole)}</Badge>
                          </div>
                        </div>
                        <time className="shrink-0 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">{fmtClock(log.createdAt)}</time>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* DI LUAR cabang loading/empty/isi — sengaja. Kalau tombol ini hanya
            muncul saat ada isi, bulan yang sepi jadi jalan buntu: pengguna
            melihat "Belum ada aktivitas" tanpa cara memuat bulan lama. */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-border px-5 py-4 @max-[641px]/log:px-4">
            <Button variant="outline" size="sm" onClick={() => setMonthsBack((m) => m + 1)}>
              <History aria-hidden />
              Muat bulan sebelumnya
            </Button>
            {/* Pemangkasan hanya di cloud: di mode lokal jejaknya ada di
                perangkat ini saja, dan menghapusnya tak punya lawan biaya. */}
            {isCloudMode() && (
              <Button variant="outline" size="sm" onClick={() => setConfirmPurge(true)} disabled={purging} aria-busy={purging || undefined}>
                {purging ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Trash2 aria-hidden />}
                Pangkas log lama
              </Button>
            )}
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {monthsBack === 0 ? 'Bulan ini' : `${monthsBack + 1} bulan terakhir`} · {logs.length} event termuat
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmPurge}
        title="Pangkas log lama?"
        message={`Event yang lebih tua dari ${KEEP_DAYS} hari akan dihapus permanen. Jejak ${KEEP_DAYS} hari terakhir tetap utuh, dan pemangkasan ini sendiri ikut tercatat di log.`}
        confirmLabel="Pangkas"
        danger
        loading={purging}
        onConfirm={purge}
        onCancel={() => setConfirmPurge(false)}
      />
    </div>
  );
}

const NOTE = 'flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground';

/* Nama ikon di ACTION_META (lib/business/activity.ts) memakai set ikon FixMaster;
   halaman dens memakai lucide, jadi dipetakan di sini. Nama yang belum ada di
   peta jatuh ke Info. */
const ICONS: Record<string, LucideIcon> = {
  trash: Trash2,
  pen: Pencil,
  users: Users,
  'circle-xmark': CircleX,
  'right-to-bracket': LogIn,
  'right-from-bracket': LogOut,
  'clock-rotate-left': History,
  wrench: Wrench,
  'screwdriver-wrench': Wrench,
  times: X,
  'list-check': ListChecks,
  'info-circle': Info,
  'circle-check': CircleCheck,
  'cash-register': ShoppingCart,
  box: Package,
  'arrow-trend-up': TrendingUp,
  'arrow-trend-down': TrendingDown,
  'arrow-right-arrow-left': ArrowLeftRight,
  'clipboard-list': ClipboardList,
};

const TONE: Record<string, string> = {
  neutral: 'bg-secondary text-muted-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info text-info-foreground',
};
