import { EmptyValue } from '@/components/ui/EmptyValue';
import { EMPTY_VALUE } from '@/lib/format';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  CircleCheck,
  Clock,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserRoundX,
  Users,
} from 'lucide-react';
import { LoadState, loadPending } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { Field } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { useCollectionRange } from '@/hooks/useCollectionRange';
import { repository } from '@/data';
import { clockIn, clockOut } from '@/data/supabase-client';
import { isCloudMode } from '@/stores/demo';
import { isOwner } from '@/config/plans';
import { logActivity } from '@/lib/activity';
import { getCurrentPosition } from '@/lib/geo';
import {
  hasGeofence,
  hoursByEmployee,
  withinRange,
  visibleAttendance,
  isWorkedDay,
  STATUS_LABEL,
  IMPLAUSIBLE_HOURS,
} from '@/lib/business/attendance';
import { newId } from '@/lib/id';
import { localDateStr, localTimeStr, localTimeSec, calcHours, fmtDate } from '@/lib/time';
import { toast } from '@/stores/toast';
import { useFormat } from '@/lib/useFormat';
import { useSessionStore } from '@/stores/session';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';
import type { Attendance } from '@/data/types';

export function AttendancePage() {
  const today = localDateStr();
  // Papan hari ini: satu hari saja. Dulu halaman ini menarik SELURUH tabel
  // absensi lewat daftar biasa, yang diam-diam terpotong 1.000 baris — untuk
  // tim lima orang itu sekitar enam bulan, dan sesudahnya rekap gaji periode
  // lama tampil kosong tanpa satu pun tanda bahwa datanya tidak lengkap.
  const { data: outlets } = useCollection('outlets');
  const { data: employees } = useCollection('employees');
  const me = useSessionStore((s) => s.currentEmployee);
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  // Halaman ini sengaja TIDAK memakai isManager(). Absensi seluruh tim adalah
  // data upah plus pola kehadiran orang lain, dan itu milik PEMILIK — bukan
  // siapa pun yang kebetulan berperan manager. Admin memang manager untuk
  // servis, stok, dan supplier; kehadiran rekan kerjanya bukan urusan
  // operasional, itu urusan ketenagakerjaan.
  const owner = me ? isOwner(me.role) : false;
  const { fmtDate: fmtLocaleDate } = useFormat();
  const t = useT();

  // Koreksi owner: ubah jam/status atau hapus baris; plus entri manual
  // (absenkan karyawan) lewat modal yang sama, jalur `creating`.
  const [editRow, setEditRow] = useState<Attendance | null>(null);
  const [creating, setCreating] = useState(false);
  const [editEmp, setEditEmp] = useState('');
  // Cabang absensi manual dipilih eksplisit. Dulu selalu memakai cabang yang
  // sedang AKTIF di layar pemilik — jadi absensi bisa tercatat ke cabang yang
  // bukan tempat orangnya bekerja.
  const [editOutlet, setEditOutlet] = useState('');
  const [editDate, setEditDate] = useState(today);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [editStatus, setEditStatus] = useState('hadir');
  const [editNote, setEditNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Attendance | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Periode yang sedang dilihat — mengendalikan REKAP sekaligus RIWAYAT.
  // Rentang bebas, bukan bulan kalender: periode gaji toko jarang jatuh persis
  // tanggal 1 sampai akhir bulan; 26–25 dan per-dua-minggu sama umumnya.
  // Bawaannya bulan berjalan, karena itu yang paling sering dilihat.
  const [from, setFrom] = useState(() => `${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [historyEmp, setHistoryEmp] = useState('all');
  const rangeValid = from <= to;
  // Rekap & riwayat mengambil PERSIS periode yang dipilih dari server, jadi
  // periode setahun lalu sama lengkapnya dengan bulan ini. Papan hari ini ikut
  // di dalam rentang yang sama: satu permintaan untuk satu halaman — dua kueri
  // yang saling tumpang tindih berarti setiap absen memicu dua kali muat ulang.
  const lo = rangeValid ? from : to;
  const { data: rows, refetch, ...rangeLoad } = useCollectionRange(
    'attendance',
    'date',
    lo < today ? lo : today,
    to > today ? to : today,
  );
  const attendanceLoad = { ...rangeLoad, refetch };
  const periodLoad = attendanceLoad;
  const todayRows = useMemo(() => rows.filter((a) => a.date === today), [rows, today]);
  const periodRows = useMemo(
    () => rows.filter((a) => a.date >= lo && a.date <= to),
    [rows, lo, to],
  );
  // Rekap owner-only. Isinya jam kerja SELURUH karyawan sepanjang periode —
  // dasar perhitungan upah dan sekaligus potret siapa yang sering telat.
  // Sebelumnya saya buka untuk manager dengan alasan "admin boleh mengoreksi,
  // jadi harus bisa memeriksa hasilnya". Itu keliru: yang perlu diperiksa
  // admin adalah barisnya sendiri, bukan rekap satu toko.
  const recap = useMemo(
    () => (owner ? hoursByEmployee(periodRows, from, to) : []),
    [periodRows, from, to, owner],
  );

  // Outlet whose geofence applies to this check-in: the active branch if one is
  // selected, otherwise the primary (or first) outlet.
  const targetOutlet = useMemo(() => {
    if (outlets.length === 0) return null;
    const fallback = outlets.find((o) => o.isPrimary) ?? outlets[0];
    if (!activeOutletId) return fallback;
    // Cabang aktif yang sudah dihapus TIDAK boleh mengembalikan null: dulu
    // itu menjatuhkan check-in ke jalur legacy — tulis langsung, tanpa GPS,
    // tanpa server. Kegagalan senyap ke arah yang lebih longgar adalah
    // kegagalan terburuk untuk sebuah gerbang.
    return outlets.find((o) => o.id === activeOutletId) ?? fallback;
  }, [outlets, activeOutletId]);

  const openEdit = (a: Attendance) => {
    setEditRow(a);
    setCreating(false);
    setEditIn(a.checkIn ?? '');
    setEditOut(a.checkOut ?? '');
    setEditStatus(a.status);
    setEditNote(a.note ?? '');
  };

  const openCreate = () => {
    setEditRow(null);
    setCreating(true);
    setEditEmp('');
    setEditOutlet(targetOutlet?.id ?? '');
    setEditDate(today);
    setEditIn(localTimeStr());
    setEditOut('');
    setEditStatus('hadir');
    setEditNote('');
  };

  const closeModal = () => {
    setEditRow(null);
    setCreating(false);
  };

  // Jam yang akan tersimpan, dihitung sambil mengetik. Menampilkannya di modal
  // membuat shift semalaman (calcHours menambah 24 jam saat keluar < masuk)
  // terlihat SEBELUM disimpan — dulu "17:00–08:00" diam-diam jadi 15 jam.
  const editHours = useMemo(
    () => (editIn && editOut ? calcHours(editIn, editOut) : null),
    [editIn, editOut],
  );

  const saveEdit = async () => {
    if (!editRow && !creating) return;
    // Izin/sakit/alpha bukan shift: jamnya dikosongkan di sini supaya yang
    // tersimpan sama dengan yang dibaca semua penghitung (server menegakkan
    // aturan yang sama, 0076).
    const absent = editStatus !== 'hadir';
    const checkIn = absent ? null : editIn.trim() || null;
    const checkOut = absent ? null : editOut.trim() || null;
    // Input-nya kini type="time", tapi nilai bisa datang dari paste atau
    // browser lama. Tanpa penjagaan ini "8" tersimpan apa adanya dan
    // calcHours mengembalikan 0 — sehari upah hilang tanpa satu peringatan.
    const badFormat = (v: string | null) => v !== null && !/^\d{2}:\d{2}$/.test(v);
    if (badFormat(checkIn) || badFormat(checkOut)) {
      toast.error(t('attendance.badTime'));
      return;
    }
    if (checkOut && !checkIn) {
      toast.error(t('attendance.inBeforeOut'));
      return;
    }
    const totalHours = checkIn && checkOut ? calcHours(checkIn, checkOut) : 0;
    setEditBusy(true);
    try {
      if (creating) {
        const emp = employees.find((e) => e.id === editEmp);
        if (!emp) {
          toast.error(t('attendance.pickEmployee'));
          return;
        }
        // One row per employee per day — a second one would double-count hours.
        // Pemeriksaan ramah di klien; indeks unik di database (0054) yang
        // benar-benar menjaminnya, termasuk untuk tanggal di luar periode ini.
        if (rows.some((a) => a.employeeId === emp.id && a.date === editDate)) {
          toast.error(interpolate(t('attendance.duplicate'), { name: emp.name, date: fmtDate(editDate) }));
          return;
        }
        const now = new Date().toISOString();
        await repository.put('attendance', {
          id: newId(),
          orgId,
          outletId: editOutlet || targetOutlet?.id || null,
          employeeId: emp.id,
          employeeName: emp.name,
          date: editDate,
          status: editStatus as Attendance['status'],
          checkIn,
          checkOut,
          totalHours,
          note: editNote.trim(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        toast.success(interpolate(t('attendance.created'), { name: emp.name, date: fmtDate(editDate) }));
        logActivity({
          action: 'attendance.checkin',
          entityType: 'attendance',
          entityLabel: emp.name,
          meta: { date: editDate, checkIn, checkOut, status: editStatus, manual: true },
        });
      } else {
        await repository.put('attendance', {
          ...editRow!,
          checkIn,
          checkOut,
          status: editStatus as Attendance['status'],
          note: editNote.trim(),
          totalHours,
        });
        toast.success(t('attendance.updated'));
        logActivity({
          action: 'attendance.update',
          entityType: 'attendance',
          entityId: editRow!.id,
          entityLabel: editRow!.employeeName,
          meta: { date: editRow!.date, checkIn, checkOut, status: editStatus },
        });
      }
      closeModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('attendance.saveFailed'));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await repository.remove('attendance', toDelete.id);
      toast.success(t('attendance.deleted'));
      logActivity({
        action: 'attendance.delete',
        entityType: 'attendance',
        entityId: toDelete.id,
        entityLabel: toDelete.employeeName,
        meta: { date: toDelete.date },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('attendance.deleteFailed'));
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const [busy, setBusy] = useState(false);

  // Jam hidup, berdetak tiap detik.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hhmmss = localTimeSec(clock);

  // Baris absensi SAYA hari ini — satu-satunya, karena satu baris per hari
  // (dijamin indeks di migrasi 0054). Tiga turunan di bawah dibaca darinya,
  // bukan dari tiga pencarian terpisah yang bisa saling bertentangan.
  const myRow = useMemo(
    () => todayRows.find((a) => a.employeeId === me?.id && a.date === today) ?? null,
    [todayRows, me, today],
  );
  // Izin/sakit/alpha bukan shift. Dulu ketiganya lolos ke myTodayDone dan
  // membuat papan jam menampilkan "Selesai · 8.75 jam" untuk orang yang
  // justru sedang tidak masuk.
  const myAbsent = myRow && myRow.status !== 'hadir' ? myRow : null;
  const myToday = myRow && !myAbsent && myRow.checkIn && !myRow.checkOut ? myRow : null;
  const myTodayDone = myRow && !myAbsent && myRow.checkIn && myRow.checkOut ? myRow : null;

  const todayRecords = useMemo(
    () => [...todayRows].sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? '')),
    [todayRows],
  );

  const recentByDay = useMemo(() => {
    // HANYA OWNER yang melihat riwayat seluruh tim. Admin dan karyawan sama:
    // barisnya sendiri saja. Admin memang manager untuk servis, stok, dan
    // supplier — tapi kehadiran rekan kerjanya bukan urusan operasional, itu
    // urusan ketenagakerjaan, dan yang menggaji hanya satu orang.
    //
    // Batasnya soal RIWAYAT, bukan kehadiran hari ini: papan "Kehadiran Hari
    // Ini" di atas tetap terbuka untuk semua — siapa yang sedang jaga adalah
    // informasi shift biasa. Yang sensitif adalah polanya sepanjang periode:
    // siapa sering telat, siapa sering absen.
    const scoped = visibleAttendance(periodRows, { isOwner: owner, employeeId: me?.id });
    // Difilter per periode, bukan dipotong 30 baris terakhir. Potongan lama
    // membuat tim 5 orang hanya punya enam hari riwayat, dan tidak ada cara
    // sama sekali melihat bulan lalu.
    // Rentangnya SAMA dengan rekap di atas: satu kontrol, supaya baris yang
    // dilihat selalu baris yang dihitung.
    if (!rangeValid) return [];
    return scoped
      .filter((a) => a.date && withinRange(a.date, from, to))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.checkIn ?? '').localeCompare(a.checkIn ?? ''));
  }, [periodRows, owner, me, from, to, rangeValid]);

  // Owner bisa menyempitkan riwayat tim ke satu karyawan. Pilihannya diambil dari
  // SEMUA baris yang boleh ia lihat (mantan karyawan yang punya riwayat tetap
  // bisa dipilih), dengan jumlah barisnya di periode ini. Pilihan tetap bertahan
  // saat periode diganti, supaya "belum ada riwayat Sari" terbaca jujur alih-alih
  // diam-diam kembali ke seluruh tim.
  const historyPeople = useMemo(() => {
    const people = new Map<string, { name: string; count: number }>();
    for (const a of visibleAttendance(periodRows, { isOwner: owner, employeeId: me?.id })) {
      if (!people.has(a.employeeId)) people.set(a.employeeId, { name: a.employeeName, count: 0 });
    }
    for (const a of recentByDay) {
      const person = people.get(a.employeeId);
      if (person) person.count += 1;
    }
    return [...people.entries()].sort((x, y) => x[1].name.localeCompare(y[1].name));
  }, [periodRows, owner, me, recentByDay]);
  const historyEmpName =
    historyEmp === 'all' ? null : (historyPeople.find(([id]) => id === historyEmp)?.[1].name ?? null);
  const activeHistoryEmp = historyEmpName ? historyEmp : 'all';
  const historyRows =
    activeHistoryEmp === 'all' ? recentByDay : recentByDay.filter((a) => a.employeeId === activeHistoryEmp);

  const checkIn = async () => {
    if (!me) return;
    // Satu baris per karyawan per hari — penjagaan yang sudah ada di entri
    // manual (lihat saveEdit) tapi hilang di jalur otomatis. Dua perangkat,
    // atau satu yang belum sempat refetch, menghasilkan dua baris dan rekap
    // yang menggelembung. Server menolaknya juga (migrasi 0053); ini hanya
    // supaya pesannya ramah, bukan lemparan RPC.
    if (todayRows.some((a) => a.employeeId === me.id && a.date === today)) {
      toast.error(t('attendance.alreadyToday'));
      return;
    }
    setBusy(true);
    try {
      // Cloud: SELALU lewat server, bukan hanya saat outletnya berpagar. Jalur
      // tulis langsung memakai jam PERANGKAT — dan jam kerja adalah upah, jadi
      // mengubah jam HP tidak boleh mengubah absensi. GPS hanya diminta kalau
      // outletnya memang punya radius; servernya yang memvalidasi ulang.
      if (isCloudMode() && targetOutlet) {
        const pos = hasGeofence(targetOutlet) ? await getCurrentPosition() : null;
        await clockIn({
          orgId,
          outletId: targetOutlet.id,
          employeeId: me.id,
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
        });
        // RPC melewati change-subscription adapter, jadi muat ulang manual.
        await refetch();
      } else {
        // Lokal/demo (atau toko tanpa outlet sama sekali) → tulis langsung.
        const now = new Date().toISOString();
        await repository.put('attendance', {
          id: newId(),
          orgId,
          outletId: targetOutlet?.id ?? null,
          employeeId: me.id,
          employeeName: me.name,
          date: today,
          status: 'hadir',
          checkIn: localTimeStr(),
          checkOut: null,
          totalHours: 0,
          note: '',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
      }
      toast.success(interpolate(t('attendance.checkedIn'), { time: localTimeStr() }));
      logActivity({
        action: 'attendance.checkin',
        entityType: 'attendance',
        entityLabel: me.name,
        meta: { time: localTimeStr() },
        outletId: targetOutlet?.id ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('attendance.checkInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!myToday) return;
    setBusy(true);
    const out = localTimeStr();
    try {
      // Cermin dari checkIn: kalau outlet-nya ber-geofence, pulang divalidasi
      // server juga. Sebelumnya masuk dijaga GPS + jam server sementara pulang
      // ditulis langsung dari perangkat — separuh catatan jam kerja tidak
      // bisa dipercaya, dan separuh itulah yang menentukan upah.
      if (isCloudMode() && targetOutlet) {
        const pos = hasGeofence(targetOutlet) ? await getCurrentPosition() : null;
        await clockOut({
          attendanceId: myToday.id,
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
        });
        await refetch();
      } else {
        await repository.put('attendance', {
          ...myToday,
          checkOut: out,
          totalHours: calcHours(myToday.checkIn ?? '00:00', out),
        });
      }
      toast.success(interpolate(t('attendance.checkedOut'), { time: out }));
      logActivity({
        action: 'attendance.checkout',
        entityType: 'attendance',
        entityId: myToday.id,
        entityLabel: myToday.employeeName,
        meta: { time: out, totalHours: calcHours(myToday.checkIn ?? '00:00', out) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('attendance.checkOutFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Lompatan cepat ke periode yang paling sering diminta. Mengetik dua tanggal
  // untuk "bulan lalu" setiap kali gajian adalah gesekan yang tidak perlu.
  const setPreset = (preset: 'thisMonth' | 'lastMonth' | 'last7') => {
    const d = new Date(`${today}T00:00:00`);
    if (preset === 'last7') {
      const start = new Date(d);
      start.setDate(start.getDate() - 6);
      setFrom(localDateStr(start));
      setTo(today);
      return;
    }
    // setMonth() di JS menangani pergantian tahun sendiri: Januari − 1 = Desember
    // tahun sebelumnya. Menghitungnya manual dari string adalah cara klasik
    // kehilangan bulan Desember.
    const base = preset === 'lastMonth' ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
    // Hari ke-0 bulan berikutnya = hari terakhir bulan ini, termasuk Februari.
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    setFrom(localDateStr(base));
    setTo(preset === 'thisMonth' ? today : localDateStr(end));
  };

  // Satu kontrol periode, dua kartu. Rekap dan riwayat harus selalu menunjukkan
  // rentang yang sama — dua pemilih terpisah adalah cara termudah membuat
  // pemilik membandingkan total Agustus dengan baris September.
  const periodPicker = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Input tanggal bawaan, tidak disembunyikan: dua tanggal harus bisa dibaca
          sekaligus, dan nilai yang terlihat itulah yang membuat periode gaji bisa
          diperiksa. */}
      <div className="flex min-w-0 items-center gap-2 @max-[400px]/absen:w-full">
        <Input
          type="date"
          max={to}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={DATE_INPUT}
          aria-label={t('attendance.periodFrom')}
        />
        <span className="text-muted-foreground" aria-hidden>
          &ndash;
        </span>
        <Input
          type="date"
          min={from}
          max={today}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={DATE_INPUT}
          aria-label={t('attendance.periodTo')}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setPreset('thisMonth')}>
          {t('attendance.thisMonth')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreset('lastMonth')}>
          {t('attendance.lastMonth')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreset('last7')}>
          {t('attendance.last7')}
        </Button>
      </div>
    </div>
  );

  const periodLabel = `${fmtLocaleDate(`${from}T00:00:00`, { day: 'numeric', month: 'short' })} – ${fmtLocaleDate(`${to}T00:00:00`, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div data-nu className="@container/absen flex flex-col gap-4 bg-transparent">
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-panel @max-[561px]/absen:px-4 @max-[561px]/absen:py-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium text-primary-foreground/80">
            {me?.name ? interpolate(t('attendance.operatorName'), { name: me.name }) : t('attendance.operator')}
          </span>
          <span className="font-mono text-[length:clamp(2.4rem,7cqi,3.6rem)] leading-none font-semibold tabular-nums">{hhmmss}</span>
          <span className="font-mono text-sm tabular-nums text-primary-foreground/80">{fmtDate(today)}</span>
          {myToday && (
            <span className={CLOCK_STATUS}>
              <span className="size-2 shrink-0 rounded-full bg-highlight" aria-hidden />
              {interpolate(t('attendance.workingSince'), { time: myToday.checkIn ?? '' })}
            </span>
          )}
          {myTodayDone && (
            <span className={CLOCK_STATUS}>
              <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
              {interpolate(t('attendance.doneSummary'), {
                hours: String(myTodayDone.totalHours),
                in: myTodayDone.checkIn ?? '',
                out: myTodayDone.checkOut ?? '',
              })}
            </span>
          )}
          {myAbsent && (
            <span className={CLOCK_STATUS}>
              <span className="size-2 shrink-0 rounded-full bg-primary-foreground/50" aria-hidden />
              {interpolate(t('attendance.recordedToday'), { status: t(STATUS_LABEL[myAbsent.status]).toLowerCase() })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Tombol Absen Masuk hilang begitu ADA baris hari ini, apa pun
              statusnya. Dulu baris izin tidak dikenali, tombolnya tetap
              muncul, dan menekannya hanya menghasilkan penolakan. */}
          {!myRow && (
            <Button size="lg" variant="highlight" onClick={checkIn} disabled={busy} aria-busy={busy || undefined}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <LogIn aria-hidden />}
              {t('attendance.checkIn')}
            </Button>
          )}
          {myToday && (
            <Button size="lg" variant="secondary" onClick={checkOut} disabled={busy} aria-busy={busy || undefined}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <LogOut aria-hidden />}
              {t('attendance.checkOut')}
            </Button>
          )}
          {myTodayDone && (
            <Badge variant="success">
              <CircleCheck aria-hidden />
              {t('attendance.complete')}
            </Badge>
          )}
          {myAbsent && <Badge variant="secondary">{t(STATUS_LABEL[myAbsent.status])}</Badge>}
        </div>
      </div>

      <Panel>
        <PanelHead
          icon={<Users aria-hidden />}
          title={t('attendance.todayTitle')}
          action={
            // Owner-only, sejalan dengan tombol edit/hapus di riwayat: yang
            // boleh menulis absensi orang lain hanya yang menggajinya.
            owner && (
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus aria-hidden />
                {t('attendance.record')}
              </Button>
            )
          }
        />
        {loadPending(attendanceLoad) ? (
          <LoadState queries={[attendanceLoad]} />
        ) : todayRecords.length === 0 ? (
          <EmptyState icon={<UserRoundX aria-hidden />} title={t('attendance.noCheckIn')} description={t('attendance.noCheckInHint')} />
        ) : (
          <ul>
            {todayRecords.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 py-3 ${ROW}`}>
                <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {a.employeeName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold">{a.employeeName}</strong>
                  <small className="font-mono text-xs tabular-nums text-muted-foreground">
                    {a.status === 'hadir'
                      ? `${a.checkIn ?? EMPTY_VALUE}${a.checkOut ? ` – ${a.checkOut}` : ''}`
                      : t(STATUS_LABEL[a.status])}
                    {a.note ? ` · ${a.note}` : ''}
                  </small>
                </div>
                {/* Hijau berarti "shift selesai". Baris izin/sakit/alpha dulu ikut
                    memakainya dan terbaca sebagai hari kerja penuh dengan nol jam —
                    kebalikan dari kenyataannya. */}
                {a.status !== 'hadir' ? (
                  <Badge variant="secondary">{t(STATUS_LABEL[a.status])}</Badge>
                ) : a.checkOut ? (
                  <Badge variant="success">{interpolate(t('attendance.hours'), { hours: String(a.totalHours) })}</Badge>
                ) : (
                  <Badge variant="info">
                    <span className="size-1.5 rounded-full bg-info-foreground" aria-hidden />
                    {t('attendance.working')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Kontrol periode berdiri sendiri di atas kedua kartu yang dikendalikannya.
          Menaruhnya di dalam salah satu header akan menyiratkan ia hanya
          mengatur kartu itu. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3" role="group" aria-label={t('attendance.period')}>
        <span className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap text-muted-foreground [&>svg]:size-4">
          <CalendarDays aria-hidden />
          {t('attendance.period')}
        </span>
        {periodPicker}
      </div>

      {owner && (
        <Panel>
          <PanelHead icon={<Clock aria-hidden />} title={t('attendance.recapTitle')} action={<span className={PERIOD_TAG}>{periodLabel}</span>} />
          {loadPending(periodLoad) ? (
            <LoadState queries={[periodLoad]} />
          ) : recap.length === 0 ? (
            <EmptyState icon={<CalendarDays aria-hidden />} title={t('attendance.recapEmpty')} />
          ) : (
            <div>
              <div className={`${RECAP_GRID} ${HEAD}`}>
                <span>{t('attendance.colEmployee')}</span>
                <span className={HOURS}>{t(STATUS_LABEL.hadir)}</span>
                <span className={HOURS}>{t(STATUS_LABEL.izin)}</span>
                <span className={HOURS}>{t(STATUS_LABEL.sakit)}</span>
                <span className={HOURS}>{t(STATUS_LABEL.alpha)}</span>
                <span className={HOURS}>{t('attendance.colTotalHours')}</span>
              </div>
              {recap.map((r) => (
                <div key={r.employeeId} className={`${RECAP_GRID} ${BODY_ROW}`}>
                  <span className={NAME}>{r.employeeName}</span>
                  {/* Hari hadir yang jam keluarnya tak pernah tercatat terhitung
                      0 jam. Tanpa penanda ini, kekurangan upah hanya ketahuan
                      bila barisnya diperiksa satu per satu. */}
                  <span className={HOURS}>
                    {r.days}
                    {r.openShifts > 0 && (
                      <small className="block text-xs leading-tight font-medium whitespace-nowrap text-warning-foreground" title={t('attendance.openShiftTitle')}>
                        {interpolate(t('attendance.openShifts'), { n: String(r.openShifts) })}
                      </small>
                    )}
                  </span>
                  {/* Nol ditulis samar, bukan nol tebal: yang perlu terbaca sekilas
                      adalah kolom yang BERISI. */}
                  <span className={cn(HOURS, !r.izin && MUTED)}>{r.izin}</span>
                  <span className={cn(HOURS, !r.sakit && MUTED)}>{r.sakit}</span>
                  <span className={cn(HOURS, !r.alpha && MUTED)}>{r.alpha}</span>
                  <span className={HOURS}>{interpolate(t('attendance.hours'), { hours: String(r.totalHours) })}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel>
        <PanelHead
          icon={<History aria-hidden />}
          title={t('attendance.historyTitle')}
          action={
            <span className="flex flex-wrap items-center justify-end gap-3">
              {owner && historyPeople.length > 1 && (
                <SelectBox
                  size="sm"
                  className="w-auto max-w-60"
                  value={activeHistoryEmp}
                  onValueChange={setHistoryEmp}
                  aria-label={t('attendance.historyFilter')}
                  options={[
                    { value: 'all', label: interpolate(t('attendance.allEmployees'), { n: String(recentByDay.length) }) },
                    ...historyPeople.map(([id, person]) => ({ value: id, label: `${person.name} (${person.count})` })),
                  ]}
                />
              )}
              <span className={PERIOD_TAG}>{periodLabel}</span>
            </span>
          }
        />
        {loadPending(periodLoad) ? (
          <LoadState queries={[periodLoad]} />
        ) : historyRows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays aria-hidden />}
            title={historyEmpName ? interpolate(t('attendance.historyEmptyFor'), { name: historyEmpName }) : t('attendance.historyEmpty')}
          />
        ) : (
          <div className="font-mono">
            <div className={`${owner ? LEDGER_GRID_OWNER : LEDGER_GRID} ${HEAD} ${LEDGER_HEAD_STACK}`}>
              <span>{t('common.date')}</span>
              <span>{t('attendance.colEmployee')}</span>
              <span>{t('attendance.colIn')}</span>
              <span>{t('attendance.colOut')}</span>
              <span>{t('common.status')}</span>
              <span className={HOURS}>{t('common.total')}</span>
              {owner && <span className={ACTIONS}>{t('common.actions')}</span>}
            </div>
            {historyRows.map((a) => (
              <div key={a.id} className={`${owner ? LEDGER_GRID_OWNER : LEDGER_GRID} ${BODY_ROW}`}>
                <span className={PUNCH}>{fmtDate(a.date)}</span>
                <span className={NAME}>
                  {a.employeeName}
                  {/* Catatan dulu bisa diisi tapi tidak pernah tampil di mana pun —
                      alasan sebuah koreksi hilang begitu modal ditutup. Dipotong
                      supaya baris tetap satu tinggi; teks penuhnya ada di jendela koreksi. */}
                  {a.note && <small className={ROW_NOTE}>{a.note}</small>}
                  {/* Bukti lokasi (0076). Hanya pemilik yang melihatnya, dan hanya
                      bila perangkat memang mengirimkannya. */}
                  {owner && a.checkInLat != null && a.checkInLng != null && (
                    <a
                      className={`${ROW_NOTE} rounded-sm underline decoration-dotted underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring`}
                      href={`https://www.google.com/maps?q=${a.checkInLat},${a.checkInLng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('attendance.checkInLocation')}
                    </a>
                  )}
                </span>
                <span className={PUNCH}>{a.checkIn ?? <EmptyValue />}</span>
                <span className={PUNCH}>
                  {a.checkOut ?? (
                    <span className={MUTED}>
                      <EmptyValue />
                    </span>
                  )}
                </span>
                <span>
                  <StatusTag status={a.status} />
                </span>
                {/* Jam hanya dihitung untuk hari yang benar-benar dikerjakan. Baris
                    izin bisa saja masih membawa jam sisa dari check-in pagi;
                    menampilkannya membuat baris berkata "8.75 jam" sementara rekap
                    di atas berkata 0 — dua angka bertentangan tentang upah yang sama. */}
                <span className={HOURS}>
                  {isWorkedDay(a) && a.checkOut ? (
                    interpolate(t('attendance.hours'), { hours: String(a.totalHours) })
                  ) : (
                    <span className={MUTED}>
                      <EmptyValue />
                    </span>
                  )}
                </span>
                {owner && (
                  <span className={ACTIONS}>
                    <Button variant="outline" size="icon" onClick={() => openEdit(a)} aria-label={t('attendance.editRow')}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => setToDelete(a)}
                      aria-label={t('attendance.deleteRow')}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <FormDialog
        open={editRow !== null || creating}
        onClose={closeModal}
        title={creating ? t('attendance.createTitle') : interpolate(t('attendance.editTitle'), { name: editRow?.employeeName ?? '' })}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="attendance-edit" disabled={editBusy} aria-busy={editBusy || undefined}>
              {editBusy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          id="attendance-edit"
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          {creating && (
            <>
              <Field label={t('attendance.colEmployee')}>
                <SelectBox
                  value={editEmp}
                  onValueChange={setEditEmp}
                  placeholder={t('attendance.pickEmployeePh')}
                  options={employees.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name }))}
                  data-autofocus
                />
              </Field>
              <Field label={t('common.date')}>
                <Input type="date" max={today} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="font-mono" />
              </Field>
              {outlets.length > 1 && (
                <Field label={t('attendance.branch')} hint={t('attendance.branchHint')}>
                  <SelectBox value={editOutlet} onValueChange={setEditOutlet} options={outlets.map((o) => ({ value: o.id, label: o.name }))} />
                </Field>
              )}
            </>
          )}
          {/* type="time" — pemilih jam bawaan browser. Sebelumnya ini teks bebas:
              "8" tersimpan apa adanya, calcHours mengembalikan 0, dan sehari upah
              hilang di balik toast hijau "Absensi diperbarui". */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('attendance.timeIn')}>
              <Input type="time" value={editIn} onChange={(e) => setEditIn(e.target.value)} className="font-mono" data-autofocus={!creating || undefined} />
            </Field>
            <Field
              label={t('attendance.timeOut')}
              hint={editHours !== null ? interpolate(t('attendance.hours'), { hours: String(editHours) }) : undefined}
              error={
                editHours !== null && editHours > IMPLAUSIBLE_HOURS
                  ? interpolate(t('attendance.hoursSwapped'), { hours: String(editHours) })
                  : undefined
              }
            >
              <Input type="time" value={editOut} onChange={(e) => setEditOut(e.target.value)} className="font-mono" />
            </Field>
          </div>
          <Field label={t('common.status')}>
            <SelectBox
              value={editStatus}
              onValueChange={setEditStatus}
              options={[
                { value: 'hadir', label: t(STATUS_LABEL.hadir) },
                { value: 'izin', label: t(STATUS_LABEL.izin) },
                { value: 'sakit', label: t(STATUS_LABEL.sakit) },
                { value: 'alpha', label: t(STATUS_LABEL.alpha) },
              ]}
            />
          </Field>
          <Field label={t('attendance.note')}>
            <TextInput placeholder={t('attendance.optional')} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </Field>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={!!toDelete}
        title={t('attendance.deleteTitle')}
        message={interpolate(t('attendance.deleteMessage'), {
          name: toDelete?.employeeName ?? '',
          date: toDelete ? fmtDate(toDelete.date) : '',
        })}
        confirmLabel={t('common.delete')}
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/* ---------- Kelas bersama ----------
   Ambang membaca wadah `absen`, bukan viewport: zoom aplikasi dan sidebar
   mengubah ruang konten tanpa menggeser media query. */
const ROW = 'border-b border-dashed border-border px-5 last:border-b-0 hover:bg-accent/40';
const DATE_INPUT = 'h-9 w-auto rounded-full px-3 font-mono text-[13px] pointer-coarse:h-11 @max-[400px]/absen:min-w-0 @max-[400px]/absen:flex-1';
const CLOCK_STATUS = 'mt-0.5 inline-flex items-center gap-2 font-mono text-xs tabular-nums text-primary-foreground/80';
/* Periode aktif, diulang di kepala tiap kartu yang dikendalikannya — supaya
   angka yang dibaca tidak pernah terlepas dari rentang yang menghasilkannya. */
const PERIOD_TAG = 'font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground';
const HEAD = 'border-b border-border bg-surface px-5 py-2.5 font-sans text-xs font-medium text-muted-foreground';
const BODY_ROW = `py-[11px] text-sm ${ROW}`;
const NAME = 'flex min-w-0 flex-col gap-0.5 font-sans';
const ROW_NOTE = 'truncate text-xs text-muted-foreground';
const PUNCH = 'tabular-nums text-muted-foreground';
const HOURS = 'text-right font-semibold whitespace-nowrap tabular-nums text-foreground';
const MUTED = 'text-muted-foreground font-normal';
// Saat riwayat bertumpuk, aksi pindah ke kolom kanan di baris terakhir.
const ACTIONS = 'flex items-center justify-end gap-2 @max-[716px]/absen:col-start-2';

/* Rekap: Karyawan · Hadir · Izin · Sakit · Alpha · Total Jam. Di wadah sempit
   nama mengambil baris penuh, lalu empat hitungan + total mengalir di bawahnya.
   Kepala rekap TETAP tampil (tidak seperti riwayat): "2" tanpa label tidak
   berarti apa-apa. Ambang dari lebar terukur (23 Nov 2026): enam kolom muat di
   490px dengan nama berkata panjang ("Wijayakusumaningrat") dan "199.75 jam". */
const RECAP_GRID = [
  'grid grid-cols-[2fr_0.6fr_0.6fr_0.6fr_0.6fr_1fr] items-center gap-3',
  '@max-[491px]/absen:grid-cols-5 @max-[491px]/absen:gap-y-0.5 @max-[491px]/absen:[&>*]:text-center',
  '@max-[491px]/absen:[&>:first-child]:col-span-full @max-[491px]/absen:[&>:first-child]:text-left',
].join(' ');
/* Riwayat: Tanggal · Karyawan · Masuk · Keluar · Status · Total (+ Aksi untuk
   pemilik). Di wadah sempit jadi dua kolom bertumpuk dan kepalanya hilang: jam
   dan status sudah menjelaskan dirinya sendiri. Tujuh kolom butuh 715px untuk
   kasus yang sama (kolom nama hanya mendapat 1,6/6,9 bagian ruang). FixMaster
   memakai @media 768px untuk keduanya, sehingga di 1025px, saat sidebar muncul
   dan wadahnya tinggal ±665px, tujuh kolom justru tampil sesak. */
const LEDGER_STACK = '@max-[716px]/absen:grid-cols-2 @max-[716px]/absen:gap-y-1 @max-[716px]/absen:[&>.text-right]:text-left';
const LEDGER_GRID = `grid grid-cols-[1.2fr_1.6fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-3 ${LEDGER_STACK}`;
const LEDGER_GRID_OWNER = `grid grid-cols-[1.2fr_1.6fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr] items-center gap-3 ${LEDGER_STACK}`;
const LEDGER_HEAD_STACK = '@max-[716px]/absen:hidden';

const STATUS_TAG: Record<Attendance['status'], 'info' | 'warning' | 'destructive-soft' | null> = {
  // Hadir sengaja paling sunyi: yang perlu menarik mata saat pemilik memindai
  // tabel adalah baris yang TIDAK normal.
  hadir: null,
  izin: 'info',
  sakit: 'warning',
  alpha: 'destructive-soft',
};

function StatusTag({ status }: { status: Attendance['status'] }) {
  const t = useT();
  const variant = STATUS_TAG[status];
  if (!variant) return <span className="font-sans text-xs font-semibold text-muted-foreground">{t(STATUS_LABEL[status])}</span>;
  return (
    <Badge variant={variant} className="font-sans">
      {t(STATUS_LABEL[status])}
    </Badge>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">{children}</div>;
}

function PanelHead({ icon, title, action }: { icon: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}
        <span className="min-w-0">{title}</span>
      </h2>
      {action}
    </div>
  );
}
