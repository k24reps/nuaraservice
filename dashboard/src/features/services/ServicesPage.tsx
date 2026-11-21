import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CircleCheck,
  Cpu,
  ExternalLink,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { FilterChips } from '@/components/dens/filter-chips';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { SummaryStrip } from '@/components/dens/summary-strip';
import { TextInput } from '@/components/dens/text-input';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { ThumbDock } from '@/components/layout/ThumbDock';
import { repository } from '@/data';
import { useCollection, useDerivedQuery } from '@/hooks/useCollection';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useServiceSummary } from '@/hooks/useServiceSummary';
import { SERVICE_LIST_CAP, useServiceArchive } from '@/hooks/useServiceArchive';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { EMPTY_VALUE, fmtNumber, fmtRp } from '@/lib/format';
import { addDays, fmtDate, localDateOf, localDateStr, localDayStartISO, monthRange } from '@/lib/time';
import { cn } from '@/lib/utils';
import { serviceSummary } from '@/lib/business/dashboard';
import {
  STATUS_BADGE,
  STATUS_LABELS,
  visibleServices,
  isAwaitingPickup,
  serviceProfit,
  serviceModalTotal,
  heldCost,
  cancelledProfit,
  isClosedOut,
  outstandingBalance,
  canQuickAddParts,
  finalCostLocked,
  type ModalDadakanInput,
} from '@/lib/business/services';
import { walletsForOutlet } from '@/lib/business/finance';
import { addServiceModalLine, addServicePart } from '@/data/serviceParts';
import { resolveServiceColumns } from '@/lib/business/serviceColumns';
import { LIST_PAGE_SIZE, resolveListView, scrollRestoreStep } from '@/lib/business/serviceListView';
import { readListSnapshot, readScroll, saveListScroll, saveListView, writeScroll } from './listMemory';
import {
  SERVICE_SCOPES,
  SERVICE_SORTS,
  SORT_LABEL_KEY,
  compareServices,
  costReadout,
  createdRange,
  matchesPayment,
  matchesQuery,
  matchesScope,
  matchesTechnician,
  nextSort,
  scopeCounts,
  sortDirectionOn,
  stalledDays,
  type DateFilter,
  type PaymentFilter,
  type ServiceScope,
  type ServiceSort,
  type ServiceSortColumn,
} from '@/lib/business/serviceFilters';
import { getCategories, getLastExpenseWallet, setLastExpenseWallet } from '@/config/orgConfig';
import { ServiceModal } from './ServiceModal';
import { StatusModal } from './StatusModal';
import { NotifyModal } from './NotifyModal';
import { TicketDoneModal } from './TicketDoneModal';
import { SparepartPickerModal } from './SparepartPickerModal';
import type { Service, ServiceSparepart, ServiceStatus } from '@/data/types';
import { useT, type TranslationKey } from '@/i18n';
import { interpolate } from '@/lib/business/notify';
import { PICKUP_NOTE, UNPICK_NOTE } from '@/lib/business/services';

/**
 * Kartu di <=1024px, daftar baris di layar yang lebih lebar (DBD bagian 4,
 * keputusan P17.3). Ambangnya sama dengan laci sidebar (`drawer` di app.css):
 * di bawahnya sidebar menjadi laci dan tablet melihat kartu satu atau dua kolom.
 * Media query, bukan @container: ini selera per perangkat, sedangkan daftar
 * baris sendiri sudah muat di lebar wadah berapa pun lewat container query.
 */
const CARDS_QUERY = '(max-width: 1024px)';

/**
 * Daftar baris menjadi tabel (judul kolom tampil, segmen berbaris dalam lajur)
 * bila lantai semua lajur muat sebaris. Ambang = jumlah lantai (`tracks` di
 * bawah) + jarak antarsegmen 12px + lajur kanan 11 + 9 + 7.5rem + tiga jarak
 * 16px + padding baris 16 + 4px, diukur dari wadah daftar (zoom aplikasi ikut
 * dihitung):
 *   5 segmen  104+132+120+156+88 + 4x12 = 648 + 508 -> 1156px
 *   <=4 segmen 104+132+120+156   + 3x12 = 548 + 508 -> 1056px
 * Persis, tak dibulatkan: kerapatan Padat di 1366px memberi wadah 1056px.
 * Toko satu teknisi (kolom Teknisi otomatis hilang) jadi tabel sejak 1056px.
 * Kelasnya ditulis utuh karena Tailwind hanya membuat kelas yang tertulis.
 */
const TABLE_AT = {
  5: {
    head: '@min-[1156px]/svc:grid',
    main: '@min-[1156px]/svc:grid @min-[1156px]/svc:gap-x-3 @min-[1156px]/svc:gap-y-0',
    srOnly: '@min-[1156px]/svc:sr-only',
    hide: '@min-[1156px]/svc:hidden',
  },
  4: {
    head: '@min-[1056px]/svc:grid',
    main: '@min-[1056px]/svc:grid @min-[1056px]/svc:gap-x-3 @min-[1056px]/svc:gap-y-0',
    srOnly: '@min-[1056px]/svc:sr-only',
    hide: '@min-[1056px]/svc:hidden',
  },
} as const;

/*
 * Lajur baris: utama (segmen), status 11rem, biaya 9rem, aksi 7.5rem (tiga
 * tombol 40px; membuka tiket = klik barisnya). Di layar sentuh aksi 8.25rem
 * (tiga tombol 44px), hanya selama lajurnya tetap. Di wadah <861px biaya dan
 * aksi turun ke baris kedua, seperti Inventori.
 */
const ROW_COST =
  'grid-cols-[minmax(0,1fr)_11rem_9rem_7.5rem] [grid-template-areas:"main_status_cost_actions"] pointer-coarse:@min-[861px]/svc:grid-cols-[minmax(0,1fr)_11rem_9rem_8.25rem]';
const ROW_NO_COST =
  'grid-cols-[minmax(0,1fr)_11rem_7.5rem] [grid-template-areas:"main_status_actions"] pointer-coarse:@min-[861px]/svc:grid-cols-[minmax(0,1fr)_11rem_8.25rem]';
const ROW_BASE =
  'relative grid min-h-14 items-center gap-x-4 py-2 pl-4 pr-1 @max-[861px]/svc:grid-cols-[minmax(0,1fr)_auto] @max-[861px]/svc:gap-y-0.5 @max-[861px]/svc:[grid-template-areas:"main_status"_"cost_actions"]';

/**
 * Jendela daftar "panas" di cloud: SEMUA tiket yang belum tuntas (berapa pun
 * umurnya, supaya selalu terpantau) plus yang tuntas dalam N hari terakhir.
 * Tiket tuntas adalah riwayat beku yang dulu ditarik ulang utuh di setiap
 * perangkat tiap ada perubahan servis, sehingga ongkosnya tumbuh seiring umur
 * toko. Dengan jendela, ongkosnya mengikuti laju tiket masuk toko itu sendiri,
 * bukan umurnya. Tiket lama tetap ditemukan lewat pencarian, filter tanggal,
 * dan riwayat pelanggan (useServiceArchive).
 */
const SERVICE_WINDOW_DAYS = 31;
const NO_WINDOW: { rows: Service[]; truncated: boolean } = { rows: [], truncated: false };

const SCOPE_TEXT: Record<ServiceScope, { label: TranslationKey; hint: TranslationKey }> = {
  all: { label: 'services.scopeAll', hint: 'services.scopeAllHint' },
  open: { label: 'services.scopeOpen', hint: 'services.scopeOpenHint' },
  stalled: { label: 'services.stalled', hint: 'services.stalledHint' },
};

