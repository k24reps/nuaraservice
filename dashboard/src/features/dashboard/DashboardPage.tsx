import { EmptyValue } from '@/components/ui/EmptyValue';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Inbox,
  ListChecks,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShoppingCart,
  Target,
  TriangleAlert,
  Trophy,
  Users,
} from 'lucide-react';
import { Term } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { EmptyState } from '@/components/dens/empty-state';
import { cn } from '@/lib/utils';
import { ThumbDock } from '@/components/layout/ThumbDock';
import { useCollection, useDerivedQuery } from '@/hooks/useCollection';
import { repository } from '@/data';
import { useCollectionRange } from '@/hooks/useCollectionRange';
import { useServiceSummary } from '@/hooks/useServiceSummary';
import { useCategoryProfit } from '@/hooks/useReportData';
import { useNavSignals } from '@/hooks/useNavSignals';
import { fmtRp, EMPTY_VALUE } from '@/lib/format';
import { localDateStr, localDateOf, fmtDate, monthRange } from '@/lib/time';
import {
  computeKpis,
  computeAlerts,
  serviceMargin,
  monthPace,
  dailyRevenueTarget,
  targetState,
  alertAges,
  type Alert,
} from '@/lib/business/dashboard';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  visibleServices,
  isClosedOut,
} from '@/lib/business/services';
import { matchesTechnician } from '@/lib/business/serviceFilters';
import { getTarget, getRent, getStartMonth } from '@/config/orgConfig';
import {
  computeBreakEven,
  breakEvenVerdict,
  overheadFetchFrom,
  overheadFetchTo,
  type BreakEvenVerdict,
} from '@/lib/business/overhead';
import { interpolate } from '@/lib/business/notify';
import { useSessionStore } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { isManager } from '@/config/plans';
import { useT, type TranslationKey } from '@/i18n';
import type { Service, ServiceStatus } from '@/data/types';

const ALERT_COPY: Record<
  Alert['kind'],
  { message: TranslationKey; action: TranslationKey }
> = {
  confirmation: {
    message: 'dashboard.alert.confirmation',
    action: 'dashboard.alert.openServices',
  },
  'out-of-stock': {
    message: 'dashboard.alert.outOfStock',
    action: 'dashboard.alert.openInventory',
  },
  'low-stock': {
    message: 'dashboard.alert.lowStock',
    action: 'dashboard.alert.openInventory',
  },
  'awaiting-pickup': {
    message: 'dashboard.alert.awaitingPickup',
    action: 'dashboard.alert.openServices',
  },
};

const RECENT_SERVICES = 6;
// Tiket terbuka untuk umur peringatan & "Tiket saya". Kolom daftar (tanpa
// history) saja, jadi ±1 KB per baris.
// ponytail: batas 60 — toko dengan >60 tiket terbuka bisa melewatkan tiket
// tertua; ganti dengan kolom `oldest_*` di service_summary bila itu terjadi.
const OPEN_LIMIT = 60;
const NO_SERVICES: Service[] = [];

type Period = 'today' | 'month';

function fmtRpInline(value: number): string {
  return fmtRp(value).replace(' ', ' ');
}

