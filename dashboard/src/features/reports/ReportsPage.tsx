import { EmptyValue } from '@/components/ui/EmptyValue';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  CalendarDays,
  ChartLine,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  Coins,
  Cpu,
  Download,
  FileText,
  Funnel,
  Gauge,
  Inbox,
  Info,
  PackageOpen,
  Scale,
  ShoppingCart,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { LoadState, loadPending, Term } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { EmptyState } from '@/components/dens/empty-state';
import { Input } from '@/components/dens/input';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { useCollectionRange, rangeForTimestamp } from '@/hooks/useCollectionRange';
import { fmtRp, fmtPercent } from '@/lib/format';
import { localDateStr, localDateOf, fmtDate, fmtDateRange, isInRange } from '@/lib/time';
import { isCapitalFlow, summarize } from '@/lib/business/finance';
import {
  trendSeries,
  transactionRows,
  sparepartUsage,
  restockSuggestions,
  serviceFunnel,
  serviceQuality,
  technicianProfit,
    salesBreakdown,
    periodPreset,
  PERIOD_PRESETS,
  customerStats,
  stockValue,
  monthTargetPace,
  periodComparison,
  comparisonWindows,
  outletComparison,
  type AgingBucket,
} from '@/lib/business/reports';
import { useReceivables, useCategoryProfit, useCompletedServices, useAwaitingPickup } from '@/hooks/useReportData';
import { getRent, getStartMonth, getTarget } from '@/config/orgConfig';
import {
  computeBreakEven,
  breakEvenVerdict,
  profitLoss,
  overheadFetchFrom,
  overheadFetchTo,
  overheadBreakdown,
  categoryLabel,
  EXPENSE_GROUPS,
  EXPENSE_GROUP_LABEL,
  expenseGroupOf,
  type BreakEvenVerdict,
  type ExpenseGroup,
} from '@/lib/business/overhead';
import { useSessionStore } from '@/stores/session';
import { buildCsv, csvFilename } from '@/lib/business/export';
import { downloadCsvFile } from '@/lib/csv';
import { toast } from '@/stores/toast';
import { TrendChart } from './TrendChart';
import { printReport } from './printReport';
import type { TermId } from '@/features/glossary/terms';
import { useT, type TranslationKey } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