export function ServicesPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  // Cloud: daftar berjendela. Batasnya awal hari lokal, jadi kuncinya hanya
  // berganti sekali sehari. Lokal/demo: daftar lengkap — tidak ada ongkos
  // egress di sana. Kunci di bawah ['collection','services',…] supaya realtime
  // tetap meng-invalidasi.
  // Dua kueri, bukan satu `or`: tiap kueri mentok max_rows PostgREST (1.000).
  // Dengan satu kueri berurut created_at, toko yang ramai akan kehilangan
  // tiket BELUM tuntas yang paling tua lebih dulu — justru yang harus terpantau.
  const windowed = !!repository.queryServices;
  const activeOutlet = useSessionStore((s) => s.activeOutletId);
  const windowStart = localDayStartISO(addDays(localDateStr(), -SERVICE_WINDOW_DAYS));
  const { data: windowData, loading } = useDerivedQuery(
    ['collection', 'services', 'window', activeOutlet, windowStart],
    async () => {
      if (!repository.queryServices) return { rows: await repository.list('services'), truncated: false };
      const [open, closed] = await Promise.all([
        repository.queryServices({ openOnly: true, limit: SERVICE_LIST_CAP }),
        repository.queryServices({ closedSince: windowStart, limit: SERVICE_LIST_CAP }),
      ]);
      return {
        rows: [...open, ...closed],
        truncated: open.length >= SERVICE_LIST_CAP || closed.length >= SERVICE_LIST_CAP,
      };
    },
    NO_WINDOW,
  );
  const services = windowData.rows;
  const truncated = windowData.truncated;
  const { data: employees } = useCollection('employees');
  const sessionEmployees = useSessionStore((s) => s.employees);
  const techs = employees.length ? employees : sessionEmployees;
  const me = useSessionStore((s) => s.currentEmployee);
  const role = me?.role;
  const isOwner = role === 'owner';
  const isManager = role === 'owner' || role === 'admin';
  // Hanya untuk Modal Dadakan di aksi cepat sparepart, yang khusus owner/admin.
  const { data: allWallets } = useCollection('wallets', { enabled: isManager });

  // Tampilan awal = tautan yang membuka halaman ini (?status/?pickup/?tech/
  // ?date/?open dari Dashboard) ATAU ingatan sesi bila pengguna baru saja
  // membuka tiket dan kembali. Aturannya ada di resolveListView.
  // `?pickup=awaiting` tetap dihormati: alert "unit menunggu diambil" di
  // Dashboard menaut ke sana (lihat dashboard.ts); `?tech=me` = "Tiket saya".
  const { key: entryKey } = useLocation();
  const listOwner = `${activeOutlet ?? ''}:${me?.id ?? ''}`;
  const [initial] = useState(() =>
    resolveListView({
      snapshot: readListSnapshot(),
      owner: listOwner,
      entryKey,
      params: searchParams,
      now: Date.now(),
    }),
  );
  const start = initial.view;
  const [query, setQuery] = useState(start.query);
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | 'all'>(start.status);
  const [categoryFilter, setCategoryFilter] = useState(start.category);
  const [pickupFilter, setPickupFilter] = useState<'all' | 'awaiting'>(start.pickup);
  const [moreOpen, setMoreOpen] = useState(false);
  // Tampilan ditentukan perangkat, bukan dipilih (keputusan pemilik FixMaster,
  // 7 Nov 2026): kartu di ponsel dan tablet, daftar di layar yang lebih lebar
  // (CARDS_QUERY, P17.3).
  const view = useMediaQuery(CARDS_QUERY) ? 'cards' : 'list';
  const [techFilter, setTechFilter] = useState(start.tech);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(start.payment);
  // `?date=month` = "Unit masuk bulan ini" dari Dashboard.
  const [dateFilter, setDateFilter] = useState<DateFilter>(start.date);
  const [customFrom, setCustomFrom] = useState(start.from);
  const [customTo, setCustomTo] = useState(start.to);
  const [sort, setSort] = useState<ServiceSort>(start.sort);
  // Semua / Belum tuntas / Tertahan. Arsip (lunas/batal DAN sudah diambil) ikut
  // tampil di Semua menurut urutan tanggal; Belum tuntas membuangnya saat daftar
  // dipakai sebagai antrean kerja. `?open=1` = "Tiket saya" dari Dashboard.
  const [scope, setScope] = useState<ServiceScope>(start.scope);
  // `?new=1` membuka Servis Baru langsung (tombol cepat Dashboard).
  const [editOpen, setEditOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Service | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Service | null>(null);
  // Panel setelah tiket dibuat / unit diserahkan. Baris daftar dicari lagi saat
  // render supaya nota memakai data terbaru (lunas, garansi).
  const [done, setDone] = useState<{ service: Service; variant: 'intake' | 'handover' } | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<Service | null>(null);
  // Dipulihkan bersama gulir: tanpa itu daftar kembali 50 baris dan posisi
  // gulir yang dalam tersangkut di ujung bawahnya.
  const [limit, setLimit] = useState(start.limit);
  const [pickupConfirm, setPickupConfirm] = useState<Service | null>(null);
  // Tiket yang sedang ditambah sparepart dari daftar. Disimpan id-nya, lalu
  // barisnya dicari saat render, supaya part yang baru masuk langsung terbaca
  // "Tambah lagi" di pemilih.
  const [partsFor, setPartsFor] = useState<string | null>(null);

  // Subscribe to the org slice so the category filter reflects cloud-synced
  // edits (and updates from other devices) without a manual reload.
  const orgCategories = useSessionStore((s) => s.org?.settings?.deviceCategories);
  const categories = orgCategories ?? getCategories();
  // Kolom yang dipilih toko di Pengaturan > Operasional (tersinkron antar perangkat).
  const savedColumns = useSessionStore((s) => s.org?.settings?.serviceColumns);
  const cols = useMemo(() => new Set(resolveServiceColumns(savedColumns)), [savedColumns]);

  const today = localDateStr();
  // Tiket di luar daftar yang dimuat ditanyakan ke server saat dicari (≥3 huruf)
  // atau saat rentang tanggal menjangkau sebelum batasnya, lalu digabung.
  // SETIAP tiket yang DIBUAT dalam jendela pasti termuat, karena updated_at tak
  // mungkin lebih tua dari created_at — jadi batasnya adalah awal jendela. Kalau
  // salah satu kueri terpotong, jaminan itu gugur: setiap rentang tanggal
  // ditanyakan ke server.
  const dateRange = createdRange(dateFilter, today, { from: customFrom, to: customTo });
  const oldestLoaded = truncated ? Infinity : Date.parse(windowStart);
  const { rows: archive, pending: archivePending } = useServiceArchive({
    enabled: windowed,
    term: query,
    range: dateRange && Date.parse(localDayStartISO(dateRange.from)) < oldestLoaded ? dateRange : null,
  });
  const allServices = useMemo(() => {
    if (archive.length === 0) return services;
    const loaded = new Set(services.map((s) => s.id));
    return [...services, ...archive.filter((s) => !loaded.has(s.id))];
  }, [services, archive]);
  const visible = useMemo(() => visibleServices(allServices), [allServices]);

  // Hitungan dari SEMUA tiket — daftar cloud maks 1000 tiket terbaru, jadi
  // dihitung server (service_summary, 0063). Selama dimuat, pakai daftar yang ada.
  const { from: monthFrom, to: monthTo } = monthRange();
  const summaryQuery = useServiceSummary(monthFrom, monthTo);
  const stats = useMemo(
    () => summaryQuery.data ?? serviceSummary(services, monthFrom, monthTo),
    [summaryQuery.data, services, monthFrom, monthTo],
  );

  const {
    open: openCount,
    stalled: stalledCount,
    closed: closedCount,
  } = useMemo(() => scopeCounts(visible, today), [visible, today]);

  // Semua filter KECUALI status — dasar hitungan chip status, supaya angka di
  // chip selalu berarti "yang akan tampil kalau chip ini dipilih".
  const filteredExceptStatus = useMemo(() => {
    const range = createdRange(dateFilter, today, { from: customFrom, to: customTo });
    return visible
      .filter((s) => matchesScope(s, scope, today))
      .filter((s) => categoryFilter === 'all' || s.category === categoryFilter)
      .filter((s) => pickupFilter === 'all' || isAwaitingPickup(s))
      .filter((s) => matchesTechnician(s, techFilter, techs, me))
      .filter((s) => matchesPayment(s, paymentFilter))
      .filter((s) => {
        if (!range) return true;
        const created = localDateOf(s.createdAt);
        return created >= range.from && created <= range.to;
      })
      .filter((s) => matchesQuery(s, query));
  }, [
    visible,
    scope,
    pickupFilter,
    categoryFilter,
    techFilter,
    techs,
    me,
    paymentFilter,
    dateFilter,
    customFrom,
    customTo,
    today,
    query,
  ]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of filteredExceptStatus) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
    return (Object.keys(STATUS_LABELS) as ServiceStatus[])
      .filter((st) => counts.has(st))
      .map((st): [string, number] => [st, counts.get(st) ?? 0]);
  }, [filteredExceptStatus]);
  const activeStatus = statusCounts.some(([st]) => st === statusFilter) ? statusFilter : 'all';

  const rows = useMemo(
    () =>
      filteredExceptStatus
        .filter((s) => activeStatus === 'all' || s.status === activeStatus)
        .sort((a, b) => compareServices(a, b, sort)),
    [filteredExceptStatus, activeStatus, sort],
  );

  const filtersActive =
    query !== '' ||
    activeStatus !== 'all' ||
    categoryFilter !== 'all' ||
    pickupFilter !== 'all' ||
    techFilter !== 'all' ||
    paymentFilter !== 'all' ||
    dateFilter !== 'all' ||
    scope === 'stalled';

  // Filter yang jarang dipakai tinggal di panel "Filter lainnya"; jumlah yang
  // aktif tampil di tombolnya supaya daftar yang tersaring tak pernah tanpa sebab.
  const moreActive = [categoryFilter !== 'all', paymentFilter !== 'all', dateFilter !== 'all'].filter(
    Boolean,
  ).length;
  // Toko satu orang (mis. paket Solo) tidak butuh filter teknisi.
  const activeTechs = techs.filter((e) => e.active !== false);
  const showTechFilter = activeTechs.length > 1;
  // Kolom Teknisi hanya berguna bila isinya membedakan tiket. Toko satu teknisi
  // (atau yang tak pernah mengisinya) mengulang nama yang sama di tiap baris dan
  // memakan lajur yang dibutuhkan keluhan; di demo "Rizal Pratama" ada di 7 dari
  // 7 tiket. Yang dihitung nama pada tiketnya, bukan jumlah karyawan aktif: semua
  // karyawan bisa dipilih jadi teknisi, jadi toko berkaryawan banyak tetap bisa
  // hanya punya satu nama di daftar. Tiket tanpa teknisi dihitung sebagai satu
  // nilai sendiri, supaya campuran "ada / belum ditugaskan" tetap terlihat.
  const distinctTechs = useMemo(
    () => new Set(services.map((s) => s.technicianName || '')).size,
    [services],
  );
  const showTech = cols.has('technician') && distinctTechs > 1;
  // Di ponsel teknisi, urutan, dan sakelar lingkup dilipat ke tombol filter di
  // samping kolom cari (foldOnPhone); yang aktif ikut dihitung di tombol itu.
  const foldedOnMobile = [
    showTechFilter && techFilter !== 'all',
    sort !== 'newest',
    scope !== 'all',
  ].filter(Boolean).length;

  // Setiap perubahan filter kembali ke potongan pertama daftar.
  const change = (apply: () => void) => {
    apply();
    setLimit(LIST_PAGE_SIZE);
  };
  const resetFilters = () =>
    change(() => {
      setQuery('');
      setStatusFilter('all');
      setCategoryFilter('all');
      setPickupFilter('all');
      setTechFilter('all');
      setPaymentFilter('all');
      setDateFilter('all');
      setCustomFrom('');
      setCustomTo('');
      // Belum tuntas adalah cara pandang, bukan saringan, jadi tak direset.
      // Tertahan = Belum tuntas + saringan, maka resetnya kembali ke Belum tuntas.
      setScope((v) => (v === 'stalled' ? 'open' : v));
    });

  // Hanya potongan ini yang dirender. `stats` di atas SENGAJA tetap dihitung
  // dari seluruh tiket, bukan dari sini — kalau tidak, angka
  // "Total Servis"/"Nilai Tiket Lunas" akan berubah mengikuti seberapa banyak
  // baris yang kebetulan sudah dimuat, dan itu laporan yang menyesatkan.
  // Daftar berjendela dirender UTUH (±105 tiket). Potongan 50 baris dibuat untuk
  // ribuan tiket sejak toko berdiri; kini itu hanya terjadi saat hasil arsip ikut
  // digabung (pencarian/rentang lama, maks 1000), jadi potongannya hanya berlaku
  // saat itu.
  const shownRows = useMemo(
    () => (archive.length > 0 ? rows.slice(0, limit) : rows),
    [rows, limit, archive.length],
  );

  // Keluhan & Penanganan berbagi satu segmen: dua baris bertumpuk, bukan dua
  // potongan yang terpisah jauh saat segmen membungkus di layar laptop.
  const showComplaint = cols.has('complaint');
  const showFix = cols.has('completionNote');
  const showNotes = showComplaint || showFix;

  // Tiket yang belum selesai belum punya penanganan: baris "Penanganan –" hanya
  // jadi derau di empat dari tujuh tiket. Selesai/Lunas tanpa catatan tetap
  // menampilkan tanda kosong, karena itu catatan yang lupa diisi.
  const showFixLine = (s: Service) =>
    showFix && (!!s.completionNote || s.status === 'selesai' || s.status === 'lunas');

  // Lajur segmen Daftar dari kolom yang diaktifkan toko, supaya segmen antar
  // baris sejajar. Urutan = urutan segmen di JSX (nomor dulu). Tiap lajur punya
  // lantai (minmax) selebar isi terpendek yang masih terbaca; jumlah lantainya
  // menurunkan ambang judul kolom (TABLE_AT di atas).
  const tracks = [
    '6.5rem',
    // Segmen keluhan-penanganan paling lebar (tiga baris ringkasan kerja); nama
    // pelanggan & teknisi pendek dan boleh dua baris, jadi lajurnya lebih sempit.
    // Lantai pelanggan = nomor HP mono 18 karakter ("+62 812-3456-78901" = 129,6px
    // terukur): nomor yang kehilangan digit sama dengan nomor salah, jadi tak boleh
    // dipotong. Selisihnya diambil dari lantai catatan, sehingga jumlah lantai (dan
    // ambang judul kolom di CSS) tak bergeser.
    cols.has('customer') && 'minmax(8.25rem, 0.9fr)',
    cols.has('device') && 'minmax(7.5rem, 1fr)',
    showNotes && `minmax(9.75rem, ${showComplaint && showFix ? 2.5 : showFix ? 1.6 : 0.9}fr)`,
    showTech && 'minmax(5.5rem, 0.7fr)',
  ]
    .filter(Boolean);
  const rowTracks = tracks.join(' ');
  // Jumlah segmen = jumlah lajur; ambang tabel (TABLE_AT) dipilih dari sini.
  const segCount = tracks.length;

  // Seluruh baris Daftar membuka tiket. Jalur papan ketik & pembaca layar tetap
  // tautan nomor tiket (satu perhentian tab per baris), jadi ini hanya jalan
  // pintas untuk penunjuk. Klik pada kontrol di dalam baris, seleksi teks, dan
  // klik bermodifikasi (tab baru lewat tautan nomor) dibiarkan apa adanya.
  const navigate = useNavigate();
  const openTicket = (e: MouseEvent<HTMLElement>, id: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection()?.toString()) return;
    navigate(`/services/${id}`);
  };

  // Ingatan daftar: saringan dicatat tiap berubah, gulir tiap bergeser, supaya
  // membuka tiket lalu kembali (tautan "Kembali ke daftar", sidebar, atau tombol
  // Kembali peramban) mendarat di tempat yang sama, bukan kotak cari kosong di
  // puncak daftar. Bentuk & masa berlakunya: lib/business/serviceListView.ts.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    saveListView(listOwner, entryKey, {
      limit,
      query,
      status: statusFilter,
      category: categoryFilter,
      pickup: pickupFilter,
      tech: techFilter,
      payment: paymentFilter,
      date: dateFilter,
      from: customFrom,
      to: customTo,
      sort,
      scope,
    });
  }, [
    listOwner,
    entryKey,
    limit,
    query,
    statusFilter,
    categoryFilter,
    pickupFilter,
    techFilter,
    paymentFilter,
    dateFilter,
    customFrom,
    customTo,
    sort,
    scope,
  ]);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Halaman ini sudah tergantikan (peralihan rute) → peramban memotong
        // gulir ke 0 dan itu bukan posisi daftar; jangan dicatat.
        if (wrapRef.current?.isConnected) saveListScroll(readScroll());
      });
    };
    // Capture: peristiwa scroll tak menggelembung, dan wadah gulir bisa dokumen
    // atau elemen (demo).
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      cancelAnimationFrame(raf);
    };
  }, []);
  // Pulihkan gulir sekali, setelah baris yang dulu mengisi halaman benar-benar
  // ada: jendela termuat DAN arsip yang diminta pencarian/rentang sudah tiba
  // (scrollRestoreStep). Flag dinyalakan di dalam rAF: kalau efek ini dijalankan
  // ulang sebelum bingkai tiba, pembatalan tak boleh menelan pemulihan.
  const scrollRestored = useRef(initial.scrollTop <= 0);
  const rowCount = rows.length;
  useEffect(() => {
    if (scrollRestored.current) return;
    const step = scrollRestoreStep({ loading, archivePending, rowCount });
    if (step === 'wait') return;
    if (step === 'skip') {
      scrollRestored.current = true;
      return;
    }
    const raf = requestAnimationFrame(() => {
      scrollRestored.current = true;
      writeScroll(initial.scrollTop);
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, archivePending, rowCount, initial.scrollTop]);

  const openNew = () => {
    setEditing(null);
    setEditOpen(true);
  };
  // "N" = Servis Baru, seperti "/" untuk cari di Kasir. Diabaikan saat mengetik
  // atau saat jendela lain terbuka.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setEditing(null);
      setEditOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Toggle physical collection (manager-only). Mirrors ServiceDetailPage so the
  // list and detail stay consistent; pickup is independent of payment status.
  const togglePickup = async (s: Service, confirmed = false) => {
    // Unit keluar sebelum lunas boleh, tapi harus disengaja.
    if (!s.pickedUp && !confirmed && s.status === 'selesai' && outstandingBalance(s) > 0) {
      setPickupConfirm(s);
      return;
    }
    const now = new Date().toISOString();
    const nowPicked = !s.pickedUp;
    try {
      await repository.patch('services', s.id, {
        pickedUp: nowPicked,
        pickedUpAt: nowPicked ? now : null,
        updatedAt: now,
        history: [
          ...(s.history ?? []),
          {
            at: now,
            status: 'edit',
            by: me?.id ?? '',
            byName: me?.name ?? '',
            note: nowPicked ? PICKUP_NOTE : UNPICK_NOTE,
            internal: false,
          },
        ],
      });
      toast.success(t(nowPicked ? 'services.pickedToast' : 'services.unpickedToast'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('services.pickupFailed'));
    }
  };

  const partsService = partsFor ? (allServices.find((s) => s.id === partsFor) ?? null) : null;
  // Jalur yang sama dengan tombol Sparepart di detail tiket (addServicePart).
  // Biaya final yang sudah ditetapkan tidak ikut naik; detail mengingatkannya di
  // panel biaya, di daftar toast inilah satu-satunya pengingat.
  const addPart = async (line: ServiceSparepart) => {
    if (!partsService) return;
    try {
      await addServicePart(partsService, line);
      if (finalCostLocked(partsService)) {
        toast.warning(
          interpolate(t('services.partAddedCostStale'), { amount: fmtRp(partsService.finalCost) }),
        );
      } else {
        toast.success(t('serviceDetail.partAdded'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.partAddFailed'));
    }
  };

  // Part yang dibeli di luar stok. Pengeluaran kas, jadi hanya owner/admin
  // (RLS & RPC 0087), sama dengan tombol Modal Dadakan di detail tiket.
  const partsWallets =
    partsService && isManager ? walletsForOutlet(allWallets, partsService.outletId) : [];
  const lastWallet = getLastExpenseWallet();
  const addModal = async (input: ModalDadakanInput): Promise<boolean> => {
    if (!partsService) return false;
    try {
      await addServiceModalLine(partsService, input);
      setLastExpenseWallet(input.walletId);
      if (finalCostLocked(partsService)) {
        toast.warning(
          interpolate(t('services.modalAddedCostStale'), { amount: fmtRp(partsService.finalCost) }),
        );
      } else {
        toast.success(t('serviceDetail.modalAdded'));
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.modalAddFailed'));
      return false;
    }
  };


  // Tombol ikon yang sama berulang di setiap baris ("Ubah", "Notifikasi & nota"):
  // tiap tombol menunjuk nomor tiketnya lewat aria-describedby supaya pembaca
  // layar tahu ia milik tiket yang mana. Daftar dan Kartu tak pernah tampil
  // bersamaan, jadi id ini unik di halaman.
  const noId = (s: Service) => `svc-no-${s.id}`;

  // Label sel yang tampil sebagai judul kolom (atau tak tampil sama sekali di
  // tata letak mengalir) tetap sampai ke pembaca layar sebagai teks tersembunyi.
  const srLabel = (key: Parameters<typeof t>[0]) => <span className="sr-only">{t(key)}: </span>;

  // Isi sel yang memang kosong: mata melihat tanda pisah, pembaca layar mendengar "kosong".
  const emptyValue = (
    <>
      <span aria-hidden="true">{EMPTY_VALUE}</span>
      <span className="sr-only">{t('common.emptyValue')}</span>
    </>
  );

  const wide = TABLE_AT[segCount === 5 ? 5 : 4];

  // Pickup indicator: prominent "Belum diambil" for closed-but-uncollected
  // units, dim "Diambil" for collected ones, nothing for in-progress tickets.
  // Manajer mengklik labelnya untuk menandai/membatalkan pengambilan (dulu tombol
  // ikon terpisah di kolom aksi).
  const renderPickup = (s: Service) => {
    if (!s.pickedUp && !isAwaitingPickup(s)) return null;
    const cls = cn(
      'mt-1 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold leading-snug [&_svg]:size-3.5 [&_svg]:shrink-0',
      s.pickedUp ? 'text-muted-foreground' : 'text-foreground',
    );
    // Titik amber: unit siap diambil menuntut perhatian; yang sudah diambil redup.
    const content = s.pickedUp ? (
      <>
        <CircleCheck aria-hidden /> {t('services.pickedUp')}
      </>
    ) : (
      <>
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-highlight" />
        <Package aria-hidden /> {t('services.notPickedUp')}
      </>
    );
    if (!isManager) return <span className={cls}>{content}</span>;
    const action = t(s.pickedUp ? 'services.unpickHint' : 'services.pickHint');
    return (
      <button
        type="button"
        className={cn(
          cls,
          '-mx-1.5 rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-accent hover:underline hover:decoration-dotted hover:underline-offset-[3px] focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11',
        )}
        onClick={() => void togglePickup(s)}
        title={action}
        // Nama memuat teks yang terlihat, lalu tiketnya dan apa yang terjadi bila
        // diklik: dulu hanya title yang memuatnya, dan title tak terbaca keyboard.
        aria-label={`${t(s.pickedUp ? 'services.pickedUp' : 'services.notPickedUp')} ${s.serviceNo}. ${action}`}
      >
        {content}
      </button>
    );
  };

  // Tiket tuntas tidak pernah ditandai tertahan: tak ada lagi yang ditunggu.
  const renderStall = (s: Service) => {
    const days = isClosedOut(s) ? null : stalledDays(s, today);
    if (days === null) return null;
    return (
      <span
        className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold leading-snug text-warning-foreground"
        title={t('services.stallHint')}
      >
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning-foreground" />
        {interpolate(t('services.stalledDays'), { n: String(days) })}
      </span>
    );
  };

  // Lencana status yang bisa diklik untuk mengubah status; sama di kedua tampilan.
  // Margin negatif = padding, jadi lencananya sejajar tepi lajur; pensil hanya
  // tampil saat hover atau fokus keyboard.
  const renderStatus = (s: Service) => (
    <button
      type="button"
      className="group/status -mx-1.5 -my-0.5 inline-flex max-w-[calc(100%+0.75rem)] items-center gap-1 rounded-full px-1.5 py-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
      onClick={() => {
        setStatusTarget(s);
        setStatusOpen(true);
      }}
      title={t('services.statusHint')}
      aria-label={interpolate(t('services.statusChangeAria'), {
        no: s.serviceNo,
        status: t(`statusLabel.${s.status}`),
      })}
    >
      <Badge variant={STATUS_BADGE[s.status]}>{t(`statusLabel.${s.status}`)}</Badge>
      <Pencil
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/status:opacity-100 group-focus-visible/status:opacity-100"
      />
    </button>
  );

  // Judul kolom yang bisa diurutkan (hanya tampil di tata letak lebar). Klik: naik,
  // turun, lalu kembali ke Terbaru (nextSort). Panah menandai arah; di kolom yang
  // tak aktif ia tersembunyi sampai disorot, supaya judul tak terlihat seperti
  // tabel penuh panah. Tak memakai aria-sort (hanya sah di columnheader, dan daftar
  // ini bukan tabel): urutan aktif dibacakan lewat teks tersembunyi. Padding 4px
  // memberi target >=24px (WCAG 2.5.8); margin negatif mengembalikan hurufnya ke
  // garis sel di bawahnya.
  const sortHead = (column: ServiceSortColumn, label: string, alignEnd = false) => {
    const dir = sortDirectionOn(sort, column);
    const Arrow = dir === 'descending' ? ArrowDown : ArrowUp;
    return (
      <button
        type="button"
        className={cn(
          'group/sort -m-1 inline-flex min-w-0 max-w-[calc(100%+0.5rem)] items-center gap-1 justify-self-start whitespace-nowrap rounded-md p-1 uppercase tracking-[inherit] outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          dir !== 'none' && 'text-foreground',
          alignEnd && 'flex-row-reverse',
        )}
        data-dir={dir}
        onClick={() => change(() => setSort(nextSort(sort, column)))}
        title={interpolate(t('services.sortBy'), { column: label })}
      >
        <span className="min-w-0 truncate">{label}</span>
        <Arrow
          aria-hidden
          className={cn(
            'size-3 shrink-0 transition-opacity',
            dir === 'none'
              ? 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60'
              : 'text-primary opacity-100',
          )}
        />
        {dir !== 'none' && (
          <span className="sr-only">{interpolate(t('services.sortCurrent'), { order: t(SORT_LABEL_KEY[sort]) })}</span>
        )}
      </button>
    );
  };

  // Biaya, sama di kedua tampilan: biaya final (plus modal/profit untuk pemilik
  // bila ada modal), atau estimasi berlabel selama biaya final belum ditetapkan.
  // Tiket batal: DP yang ditahan (biaya cek), dengan modal = biaya yang tetap
  // ditanggung, sama seperti rincian Detail Servis.
  const renderCost = (s: Service, align: 'end' | 'start' = 'end') => {
    const shown = costReadout(s);
    if (shown.kind === 'none') return <span className="text-muted-foreground">{emptyValue}</span>;
    if (shown.kind === 'estimate') {
      return (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" title={t('services.estimateHint')}>
          {interpolate(t('services.estimateShort'), { amount: fmtRp(shown.amount) })}
        </span>
      );
    }
    const kept = shown.kind === 'kept';
    const modal = kept ? heldCost(s.spareparts) : serviceModalTotal(s.spareparts);
    const profit = kept ? (cancelledProfit(s) ?? 0) : serviceProfit(s);
    return (
      <>
        <span className="font-mono font-semibold tabular-nums text-foreground">{fmtRp(shown.amount)}</span>
        {kept && (
          <span className="mt-0.5 block text-xs font-medium text-muted-foreground" title={t('services.keptHint')}>
            {t('services.keptTag')}
          </span>
        )}
        {/* Hanya kalau ada modal. Tanpa sparepart, profit SAMA DENGAN biaya, dan
            sub-baris cuma mengulang angka di atasnya. Angka tanpa "Rp": baris di
            atasnya sudah menetapkan mata uangnya. Tanda dan warna yang membawa
            arti: abu = modal keluar, hijau = profit, kuning = rugi. */}
        {isOwner && modal > 0 && (
          <span
            className={cn(
              'mt-0.5 flex gap-2 font-mono text-xs font-medium leading-snug tabular-nums',
              // Di wadah sempit biaya turun ke baris kedua, rata kiri; rinciannya ikut.
              align === 'end' ? 'justify-end @max-[861px]/svc:justify-start' : 'justify-start',
            )}
          >
            {/* Label margin lewat teks tersembunyi, bukan aria-label: aria-label pada
                <span> biasa tak dibacakan, sehingga pembaca layar hanya mengucap
                "-850.000 +650.000" tanpa tahu mana modal dan mana profit. */}
            <span className="text-muted-foreground">
              <span aria-hidden>-{fmtNumber(modal)}</span>
              <span className="sr-only">{interpolate(t('services.modalAria'), { amount: fmtRp(modal) })}</span>
            </span>
            <span
              className={profit < 0 ? 'text-warning-foreground' : 'text-success-foreground'}
              data-loss={profit < 0 ? 'true' : undefined}
            >
              <span aria-hidden>
                {profit >= 0 && '+'}
                {fmtNumber(profit)}
              </span>
              <span className="sr-only">{interpolate(t('services.profitAria'), { amount: fmtRp(profit) })}</span>
            </span>
          </span>
        )}
      </>
    );
  };

  // Aksi sama di Daftar dan Kartu. Tiga aksi tetap untuk semua tiket; tanda ambil
  // ada di label status ambil (renderPickup). Sparepart hanya untuk tiket yang
  // masih dikerjakan, dan ditaruh paling kiri: kelompoknya rata kanan, jadi tiga
  // aksi tetap sejajar antarbaris. `viewLink` hanya untuk Kartu: di Daftar seluruh
  // baris sudah tautan ke tiket (openTicket).
  const iconBtn = 'text-muted-foreground hover:text-foreground [&_svg]:size-[18px]';
  const renderActions = (s: Service, viewLink = false) => (
    <>
      {canQuickAddParts(s.status) && (
        <Button
          variant="ghost"
          size="icon"
          className={iconBtn}
          onClick={() => setPartsFor(s.id)}
          title={t('services.addPart')}
          aria-label={t('services.addPart')}
          aria-describedby={noId(s)}
        >
          <Cpu aria-hidden />
        </Button>
      )}
      {viewLink && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={iconBtn}
        >
          <Link
            to={`/services/${s.id}`}
            title={t('services.viewTicket')}
            aria-label={t('services.viewTicket')}
            aria-describedby={noId(s)}
          >
            <ExternalLink aria-hidden />
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={iconBtn}
        onClick={() => {
          setNotifyTarget(s);
          setNotifyOpen(true);
        }}
        title={t('services.notifyReceipt')}
        aria-label={t('services.notifyReceipt')}
        aria-describedby={noId(s)}
      >
        <WhatsAppIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={iconBtn}
        onClick={() => {
          setEditing(s);
          setEditOpen(true);
        }}
        title={t('common.edit')}
        aria-label={t('common.edit')}
        aria-describedby={noId(s)}
      >
        <Pencil aria-hidden />
      </Button>
    </>
  );

  // Ponsel (<=720px, ambang menu bawah): teknisi, urutan, dan lingkup dilipat ke
  // tombol filter di samping kolom cari, supaya tiket pertama naik ke layar
  // pertama. Baris filter tanpa isi yang tampil tidak boleh memakan jarak.
  const foldOnPhone = !moreOpen && 'phone:hidden';
  const phoneBarEmpty = !moreOpen && pickupFilter !== 'awaiting' && !filtersActive;
  const panel = 'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60';
  const filterSelect = 'w-auto min-w-[9.5rem] phone:w-full phone:min-w-0';
  const countPill = 'rounded-full bg-primary px-1.5 font-mono text-xs leading-[18px] text-primary-foreground';

  const loadMore = (
    <div className={cn('flex flex-wrap items-center gap-3', view === 'list' ? 'border-t border-border/70 px-5 py-4' : 'px-1')}>
      {rows.length > shownRows.length && (
        <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + LIST_PAGE_SIZE)}>
          <ArrowDown aria-hidden />
          {t('services.showMore')}
        </Button>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        {interpolate(t('services.shownOf'), { shown: String(shownRows.length), total: String(rows.length) })}
        {rows.length !== stats.total && interpolate(t('services.totalTail'), { n: String(stats.total) })}
        {scope === 'open' && closedCount > 0 && interpolate(t('services.closedHiddenTail'), { n: String(closedCount) })}
        {windowed && archive.length === 0 && t(truncated ? 'services.truncatedTail' : 'services.olderTail')}
      </span>
    </div>
  );

  return (
    <div data-nu className="flex flex-col gap-4 phone:gap-3" ref={wrapRef}>
      <ConfirmDialog
        open={!!pickupConfirm}
        title={t('services.unpaidTitle')}
        message={
          pickupConfirm
            ? interpolate(t('services.unpaidMsg'), {
                no: pickupConfirm.serviceNo,
                amount: fmtRp(outstandingBalance(pickupConfirm)),
              })
            : ''
        }
        confirmLabel={t('services.unpaidConfirm')}
        onCancel={() => setPickupConfirm(null)}
        onConfirm={() => {
          const s = pickupConfirm;
          setPickupConfirm(null);
          if (s) void togglePickup(s, true);
        }}
      />
      {/* Satu strip ringkasan, bukan lima kartu. Di ponsel ia satu baris empat
          hitungan berlabel pendek; nilai rupiah ada di Dashboard & Laporan. */}
      <SummaryStrip
        label={t('services.summaryAria')}
        items={[
          { label: t('services.statTotal'), short: t('services.statTotalShort'), value: stats.total },
          {
            label: t('services.statInProcess'),
            short: t('services.statInProcessShort'),
            value: stats.inProcess,
            tone: stats.inProcess > 0 ? 'info' : undefined,
          },
          {
            label: t('services.statAwaiting'),
            short: t('services.statAwaitingShort'),
            value: stats.awaitingPickup,
            tone: stats.awaitingPickup > 0 ? 'accent' : undefined,
          },
          { label: t('services.statDone'), short: t('services.statDoneShort'), value: stats.done },
          // Jumlah biaya final tiket Lunas — bukan "pendapatan" (itu kas masuk per bulan di Dashboard/Keuangan).
          { label: t('services.statPaidValue'), value: fmtRp(stats.lunasValue), wide: true, hideOnPhone: true },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 phone:flex-nowrap phone:items-stretch">
        <div className="min-w-0 max-w-xl flex-[1_1_18rem] phone:max-w-none">
          <TextInput
            placeholder={t('services.searchPh')}
            value={query}
            onChange={(e) => change(() => setQuery(e.target.value))}
            onClear={() => change(() => setQuery(''))}
            clearLabel={t('services.searchClear')}
            start={<Search aria-hidden />}
            aria-label={t('services.searchAria')}
          />
        </div>
        {/* Ponsel: seluruh filter (termasuk sakelar lingkup) dilipat ke sini,
            di samping kolom cari, supaya tiket pertama naik ke layar pertama. */}
        <Button
          variant="outline"
          size="icon"
          className="relative hidden shrink-0 phone:inline-flex aria-expanded:bg-accent"
          aria-expanded={moreOpen}
          aria-controls="servis-filter-lainnya"
          aria-label={t('services.moreFilters')}
          title={t('services.moreFilters')}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          {moreActive + foldedOnMobile > 0 && (
            <span className={cn(countPill, 'absolute -right-1 -top-1')}>{moreActive + foldedOnMobile}</span>
          )}
        </Button>
        <Button className="ml-auto phone:hidden" onClick={openNew}>
          <Plus aria-hidden />
          {t('services.new')}
        </Button>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-2 phone:grid phone:grid-cols-2',
          phoneBarEmpty && 'phone:hidden',
        )}
        role="group"
        aria-label={t('services.filterAria')}
      >
        {showTechFilter && (
          <SelectBox
            size="sm"
            className={cn(filterSelect, foldOnPhone)}
            value={techFilter}
            onValueChange={(v) => change(() => setTechFilter(v))}
            aria-label={t('services.filterTech')}
            options={[
              { value: 'all', label: t('services.allTechs') },
              ...(me ? [{ value: 'me', label: t('services.myTickets') }] : []),
              ...activeTechs.map((e) => ({ value: e.id, label: e.name })),
              { value: 'none', label: t('services.unassigned') },
            ]}
          />
        )}
        <SelectBox
          size="sm"
          className={cn(filterSelect, foldOnPhone)}
          value={sort}
          onValueChange={(v) => change(() => setSort(v as ServiceSort))}
          aria-label={t('services.sortAria')}
          options={SERVICE_SORTS.map((value) => ({ value, label: t(SORT_LABEL_KEY[value]) }))}
        />
        {/* Sakelar lingkup: tiga posisi bertingkat dalam satu rumah. Angka =
            tiket yang tampil bila posisi itu dipilih. Semua sengaja tanpa angka:
            di cloud daftarnya berjendela (31 hari), jadi angkanya akan
            bertabrakan dengan TOTAL di strip atas, dan chip status di bawah
            sudah menghitungnya. Di ponsel satu baris penuh, lebar tiap tuts
            mengikuti isinya, dan label boleh turun baris bila tak muat. */}
        <div
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full bg-secondary p-0.5 phone:col-span-2 phone:flex',
            foldOnPhone,
          )}
          role="group"
          aria-label={t('services.scopeAria')}
        >
          {SERVICE_SCOPES.map((value) => {
            const count = value === 'open' ? openCount : value === 'stalled' ? stalledCount : null;
            return (
              <button
                key={value}
                type="button"
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-secondary-foreground outline-none transition-colors hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgb(6_32_54/0.08)] pointer-coarse:min-h-11 phone:flex-auto phone:whitespace-normal phone:px-2 phone:leading-tight"
                aria-pressed={scope === value}
                onClick={() => change(() => setScope(value))}
                title={t(SCOPE_TEXT[value].hint)}
              >
                {/* Titik peringatan Tertahan menyala selama ada tiket yang tertahan. */}
                {value === 'stalled' && (
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      stalledCount > 0 ? 'bg-warning-foreground' : 'bg-muted-foreground/40',
                    )}
                  />
                )}
                <span>{t(SCOPE_TEXT[value].label)}</span>
                {count !== null && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtNumber(count)}</span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="phone:hidden aria-expanded:bg-accent"
          aria-expanded={moreOpen}
          aria-controls="servis-filter-lainnya"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          {t('services.moreFilters')}
          {moreActive > 0 && <span className={countPill}>{moreActive}</span>}
        </Button>
        {/* Hanya muncul dari tautan Dashboard "unit menunggu diambil". */}
        {pickupFilter === 'awaiting' && (
          <Button
            variant="soft"
            size="sm"
            onClick={() => change(() => setPickupFilter('all'))}
            aria-label={t('services.awaitingOffAria')}
            title={t('services.awaitingOffHint')}
          >
            {t('services.awaiting')} <X aria-hidden />
          </Button>
        )}
        {filtersActive && (
          <Button variant="link" size="sm" className="phone:justify-self-start" onClick={resetFilters}>
            {t('services.resetFilters')}
          </Button>
        )}
      </div>

      {moreOpen && (
        <div
          id="servis-filter-lainnya"
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-border/60 phone:grid phone:grid-cols-2"
          role="group"
          aria-label={t('services.moreFilters')}
        >
          <SelectBox
            size="sm"
            className={filterSelect}
            value={categoryFilter}
            onValueChange={(v) => change(() => setCategoryFilter(v))}
            aria-label={t('services.filterDevice')}
            options={[
              { value: 'all', label: t('services.allDevices') },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <SelectBox
            size="sm"
            className={filterSelect}
            value={dateFilter}
            onValueChange={(v) => change(() => setDateFilter(v as DateFilter))}
            aria-label={t('services.filterDate')}
            options={[
              { value: 'all', label: t('services.allDates') },
              { value: 'last7', label: t('services.last7') },
              { value: 'thisMonth', label: t('services.thisMonth') },
              { value: 'custom', label: t('services.pickDates') },
            ]}
          />
          {dateFilter === 'custom' && (
            <span className="flex items-center gap-2 phone:col-span-2">
              <Input
                type="date"
                className="h-8 w-auto rounded-full px-3 text-[13px] pointer-coarse:h-11 phone:min-w-0 phone:flex-1"
                value={customFrom}
                onChange={(e) => change(() => setCustomFrom(e.target.value))}
                aria-label={t('services.dateFrom')}
              />
              <span aria-hidden>{EMPTY_VALUE}</span>
              <Input
                type="date"
                className="h-8 w-auto rounded-full px-3 text-[13px] pointer-coarse:h-11 phone:min-w-0 phone:flex-1"
                value={customTo}
                onChange={(e) => change(() => setCustomTo(e.target.value))}
                aria-label={t('services.dateTo')}
              />
            </span>
          )}
          {/* Terakhir: di ponsel ia mengambil satu baris penuh ("Semua Pembayaran" lebih lebar dari separuh baris). */}
          <SelectBox
            size="sm"
            className={cn(filterSelect, 'phone:col-span-2')}
            value={paymentFilter}
            onValueChange={(v) => change(() => setPaymentFilter(v as PaymentFilter))}
            aria-label={t('services.filterPayment')}
            options={[
              { value: 'all', label: t('services.allPayments') },
              { value: 'unpaid', label: t('services.unpaid') },
              { value: 'dp', label: t('services.dpUnpaid') },
            ]}
          />
        </div>
      )}

      <FilterChips
        categories={statusCounts}
        total={filteredExceptStatus.length}
        value={activeStatus}
        onChange={(v) => change(() => setStatusFilter(v as ServiceStatus | 'all'))}
        label={t('services.statusAria')}
        labelOf={(id) => t(`statusLabel.${id as ServiceStatus}`) ?? id}
      />

      {loading ? (
        <div className={panel}>
          <p className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> {t('services.loading')}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={<Wrench aria-hidden />}
            title={t(visible.length === 0 ? 'services.emptyTitle' : 'services.noResults')}
            description={
              visible.length === 0
                ? t('services.emptyFirst')
                : !filtersActive && scope === 'open' && closedCount > 0
                  ? t('services.emptyAllClosed')
                  : t('services.emptyFiltered')
            }
            action={
              visible.length === 0 ? (
                <Button onClick={openNew}>
                  <Plus aria-hidden />
                  {t('services.new')}
                </Button>
              ) : filtersActive ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  {t('services.resetFilters')}
                </Button>
              ) : scope === 'open' && closedCount > 0 ? (
                <Button variant="outline" size="sm" onClick={() => change(() => setScope('all'))}>
                  {t('services.showClosed')}
                </Button>
              ) : null
            }
          />
        </div>
      ) : view === 'list' ? (
        /* Daftar: satu baris per tiket. Segmen opsional mengikuti Pengaturan >
           kolom Servis; lajurnya (--row-cols) dibentuk dari segmen yang aktif,
           jadi segmen antar baris sejajar. Semua lajur minmax(…) dan teksnya
           dipotong atau dijepit, sehingga baris tak pernah meluap. */
        <div className={panel}>
          <div
            className="@container/svc"
            data-segs={segCount}
            style={{ '--row-cols': rowTracks } as CSSProperties}
          >
            {/* Judul kolom: hanya di tata letak lebar, saat segmen berbaris dalam lajur.
                Baris di bawah (ul) tak pernah jadi tabel bagi pembaca layar, jadi judul
                yang hanya label disembunyikan (aria-hidden): tiap sel membawa labelnya
                sendiri sebagai teks tersembunyi (srLabel). Judul yang bisa diurutkan
                (No. Servis, Pelanggan, Status, Biaya) adalah tombol sungguhan di dalam
                grup berlabel, jadi wadahnya TIDAK aria-hidden. */}
            <div
              data-row-head
              className={cn(
                ROW_BASE,
                cols.has('cost') ? ROW_COST : ROW_NO_COST,
                'hidden min-h-0 whitespace-nowrap border-b border-border/70 bg-surface py-2.5 font-mono text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground',
                wide.head,
              )}
              role="group"
              aria-label={t('services.sortAria')}
            >
              <div className="grid min-w-0 grid-cols-(--row-cols) items-center gap-x-3 [grid-area:main] [&>span]:truncate">
                {sortHead('date', t('services.colNo'))}
                {cols.has('customer') && sortHead('customer', t('services.colCustomer'))}
                {cols.has('device') && <span aria-hidden="true">{t('services.colDevice')}</span>}
                {showNotes && (
                  <span aria-hidden="true">
                    {showComplaint && showFix
                      ? t('services.colNotes')
                      : t(showFix ? 'services.colFix' : 'services.colComplaint')}
                  </span>
                )}
                {showTech && <span aria-hidden="true">{t('services.colTech')}</span>}
              </div>
              <span className="min-w-0 [grid-area:status]">{sortHead('status', t('common.status'))}</span>
              {cols.has('cost') && (
                <span className="flex min-w-0 justify-end [grid-area:cost]">
                  {sortHead('cost', t('services.colCost'), true)}
                </span>
              )}
              {/* "AKSI" rata dengan glyph ikon terakhir, bukan tepi kotak tombolnya. */}
              <span
                className="flex justify-end pr-3 [grid-area:actions] pointer-coarse:@min-[861px]/svc:pr-3.5"
                aria-hidden="true"
              >
                {t('common.actions')}
              </span>
            </div>
            <ul className="m-0 list-none p-0">
              {shownRows.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    ROW_BASE,
                    cols.has('cost') ? ROW_COST : ROW_NO_COST,
                    'cursor-pointer border-t border-border/70 transition-colors first:border-t-0 hover:bg-accent/60',
                  )}
                  onClick={(e) => openTicket(e, s.id)}
                >
                  <div
                    className={cn(
                      'flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5 [grid-area:main] grid-cols-(--row-cols)',
                      '@max-[521px]/svc:flex-col @max-[521px]/svc:items-start',
                      wide.main,
                    )}
                  >
                    {/* Nomor + tanggal masuk: satu identitas tiket, satu segmen.
                        Cukup selebar lajur tabelnya; tanpa ini ia ikut membengkak
                        dan mendorong perangkat ke baris kedua. */}
                    <div
                      className="flex min-w-0 flex-[0_1_6.5rem] flex-col items-start text-sm leading-snug @max-[521px]/svc:flex-none @max-[521px]/svc:flex-row @max-[521px]/svc:items-baseline @max-[521px]/svc:gap-2"
                      data-seg="id"
                    >
                      <Link
                        to={`/services/${s.id}`}
                        className="whitespace-nowrap font-mono font-semibold text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:-mx-2 pointer-coarse:-my-3.5 pointer-coarse:inline-block pointer-coarse:px-2 pointer-coarse:py-3.5"
                        id={noId(s)}
                      >
                        {s.serviceNo}
                      </Link>
                      <small className="block text-xs text-muted-foreground">{fmtDate(localDateOf(s.createdAt))}</small>
                    </div>
                    {cols.has('customer') && (
                      <div
                        className="flex min-w-0 flex-[1_1_9rem] flex-col items-start text-sm leading-snug @max-[521px]/svc:flex-none"
                        data-seg="customer"
                      >
                        {srLabel('services.colCustomer')}
                        {/* Nama pelanggan boleh dua baris: satu baris berelipsis menyembunyikan
                            nama belakang (pembeda antar "Budi"). */}
                        <strong
                          className="line-clamp-2 max-w-full font-semibold text-foreground [overflow-wrap:anywhere]"
                          title={s.customerName || undefined}
                        >
                          {s.customerName}
                        </strong>
                        {/* Nomor HP mono, tak boleh dipotong: nomor yang kehilangan digit = nomor salah. */}
                        <small
                          className="block max-w-full truncate font-mono text-xs text-muted-foreground @max-[521px]/svc:hidden"
                          title={s.customerPhone || undefined}
                        >
                          {s.customerPhone}
                        </small>
                      </div>
                    )}
                    {cols.has('device') && (
                      <div
                        className="flex min-w-0 flex-[1_1_9rem] flex-col items-start text-sm leading-snug @max-[521px]/svc:flex-none"
                        data-seg="device"
                      >
                        {srLabel('services.colDevice')}
                        {/* Nama perangkat boleh dua baris: "MacBook Pro 13" 2019" tanpa
                            tahun modelnya kehilangan pembeda antartiket. */}
                        <span className="line-clamp-2 max-w-full text-foreground [overflow-wrap:break-word]" title={s.device || undefined}>
                          {s.device}
                        </span>
                        <small className="block max-w-full truncate text-xs text-muted-foreground @max-[521px]/svc:hidden">
                          {s.category}
                        </small>
                      </div>
                    )}
                    {showNotes && (
                      <div
                        className="flex min-w-0 flex-[2_1_14rem] flex-col items-start gap-0.5 text-sm leading-snug @max-[521px]/svc:hidden"
                        data-seg="notes"
                        data-single={showComplaint !== showFix ? 'true' : undefined}
                      >
                        {/* Label yang mengulang judul kolom disembunyikan secara visual
                            (bukan display: none) saat judul tampil dan toko hanya memakai
                            satu jenis catatan: judulnya aria-hidden, jadi label inilah
                            satu-satunya nama sel bagi pembaca layar. */}
                        {showComplaint && (
                          <span className="line-clamp-2 text-xs text-muted-foreground" title={s.complaint || undefined}>
                            <b className={cn('mr-1 font-semibold text-foreground/70', showComplaint !== showFix && wide.srOnly)}>
                              {t('services.colComplaint')}
                            </b>{' '}
                            {s.complaint || emptyValue}
                          </span>
                        )}
                        {showFixLine(s) && (
                          <span className="line-clamp-3 text-xs text-muted-foreground" title={s.completionNote || undefined}>
                            <b className={cn('mr-1 font-semibold text-foreground/70', showComplaint !== showFix && wide.srOnly)}>
                              {t('services.colFix')}
                            </b>{' '}
                            {s.completionNote || emptyValue}
                          </span>
                        )}
                      </div>
                    )}
                    {showTech && (
                      <div
                        className="flex min-w-0 flex-[1_1_9rem] flex-col items-start text-sm leading-snug @max-[521px]/svc:hidden"
                        data-seg="technician"
                      >
                        {srLabel('services.colTech')}
                        <span className="flex max-w-full items-start gap-1.5 text-muted-foreground" title={t('services.colTech')}>
                          <Wrench aria-hidden className={cn('mt-[0.2em] size-3.5 shrink-0', wide.hide)} />
                          <span className="line-clamp-2 [overflow-wrap:anywhere]">{s.technicianName || emptyValue}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Satu zona pindai: lencana status, lalu sinyal "belum diambil" dan
                      "tertahan". Di wadah sempit lencananya rata kanan di baris pertama. */}
                  <div className="flex min-w-0 flex-col items-start [grid-area:status] @max-[861px]/svc:items-end @max-[861px]/svc:self-start @max-[861px]/svc:pr-1.5">
                    {renderStatus(s)}
                    {renderPickup(s)}
                    {renderStall(s)}
                  </div>
                  {cols.has('cost') && (
                    <div className="whitespace-nowrap text-right text-sm [grid-area:cost] @max-[861px]/svc:text-left">
                      {srLabel('services.colCost')}
                      {renderCost(s, 'end')}
                    </div>
                  )}
                  <div className="flex justify-end [grid-area:actions]">{renderActions(s)}</div>
                </li>
              ))}
            </ul>
          </div>
          {loadMore}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Kartu: satu atau dua kolom mengikuti lebar (auto-fill, tanpa breakpoint). */}
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(18.75rem,100%),1fr))] gap-3 p-0">
            {shownRows.map((s) => (
              <li
                key={s.id}
                className="flex min-w-0 flex-col gap-2 rounded-2xl bg-card px-4 py-3 text-card-foreground shadow-panel ring-1 ring-border/60"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Nomor tiket = pintu ke detail; tingginya sekelas tombol supaya mudah diketuk. */}
                  <Link
                    to={`/services/${s.id}`}
                    className="inline-flex min-h-10 items-center whitespace-nowrap font-mono text-sm font-semibold text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                    id={noId(s)}
                  >
                    {s.serviceNo}
                  </Link>
                  {renderStatus(s)}
                </div>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <strong className="block text-base font-semibold" title={s.device || undefined}>
                    {s.device}
                  </strong>
                  <small className="text-xs text-muted-foreground">{s.category}</small>
                  {renderPickup(s) && <div>{renderPickup(s)}</div>}
                  {showComplaint && s.complaint && (
                    <small className="mt-1 block text-xs text-muted-foreground">
                      <b className="mr-1 font-semibold text-foreground/70">{t('services.colComplaint')}</b> {s.complaint}
                    </small>
                  )}
                  {showFix && s.completionNote && (
                    <small className="mt-1 block text-xs text-muted-foreground">
                      <b className="mr-1 font-semibold text-foreground/70">{t('services.colFix')}</b> {s.completionNote}
                    </small>
                  )}
                  {renderStall(s)}
                </div>
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground [overflow-wrap:anywhere] [&_svg]:size-3.5 [&_svg]:shrink-0">
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                    <User aria-hidden className="text-muted-foreground" /> {s.customerName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar aria-hidden /> {fmtDate(localDateOf(s.createdAt))}
                  </span>
                  {s.technicianName && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Wrench aria-hidden /> {s.technicianName}
                    </span>
                  )}
                </div>
                {/* Angka tetap satu baris; aksi turun ke baris sendiri, rata kanan,
                    hanya bila tidak muat. */}
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
                  <div className="flex flex-col items-start whitespace-nowrap">
                    {srLabel('services.colCost')}
                    {renderCost(s, 'start')}
                  </div>
                  <div className="ml-auto flex gap-1">{renderActions(s, true)}</div>
                </div>
              </li>
            ))}
          </ul>
          {loadMore}
        </div>
      )}

      <ThumbDock>
        <Button onClick={openNew}>
          <Plus aria-hidden />
          {t('services.new')}
        </Button>
      </ThumbDock>

      <ServiceModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={editing}
        services={services}
        employees={techs}
        onSaved={(created) => created && setDone({ service: created, variant: 'intake' })}
      />
      <StatusModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        service={statusTarget}
        onSaved={() => {}}
        onHandedOver={() => statusTarget && setDone({ service: statusTarget, variant: 'handover' })}
      />
      <TicketDoneModal
        open={!!done}
        onClose={() => setDone(null)}
        service={done ? (services.find((s) => s.id === done.service.id) ?? done.service) : null}
        variant={done?.variant ?? 'intake'}
      />
      <NotifyModal open={notifyOpen} onClose={() => setNotifyOpen(false)} service={notifyTarget} />
      {/* key per tiket: pencarian dan jumlah di pemilih tidak terbawa ke tiket lain. */}
      <SparepartPickerModal
        key={partsFor ?? 'none'}
        open={!!partsService}
        onClose={() => setPartsFor(null)}
        existingItemIds={(partsService?.spareparts ?? []).map((p) => p.itemId).filter((x): x is string => !!x)}
        onPick={addPart}
        ticket={partsService ?? undefined}
        modalDadakan={
          isManager
            ? {
                wallets: partsWallets,
                defaultWalletId: partsWallets.some((w) => w.id === lastWallet)
                  ? lastWallet
                  : (partsWallets[0]?.id ?? ''),
                onSave: addModal,
              }
            : undefined
        }
      />
    </div>
  );
}