export function DashboardPage() {
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const me = useSessionStore((s) => s.currentEmployee);
  const isMgr = me ? isManager(me.role) : false;
  // Laba = angka Laporan, dan Laporan khusus owner. Admin tetap melihat arus kas.
  const isOwner = me?.role === 'owner';
  const { from, to } = monthRange();
  const today = localDateStr();
  // Pilihan periode diingat per perangkat (dulu kembali ke Hari ini tiap pindah menu).
  const [period, setPeriodState] = useState<Period>(() => {
    try {
      return localStorage.getItem('fixmaster-dash-period') === 'month' ? 'month' : 'today';
    } catch {
      return 'today';
    }
  });
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem('fixmaster-dash-period', p);
    } catch {
      /* penyimpanan diblokir — pilihan tetap berlaku untuk kunjungan ini */
    }
  };

  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  // Dashboard hanya MENAMPILKAN 6 tiket terbaru; hitungan & papan teknisinya
  // datang dari RPC (useServiceSummary di bawah). Dulu halaman ini menarik
  // SELURUH tabel servis untuk 6 baris itu — 338 KB di replika produksi (334
  // tiket), tumbuh ±100 tiket/bulan, dan ditarik ulang di setiap perangkat tiap
  // ada perubahan servis. Dashboard juga halaman pertama setiap kali masuk.
  // Kunci di bawah ['collection','services',…] supaya realtime tetap
  // meng-invalidasi; yang ditarik ulang kini hanya 6 baris.
  const servicesQuery = useDerivedQuery(
    ['collection', 'services', 'dashboardRecent', activeOutletId],
    async () =>
      repository.queryServices
        ? repository.queryServices({ limit: RECENT_SERVICES, visibleOnly: true })
        : visibleServices(await repository.list('services'))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, RECENT_SERVICES),
    NO_SERVICES,
  );
  const openQuery = useDerivedQuery(
    ['collection', 'services', 'dashboardOpen', activeOutletId],
    async () =>
      repository.queryServices
        ? repository.queryServices({ openOnly: true, visibleOnly: true, limit: OPEN_LIMIT })
        : visibleServices(await repository.list('services')).filter((s) => !isClosedOut(s)),
    NO_SERVICES,
  );
  // Hitungan & papan teknisi dari SEMUA tiket; versi hari ini untuk readout konsol.
  const summaryQuery = useServiceSummary(from, to);
  const todaySummaryQuery = useServiceSummary(today, today);
  // Laba servis dari himpunan yang sama dengan Laporan (tiket SELESAI dalam periode).
  const profitMonthQuery = useCategoryProfit(from, to);
  const profitTodayQuery = useCategoryProfit(today, today);
  const incomesQuery = useCollectionRange('incomes', 'date', from, to);
  const expensesQuery = useCollectionRange('expenses', 'date', from, to);
  const walletsQuery = useCollection('wallets');
  const inventoryQuery = useCollection('inventory');
  const { data: outlets } = useCollection('outlets');
  // Hanya baris hari ini yang dipakai (activeStaff) — kunci query-nya sama
  // dengan rail navigasi, jadi keduanya berbagi satu tarikan kecil.
  const attendanceQuery = useCollectionRange('attendance', 'date', today, today);
  // Rel navigasi sudah menghitung tugas tertunda dengan aturan halaman Tugas.
  const signals = useNavSignals();
  const incomes = incomesQuery.data;
  const expenses = expensesQuery.data;
  const wallets = walletsQuery.data;
  const inventory = inventoryQuery.data;
  const attendance = attendanceQuery.data;

  const queryStates = [
    servicesQuery,
    openQuery,
    summaryQuery,
    todaySummaryQuery,
    profitMonthQuery,
    profitTodayQuery,
    incomesQuery,
    expensesQuery,
    walletsQuery,
    inventoryQuery,
    attendanceQuery,
  ];
  const initialLoading = queryStates.some((query) => query.loading);
  const refreshing = queryStates.some((query) => query.refreshing);
  const criticalError = queryStates.find((query) => query.error)?.error ?? null;
  const dataUnavailable = queryStates.some((query) => query.error && query.updatedAt === 0);
  const updateTimes = queryStates.map((query) => query.updatedAt).filter((value) => value > 0);
  const oldestUpdatedAt = updateTimes.length ? Math.min(...updateTimes) : 0;

  const retryDashboard = async () => {
    await Promise.allSettled(queryStates.map((query) => query.refetch()));
  };

  const target = getTarget();
  const range = period === 'today' ? { from: today, to: today } : { from, to };
  const kpis = useMemo(
    () => computeKpis(incomes, expenses, wallets, range.from, range.to),
    [incomes, expenses, wallets, range.from, range.to],
  );
  const monthKpis = useMemo(
    () => computeKpis(incomes, expenses, wallets, from, to),
    [incomes, expenses, wallets, from, to],
  );
  const monthRevenue = monthKpis.revenue;
  const margin = serviceMargin(period === 'today' ? profitTodayQuery.data : profitMonthQuery.data);
  const doneToday = serviceMargin(profitTodayQuery.data).units;
  // Target servis = unit SELESAI bulan ini (yang menghasilkan uang), bukan unit masuk.
  const doneMonth = serviceMargin(profitMonthQuery.data).units;
  const summary = summaryQuery.data;
  const unitsIn = summary?.unitsIn ?? 0;
  const leaderboard = summary?.leaderboard ?? [];
  const open = openQuery.data;
  const ages = useMemo(() => alertAges(open), [open]);
  const alerts = useMemo(
    () => computeAlerts(summary ?? { confirmation: 0, awaitingPickup: 0 }, inventory),
    [summary, inventory],
  );
  // Sama dengan daftar yang ditautnya (/services?tech=me&open=1): tiket saya yang
  // belum tuntas. Dulu hanya "belum selesai" sementara tautannya membuka semua tiket saya.
  const myOpen = me ? open.filter((s) => matchesTechnician(s, 'me', [], me)).length : 0;
  const myAttendance = me ? attendance.find((a) => a.date === today && a.employeeId === me.id) : undefined;
  const taskSignal = signals['/tasks'];
  // Tiket arsip sudah disaring di sumbernya (visibleOnly / visibleServices),
  // supaya yang tampil sama dengan menu Servis saat tautannya diklik.
  const recent = servicesQuery.data;
  // Target berlaku untuk SELURUH usaha: membandingkannya dengan pemasukan satu
  // cabang dulu menghasilkan 2–5% yang tampak seperti toko gagal.
  const branchScoped = !!activeOutletId && outlets.length > 1;
  const activeOutlet = outlets.find((o) => o.id === activeOutletId) ?? null;
  const pace = monthPace();
  const todayRevenue = useMemo(
    () => computeKpis(incomes, expenses, wallets, today, today).revenue,
    [incomes, expenses, wallets, today],
  );
  const dailyNeed = dailyRevenueTarget(target.revenue, monthRevenue - todayRevenue);
  const revenuePct = target.revenue > 0 ? Math.min(100, (monthRevenue / target.revenue) * 100) : 0;
  const servicePct = target.serviceCount > 0
    ? Math.min(100, (doneMonth / target.serviceCount) * 100)
    : 0;
  const empty = recent.length === 0;
  const maxRev = Math.max(1, ...leaderboard.map((tech) => tech.revenue));
  const maxDone = Math.max(1, ...leaderboard.map((tech) => tech.completed));

  const activeStaff = attendance.filter(
    (entry) => entry.date === today && !!entry.checkIn && !entry.checkOut,
  ).length;
  const updatedTime = oldestUpdatedAt
    ? new Date(oldestUpdatedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' })
    : null;
  const dataStatus = criticalError
    ? t('dashboard.dataStale')
    : initialLoading
      ? t('dashboard.loading')
      : refreshing
        ? t('dashboard.refreshing')
        : updatedTime
          ? `${t('dashboard.updated')} ${updatedTime}`
          : t('dashboard.ready');
  // Defisit = peringatan, bukan bahaya: kas bisa negatif sehari karena belanja
  // stok besar. Impas tidak menyala sama sekali (LED padam, tag tetap bilang IMPAS).
  const profitState = kpis.netCashFlow > 0 ? 'ok' : kpis.netCashFlow < 0 ? 'warn' : null;
  const hasTarget = !branchScoped && ((isMgr && target.revenue > 0) || target.serviceCount > 0);
  const dash = initialLoading ? EMPTY_VALUE : null;

  const panel = 'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60';
  const linkBtn =
    'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 [&_svg]:size-4';
  const primaryLink = cn(linkBtn, 'bg-primary text-primary-foreground hover:bg-primary-hover');
  const secondaryLink = cn(linkBtn, 'bg-card text-foreground ring-1 ring-border hover:bg-accent');
  const viewAll =
    'inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-primary no-underline outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11';
  const consoleKey = 'text-xs font-medium text-muted-foreground';

  return (
    <div data-nu className="@container/dashboard flex flex-col gap-4 bg-transparent" aria-busy={initialLoading || refreshing}>
      {/* Konsol: cabang yang sedang dilihat + denyut HARI INI. Dulu berisi tanggal
          dan jam (mengulang jam ponsel) sementara tak satu angka pun milik hari ini. */}
      <section
        aria-label={t('dashboard.consoleAria')}
        className={cn(
          panel,
          'flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5',
          // Sempit: cabang | status data, lalu "hari ini" dan tiga angka selebar konsol.
          '@max-[561px]/dashboard:grid @max-[561px]/dashboard:grid-cols-[minmax(0,1fr)_auto] @max-[561px]/dashboard:gap-x-3 @max-[561px]/dashboard:px-3 @max-[561px]/dashboard:py-2',
        )}
      >
        <div className="grid min-w-0 gap-0.5">
          <span className={consoleKey}>{t('dashboard.branch')}</span>
          <span className="truncate text-sm font-semibold">
            {activeOutlet?.name ?? (outlets.length > 1 ? t('dashboard.allBranches') : outlets[0]?.name ?? <EmptyValue />)}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground @max-[561px]/dashboard:col-span-full @max-[561px]/dashboard:border-t @max-[561px]/dashboard:border-dashed @max-[561px]/dashboard:border-border @max-[561px]/dashboard:pt-2">
          <span aria-hidden className="size-2 rounded-full bg-highlight" /> {t('dashboard.today')}
        </span>
        <dl className="m-0 flex gap-5 @max-[561px]/dashboard:col-span-full @max-[561px]/dashboard:grid @max-[561px]/dashboard:grid-cols-3 @max-[561px]/dashboard:gap-2">
          {(
            [
              [t('dashboard.todayIn'), dash ?? todaySummaryQuery.data?.unitsIn ?? 0],
              [t('dashboard.todayDone'), dash ?? doneToday],
              [t('dashboard.staffPresent'), dash ?? activeStaff],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="grid min-w-0 gap-0.5">
              <dt className={consoleKey}>{key}</dt>
              <dd className="m-0 font-mono text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div
          className="grid gap-0.5 @max-[561px]/dashboard:col-start-2 @max-[561px]/dashboard:row-start-1 @max-[561px]/dashboard:text-right"
          role="status"
          aria-live="polite"
        >
          <span className={consoleKey}>{t('dashboard.data')}</span>
          <span className={cn('text-sm font-semibold', criticalError && 'text-destructive')}>{dataStatus}</span>
        </div>
        {/* Aksi cepat — di wadah sempit dilipat (menu bawah sudah memuat Servis & Kasir);
            di ponsel Servis Baru tinggal di dok zona jempol. */}
        <div className="ml-auto flex gap-2 @max-[561px]/dashboard:hidden" role="group" aria-label={t('dashboard.quickActions')}>
          <Link className={cn(primaryLink, 'phone:hidden')} to="/services?new=1">
            <Plus aria-hidden /> {t('dashboard.newService')}
          </Link>
          <Link className={secondaryLink} to="/pos">
            <ShoppingCart aria-hidden /> {t('dashboard.openPos')}
          </Link>
        </div>
      </section>

      {criticalError && (
        <section className="flex items-center gap-3 rounded-2xl bg-destructive-soft px-4 py-3 text-sm ring-1 ring-destructive/20 @max-[561px]/dashboard:flex-wrap @max-[561px]/dashboard:items-start" role="alert">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-destructive [&_svg]:size-5">
            <TriangleAlert aria-hidden />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5 @max-[561px]/dashboard:min-w-[calc(100%-52px)]">
            <strong className="font-semibold text-destructive">{t('dashboard.errorTitle')}</strong>
            <span className="text-muted-foreground">
              {dataUnavailable ? t('dashboard.errorUnavailable') : t('dashboard.errorStale')}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void retryDashboard()} disabled={initialLoading || refreshing}>
            <RotateCcw aria-hidden className={cn((initialLoading || refreshing) && 'animate-spin motion-reduce:animate-none')} />
            {t('dashboard.retry')}
          </Button>
        </section>
      )}

      {initialLoading ? (
        <DashboardLoading label={t('dashboard.loading')} />
      ) : dataUnavailable ? null : (
        <>
          {/* Karyawan: mejanya dulu. Semua: yang perlu ditangani sebelum angka uang. */}
          {!isMgr && (
            <section className="grid gap-2" aria-label={t('dashboard.myDesk')}>
              <h2 className="text-sm font-semibold">{t('dashboard.myDesk')}</h2>
              <Strip>
                <DeskCell
                  to="/services?tech=me&open=1"
                  label={t('dashboard.myTickets')}
                  value={String(myOpen)}
                  unit={t('dashboard.myTicketsUnit')}
                  tone={myOpen > 0 ? 'info' : undefined}
                />
                <DeskCell
                  to="/tasks"
                  label={t('dashboard.myTasks')}
                  value={String(taskSignal?.count ?? 0)}
                  unit={t('dashboard.myTasksUnit')}
                  tone={taskSignal?.tone === 'crit' ? 'danger' : taskSignal?.count ? 'warning' : undefined}
                />
                <DeskCell
                  to="/attendance"
                  label={t('dashboard.myAttendance')}
                  value={
                    myAttendance?.checkOut
                      ? t('dashboard.clockedOut').replace('{time}', myAttendance.checkOut)
                      : myAttendance?.checkIn
                        ? t('dashboard.clockedIn').replace('{time}', myAttendance.checkIn)
                        : t('dashboard.notClockedIn')
                  }
                  tone={myAttendance?.checkIn ? 'success' : 'warning'}
                  small
                />
              </Strip>
            </section>
          )}

          <section className={panel} aria-labelledby="dash-actions">
            <PanelHead id="dash-actions" icon={<ListChecks aria-hidden />} title={t('dashboard.actionsTitle')} />
            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-4">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT.success)} />
                <span className="grid gap-0.5">
                  <strong className="text-sm font-semibold">{t('dashboard.allClear')}</strong>
                  <small className="text-xs text-muted-foreground">{t('dashboard.allClearDescription')}</small>
                </span>
              </div>
            ) : (
              <ul className="m-0 grid list-none p-0">
                {alerts.map((alert) => {
                  const copy = ALERT_COPY[alert.kind];
                  const age = ages[alert.kind];
                  const ageText =
                    age === undefined
                      ? null
                      : age === 0
                        ? t('dashboard.ageToday')
                        : t('dashboard.ageDays').replace('{days}', String(age));
                  const message = t(copy.message);
                  const action = t(copy.action);
                  return (
                    <li key={alert.kind}>
                      <Link
                        className="group flex items-center gap-3 border-b border-dashed border-border px-5 py-3 text-inherit no-underline outline-none transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        to={alert.href}
                        aria-label={`${alert.count} ${message}${ageText ? `, ${ageText}` : ''}. ${action}`}
                      >
                        <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[alert.tone])} />
                        <span className={cn('min-w-8 font-mono text-lg font-semibold tabular-nums', COUNT[alert.tone])}>{alert.count}</span>
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <strong className="text-sm font-semibold">{message}</strong>
                          <small className="text-xs text-muted-foreground">{ageText ? `${ageText} · ${action}` : action}</small>
                        </span>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {isMgr && (
            // Panel laba: panel navy (pengganti layar LCD FixMaster, K-17), angka
            // putih; arus kas negatif berwarna sorot supaya pemilik berhenti membaca.
            <section
              aria-label={t('dashboard.netProfitAria')}
              data-state={profitState ?? undefined}
              className="@container/hero flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-panel @max-[561px]/dashboard:gap-3 @max-[561px]/dashboard:px-4 @max-[561px]/dashboard:py-3"
            >
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-foreground/80 [&_a]:text-primary-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 rounded-full',
                        profitState === 'ok' ? 'bg-success' : profitState === 'warn' ? 'bg-highlight' : 'bg-primary-foreground/50',
                      )}
                    />
                    <Term id="arus-kas-bersih">{t('dashboard.netProfit')}</Term>
                  </span>
                  <div className="inline-flex gap-0.5 rounded-full bg-primary-foreground/10 p-0.5" role="group" aria-label={t('dashboard.periodAria')}>
                    {(['today', 'month'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={period === p}
                        className="relative h-7 rounded-full px-3 text-xs font-semibold text-primary-foreground/80 outline-none transition-colors hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-highlight aria-pressed:bg-primary-foreground aria-pressed:text-primary pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2"
                        onClick={() => setPeriod(p)}
                      >
                        {t(p === 'today' ? 'dashboard.today' : 'dashboard.month')}
                      </button>
                    ))}
                  </div>
                </div>
                <span
                  className={cn(
                    'font-mono text-[length:clamp(1.45rem,7cqi,2.25rem)] font-semibold leading-tight tabular-nums',
                    profitState === 'warn' && 'text-highlight',
                  )}
                >
                  {fmtRpInline(kpis.netCashFlow)}
                </span>
                <span className="text-xs font-medium text-primary-foreground/80">
                  {kpis.netCashFlow > 0
                    ? t('dashboard.surplus')
                    : kpis.netCashFlow < 0
                      ? t('dashboard.deficit')
                      : t('dashboard.even')}
                </span>
              </div>
              {/* minmax(0,…): rupiah mono yang tak bisa patah tak boleh mendorong grid
                  melewati layar (terukur 13px terpotong di 320px). */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 @max-[561px]/dashboard:grid @max-[561px]/dashboard:w-full @max-[561px]/dashboard:grid-cols-2 @max-[561px]/dashboard:gap-x-4 @max-[561px]/dashboard:[&>:last-child:nth-child(odd)]:col-span-full">
                <Link className={heroStat} to="/finance">
                  <span className={heroKey}>{t('dashboard.revenue')}</span>
                  <span className={heroVal}>{fmtRpInline(kpis.revenue)}</span>
                </Link>
                <Link className={heroStat} to="/finance">
                  <span className={heroKey}>{t('dashboard.expense')}</span>
                  <span className={heroVal}>{fmtRpInline(kpis.expense)}</span>
                </Link>
                {isOwner && (
                  <div className={cn(heroStat, 'hover:bg-transparent')}>
                    <span className={cn(heroKey, '[&_a]:text-primary-foreground')}>
                      <Term id="laba-servis">{t('dashboard.serviceProfit')}</Term>
                    </span>
                    <span className={heroVal}>{fmtRpInline(margin.profit)}</span>
                    <span className="text-xs text-primary-foreground/80">
                      {margin.pct === null
                        ? t('dashboard.noServiceDone')
                        : t('dashboard.serviceMarginDetail')
                            .replace('{pct}', `${Math.round(margin.pct)}%`)
                            .replace('{units}', String(margin.units))}
                    </span>
                  </div>
                )}
              </div>
              {isOwner && <BreakEvenReadout from={from} to={to} netCash={monthKpis.netCashFlow} />}
              <p className="basis-full text-xs text-primary-foreground/80">{t('dashboard.cashNote')}</p>
            </section>
          )}

          {/* Strip readout, bukan deretan kartu statistik: tiap angka menaut ke
              daftar yang menjelaskannya. "Dalam proses" memakai definisi yang sama
              dengan readout halaman Servis. */}
          <Strip label={t('dashboard.metricsAria')}>
            <DeskCell to="/services?date=month" label={t('dashboard.unitsIn')} value={String(unitsIn)} unit={t('dashboard.thisMonth')} />
            <DeskCell
              to="/services"
              label={t('dashboard.inProcess')}
              value={String(summary?.inProcess ?? 0)}
              unit={t('dashboard.inProcessUnit')}
              tone={(summary?.inProcess ?? 0) > 0 ? 'info' : undefined}
            />
            {isMgr && (
              <DeskCell
                to="/finance"
                label={t('dashboard.totalBalance')}
                value={fmtRpInline(kpis.totalWallet)}
                unit={activeOutletId ? t('dashboard.orgWide') : t('dashboard.allWallets')}
              />
            )}
          </Strip>

          <div className={cn('grid items-start gap-4', hasTarget && 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @max-[901px]/dashboard:grid-cols-1')}>
            <section className={panel} aria-labelledby="dash-recent">
              <PanelHead
                id="dash-recent"
                icon={<Clock aria-hidden />}
                title={t('dashboard.recentServices')}
                action={
                  <Link className={viewAll} to="/services">
                    {t('dashboard.viewAll')}
                  </Link>
                }
              />
              {empty ? (
                <EmptyState
                  icon={<Inbox aria-hidden />}
                  title={t('dashboard.noServices')}
                  description={t('dashboard.noServicesDescription')}
                  action={
                    <Link className={primaryLink} to="/services?new=1">
                      <Plus aria-hidden /> {t('dashboard.newService')}
                    </Link>
                  }
                />
              ) : (
                <ul className="m-0 grid list-none p-0">
                  {recent.map((service) => (
                    <li key={service.id} className="min-w-0">
                      {/* Sempit: no. | perangkat | panah, lencana di bawah perangkat.
                          flex-wrap dulu membuat baris 84–108px dan panah terdampar. */}
                      <Link
                        className="group flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-border px-5 py-3 text-inherit no-underline outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @max-[561px]/dashboard:grid @max-[561px]/dashboard:grid-cols-[auto_minmax(0,1fr)_auto] @max-[561px]/dashboard:[grid-template-areas:'no_detail_arrow'_'._badge_arrow']"
                        to={`/services/${service.id}`}
                        aria-label={`${service.serviceNo}, ${service.device}, ${service.customerName}, ${STATUS_LABELS[service.status as ServiceStatus]}`}
                      >
                        <span className="font-mono text-sm font-semibold [grid-area:no]">{service.serviceNo}</span>
                        {/* Lantai 140px: nomor + perangkat berbagi baris pertama, lencana
                            lebar ("Konfirmasi Biaya") yang turun, bukan nama perangkat yang terpotong. */}
                        <span className="grid min-w-[140px] flex-1 gap-0.5 [grid-area:detail] @max-[561px]/dashboard:min-w-0">
                          <strong className="truncate text-sm font-semibold">{service.device}</strong>
                          <small className="truncate text-xs text-muted-foreground">
                            {service.customerName} · {fmtDate(localDateOf(service.createdAt))}
                          </small>
                        </span>
                        <span className="[grid-area:badge] @max-[561px]/dashboard:justify-self-start">
                          <Badge variant={STATUS_BADGE[service.status]}>{STATUS_LABELS[service.status as ServiceStatus]}</Badge>
                        </span>
                        <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform [grid-area:arrow] group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {hasTarget && (
              <section className={panel} aria-labelledby="dash-target">
                <PanelHead
                  id="dash-target"
                  icon={<Target aria-hidden />}
                  title={t('dashboard.monthlyTarget')}
                  action={
                    me?.role === 'owner' ? (
                      <Link className={viewAll} to="/settings?tab=usaha">
                        {t('dashboard.editTarget')}
                      </Link>
                    ) : undefined
                  }
                />
                <div className="grid gap-5 px-5 pt-1 pb-5">
                  {isMgr && target.revenue > 0 && (
                    <TargetGauge
                      label={t('dashboard.revenueTarget')}
                      pct={revenuePct}
                      pace={pace}
                      detail={`${fmtRpInline(monthRevenue)} / ${fmtRpInline(target.revenue)}`}
                    />
                  )}
                  {isMgr && target.revenue > 0 && dailyNeed > 0 && (
                    <TargetGauge
                      label={t('dashboard.todayNeed')}
                      pct={Math.min(100, (todayRevenue / dailyNeed) * 100)}
                      detail={`${fmtRpInline(todayRevenue)} / ${fmtRpInline(dailyNeed)} · ${
                        todayRevenue >= dailyNeed
                          ? t('dashboard.todayReached')
                          : interpolate(t('dashboard.todayShort'), { amount: fmtRpInline(dailyNeed - todayRevenue) })
                      }`}
                    />
                  )}
                  {target.serviceCount > 0 && (
                    <TargetGauge
                      label={t('dashboard.serviceTarget')}
                      pct={servicePct}
                      pace={pace}
                      detail={`${doneMonth} / ${target.serviceCount} ${t('dashboard.unitsDone')}`}
                    />
                  )}
                </div>
              </section>
            )}
          </div>

          <section className={panel} aria-labelledby="dash-tech">
            <PanelHead
              id="dash-tech"
              icon={<Trophy aria-hidden />}
              title={`${t('dashboard.technicianPerformance')} · ${t('dashboard.month').toLowerCase()}`}
            />
            {leaderboard.length === 0 ? (
              <EmptyState icon={<Users aria-hidden />} title={t('dashboard.noPerformance')} description={t('dashboard.noPerformanceDescription')} />
            ) : (
              <ul className="m-0 grid list-none gap-4 px-5 pt-1 pb-5">
                {leaderboard.map((tech, index) => {
                  const rank = index + 1;
                  // Karyawan tak melihat keuangan, termasuk pendapatan rekan kerja:
                  // meternya mengikuti jumlah unit selesai.
                  const pct = Math.max(8, isMgr ? (tech.revenue / maxRev) * 100 : (tech.completed / maxDone) * 100);
                  return (
                    <li key={tech.key} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm font-semibold',
                          rank === 1 ? 'bg-highlight text-highlight-foreground' : 'bg-secondary text-secondary-foreground',
                        )}
                      >
                        {rank}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="truncate text-sm font-semibold">{tech.name}</span>
                          <span className="text-xs text-muted-foreground [&_strong]:font-mono [&_strong]:font-semibold [&_strong]:text-foreground">
                            <strong>{tech.completed}</strong> {t('dashboard.completed')}
                            {isMgr && <> · {fmtRpInline(tech.revenue)}</>}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn('h-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none', rank === 1 ? 'bg-highlight' : 'bg-primary/70')}
                            style={{ transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
      {/* Aksi cepat konsol dilipat di ponsel; tab Servis di menu bawah membuka
          daftar, bukan tiket baru. Servis Baru pindah ke zona jempol. */}
      <ThumbDock>
        <Link className={cn(primaryLink, 'h-11 px-4 shadow-raised ring-2 ring-primary-foreground/70')} to="/services?new=1">
          <Plus aria-hidden /> {t('dashboard.newService')}
        </Link>
      </ThumbDock>
    </div>
  );
}

// Warna sinyal: titik dan angka. "accent" FixMaster = sorot Nuara.
const DOT = {
  info: 'bg-info-foreground',
  warning: 'bg-warning-foreground',
  danger: 'bg-destructive',
  accent: 'bg-highlight',
  success: 'bg-success-foreground',
} as const;
const COUNT = {
  info: 'text-info-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive',
  accent: 'text-foreground',
  success: 'text-success-foreground',
} as const;
const heroStat = '-mx-1.5 -my-1 grid min-w-0 gap-0.5 rounded-lg px-1.5 py-1 text-inherit no-underline outline-none transition-colors hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-highlight';
const heroKey = 'text-xs font-medium text-primary-foreground/80';
const heroVal = 'font-mono text-base font-semibold whitespace-nowrap tabular-nums';

function PanelHead({ id, icon, title, action }: { id: string; icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 id={id} className="inline-flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

function Strip({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60 @max-[561px]/dashboard:grid-cols-2 @max-[561px]/dashboard:[&>:last-child:nth-child(odd)]:col-span-full"
    >
      {children}
    </div>
  );
}

const BE_VERDICT: Record<BreakEvenVerdict, { key: TranslationKey; tone: 'ok' | 'warn' | 'crit' }> = {
  healthy: { key: 'dashboard.verdictHealthy', tone: 'ok' },
  thin: { key: 'dashboard.verdictThin', tone: 'warn' },
  tied: { key: 'dashboard.verdictTied', tone: 'warn' },
  loss: { key: 'dashboard.verdictLoss', tone: 'crit' },
};
const BE_TONE = { ok: 'bg-success', warn: 'bg-highlight', crit: 'bg-destructive-soft' } as const;

/**
 * Break-even bulan ini, owner saja (memuat laba). Komponen terpisah supaya
 * tarikan tambahannya (pengeluaran 3 bulan, penjualan) hanya jalan untuk owner;
 * laba servisnya berbagi kunci query dengan hero.
 */
function BreakEvenReadout({ from, to, netCash }: { from: string; to: string; netCash: number }) {
  const t = useT();
  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  const { data: outlets } = useCollection('outlets');
  const overheadQuery = useCollectionRange('expenses', 'date', overheadFetchFrom(from), overheadFetchTo(to));
  const salesQuery = useCollectionRange('sales', 'date', from, to);
  const profitQuery = useCategoryProfit(from, to);
  const loading = overheadQuery.loading || salesQuery.loading || profitQuery.loading;
  const be = useMemo(() => {
    const today = localDateStr();
    return computeBreakEven(
      {
        expenses: overheadQuery.data,
        from,
        to,
        today,
        rent: getRent(),
        outletIds: activeOutletId ? [activeOutletId] : outlets.map((o) => o.id),
        startMonth: getStartMonth(),
      },
      profitQuery.data.reduce((sum, c) => sum + c.profit, 0),
      salesQuery.data.filter((s) => !s.voided),
      overheadQuery.data.filter((e) => e.date >= from && e.date <= today),
    );
  }, [overheadQuery.data, salesQuery.data, profitQuery.data, from, to, activeOutletId, outlets]);

  const beLink =
    '-mx-1.5 flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border-t border-dashed border-primary-foreground/20 px-1.5 py-2 text-inherit pointer-coarse:min-h-11 no-underline outline-none transition-colors hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-highlight';
  if (loading || !be) return null;
  if (be.overhead.total === 0) {
    return (
      <Link className={beLink} to="/finance">
        <span className={heroKey}>{t('dashboard.beLabel')}</span>
        <span className="text-xs text-primary-foreground/80">{t('dashboard.beEmpty')}</span>
      </Link>
    );
  }
  const verdict = BE_VERDICT[breakEvenVerdict(netCash, be.surplus)];
  const pct = Math.round(be.pct * 100);
  return (
    <Link className={beLink} to="/reports" data-tone={verdict.tone}>
      <span className={heroKey}>{t('dashboard.beLabel')}</span>
      <span aria-hidden className="h-1.5 max-w-56 min-w-24 flex-[1_1_6rem] overflow-hidden rounded-full bg-primary-foreground/15">
        <span
          className={cn('block h-full origin-left rounded-full', BE_TONE[verdict.tone])}
          style={{ transform: `scaleX(${Math.min(1, Math.max(0, be.pct))})` }}
        />
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">{pct}%</span>
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span aria-hidden className={cn('size-2 rounded-full', BE_TONE[verdict.tone])} />
        {t(verdict.key)} ·{' '}
        {interpolate(t(be.surplus >= 0 ? 'dashboard.beSurplus' : 'dashboard.beShort'), {
          amount: fmtRpInline(Math.abs(be.surplus)),
        })}
      </span>
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold [&_svg]:size-3.5">
        {t('dashboard.beOpen')} <ArrowRight aria-hidden />
      </span>
    </Link>
  );
}

function DashboardLoading({ label }: { label: string }) {
  const bar = 'animate-pulse rounded-xl bg-secondary motion-reduce:animate-none';
  return (
    <section className="grid gap-3 rounded-2xl bg-card p-5 shadow-panel ring-1 ring-border/60" role="status" aria-live="polite">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-3 @max-[561px]/dashboard:grid-cols-1" aria-hidden>
        <span className={cn(bar, 'row-span-2 min-h-28')} />
        <span className={cn(bar, 'h-12')} />
        <span className={cn(bar, 'h-12')} />
      </div>
      <div className="grid grid-cols-3 gap-3 @max-[561px]/dashboard:flex @max-[561px]/dashboard:overflow-hidden" aria-hidden>
        <span className={cn(bar, 'h-16 @max-[561px]/dashboard:min-w-[72%]')} />
        <span className={cn(bar, 'h-16 @max-[561px]/dashboard:min-w-[72%]')} />
        <span className={cn(bar, 'h-16 @max-[561px]/dashboard:min-w-[72%]')} />
      </div>
    </section>
  );
}

const TARGET_TONE = {
  ok: { text: 'text-success-foreground', fill: 'bg-success-foreground' },
  on: { text: 'text-foreground', fill: 'bg-primary' },
  behind: { text: 'text-warning-foreground', fill: 'bg-warning-foreground' },
} as const;

/**
 * Gauge target dengan penanda LAJU bulan: warnanya menyatakan jarak ke laju.
 * Tanpa `pace` (target harian) tak ada laju yang dikejar — hanya tercapai/belum.
 */
function TargetGauge({ label, pct, pace, detail }: { label: string; pct: number; pace?: number; detail: string }) {
  const t = useT();
  const state = pace === undefined ? (pct >= 100 ? 'ok' : 'on') : targetState(pct, pace);
  const pacePct = `${Math.round((pace ?? 0) * 100)}%`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('font-mono font-semibold tabular-nums', TARGET_TONE[state].text)}>{Math.round(pct)}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary">
        <div
          className={cn('absolute inset-0 origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none', TARGET_TONE[state].fill)}
          style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }}
        />
        {pace !== undefined && (
          <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${pace * 100}%` }} />
        )}
      </div>
      <small className="text-xs text-muted-foreground">
        {detail}
        {pace !== undefined && (
          <>
            {' · '}
            <span className={cn(state === 'behind' && 'font-medium text-warning-foreground')}>
              {t(state === 'behind' ? 'dashboard.targetBehind' : 'dashboard.targetOn').replace('{pace}', pacePct)}
            </span>
          </>
        )}
      </small>
    </div>
  );
}

function DeskCell({ to, label, value, unit, tone, small }: {
  to: string;
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  small?: boolean;
}) {
  return (
    <Link
      className="relative -mr-px -mb-px flex min-w-0 flex-col gap-1 border-r border-b border-dashed border-border px-4 py-3 text-inherit no-underline outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      to={to}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {tone && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[tone])} />}
        {label}
      </span>
      <span className={cn('font-mono font-semibold tabular-nums [overflow-wrap:anywhere]', small ? 'text-sm' : 'text-xl')}>{value}</span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </Link>
  );
}