function monthRange() {
  const now = new Date();
  return {
    from: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

const VERDICT: Record<BreakEvenVerdict, { key: TranslationKey; tone: 'ok' | 'warn' | 'crit' }> = {
  healthy: { key: 'reports.verdictHealthy', tone: 'ok' },
  thin: { key: 'reports.verdictThin', tone: 'warn' },
  tied: { key: 'reports.verdictTied', tone: 'warn' },
  loss: { key: 'reports.verdictLoss', tone: 'crit' },
};
const TAB_IDS = ['ringkasan', 'uang', 'servis', 'stok', 'pelanggan', 'piutang'] as const;
type TabId = (typeof TAB_IDS)[number];
const isTabId = (v: string | null): v is TabId => !!v && (TAB_IDS as readonly string[]).includes(v);
interface TabItem {
  id: TabId;
  label: string;
  readout: string;
  tone?: 'ok' | 'warn' | 'crit';
}

/** Ambang peringatan Lainnya: angka awal, ubah bila terasa terlalu cerewet/longgar. */
const OTHER_WARN_SHARE = 0.2;
/** Kelompok yang bukan beban usaha: bar netral, bukan merah pengeluaran. */
const NON_COST_GROUPS = new Set<ExpenseGroup>(['contra', 'stock', 'asset', 'receivable', 'owner']);
const GROUP_TERM: Partial<Record<ExpenseGroup, TermId>> = {
  overhead: 'overhead',
  direct: 'beban-langsung',
  stock: 'persediaan',
  asset: 'aset-tetap',
  receivable: 'piutang',
  owner: 'prive',
};
const signedRp = (n: number) => `${n >= 0 ? '+' : '−'}${fmtRp(Math.abs(n))}`;
/** Baris biaya di struk Laba Rugi: selalu bertanda minus, nol tetap "Rp 0". */
const minusRp = (n: number) => (n === 0 ? fmtRp(0) : `−${fmtRp(Math.abs(n))}`);
/** Barang tak bergerak yang ditampilkan, modal tertahan terbesar dulu. */
const IDLE_ROWS = 5;
/** Barang kasir yang ditampilkan; daftar lengkap ada di PDF. */
const TOP_PRODUCTS = 8;
/** Baris maksimum Unit Menunggu Diambil; sisanya disebut, tertua tetap di atas. */
const PICKUP_ROWS = 10;
/** Hari dengan satu desimal bila perlu ("2", "0,5"); format angka tak ikut bahasa. */
const fmtDays = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
/** Total: tanpa "+", minus hanya bila memang negatif. */
const signedPlain = (n: number) => (n < 0 ? `−${fmtRp(Math.abs(n))}` : fmtRp(n));

/** Urut nominal, tetapi Modal/Prive (arus kas pemilik) selalu di dasar. */
const byCapitalLast = (a: [string, number], b: [string, number]) =>
  Number(isCapitalFlow({ category: a[0] })) - Number(isCapitalFlow({ category: b[0] })) || b[1] - a[1];

export function ReportsPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo] = useState(monthRange().to);
  const rangeValid = from <= to;

  // Server-side date filter (plan B): only the selected period is fetched, so
  // the report never pulls the whole history (which truncated at the row cap).
  const { data: incomes, ...incomesLoad } = useCollectionRange('incomes', 'date', from, to);
  const { data: expenses, ...expensesLoad } = useCollectionRange('expenses', 'date', from, to);
  const { data: sales, ...salesLoad } = useCollectionRange('sales', 'date', from, to);
  // Periode pembanding diambil TERPISAH. Sebelumnya periodComparison dioper
  // array di atas — yang hanya memuat periode terpilih — sehingga `previous`
  // selalu nol dan chip "vs periode lalu" cuma bisa 0% atau +100%. Diambil
  // terpisah, bukan dengan melebarkan fetch di atas, karena trendSeries mode
  // bulanan memetakan lewat date.slice(0,7): baris bulan lalu akan masuk ke
  // ember grafik yang sama saat `from` bukan tanggal 1.
  // Periode berjalan dipotong ke hari ini dan dibanding tanggal yang sama
  // bulan lalu (comparisonWindows) — bukan 30 hari penuh sebelumnya.
  const today = localDateStr();
  const cmp = useMemo(() => comparisonWindows(from, to, today), [from, to, today]);
  const running = from <= today && today <= to;
  const [curFrom, curTo] = cmp.current;
  const [prevFrom, prevTo] = cmp.previous;
  const { data: prevIncomes } = useCollectionRange('incomes', 'date', prevFrom, prevTo);
  const { data: prevExpenses } = useCollectionRange('expenses', 'date', prevFrom, prevTo);
  // Overhead butuh bulan penuh + 3 bulan riwayat, di luar jendela periode.
  const { data: overheadExpenses } = useCollectionRange(
    'expenses',
    'date',
    overheadFetchFrom(from),
    overheadFetchTo(to),
  );
  // services filters on createdAt (a UTC timestamp) but groups by LOCAL date,
  // so widen the query ±1 day; the exact localDateOf filter below trims edges.
  const [svcFrom, svcTo] = rangeForTimestamp(from, to);
  const { data: services, ...servicesLoad } = useCollectionRange('services', 'createdAt', svcFrom, svcTo);
    const { data: outlets } = useCollection('outlets');
  // Pelanggan yang datanya dibuat di periode ini = pelanggan baru.
  const { data: newCustomers, ...newCustomersLoad } = useCollectionRange('customers', 'createdAt', svcFrom, svcTo);
  const { data: inventory, ...inventoryLoad } = useCollection('inventory');
  // Panel laporan menampilkan "Belum ada data" hanya setelah datanya benar-benar
  // termuat; selama memuat atau gagal, kosong bukan fakta.
  // Mutu servis & performa teknisi = tiket yang SELESAI dalam periode (bukan
  // yang masuk), dengan part-nya, supaya teknisi diurutkan menurut laba.
  const completedQuery = useCompletedServices(from, to);
  // Unit menunggu diambil: keadaan sekarang, semua periode (seperti piutang).
  const pickupQuery = useAwaitingPickup();
  // Dua kartu ini tidak boleh dibatasi jendela yang dimuat halaman: piutang
  // adalah keadaan sekarang, dan laba per kategori memakai tanggal SELESAI.
  const receivablesQuery = useReceivables();
  const catProfitQuery = useCategoryProfit(from, to);
  const reportLoad = [
    incomesLoad,
    expensesLoad,
    salesLoad,
    servicesLoad,
    inventoryLoad,
        completedQuery,
    pickupQuery,
    newCustomersLoad,
    receivablesQuery,
    catProfitQuery,
  ];
  const reportPending = loadPending(...reportLoad);
  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  const org = useSessionStore((s) => s.org);
  const scopeLabel = activeOutletId
    ? (outlets.find((o) => o.id === activeOutletId)?.name ?? t('reports.branch'))
    : t('reports.allOutlets');


  const fIncomes = useMemo(() => incomes.filter((i) => isInRange(i.date, from, to)), [incomes, from, to]);
  const fExpenses = useMemo(() => expenses.filter((e) => isInRange(e.date, from, to)), [expenses, from, to]);
  const fServices = useMemo(
    () => services.filter((s) => isInRange(localDateOf(s.createdAt), from, to)),
    [services, from, to],
  );
  const fSales = useMemo(() => sales.filter((s) => isInRange(s.date, from, to) && !s.voided), [sales, from, to]);

  const summary = useMemo(() => summarize(fIncomes, fExpenses), [fIncomes, fExpenses]);
  const completed = completedQuery.data;
  const pickups = pickupQuery.data;

  // New aggregations (all pure, from reports.ts).
  const trend = useMemo(() => trendSeries(incomes, expenses, from, to, today), [incomes, expenses, from, to, today]);
  const txnRows = useMemo(() => transactionRows(fIncomes, fExpenses), [fIncomes, fExpenses]);
  const catProfit = catProfitQuery.data;
  const partUsage = useMemo(() => sparepartUsage(fServices), [fServices]);
  const restock = useMemo(() => restockSuggestions(inventory), [inventory]);
  const funnel = useMemo(() => serviceFunnel(fServices), [fServices]);
  const quality = useMemo(() => serviceQuality(fServices, completed), [fServices, completed]);
  const techRows = useMemo(() => technicianProfit(completed), [completed]);
  // `sales`, bukan fSales: struk batal ikut dihitung (terpisah) di sini.
  const salesInfo = useMemo(() => salesBreakdown(sales, from, to), [sales, from, to]);
    const topProducts = salesInfo.products.slice(0, TOP_PRODUCTS);
  const newCustomerIds = useMemo(
    () => new Set(newCustomers.filter((c) => isInRange(localDateOf(c.createdAt), from, to)).map((c) => c.id)),
    [newCustomers, from, to],
  );
  const custStats = useMemo(
    () => customerStats(fServices, completed, sales, newCustomerIds, from, to),
    [fServices, completed, sales, newCustomerIds, from, to],
  );
  const maxCustSpend = Math.max(1, ...custStats.top.map((c) => c.spend));
  // Nilai stok: keadaan sekarang; "tak bergerak" = tak terjual/terpakai di periode.
  const stock = useMemo(
    () => stockValue(inventory, sales, [...fServices, ...completed], from, to),
    [inventory, sales, fServices, completed, from, to],
  );
  const idleTop = stock.idle.slice(0, IDLE_ROWS);
  const maxIdle = Math.max(1, ...idleTop.map((i) => i.value));
  // Target bulanan hanya bila periodenya tepat satu bulan kalender.
  const target = getTarget();
  const pace = monthTargetPace(from, to, today);
  const hasTarget = pace !== null && (target.revenue > 0 || target.serviceCount > 0);
  const maxProductProfit = Math.max(1, ...topProducts.map((p) => p.profit));
  const comparison = useMemo(
    () =>
      periodComparison(
        [...incomes, ...prevIncomes],
        [...expenses, ...prevExpenses],
        curFrom,
        curTo,
        [prevFrom, prevTo],
      ),
    [incomes, prevIncomes, expenses, prevExpenses, curFrom, curTo, prevFrom, prevTo],
  );
  const outletStats = useMemo(
    () => outletComparison(incomes, expenses, outlets, from, to),
    [incomes, expenses, outlets, from, to],
  );
  const receivables = receivablesQuery.data;

  // Periode lalu benar-benar kosong — bukan "tidak berubah". Dibedakan supaya
  // tile bisa mengatakannya alih-alih menampilkan angka yang dikarang.
  const noBaseline =
    comparison.previous.income === 0 &&
    comparison.previous.expense === 0 &&
    comparison.previous.net === 0;

  // Kalimat vonis + sumbernya. Aturannya sengaja konservatif: ia hanya berani
  // menyebut "lebih baik / lebih buruk" kalau ADA dasar pembanding. Tanpa itu
  // ia menyebutkan laba apa adanya dan mengaku tidak bisa membandingkan —
  // lebih berguna daripada kalimat percaya diri yang dikarang.
  const verdict = useMemo(() => {
    if (!rangeValid) {
      return { headline: t('reports.rangeInvalid'), source: t('reports.rangeFix') };
    }
    const net = fmtRp(summary.net);
    const src = `${fmtRp(summary.income)} − ${fmtRp(summary.expense)} = ${net}`;
    if (noBaseline) {
      return {
        headline: interpolate(t('reports.netHeadline'), { net }),
        source: `${src} · ${t('reports.noBaseline')}`,
      };
    }
    const d = comparison.netDelta;
    if (d === null || !Number.isFinite(d)) {
      return { headline: interpolate(t('reports.netHeadline'), { net }), source: src };
    }
    const arah = d >= 0 ? t('reports.better') : t('reports.worse');
    return {
      headline: interpolate(t('reports.netVsPrev'), { net, dir: arah, pct: fmtPercent(Math.abs(d)) }),
      source: `${src} · ${interpolate(t('reports.prevPeriod'), {
        range: fmtDateRange(prevFrom, prevTo),
        amount: fmtRp(comparison.previous.net),
      })}`,
    };
  }, [rangeValid, summary, noBaseline, comparison, prevFrom, prevTo, t]);

  const salesTotal = fSales.reduce((sum, s) => sum + s.total, 0);
  // Keuangan menampilkan satu bulan: tautan membuka bulan terakhir periode.
  const financeHref = (category: string) =>
    `/finance?cat=${encodeURIComponent(category)}&month=${to.slice(0, 7)}`;
  const financeLink = (category: string, inRow = false) => (
    <Link
      className={inRow ? CAT_LINK_ROW : CAT_LINK}
      to={financeHref(category)}
      aria-label={interpolate(t('reports.openInFinance'), { category })}
    >
      {categoryLabel(category)}
    </Link>
  );

  // Break-even: laba kotor vs overhead dari catatan Keuangan, seporsi panjang
  // periode. Dulu arus kas bersih (sudah dipotong overhead) dibanding anggaran
  // sebulan penuh — overhead terhitung dua kali dan filter seminggu selalu "gagal".
  const breakEven = useMemo(() => {
    if (!rangeValid) return null;
    return computeBreakEven(
      {
        expenses: overheadExpenses,
        from,
        to,
        today: localDateStr(),
        rent: getRent(),
        outletIds: activeOutletId ? [activeOutletId] : outlets.map((o) => o.id),
        startMonth: getStartMonth(),
      },
      catProfit.reduce((sum, c) => sum + c.profit, 0),
      fSales,
      fExpenses,
    );
  }, [rangeValid, overheadExpenses, from, to, activeOutletId, outlets, catProfit, fSales, fExpenses]);
  const verdictKind =
    breakEven && breakEven.overhead.total > 0 ? breakEvenVerdict(summary.net, breakEven.surplus) : null;
  // Laba Rugi = break-even yang dipecah per baris; labanya angka yang sama.
  const pl = useMemo(
    () =>
      profitLoss(
        {
          revenue: catProfit.reduce((sum, c) => sum + c.revenue, 0),
          profit: catProfit.reduce((sum, c) => sum + c.profit, 0),
        },
        fSales,
        fExpenses,
      ),
    [catProfit, fSales, fExpenses],
  );
  const unitsDone = catProfit.reduce((sum, c) => sum + c.count, 0);
  const hasOverhead = !!breakEven && breakEven.overhead.total > 0;
  const operating = breakEven?.surplus ?? 0;
  // Bulan berjalan dibandingkan dengan overhead SEBULAN: minus di tanggal 5 itu
  // jarak ke impas, bukan rugi. Kata "rugi" hanya untuk periode yang sudah tutup.
  const finalTone: 'ok' | 'warn' | 'crit' = operating >= 0 ? 'ok' : running ? 'warn' : 'crit';
  const finalLabel = running
    ? t(operating >= 0 ? 'reports.plRunningSurplus' : 'reports.plRunningShort')
    : t(operating >= 0 ? 'reports.plOperating' : 'reports.plOperatingLoss');
  // "Lainnya" gampang jadi tempat membuang catatan; porsi besar = biaya bulanan membengkak.
  const otherShare =
    breakEven && breakEven.overhead.total > 0 ? (breakEven.overhead.byCategory.Lainnya ?? 0) / breakEven.overhead.total : 0;

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of fIncomes) map.set(i.category, (map.get(i.category) ?? 0) + i.amount);
    // Modal/Prive di dasar daftar: uang pemilik, bukan omzet/biaya (isCapitalFlow).
    return [...map.entries()].sort(byCapitalLast);
  }, [fIncomes]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of fExpenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].sort(byCapitalLast);
  }, [fExpenses]);

  // Dikelompokkan menurut perlakuannya di break-even; kelompok kosong disembunyikan.
  const expenseGroups = useMemo(
    () =>
      EXPENSE_GROUPS.map((g) => {
        const rows = expenseByCategory.filter(([c]) => expenseGroupOf(c) === g.id);
        return { id: g.id, rows, total: rows.reduce((sum, [, v]) => sum + v, 0) };
      }).filter((g) => g.rows.length > 0),
    [expenseByCategory],
  );
  const paidOverhead = expenseGroups.find((g) => g.id === 'overhead')?.total ?? 0;
  const maxIncome = Math.max(1, ...incomeByCategory.map(([, v]) => v));
  const maxExpense = Math.max(1, ...expenseByCategory.map(([, v]) => v));
  const maxTechProfit = Math.max(1, ...techRows.map((tech) => tech.profit));
  const maxCatProfit = Math.max(1, ...catProfit.map((c) => c.profit));
  const maxPartQty = Math.max(1, ...partUsage.map((p) => p.qty));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const maxOutletNet = Math.max(1, ...outletStats.map((o) => Math.abs(o.net)));
  const receivablesTotal = receivables.reduce((s, r) => s + r.outstanding, 0);

  // Export the period's transactions (income + expense) as one CSV, newest first.
  const exportCsv = () => {
    if (txnRows.length === 0) {
      toast.error(t('reports.tidakAdaTransaksiPada'));
      return;
    }
    // buildCsv, bukan perakit lokal: ia melolosi sel yang diawali `=`, `+`,
    // `-`, atau `@` supaya nama pelanggan atau keterangan tidak dieksekusi
    // sebagai rumus saat berkasnya dibuka di Excel. Perakit lama di halaman
    // ini tidak punya penjagaan itu — dan tidak punya satu tes pun.
    const csv = buildCsv(txnRows, [
      { label: 'Tanggal', value: (r) => r.date },
      { label: 'Jenis', value: (r) => r.type },
      { label: 'Kategori', value: (r) => r.category },
      { label: 'Keterangan', value: (r) => r.description },
      { label: 'Nominal', value: (r) => r.amount },
    ]);
    // csvFilename menormalkan nama cabang (yang diketik pengguna) dan
    // menempelkan tanggal ekspor, sama seperti ekspor di Pengaturan.
    downloadCsvFile(csvFilename(`laporan-${scopeLabel}-${from}-sd-${to}`), csv);
    toast.success(interpolate(t('reports.txnExported'), { n: String(txnRows.length) }));
  };

  // Laporan A4 untuk dicetak atau disimpan sebagai PDF. Jalur ketiga di gerbang
  // `exportImport` yang sama: berkas yang keluar dari aplikasi, sama seperti CSV.
  const exportPdf = () => {
    if (!org) return;
    if (!rangeValid) {
      toast.error(t('reports.perbaikiRentangTanggalDulu'));
      return;
    }
    // Laporan yang dicetak selagi angkanya masih dimuat akan membekukan nol
    // sebagai fakta di atas kertas — dan kertas tidak bisa memperbarui diri.
    if (reportPending) {
      toast.error(t('reports.dataLaporanBelumSelesai'));
      return;
    }
    const opened = printReport({
      org,
      from,
      to,
      scopeLabel,
      verdict,
      summary,
      comparison,
      noBaseline,
      salesTotal,
      salesInfo,
      custStats,
      stock,
      target: { revenue: target.revenue, serviceCount: target.serviceCount, pace },
      breakEven,
      pl,
      unitsDone,
      running,
      trend,
      incomeByCategory,
      expenseByCategory,
      catProfit,
      partUsage,
      restock,
      funnel,
      quality,
      techRows,
      pickups,
      outletStats,
      receivables,
      txnRows,
    });
    // Tujuan "Simpan sebagai PDF" ada di dalam dialog cetak, dan tidak semua
    // pemilik tahu itu — tanpa kalimat ini tombol bernama "Ekspor PDF" terasa
    // seperti salah membuka dialog printer.
    if (opened) toast.success(t('reports.pilihSimpanSebagaiPdf'));
  };

  // Piutang punya ekspornya sendiri: daftar inilah yang dibawa saat menagih,
  // dan ia tidak mengikuti periode — jadi tak bisa ikut di ekspor transaksi.
  const exportReceivables = () => {
    if (receivables.length === 0) {
      toast.error(t('reports.tidakAdaPiutangUntuk'));
      return;
    }
    const csv = buildCsv(receivables, [
      { label: 'No. Servis', value: (r) => r.serviceNo },
      { label: 'Pelanggan', value: (r) => r.customerName },
      { label: 'Sisa', value: (r) => r.outstanding },
      { label: 'Umur (hari)', value: (r) => r.ageDays },
      { label: 'Kelompok Umur', value: (r) => r.bucket },
    ]);
    downloadCsvFile(csvFilename(`piutang-${scopeLabel}`), csv);
    toast.success(interpolate(t('reports.receivablesExported'), { n: String(receivables.length) }));
  };

  // Tab bagian. LED hanya pada kanal yang punya status (Lit-Signal): sisanya
  // cuma hitungan, dan lampu di sana akan menyala tanpa arti.
  const pendingReadout = '…';
  const ticketTotal = funnel.reduce((s, f) => s + f.count, 0);
  const summaryTab: TabItem = reportPending
    ? { id: 'ringkasan', label: t('reports.tabSummary'), readout: pendingReadout }
    : pl.grossMargin === null
      ? { id: 'ringkasan', label: t('reports.tabSummary'), readout: t('reports.idxNoRevenue') }
      : {
          id: 'ringkasan',
          label: t('reports.tabSummary'),
          readout: interpolate(t('reports.idxMargin'), { pct: fmtPercent(pl.grossMargin, 0) }),
          // Tanpa overhead tercatat, margin saja tak bisa menyebut impas atau belum.
          tone: hasOverhead ? (operating >= 0 ? 'ok' : 'warn') : undefined,
        };
  const tabItems: TabItem[] = [
    summaryTab,
    {
      id: 'uang',
      label: t('reports.tabMoney'),
      readout: reportPending ? pendingReadout : interpolate(t('reports.idxTxnCount'), { n: String(txnRows.length) }),
    },
    {
      id: 'servis',
      label: t('reports.tabService'),
      readout: reportPending ? pendingReadout : interpolate(t('reports.idxTickets'), { n: String(ticketTotal) }),
    },
    reportPending
      ? { id: 'stok', label: t('reports.tabStock'), readout: pendingReadout }
      : restock.length > 0
        ? {
            id: 'stok',
            label: t('reports.tabStock'),
            readout: interpolate(t('reports.idxRestock'), { n: String(restock.length) }),
            tone: 'warn',
          }
        : { id: 'stok', label: t('reports.tabStock'), readout: t('reports.idxStockOk'), tone: 'ok' },
        {
      id: 'pelanggan',
      label: t('reports.tabCustomers'),
      readout: reportPending ? pendingReadout : interpolate(t('reports.custCount'), { n: String(custStats.active) }),
    },
    reportPending
      ? { id: 'piutang', label: t('reports.idxReceivables'), readout: pendingReadout }
      : receivables.length > 0
        ? {
            id: 'piutang',
            label: t('reports.idxReceivables'),
            readout: fmtRp(receivablesTotal),
            tone: receivables.some((r) => r.bucket === '31+') ? 'crit' : 'warn',
          }
        : { id: 'piutang', label: t('reports.idxReceivables'), readout: t('reports.idxNoReceivables'), tone: 'ok' },
  ];
  // Tab aktif hidup di URL (?bagian=), supaya tautan dan tombol Kembali membuka
  // bagian yang sama. replace: berpindah tab bukan langkah navigasi.
  const tab: TabId = isTabId(searchParams.get('bagian')) ? (searchParams.get('bagian') as TabId) : 'ringkasan';
  const selectTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'ringkasan') next.delete('bagian');
    else next.set('bagian', id);
    setSearchParams(next, { replace: true });
  };
  // Pola tab WAI-ARIA: panah kiri/kanan, Home, End memindah fokus DAN memilih.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TAB_IDS.indexOf(tab);
    const to =
      e.key === 'ArrowRight' ? (i + 1) % TAB_IDS.length
      : e.key === 'ArrowLeft' ? (i - 1 + TAB_IDS.length) % TAB_IDS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TAB_IDS.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    selectTab(TAB_IDS[to]);
    document.getElementById(`lap-tab-${TAB_IDS[to]}`)?.focus();
  };
  const panel = (id: TabId, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`lap-panel-${id}`}
      aria-labelledby={`lap-tab-${id}`}
      hidden={tab !== id}
      // `flex` mengalahkan [hidden] bawaan browser, jadi panel tersembunyi butuh aturan sendiri.
      className="flex flex-col gap-5 [&[hidden]]:hidden"
    >
      {children}
    </div>
  );

  return (
    <div data-nu className="@container/laporan flex flex-col gap-5 bg-transparent">
      <Panel>
        <div className="p-5 @max-[721px]/laporan:p-4">
          {/* Pintasan periode. Dulu satu-satunya cara ganti periode adalah dua
              pemilih tanggal bawaan, dua kali buka-tutup di ponsel. Tanggal di
              bawahnya tetap ada untuk rentang lain. */}
          <div
            className="mb-4 flex flex-wrap gap-2 border-b border-dashed border-border pb-4"
            role="group"
            aria-label={t('reports.presetsLabel')}
          >
            {PERIOD_PRESETS.map((id) => {
              const [pf, pt] = periodPreset(id, today);
              const active = pf === from && pt === to;
              return (
                <button
                  key={id}
                  type="button"
                  className={CHIP}
                  aria-pressed={active}
                  onClick={() => {
                    setFrom(pf);
                    setTo(pt);
                  }}
                >
                  {t(`reports.preset.${id}` as TranslationKey)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm @max-[721px]/laporan:items-stretch">
            {/* Saat sempit label tanggal mengambil satu baris penuh, jadi ikon hiasan ini disembunyikan. */}
            <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground @max-[721px]/laporan:hidden" />
            {/* max/min saling mengunci: rentang terbalik dulu diterima diam-diam
                dan membuat ketiga belas kartu melapor nol, sehingga pemilik
                diberi tahu tokonya menghasilkan Rp 0 — bukan bahwa ia salah
                mengisi tanggal. */}
            <label className={DATE_LABEL}>
              {t('reports.dari')}
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={DATE_INPUT} />
            </label>
            <label className={DATE_LABEL}>
              {t('reports.sampai')}
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={DATE_INPUT} />
            </label>
            {rangeValid ? (
              <span className={`${RANGE_BASE} text-muted-foreground`}>{fmtDate(from)} – {fmtDate(to)}</span>
            ) : (
              <span className={`${RANGE_BASE} inline-flex items-center gap-1.5 text-destructive`} role="alert">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" /> {t('reports.rangeBad')}
              </span>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/istilah">
                <CircleHelp aria-hidden />
                {t('glossary.open')}
              </Link>
            </Button>
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
              title={t('reports.cakupanLaporan')}
            >
              {activeOutletId ? <Store aria-hidden /> : <Boxes aria-hidden />}
              {scopeLabel}
            </span>
            {/* Kedua tombol ekspor berpindah baris bersama; sebagai saudara lepas,
                PDF tertinggal di baris filter dan CSV turun sendirian. Di wadah
                sempit grup ini selebar baris dan tombolnya mengisi; keduanya butuh
                272px, jadi di wadah <304px (ponsel 320px) CSV turun ke bawah PDF
                alih-alih meluber 16px seperti dulu. */}
            <span className="inline-flex shrink-0 gap-2 @max-[721px]/laporan:w-full @max-[721px]/laporan:flex-wrap @max-[721px]/laporan:[&>*]:flex-auto">
              <Button variant="outline" onClick={exportPdf}>
                <FileText aria-hidden />
                {t('reports.eksporPdf')}
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download aria-hidden />
                {t('reports.eksporCsv')}
              </Button>
            </span>
          </div>
        </div>
      </Panel>

      {/* Vonis: halaman ini menghitung tiga belas kartu, dan kalimat inilah
          kesimpulannya. Sumbernya ditulis di bawah supaya angkanya bisa
          diperiksa, bukan dipercaya. */}
      <div className="rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-panel @max-[721px]/laporan:p-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-foreground/80">
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full',
              // Kas bersih negatif = sorot, bukan merah: bisa lahir dari belanja stok besar, bukan rugi.
              !rangeValid || noBaseline ? 'bg-primary-foreground/50' : summary.net >= 0 ? 'bg-success' : 'bg-highlight',
            )}
          />
          {t('reports.periodeIni')}
        </span>
        <p className="mt-2 text-xl leading-snug font-semibold tabular-nums @max-[721px]/laporan:text-lg">{verdict.headline}</p>
        <p className="mt-1.5 text-xs tabular-nums text-primary-foreground/80">{verdict.source}</p>
      </div>

      <div className="grid grid-cols-4 gap-3 @max-[871px]/laporan:grid-cols-2 @max-[871px]/laporan:[&>:last-child:nth-child(odd)]:col-span-full">
        <Metric
          label={t('reports.pemasukan')}
          value={fmtRp(summary.income)}
          icon={<ArrowDown aria-hidden />}
          tone="success"
          delta={noBaseline ? null : comparison.incomeDelta}
        />
        <Metric
          label={t('reports.pengeluaran')}
          value={fmtRp(summary.expense)}
          icon={<ArrowUp aria-hidden />}
          tone="neutral"
          delta={noBaseline ? null : comparison.expenseDelta}
          deltaInverse
        />
        <Metric
          label={<Term id="arus-kas-bersih">{t('reports.arusKasBersih')}</Term>}
          value={fmtRp(summary.net)}
          icon={<ChartLine aria-hidden />}
          tone={summary.net < 0 ? 'warning' : 'neutral'}
          delta={noBaseline ? null : comparison.netDelta}
        />
        <Metric
          label={t('reports.penjualanPos')}
          value={fmtRp(salesTotal)}
          icon={<ShoppingCart aria-hidden />}
          tone="neutral"
          /* Pembayaran penjualan sudah membukukan pemasukan, jadi angka ini
             BAGIAN dari Pemasukan di kiri — bukan tambahannya. */
          note={t('reports.posIncluded')}
        />
      </div>

      {/* Tab bagian. Dulu indeks lompat ke 13 kartu dalam satu gulir ±6 layar
          (ponsel), jadi kartu dikelompokkan per pertanyaan pemilik. Readout dan
          titik status tetap, jadi deret ini masih ringkasan tanpa menggulir. */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground" id="lap-tabs-title">
          {t('reports.idxTitle')}
        </span>
        <div
          role="tablist"
          aria-labelledby="lap-tabs-title"
          // 6 kolom butuh ±147px per tab (readout 15 karakter + titik, terukur
          // 7 Nov) + 5 celah: wadah 922px. 3 lalu 2 kolom = 2 dan 3 baris rata.
          className="grid grid-cols-6 gap-2 @max-[922px]/laporan:grid-cols-3 @max-[457px]/laporan:grid-cols-2 @max-[457px]/laporan:[&>:last-child:nth-child(odd)]:col-span-2"
          onKeyDown={onTabKey}
        >
          {tabItems.map((it) => (
            <button
              key={it.id}
              type="button"
              role="tab"
              id={`lap-tab-${it.id}`}
              aria-selected={tab === it.id}
              aria-controls={`lap-panel-${it.id}`}
              tabIndex={tab === it.id ? 0 : -1}
              className={TAB}
              onClick={() => selectTab(it.id)}
            >
              <span className="text-sm leading-tight font-semibold">{it.label}</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground group-aria-selected/tab:text-primary-foreground/80">
                {it.tone && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', TAB_DOT[it.tone])} />}
                {it.readout}
              </span>
            </button>
          ))}
        </div>
      </div>

      {panel(
        'ringkasan',
        <>
          {/* Laba Rugi + break-even dalam satu kartu: keduanya membaca laba kotor
              yang sama. Dulu laba usaha hanya muncul sebagai "Break-even −Rp X" di
              kalimat kecil kartu ketiga, dan laba penjualan kasir dihitung tanpa
              pernah ditampilkan. */}
          {breakEven && (
            <Panel>
              <PanelHead icon={<Scale aria-hidden />} title={<Term id="laba-usaha">{t('reports.plTitle')}</Term>} />
              <div className={BODY}>
                {reportPending ? (
                  <LoadState queries={reportLoad} />
                ) : (
                  /* Ambang dua kolom 52rem, dari lebar terukur (14 Nov 2026): baris
                     struk terlebar 369px dan baris gauge "Rp 3.935.000 / Rp 4.050.000"
                     365px pada nominal 7 digit; 52rem memberi tiap kolom ≥392px. */
                  <div className="@container/laba">
                    <div className="grid gap-5 @min-[52rem]/laba:grid-cols-2 @min-[52rem]/laba:gap-6">
                      <ul aria-label={t('reports.plLines')}>
                        <PlLine
                          label={t('reports.plServiceRevenue')}
                          sub={interpolate(t('reports.plUnits'), { n: String(unitsDone) })}
                          amount={fmtRp(pl.serviceRevenue)}
                        />
                        <PlLine label={t('reports.plServiceCost')} amount={minusRp(pl.serviceCost)} />
                        <PlLine label={t('reports.plSalesRevenue')} amount={fmtRp(pl.salesRevenue)} />
                        <PlLine
                          label={<Term id="hpp">{t('reports.plSalesCost')}</Term>}
                          amount={minusRp(pl.salesCost)}
                        />
                        {pl.directCost > 0 && (
                          <PlLine
                            label={<Term id="beban-langsung">{t('reports.plDirect')}</Term>}
                            amount={minusRp(pl.directCost)}
                          />
                        )}
                        <PlLine
                          kind="total"
                          label={<Term id="laba-kotor">{t('reports.plGross')}</Term>}
                          sub={
                            pl.grossMargin === null
                              ? undefined
                              : interpolate(t('reports.plMargin'), { pct: fmtPercent(pl.grossMargin) })
                          }
                          amount={signedPlain(pl.gross)}
                        />
                        <PlLine
                          label={<Term id="overhead">{t('reports.plOverhead')}</Term>}
                          amount={hasOverhead ? minusRp(breakEven.overhead.total) : t('reports.plOverheadNone')}
                          muted={!hasOverhead}
                        />
                        {hasOverhead && (
                          // Rincian overhead menempel di bawah barisnya, tanpa garis sendiri.
                          <li className="pb-2">
                            <ul
                              className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground [&_b]:font-mono [&_b]:font-semibold [&_b]:tabular-nums [&_b]:text-foreground"
                              aria-label={t('reports.beBreakdown')}
                            >
                              {overheadBreakdown(breakEven.overhead.byCategory).map(([c, v]) => (
                                <li key={c}>
                                  {financeLink(c)}
                                  {breakEven.overhead.estimated.includes(c) && (
                                    <i className={`ml-1 not-italic ${TAG}`}>{t('reports.estTag')}</i>
                                  )}{' '}
                                  <b>{fmtRp(v)}</b>
                                </li>
                              ))}
                            </ul>
                          </li>
                        )}
                        {hasOverhead && (
                          <PlLine
                            kind="final"
                            tone={finalTone}
                            label={finalLabel}
                            sub={
                              running || pl.revenue <= 0
                                ? undefined
                                : interpolate(t('reports.plMargin'), { pct: fmtPercent(operating / pl.revenue) })
                            }
                            amount={running ? fmtRp(Math.abs(operating)) : signedPlain(operating)}
                          />
                        )}
                      </ul>

                      <div className="flex min-w-0 flex-col border-t border-dashed border-border pt-4 @min-[52rem]/laba:border-t-0 @min-[52rem]/laba:border-l @min-[52rem]/laba:pt-0 @min-[52rem]/laba:pl-6">
                        {verdictKind && (
                          // Vonis kas × break-even: jawaban dulu, angka sesudahnya.
                          <div className={cn('mb-3 flex items-start gap-3 rounded-xl px-4 py-3', VERDICT_BG[VERDICT[verdictKind].tone])}>
                            <span aria-hidden className={cn('mt-[7px] size-2 shrink-0 rounded-full', DOT[VERDICT[verdictKind].tone])} />
                            <div>
                              <strong className="block text-base leading-snug font-semibold">{t(VERDICT[verdictKind].key)}</strong>
                              <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted-foreground">
                                {interpolate(t('reports.verdictSub'), {
                                  cash: signedRp(summary.net),
                                  be: signedRp(breakEven.surplus),
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                        {hasOverhead ? (
                          <>
                            <div className="mb-3 flex items-end justify-between gap-3">
                              <div>
                                <span className="mb-0.5 block text-xs font-medium text-muted-foreground">
                                  <Term id="break-even">{t('reports.beGrossVsOverhead')}</Term>
                                </span>
                                <strong className="font-mono text-lg font-semibold tabular-nums">
                                  {fmtRp(breakEven.gross)} / {fmtRp(breakEven.overhead.total)}
                                </strong>
                              </div>
                              <span className={cn('font-mono text-lg font-semibold tabular-nums', breakEven.pct >= 1 && TEXT.inc)}>
                                {fmtPercent(breakEven.pct)}
                              </span>
                            </div>
                            <Meter ratio={breakEven.pct} ok={breakEven.pct >= 1} />
                            <small className={NOTE}>
                              <Info aria-hidden />
                              {t(
                                breakEven.overhead.basis === 'actual'
                                  ? 'reports.beBasisActual'
                                  : breakEven.overhead.basis === 'estimate'
                                    ? 'reports.beBasisEstimate'
                                    : 'reports.beBasisPartial',
                              )}
                            </small>
                            {running && (
                              <small className={NOTE}>
                                <Info aria-hidden />
                                {t('reports.plRunningNote')}
                              </small>
                            )}
                            {breakEven.overhead.prorated && (
                              <small className={NOTE}>
                                <Info aria-hidden />
                                {t('reports.beProrated')}
                              </small>
                            )}
                            {otherShare > OTHER_WARN_SHARE && (
                              <Link
                                className={`${NOTE_WARN} rounded-sm underline decoration-dotted underline-offset-[3px] outline-none hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11`}
                                to={financeHref('Lainnya')}
                              >
                                <TriangleAlert aria-hidden />
                                {interpolate(t('reports.beOtherHigh'), {
                                  amount: fmtRp(breakEven.overhead.byCategory.Lainnya ?? 0),
                                  pct: fmtPercent(otherShare, 0),
                                })}
                              </Link>
                            )}
                            {breakEven.overhead.missingPayroll && (
                              <small className={NOTE_WARN}>
                                <TriangleAlert aria-hidden />
                                {t('reports.beNoPayroll')}
                              </small>
                            )}
                          </>
                        ) : (
                          // Tanpa isian perkiraan, kalimat inilah yang memberi tahu break-even ada.
                          <p className="text-sm leading-relaxed text-muted-foreground">{t('reports.beEmpty')}</p>
                        )}
                        <small className={NOTE}>
                          <Info aria-hidden />
                          {t('reports.plAccrualNote')}
                        </small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Target bulanan dari Pengaturan, hanya untuk periode tepat satu bulan.
              Penanda = laju merata: di tanggal 15 dari 30, separuh target. */}
          {hasTarget && pace !== null && (
            <Panel>
              <PanelHead
                icon={<Target aria-hidden />}
                title={t('reports.targetTitle')}
                action={
                  <span className={READOUT}>
                    <Link className={CAT_LINK} to="/settings?tab=usaha">
                      {t('reports.targetEdit')}
                    </Link>
                  </span>
                }
              />
              <div className={BODY}>
                <div className="grid gap-4">
                  {target.revenue > 0 && (
                    <TargetRow
                      label={t('reports.targetRevenue')}
                      value={`${fmtRp(summary.income)} / ${fmtRp(target.revenue)}`}
                      ratio={summary.income / target.revenue}
                      pace={pace}
                    />
                  )}
                  {target.serviceCount > 0 && (
                    <TargetRow
                      label={t('reports.targetUnits')}
                      value={`${unitsDone} / ${target.serviceCount}`}
                      ratio={unitsDone / target.serviceCount}
                      pace={pace}
                    />
                  )}
                </div>
                {pace < 1 && (
                  <small className={NOTE}>
                    <span aria-hidden className="mt-[3px] h-2.5 w-0.5 shrink-0 rounded-full bg-foreground" />
                    {interpolate(t('reports.targetPace'), { pct: fmtPercent(pace, 0) })}
                  </small>
                )}
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHead icon={<ChartLine aria-hidden />} title={t('reports.trenPemasukanVsPengeluaran')} />
            <div className={BODY}>
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : trend.length === 0 ? (
                <EmptyState icon={<ChartLine aria-hidden />} title={t('reports.belumAdaDataPeriode')} />
              ) : (
                <TrendChart points={trend} />
              )}
            </div>
          </Panel>
        </>,
      )}

      {panel(
        'uang',
        <>
          <div className={GRID}>
            <Panel>
              <PanelHead icon={<ArrowDown aria-hidden />} title={t('reports.pemasukanPerKategori')} />
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : incomeByCategory.length === 0 ? (
                <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaDataPeriode')} />
              ) : (
                <ul>
                  {incomeByCategory.map(([cat, amt]) => {
                    const capital = isCapitalFlow({ category: cat });
                    return (
                      <Channel
                        key={cat}
                        name={
                          <>
                            {financeLink(cat, true)}
                            {/* Modal/Prive: uang pemilik, netral dengan tanda, bukan hijau operasional. */}
                            {capital && <span className={`ml-2 ${TAG}`}>{t('reports.notRevenue')}</span>}
                          </>
                        }
                        value={fmtRp(amt)}
                        tone={capital ? undefined : 'inc'}
                        fill={(amt / maxIncome) * 100}
                        fillTone={capital ? 'capital' : 'inc'}
                      />
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHead icon={<ArrowUp aria-hidden />} title={t('reports.pengeluaranPerKategori')} />
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : expenseByCategory.length === 0 ? (
                <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaDataPeriode')} />
              ) : (
                <div>
                  {expenseGroups.map((g) => (
                    <section
                      key={g.id}
                      className="border-t border-dashed border-border first:border-t-0"
                      aria-label={t(EXPENSE_GROUP_LABEL[g.id])}
                    >
                      <div className={`flex justify-between gap-3 pt-2.5 text-xs font-medium text-muted-foreground ${ROW_X}`}>
                        <span>
                          {GROUP_TERM[g.id] ? (
                            <Term id={GROUP_TERM[g.id]!}>{t(EXPENSE_GROUP_LABEL[g.id])}</Term>
                          ) : (
                            t(EXPENSE_GROUP_LABEL[g.id])
                          )}
                        </span>
                        <span className="font-mono tabular-nums">{fmtRp(g.total)}</span>
                      </div>
                      <ul>
                        {g.rows.map(([cat, amt]) => (
                          <Channel
                            key={cat}
                            name={financeLink(cat, true)}
                            value={fmtRp(amt)}
                            tone={NON_COST_GROUPS.has(g.id) ? undefined : 'exp'}
                            fill={(amt / maxExpense) * 100}
                            fillTone={NON_COST_GROUPS.has(g.id) ? 'capital' : 'exp'}
                          />
                        ))}
                      </ul>
                      {g.id === 'overhead' && breakEven && Math.abs(breakEven.overhead.total - paidOverhead) >= 1 && (
                        <p className={`pb-3 text-xs leading-normal text-muted-foreground ${ROW_X}`}>{t('reports.groupOverheadNote')}</p>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {outlets.length > 1 && (
            <Panel>
              <PanelHead icon={<Store aria-hidden />} title={t('reports.perbandinganAntarOutlet')} />
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : activeOutletId ? (
                /* Datanya sudah tersaring cabang aktif, jadi kartu ini hanya akan
                   menampilkan satu batang — pembanding yang tidak membandingkan. */
                <p className={TABLE_NOTE}>{interpolate(t('reports.outletSingle'), { name: scopeLabel })}</p>
              ) : outletStats.length === 0 ? (
                <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaDataPeriode')} />
              ) : (
                <ul>
                  {outletStats.map((o) => {
                    const up = o.net >= 0;
                    return (
                      <Channel
                        key={o.outletId ?? 'none'}
                        name={
                          <>
                            {/* Titik + tanda: untung vs rugi tidak dibedakan oleh warna saja. */}
                            <span
                              aria-hidden
                              className={cn('mr-1.5 inline-block size-2 rounded-full', up ? FILL.inc : FILL.neg)}
                            />
                            {o.name}{' '}
                            <span className={META}>
                              {interpolate(t('reports.outletFlow'), { income: fmtRp(o.income), expense: fmtRp(o.expense) })}
                            </span>
                          </>
                        }
                        value={`${up ? '+' : '−'}${fmtRp(Math.abs(o.net))}`}
                        tone={up ? 'inc' : 'neg'}
                        fill={(Math.abs(o.net) / maxOutletNet) * 100}
                        fillTone={up ? 'inc' : 'neg'}
                      />
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}

          <Panel>
            <PanelHead
              icon={<ClipboardList aria-hidden />}
              title={t('reports.rincianTransaksi')}
              action={<span className={READOUT}>{interpolate(t('reports.rows'), { n: String(txnRows.length) })}</span>}
            />
            {reportPending ? (
              <LoadState queries={reportLoad} />
            ) : txnRows.length === 0 ? (
              <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaTransaksiPeriode')} />
            ) : (
              <div className={TABLE_SCROLL}>
                <table className={TABLE}>
                  <caption className="sr-only">{t('reports.rincianTransaksiPemasukanDan')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('reports.tanggal')}</th>
                      <th scope="col">{t('reports.jenis')}</th>
                      <th scope="col">{t('reports.kategori')}</th>
                      <th scope="col">{t('reports.keterangan')}</th>
                      <th scope="col" data-num="">{t('reports.nominal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txnRows.slice(0, 100).map((r, idx) => (
                      <tr key={idx}>
                        <td className={MONO}>{fmtDate(r.date)}</td>
                        <td>
                          <Badge variant={r.amount >= 0 ? 'success' : 'secondary'}>{r.type}</Badge>
                        </td>
                        <td>{r.category}</td>
                        <td className={DESC_CELL}>{r.description || <EmptyValue />}</td>
                        <td className={cn(NUM_PUSH, MONO, r.amount >= 0 ? TEXT.inc : TEXT.exp)}>{fmtRp(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txnRows.length > 100 && (
                  <p className={TABLE_NOTE}>
                    {interpolate(t('reports.txnShown'), { shown: '100', total: String(txnRows.length) })}{' '}
                    {t('reports.txnMoreExport')}
                  </p>
                )}
              </div>
            )}
          </Panel>
        </>,
      )}

      {panel(
        'servis',
        <>
          {/* Mutu & kecepatan: empat readout. Tanpa titik status: ambang "baik"
              untuk klaim atau batal berbeda per toko, dan lampu tanpa ambang yang
              disepakati hanya menyala tanpa arti. */}
          <Panel>
            <PanelHead icon={<Gauge aria-hidden />} title={t('reports.qualityTitle')} />
            <div className={BODY}>
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : (
                <dl className={Q_GRID}>
                  <QTile
                    label={t('reports.qTurnaround')}
                    value={
                      quality.medianDays === null ? <EmptyValue /> : interpolate(t('reports.qDays'), { n: fmtDays(quality.medianDays) })
                    }
                    sub={interpolate(t('reports.qDoneSub'), { n: String(quality.done) })}
                  />
                  <QTile
                    label={t('reports.qClaims')}
                    value={quality.done > 0 ? fmtPercent(quality.claims / quality.done, 0) : <EmptyValue />}
                    sub={interpolate(t('reports.qClaimsSub'), { claims: String(quality.claims), done: String(quality.done) })}
                  />
                  <QTile
                    label={t('reports.qCancelled')}
                    value={quality.intake > 0 ? fmtPercent(quality.cancelled / quality.intake, 0) : <EmptyValue />}
                    sub={interpolate(t('reports.qCancelledSub'), { n: String(quality.cancelled), total: String(quality.intake) })}
                  />
                  <QTile
                    label={t('reports.qOverEstimate')}
                    value={quality.estimated > 0 ? `${quality.overEstimate} / ${quality.estimated}` : <EmptyValue />}
                    sub={t('reports.qOverEstimateSub')}
                  />
                </dl>
              )}
            </div>
          </Panel>

          {/* Unit menunggu diambil: keadaan sekarang, semua periode. Rak penuh
              unit yang tak diambil = modal part tertahan dan risiko hilang. */}
          <Panel>
            <PanelHead
              icon={<PackageOpen aria-hidden />}
              title={t('reports.pickupTitle')}
              action={
                <span className={READOUT_WRAP}>
                  {pickups.length > 0 ? `${interpolate(t('reports.pickupCount'), { n: String(pickups.length) })} · ` : ''}
                  {t('reports.allPeriods')}
                </span>
              }
            />
            {reportPending ? (
              <LoadState queries={reportLoad} />
            ) : pickups.length === 0 ? (
              <EmptyState icon={<CircleCheck aria-hidden />} title={t('reports.pickupNone')} />
            ) : (
              <div className={TABLE_SCROLL}>
                <table className={TABLE}>
                  <caption className="sr-only">{t('reports.pickupCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('reports.noServis')}</th>
                      <th scope="col">{t('reports.pelanggan')}</th>
                      <th scope="col">{t('reports.status')}</th>
                      <th scope="col" data-num="">{t('reports.pickupWaiting')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickups.slice(0, PICKUP_ROWS).map((r) => (
                      <tr key={r.serviceId}>
                        <td className={MONO}>
                          <Link className={CAT_LINK} to={`/services/${r.serviceId}`}>
                            {r.serviceNo}
                          </Link>
                        </td>
                        <td>{r.customerName}</td>
                        <td>{t(`status.${r.status}` as TranslationKey)}</td>
                        <td className={NUM_PUSH}>
                          <Badge variant={AGE_BADGE[r.bucket]}>{interpolate(t('reports.qDays'), { n: String(r.ageDays) })}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pickups.length > PICKUP_ROWS && (
                  <p className={TABLE_NOTE}>
                    {interpolate(t('reports.pickupMore'), { shown: String(PICKUP_ROWS), total: String(pickups.length) })}
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead
              icon={<Cpu aria-hidden />}
              title={<Term id="laba-servis">{t('reports.labaPerKategoriPerangkat')}</Term>}
              /* Periode kartu ini dihitung dari tanggal SELESAI, sama seperti
                 Performa Teknisi di bawah — dulu ia memakai tanggal tiket masuk. */
              action={<span className={LIVE_TAG}>{t('reports.selesaiPeriodeIni')}</span>}
            />
            {reportPending ? (
              <LoadState queries={reportLoad} />
            ) : catProfit.length === 0 ? (
              <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaServisSelesai')} />
            ) : (
              <ul>
                {catProfit.map((c) => (
                  <Channel
                    key={c.category}
                    name={
                      <>
                        {c.category}{' '}
                        <span className={META}>
                          · {interpolate(t('reports.catRow'), { n: String(c.count), revenue: fmtRp(c.revenue) })}
                        </span>
                      </>
                    }
                    value={fmtRp(c.profit)}
                    tone="inc"
                    fill={(c.profit / maxCatProfit) * 100}
                    fillTone="brand"
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* Tahapan servis. Kecepatan pindah ke Mutu & Kecepatan (median dari
              unit yang SELESAI); rata-rata dari tiket masuk di sini dulu
              menjawab pertanyaan lain dengan angka yang mirip. */}
          <Panel>
            <PanelHead icon={<Funnel aria-hidden />} title={t('reports.funnelServisTiketMasuk')} />
            {reportPending ? (
              <LoadState queries={reportLoad} />
            ) : funnel.length === 0 ? (
              <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaServisPeriode')} />
            ) : (
              <ul>
                {funnel.map((f) => (
                  <Channel key={f.status} name={f.label} value={f.count} fill={(f.count / maxFunnel) * 100} fillTone="count" />
                ))}
              </ul>
            )}
          </Panel>

          {/* Teknisi menurut LABA, dari unit selesai periode ini. */}
          <Panel>
            <PanelHead
              icon={<Trophy aria-hidden />}
              title={t('reports.performaTeknisiPeriode')}
              action={<span className={LIVE_TAG}>{t('reports.techSortNote')}</span>}
            />
            {reportPending ? (
              <LoadState queries={reportLoad} />
            ) : techRows.length === 0 ? (
              <EmptyState icon={<Users aria-hidden />} title={t('reports.belumAdaServisSelesai')} />
            ) : (
              <ul>
                {techRows.map((tech) => (
                  <Channel
                    key={tech.key}
                    name={
                      <>
                        {tech.name}{' '}
                        <span className={META}>
                          ·{' '}
                          {interpolate(t('reports.techRow'), {
                            units: String(tech.units),
                            days: tech.medianDays === null ? '–' : fmtDays(tech.medianDays),
                            revenue: fmtRp(tech.revenue),
                          })}
                        </span>
                      </>
                    }
                    value={signedPlain(tech.profit)}
                    tone={tech.profit >= 0 ? 'inc' : 'neg'}
                    fill={(Math.max(0, tech.profit) / maxTechProfit) * 100}
                    fillTone="brand"
                  />
                ))}
              </ul>
            )}
          </Panel>
        </>,
      )}

      {panel(
        'stok',
        <>
          {/* Penjualan Kasir. Dulu Laporan hanya tahu omzetnya (kartu metrik);
              laba, barang yang menghasilkannya, diskon, dan struk batal tak
              terlihat di mana pun. */}
          <Panel>
            <PanelHead
              icon={<ShoppingCart aria-hidden />}
              title={t('reports.salesTitle')}
              action={<span className={LIVE_TAG}>{t('reports.sSortNote')}</span>}
            />
            {reportPending ? (
              <div className={BODY}>
                <LoadState queries={reportLoad} />
              </div>
            ) : salesInfo.count === 0 && salesInfo.voidCount === 0 ? (
              <div className={BODY}>
                <EmptyState icon={<Inbox aria-hidden />} title={t('reports.sNone')} />
              </div>
            ) : (
              <>
                <div className={BODY}>
                  <dl className={Q_GRID}>
                    <QTile
                      label={t('reports.sReceipts')}
                      value={String(salesInfo.count)}
                      sub={
                        salesInfo.count > 0
                          ? interpolate(t('reports.sReceiptsSub'), { avg: fmtRp(Math.round(salesInfo.revenue / salesInfo.count)) })
                          : t('reports.sNone')
                      }
                    />
                    <QTile
                      label={t('reports.sGross')}
                      value={signedPlain(salesInfo.revenue - salesInfo.cost)}
                      sub={interpolate(t('reports.sGrossSub'), {
                        pct: salesInfo.revenue > 0 ? fmtPercent((salesInfo.revenue - salesInfo.cost) / salesInfo.revenue, 0) : '–',
                        revenue: fmtRp(salesInfo.revenue),
                      })}
                    />
                    <QTile
                      label={t('reports.sDiscount')}
                      value={fmtRp(salesInfo.discount)}
                      sub={interpolate(t('reports.sDiscountSub'), {
                        pct: salesInfo.subtotal > 0 ? fmtPercent(salesInfo.discount / salesInfo.subtotal, 1) : '–',
                      })}
                    />
                    <QTile
                      label={t('reports.sVoid')}
                      value={String(salesInfo.voidCount)}
                      sub={interpolate(t('reports.sVoidSub'), { amount: fmtRp(salesInfo.voidValue) })}
                    />
                  </dl>
                </div>
                {topProducts.length > 0 && (
                  <ul className={DASHED_TOP}>
                    {topProducts.map((p) => (
                      <Channel
                        key={p.key}
                        name={
                          <>
                            {p.name}{' '}
                            <span className={META}>
                              ·{' '}
                              {interpolate(t('reports.sProductRow'), {
                                qty: String(p.qty),
                                revenue: fmtRp(Math.round(p.revenue)),
                              })}
                            </span>
                          </>
                        }
                        value={signedPlain(Math.round(p.profit))}
                        tone={p.profit >= 0 ? 'inc' : 'neg'}
                        fill={(Math.max(0, p.profit) / maxProductProfit) * 100}
                        fillTone="brand"
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>

          {/* Nilai stok: modal di rak sekarang, dan bagian yang tak bergerak di
              periode ini. Restok saja tidak memberi tahu uang yang tertahan. */}
          <Panel>
            <PanelHead
              icon={<Boxes aria-hidden />}
              title={t('reports.stockTitle')}
              action={<span className={LIVE_TAG}>{t('reports.stokSaatIni')}</span>}
            />
            {reportPending ? (
              <div className={BODY}>
                <LoadState queries={reportLoad} />
              </div>
            ) : (
              <>
                <div className={BODY}>
                  <dl className={Q_GRID}>
                    <QTile
                      label={t('reports.stockCost')}
                      value={fmtRp(stock.cost)}
                      sub={interpolate(t('reports.stockCostSub'), { n: String(stock.items) })}
                    />
                    <QTile label={t('reports.stockRetail')} value={fmtRp(stock.retail)} sub={t('reports.stockRetailSub')} />
                    <QTile label={t('reports.stockIdle')} value={String(stock.idleCount)} sub={t('reports.stockIdleSub')} />
                    <QTile
                      label={t('reports.stockIdleValue')}
                      value={fmtRp(stock.idleValue)}
                      sub={
                        stock.cost > 0
                          ? interpolate(t('reports.stockIdleValueSub'), { pct: fmtPercent(stock.idleValue / stock.cost, 0) })
                          : t('reports.stockIdleSub')
                      }
                    />
                  </dl>
                </div>
                {idleTop.length > 0 && (
                  <ul className={DASHED_TOP}>
                    {idleTop.map((i) => (
                      <Channel
                        key={i.id}
                        name={
                          <>
                            {i.name}{' '}
                            <span className={META}>· {interpolate(t('reports.stockIdleRow'), { n: String(i.stock) })}</span>
                          </>
                        }
                        value={fmtRp(i.value)}
                        fill={(i.value / maxIdle) * 100}
                        fillTone="capital"
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>

          <div className={GRID}>
            <Panel>
              <PanelHead icon={<Wrench aria-hidden />} title={t('reports.sparepartTerlaris')} />
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : partUsage.length === 0 ? (
                <EmptyState icon={<Inbox aria-hidden />} title={t('reports.belumAdaPemakaianSparepart')} />
              ) : (
                <ul>
                  {partUsage.slice(0, 8).map((p) => (
                    <Channel
                      key={p.name}
                      name={
                        <>
                          {p.name} · {fmtRp(p.cost)}
                        </>
                      }
                      value={`${p.qty}x`}
                      fill={(p.qty / maxPartQty) * 100}
                      fillTone="brand"
                    />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              {/* Kartu yang TIDAK mengikuti periode di header: stok adalah nilai
                  sekarang, bukan rentang. Dulu tidak disebutkan sama sekali. */}
              <PanelHead
                icon={<Boxes aria-hidden />}
                title={t('reports.saranRestok')}
                action={<span className={LIVE_TAG}>{t('reports.stokSaatIni')}</span>}
              />
              {reportPending ? (
                <LoadState queries={reportLoad} />
              ) : restock.length === 0 ? (
                <EmptyState icon={<CircleCheck aria-hidden />} title={t('reports.stokSemuaAman')} />
              ) : (
                <>
                  <ul>
                    {restock.slice(0, 8).map((i) => {
                      // Bar = KEKURANGAN, bukan sisa stok. Rumus lama (stock /
                      // minStock*2) membuat batang makin panjang saat makin aman,
                      // sehingga pemilik yang memindai batang terpanjang justru
                      // membeli barang yang paling tidak mendesak.
                      const deficit =
                        i.minStock > 0 ? Math.min(100, (Math.max(0, i.minStock - i.stock) / i.minStock) * 100) : 100;
                      const critical = i.stock < i.minStock;
                      return (
                        <Channel
                          key={i.id}
                          name={i.name}
                          value={interpolate(t('reports.stockOfMin'), { stock: String(i.stock), min: String(i.minStock) })}
                          tone={critical ? 'crit' : 'neg'}
                          fill={Math.max(6, deficit)}
                          fillTone={critical ? 'crit' : 'neg'}
                        />
                      );
                    })}
                  </ul>
                  {/* Di bawah daftar, bukan di header: di 390px header tak muat dua readout. */}
                  <p className={TABLE_NOTE}>
                    <Link className={CAT_LINK} to="/pos?stock=low">
                      {t('reports.openRestock')}
                    </Link>
                  </p>
                </>
              )}
            </Panel>
          </div>
        </>,
      )}

      {panel(
        'pelanggan',
        <Panel>
          <PanelHead
            icon={<Users aria-hidden />}
            title={t('reports.custTitle')}
            action={<span className={LIVE_TAG}>{t('reports.custSortNote')}</span>}
          />
          {reportPending ? (
            <div className={BODY}>
              <LoadState queries={reportLoad} />
            </div>
          ) : custStats.active === 0 && custStats.walkIn === 0 ? (
            <div className={BODY}>
              <EmptyState icon={<Users aria-hidden />} title={t('reports.custNone')} />
            </div>
          ) : (
            <>
              <div className={BODY}>
                <dl className={Q_GRID}>
                  <QTile
                    label={t('reports.custActive')}
                    value={String(custStats.active)}
                    sub={interpolate(t('reports.custActiveSub'), { fresh: String(custStats.fresh), back: String(custStats.returning) })}
                  />
                  <QTile
                    label={t('reports.custReturning')}
                    value={custStats.active > 0 ? fmtPercent(custStats.returning / custStats.active, 0) : <EmptyValue />}
                    sub={t('reports.custReturningSub')}
                  />
                  <QTile
                    label={t('reports.custAvg')}
                    value={custStats.active > 0 ? fmtRp(Math.round(custStats.spendTotal / custStats.active)) : <EmptyValue />}
                    sub={t('reports.custAvgSub')}
                  />
                  <QTile label={t('reports.custWalkIn')} value={String(custStats.walkIn)} sub={t('reports.custWalkInSub')} />
                </dl>
              </div>
              {custStats.top.length > 0 && (
                <ul className={DASHED_TOP}>
                  {custStats.top.map((c) => (
                    <Channel
                      key={c.id}
                      name={
                        <>
                          {c.name}{' '}
                          <span className={META}>· {interpolate(t('reports.custVisits'), { n: String(c.visits) })}</span>
                        </>
                      }
                      value={fmtRp(c.spend)}
                      fill={(c.spend / maxCustSpend) * 100}
                      fillTone="brand"
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </Panel>,
      )}

      {panel(
        'piutang',
        <Panel>
          <PanelHead
            icon={<Coins aria-hidden />}
            title={t('reports.piutangServisSelesaiBelum')}
            /* Kartu yang TIDAK mengikuti periode di header: piutang adalah keadaan
               sekarang, dan yang paling tua justru selalu di luar periode yang
               sedang dilihat. */
            action={
              <span className={READOUT_WRAP}>
                {receivables.length > 0 ? interpolate(t('reports.totalPrefix'), { amount: fmtRp(receivablesTotal) }) : ''}
                {t('reports.allPeriods')}
                {receivables.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportReceivables}>
                    <Download aria-hidden />
                    {t('reports.ekspor')}
                  </Button>
                )}
              </span>
            }
          />
          {reportPending ? (
            <LoadState queries={reportLoad} />
          ) : receivables.length === 0 ? (
            <EmptyState icon={<CircleCheck aria-hidden />} title={t('reports.tidakAdaPiutang')} />
          ) : (
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <caption className="sr-only">{t('reports.piutangServisYangSudah')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('reports.noServis')}</th>
                    <th scope="col">{t('reports.pelanggan')}</th>
                    <th scope="col" data-num="">{t('reports.sisa')}</th>
                    <th scope="col" data-num="">{t('reports.umur')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r) => (
                    <tr key={r.serviceId}>
                      <td className={MONO}>
                        {/* Daftar ini dibawa saat menagih: nomor membuka tiketnya, tempat tombol
                            WhatsApp dan pelunasan berada (RPC piutang tak membawa nomor HP). */}
                        <Link
                          className={CAT_LINK}
                          to={`/services/${r.serviceId}`}
                          aria-label={interpolate(t('reports.openTicket'), { no: r.serviceNo })}
                        >
                          {r.serviceNo}
                        </Link>
                      </td>
                      <td>{r.customerName}</td>
                      <td className={cn(NUM_PUSH, MONO, TEXT.exp)}>{fmtRp(r.outstanding)}</td>
                      {/* Hanya kolom angka PERTAMA yang didorong ke kanan saat bertumpuk. */}
                      <td className={NUM}>
                        <Badge variant={AGE_BADGE[r.bucket]}>{interpolate(t('reports.qDays'), { n: String(r.ageDays) })}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>,
      )}
    </div>
  );
}

/* ---------- Kelas bersama ----------
   Semua ambang di halaman ini membaca wadah `laporan`, bukan viewport: zoom
   aplikasi (80%-125%) dan sidebar mengubah ruang konten tanpa menggeser media
   query. `@max-[N]` berarti lebar < N, jadi @max-[721px] = "<= 720px". */
const BODY = 'px-5 pb-5 @max-[721px]/laporan:px-4 @max-[721px]/laporan:pb-4';
/** Padding samping baris daftar, sejajar dengan kepala kartu. */
const ROW_X = 'px-5 @max-[721px]/laporan:px-4';
const GRID = 'grid grid-cols-2 gap-4 @max-[1025px]/laporan:grid-cols-1';
/** Dua bagian badan dalam satu kartu (readout lalu daftar). */
const DASHED_TOP = 'border-t border-dashed border-border';
const Q_GRID = 'grid grid-cols-4 gap-x-5 gap-y-4 @max-[767px]/laporan:grid-cols-2';
const MONO = 'font-mono tabular-nums';
const META = 'tabular-nums text-muted-foreground';
const LIVE_TAG = 'text-xs font-medium text-muted-foreground';
const READOUT_BASE = 'inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground';
const READOUT = `${READOUT_BASE} whitespace-nowrap`;
/* Readout kepala yang boleh patah baris (total + "semua periode"): di 360px satu
   baris nowrap meluap keluar kartu. Dipatah, ia menyusut ke kata terpanjang. */
const READOUT_WRAP = `${READOUT_BASE} flex-wrap justify-end text-right`;
const TAG = 'rounded-full bg-secondary px-1.5 py-px text-xs font-medium text-secondary-foreground';
const NOTE_BASE = 'mt-2 flex items-start gap-1.5 text-xs [&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:shrink-0';
const NOTE = `${NOTE_BASE} text-muted-foreground`;
const NOTE_WARN = `${NOTE_BASE} text-warning-foreground`;
const TABLE_NOTE = `py-3 text-xs text-muted-foreground ${ROW_X}`;
const CHIP =
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-card px-3.5 text-[13px] font-medium text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:min-h-11';
const TAB =
  'group/tab flex size-full min-h-11 flex-col items-start justify-center gap-0.5 rounded-xl bg-card px-3 py-2 text-left text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-selected:cursor-default aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:ring-primary';
const DATE_LABEL =
  'flex items-center gap-2 text-xs font-medium text-muted-foreground @max-[721px]/laporan:flex-[1_1_100%] @max-[721px]/laporan:justify-between';
const DATE_INPUT = 'w-auto font-mono tabular-nums @max-[721px]/laporan:flex-1';
const RANGE_BASE =
  'ml-auto font-mono text-xs tabular-nums @max-[721px]/laporan:order-5 @max-[721px]/laporan:ml-0 @max-[721px]/laporan:w-full';

/* Tautan sebaris setinggi 16-17px: area kliknya diperluas lewat ::after supaya
   tata letak tidak ikut membesar (minimal 24px untuk tetikus, lebih lebar untuk
   sentuh). */
const LINK_BASE =
  'rounded-sm underline decoration-muted-foreground/60 decoration-dotted underline-offset-[3px] outline-none hover:text-primary hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring after:absolute';
const CAT_LINK = `${LINK_BASE} relative after:-inset-x-0.5 after:-inset-y-1 pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-4`;
/* Di baris rincian, nama kategori memotong teks (overflow hidden) dan ikut
   memotong ::after di atas. Area kliknya dipindah ke seluruh baris: baris tak
   memuat kontrol lain, dan isinya memang kategori yang sama. z-index di atas
   batang, yang ikut `position: relative`. */
const CAT_LINK_ROW = `${LINK_BASE} after:inset-0 after:z-[1]`;

/* ---------- Tabel (piutang, transaksi, unit menunggu) ----------
   Bertumpuk saat wadahnya lebih sempit dari min-content tabel Rincian Transaksi
   (779px, stabil karena kolom keterangan dibatasi 280px). Container, bukan media
   query: tabel ini meluber di DUA pita viewport yang terpisah (721-834px, lalu
   1025-1151px setelah sidebar muncul dan justru menyusutkan ruang konten), dan
   tak ada satu `max-width` pun yang bisa menyatakan dua pita terputus itu.
   Lima kolom tak akan pernah muat di 320px, dan menggulung ke samping justru
   menyembunyikan kolom Nominal; thead disembunyikan, caption tetap untuk
   pembaca layar. */
const TABLE_SCROLL = '@container/tabel w-full overflow-x-auto';
const TABLE = [
  'w-full border-collapse text-sm',
  '[&_th]:border-b [&_th]:border-border [&_th]:px-5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_th[data-num]]:text-right',
  '[&_td]:border-b [&_td]:border-dashed [&_td]:border-border [&_td]:px-5 [&_td]:py-2.5',
  '[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-accent/50',
  '@max-[779px]/tabel:block @max-[779px]/tabel:[&_tbody]:block @max-[779px]/tabel:[&_thead]:hidden',
  '@max-[779px]/tabel:[&_tr]:flex @max-[779px]/tabel:[&_tr]:flex-wrap @max-[779px]/tabel:[&_tr]:items-baseline @max-[779px]/tabel:[&_tr]:gap-x-2 @max-[779px]/tabel:[&_tr]:gap-y-1 @max-[779px]/tabel:[&_tr]:border-b @max-[779px]/tabel:[&_tr]:border-border @max-[779px]/tabel:[&_tr]:px-5 @max-[779px]/tabel:[&_tr]:py-3 @max-[779px]/tabel:[&_tbody_tr:last-child]:border-b-0',
  '@max-[721px]/laporan:[&_tr]:px-4',
  '@max-[779px]/tabel:[&_td]:block @max-[779px]/tabel:[&_td]:border-0 @max-[779px]/tabel:[&_td]:p-0',
].join(' ');
const NUM = 'text-right whitespace-nowrap';
/* Saat bertumpuk, hanya kolom angka PERTAMA yang didorong ke kanan, supaya dua
   kolom angka berdampingan tidak saling terpisah oleh dua margin auto. */
const NUM_PUSH = `${NUM} @max-[779px]/tabel:ml-auto`;
/* `order-1` memindahkan keterangan ke urutan terakhir: tanpa itu ia berada
   sebelum Nominal, dan saat ia mengambil satu baris penuh Nominal terdorong ke
   baris ketiga. `max-w-none` wajib: batas 280px mengalahkan basis 100%. */
const DESC_CELL =
  'max-w-[280px] truncate @max-[779px]/tabel:order-1 @max-[779px]/tabel:max-w-none @max-[779px]/tabel:basis-full @max-[779px]/tabel:whitespace-normal @max-[779px]/tabel:[overflow-wrap:anywhere]';

/* ---------- Nada ----------
   Pengeluaran rutin (sewa, gaji, belanja stok) adalah arus keluar yang wajar,
   bukan kegagalan: tinta utama, batang netral. Tiga makna dipisah: exp = arus
   keluar (netral), neg = angka bersih negatif (peringatan), crit = stok di bawah
   minimum (bahaya). */
type Tone = 'inc' | 'exp' | 'neg' | 'crit';
type Fill = Tone | 'brand' | 'capital' | 'count';
const TEXT: Record<Tone, string> = {
  inc: 'text-success-foreground',
  exp: 'text-foreground',
  neg: 'text-warning-foreground',
  crit: 'text-destructive',
};
const FILL: Record<Fill, string> = {
  inc: 'bg-success-foreground',
  exp: 'bg-muted-foreground',
  neg: 'bg-warning-foreground',
  crit: 'bg-destructive',
  brand: 'bg-primary/70',
  // Modal/Prive dan stok diam: uang pemilik, bukan hijau/merah operasional.
  capital: 'bg-muted-foreground/40',
  count: 'bg-primary/40',
};
const DOT = { ok: 'bg-success-foreground', warn: 'bg-warning-foreground', crit: 'bg-destructive' } as const;
const VERDICT_BG = { ok: 'bg-success', warn: 'bg-warning', crit: 'bg-destructive-soft' } as const;
/* Di tab terpilih (latar navy) titik gelap tak terlihat: pakai warna terangnya. */
const TAB_DOT = {
  ok: 'bg-success-foreground group-aria-selected/tab:bg-success',
  warn: 'bg-warning-foreground group-aria-selected/tab:bg-highlight',
  crit: 'bg-destructive group-aria-selected/tab:ring-2 group-aria-selected/tab:ring-primary-foreground',
} as const;
const AGE_BADGE: Record<AgingBucket, 'success' | 'warning' | 'destructive-soft'> = {
  '0-7': 'success',
  '8-30': 'warning',
  '31+': 'destructive-soft',
};
const METRIC_TONE = {
  success: 'bg-success text-success-foreground',
  neutral: 'bg-secondary text-muted-foreground',
  warning: 'bg-warning text-warning-foreground',
} as const;

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">
      {children}
    </div>
  );
}

function PanelHead({ icon, title, action }: { icon: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 @max-[721px]/laporan:px-4">
      <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}
        <span className="min-w-0">{title}</span>
      </h2>
      {action && <div className="flex min-w-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Satu baris rincian: nama (+ keterangan) dan nominal, lalu batang proporsi. */
function Channel({
  name,
  value,
  tone,
  fill,
  fillTone,
}: {
  name: ReactNode;
  value: ReactNode;
  tone?: Tone;
  /** Panjang batang, 0-100. */
  fill: number;
  fillTone: Fill;
}) {
  return (
    <li className={`relative flex flex-col gap-1.5 border-b border-dashed border-border py-[11px] last:border-b-0 ${ROW_X}`}>
      <div className="flex items-baseline justify-between gap-3">
        {/* Di wadah sempit nama dibiarkan membungkus: nowrap pada baris sepanjang
            "Cabang Cimahi - masuk Rp 2.500.000" menyembunyikan hampir seluruh
            isinya di balik ellipsis. */}
        <span className="min-w-0 truncate text-sm @max-[721px]/laporan:whitespace-normal @max-[721px]/laporan:[overflow-wrap:anywhere]">
          {name}
        </span>
        <span className={cn('font-mono text-sm font-semibold whitespace-nowrap tabular-nums', tone && TEXT[tone])}>{value}</span>
      </div>
      <div className="relative h-[5px] overflow-hidden rounded-full bg-secondary">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', FILL[fillTone])} style={{ width: `${fill}%` }} />
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
  delta,
  deltaInverse,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  tone: keyof typeof METRIC_TONE;
  /** Tanpa periode pembanding, delta `null` dan kartu diam: kalimat vonis di
   *  atasnya sudah mengatakan "tidak ada data periode lalu" sekali. Dulu tiap
   *  kartu mengulanginya, tiga kali, dan membungkus empat baris di 1097px. */
  delta?: number | null;
  deltaInverse?: boolean;
  /** Keterangan tetap di bawah angka (mis. "sudah termasuk di Pemasukan"). */
  note?: string;
}) {
  const t = useT();
  // Pengeluaran: naik berarti buruk, jadi pemetaan baik/buruk dibalik.
  const showDelta = delta != null && Number.isFinite(delta);
  const isUp = (delta ?? 0) >= 0;
  const good = deltaInverse ? !isUp : isUp;
  return (
    /* Ambang dari lebar terukur (7 Nov 2026): 13 karakter mono ("Rp 99.999.999")
       sebaris dengan ikon butuh kartu 257px, empat kolom = wadah 1063px. Di
       bawahnya ikon naik ke atas angka (wadah 871px); di bawah itu dua kolom, yang
       melebarkan kartu lagi sehingga ikon kembali sebaris sampai 510px. Hanya
       Pemasukan yang hijau, dan Arus kas bersih jingga saat negatif. */
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-card p-4 text-card-foreground shadow-panel ring-1 ring-border/60 @max-[1063px]/laporan:flex-col @max-[1063px]/laporan:items-start @max-[871px]/laporan:flex-row @max-[871px]/laporan:items-center @max-[510px]/laporan:flex-col @max-[510px]/laporan:items-start @max-[721px]/laporan:p-3">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px] @max-[1063px]/laporan:size-8 @max-[871px]/laporan:size-10 @max-[510px]/laporan:size-8',
          METRIC_TONE[tone],
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{label}</span>
        {/* Tanpa ellipsis: angka ditampilkan apa adanya. Di ponsel ukurannya
            mengikuti wadah (cqi, supaya pembesaran aplikasi ikut terhitung): isi
            kartu dua kolom = W/2 - 32px, dan 13 karakter x 0,6em muat bila ukuran
            <= 6,4cqi - 4,2px, dengan lantai 14px di wadah tersempit. */}
        <span className="min-w-0 font-mono text-xl leading-tight font-semibold tabular-nums @max-[721px]/laporan:text-[length:clamp(0.875rem,calc(6.4cqi_-_4.2px),1.25rem)]">
          {value}
        </span>
        {showDelta && (
          <span className={cn('mt-0.5 inline-flex items-center gap-1 font-mono text-xs tabular-nums [&>svg]:size-3.5', good ? TEXT.inc : TEXT.neg)}>
            {isUp ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}
            {interpolate(t('reports.deltaVsPrev'), { pct: fmtPercent(Math.abs(delta as number)) })}
          </span>
        )}
        {note && <span className="mt-0.5 text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

/** Satu baris struk Laba Rugi: nama (+ keterangan kecil) di kiri, nominal mono di kanan. */
function PlLine({
  label,
  sub,
  amount,
  kind = 'line',
  tone,
  muted,
}: {
  label: ReactNode;
  sub?: string;
  amount: string;
  kind?: 'line' | 'total' | 'final';
  tone?: 'ok' | 'warn' | 'crit';
  muted?: boolean;
}) {
  const strong = kind !== 'line';
  return (
    <li
      className={cn(
        'flex items-baseline justify-between gap-3 py-2 text-sm',
        // Total memakai garis rangkap, seperti struk.
        strong
          ? 'mt-1 border-t-[3px] border-double border-border pt-3'
          : 'border-t border-dashed border-border first:border-t-0 first:pt-0',
      )}
    >
      <span
        className={cn(
          'flex min-w-0 items-baseline gap-2 [overflow-wrap:anywhere]',
          strong ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {tone && <span aria-hidden className={cn('size-2 shrink-0 self-center rounded-full', DOT[tone])} />}
        <span>
          {label}
          {sub && <small className="mt-px block text-xs font-normal tabular-nums text-muted-foreground">{sub}</small>}
        </span>
      </span>
      <span
        className={cn(
          'font-mono whitespace-nowrap tabular-nums',
          muted ? 'text-muted-foreground' : 'text-foreground',
          kind === 'total' && 'font-semibold',
          kind === 'final' && 'text-base font-semibold',
          kind === 'final' && tone && PL_TONE_TEXT[tone],
        )}
      >
        {amount}
      </span>
    </li>
  );
}
const PL_TONE_TEXT = { ok: TEXT.inc, warn: TEXT.neg, crit: TEXT.crit } as const;

/** Satu readout: label, nilai besar, keterangan dasar angkanya. */
function QTile({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-t border-dashed border-border pt-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs tabular-nums text-muted-foreground [overflow-wrap:anywhere]">{sub}</dd>
    </div>
  );
}

/** Batang capaian; `pace` (0-1) menandai laju merata bila periodenya belum habis. */
function Meter({ ratio, ok, pace }: { ratio: number; ok: boolean; pace?: number }) {
  return (
    <div className="relative h-2 rounded-full bg-secondary">
      <div
        className={cn('absolute inset-y-0 left-0 rounded-full', ok ? 'bg-success-foreground' : 'bg-warning-foreground')}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
      {pace !== undefined && pace < 1 && (
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${pace * 100}%` }}
        />
      )}
    </div>
  );
}

/**
 * Satu baris target: nilai / target, persen, dan batang dengan penanda laju
 * merata. Hijau bila di depan laju (atau tercapai), jingga bila di belakang —
 * target yang tertinggal bukan kegagalan, jadi tidak merah.
 */
function TargetRow({ label, value, ratio, pace }: { label: string; value: string; ratio: number; pace: number }) {
  const ahead = ratio >= Math.min(1, pace);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ahead ? DOT.ok : DOT.warn)} />
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {value} · {fmtPercent(ratio, 0)}
        </span>
      </div>
      <Meter ratio={ratio} ok={ahead} pace={pace} />
    </div>
  );
}
