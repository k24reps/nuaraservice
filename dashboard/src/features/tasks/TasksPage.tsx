import { EmptyValue } from '@/components/ui/EmptyValue';
import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  CircleCheck,
  ListChecks,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  User,
} from 'lucide-react';
import { LoadState, loadPending } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { TextInput } from '@/components/dens/text-input';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { repository } from '@/data';
import { newId } from '@/lib/id';
import { localDateStr, fmtDate } from '@/lib/time';
import {
  generateInstances,
  instanceKey,
  describeRecurrence,
  isOverdue,
  reorder,
  bySortOrder,
  templateItems,
  visibleInstances,
} from '@/lib/business/tasks';
import { roleAllows } from '@/config/plans';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { useSessionStore } from '@/stores/session';
import { TaskTemplateModal } from './TaskTemplateModal';
import type { TaskTemplate, TaskInstance } from '@/data/types';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', karyawan: 'Karyawan',
};

export function TasksPage() {
  const { data: templates, ...templatesLoad } = useCollection('taskTemplates');
  const { data: instances, ...instancesLoad } = useCollection('taskInstances');
  const { data: employees } = useCollection('employees');
  const { data: outlets } = useCollection('outlets');
  const org = useSessionStore((s) => s.org);
  const me = useSessionStore((s) => s.currentEmployee);
  const allowedOutletIds = useSessionStore((s) => s.allowedOutletIds);
  const orgId = org?.id ?? '';
  const canManage = me ? roleAllows(me.role, '*') || me.role === 'admin' : false;

  const [tab, setTab] = useState<'today' | 'templates'>('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [toDelete, setToDelete] = useState<TaskTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  const today = localDateStr();
  // Templates render in manual SOP order — this is what seeds each new day.
  const orderedTemplates = useMemo(() => [...templates].sort(bySortOrder), [templates]);
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  // Kunci instance yang sudah dikirim dari halaman ini. Efek di bawah berjalan
  // ulang setiap `instances` berubah; sebelum tulisan pertama kembali, daftar
  // masih lama sehingga instance yang sama dibuat lagi (demo: 3 → 13 baris,
  // "Buka toko" tiga kali). Cloud menolaknya lewat indeks unik 0041, lokal tidak.
  const writtenKeys = useRef(new Set<string>());

  // Auto-generate due instances for a rolling window [today-7, today+1].
  useEffect(() => {
    if (!orgId || templates.length === 0) return;
    // Daftar belum dimuat = semua tampak "hilang"; jangan membuat apa pun.
    if (instancesLoad.loading) return;
    // 30 hari ke belakang: dengan 7 hari, toko yang tutup seminggu lebih (atau
    // tugas bulanan yang tanggalnya sudah lewat) kehilangan tugasnya permanen.
    const from = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return localDateStr(d);
    })();
    const to = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return localDateStr(d);
    })();
    const missing = generateInstances(templates, instances, from, to, orgId).filter((i) => {
      const key = instanceKey(i.templateId, i.itemId, i.dueDate);
      if (writtenKeys.current.has(key)) return false;
      writtenKeys.current.add(key);
      return true;
    });
    if (missing.length) {
      // Kegagalan di sini dulu ditelan diam-diam: karyawan yang ditolak aturan
      // cabang tidak pernah melihat tugasnya, tanpa satu pun pesan.
      void repository.putMany('taskInstances', missing).catch((e: unknown) => {
        toast.error(
          e instanceof Error
            ? `Tugas hari ini gagal disiapkan: ${e.message}`
            : 'Tugas hari ini gagal disiapkan',
        );
      });
    }
  }, [templates, instances, orgId, instancesLoad.loading]);

  // Manual order only (user choice (a)): ↑↓ must behave predictably across the
  // WHOLE list, so overdue items no longer jump the queue by date — their
  // urgency is carried by the red "Telat" badge + highlighted row instead.
  /** Every pending task due today or earlier (overdue carries a red badge). */
  const pending = useMemo(
    () =>
      // "Tugaskan Ke" sekarang benar-benar menyaring: karyawan hanya melihat
      // tugas yang ditujukan kepadanya. Manager tetap melihat semuanya.
      visibleInstances(
        instances.filter((i) => i.dueDate <= today && i.status === 'pending'),
        templateById,
        { id: me?.id ?? '', role: me?.role ?? 'karyawan' },
        allowedOutletIds,
        canManage,
      ),
    [instances, today, templateById, me, allowedOutletIds, canManage],
  );

  /**
   * Template groups, in template order. Items INSIDE a group follow the
   * template's current item order — read live, so reordering in the Template
   * tab shows up here instantly with no propagation write.
   */
  const groups = useMemo(
    () =>
      orderedTemplates
        .map((tpl) => {
          const order = new Map(templateItems(tpl).map((it, idx) => [it.id, idx]));
          const tasks = pending
            .filter((i) => i.templateId === tpl.id)
            .sort((a, b) => (order.get(a.itemId ?? '') ?? 0) - (order.get(b.itemId ?? '') ?? 0));
          return { tpl, tasks };
        })
        .filter((g) => g.tasks.length > 0),
    [orderedTemplates, pending],
  );

  /** Ad-hoc quick tasks — their own zone below the groups, own ordering. */
  // Termasuk tugas yang templatenya sudah hilang: tanpa ini baris itu tak muncul
  // di grup mana pun, tapi tetap terhitung di badge — tugas hantu.
  const adhocTasks = useMemo(
    () =>
      pending
        .filter((i) => !i.templateId || !templateById.has(i.templateId))
        .sort(bySortOrder),
    [pending, templateById],
  );
  const todayTasks = pending;
  const doneToday = useMemo(
    () => instances.filter((i) => i.status === 'done' && i.dueDate === today),
    [instances, today],
  );

  const complete = async (inst: TaskInstance) => {
    try {
      await repository.put('taskInstances', {
        ...inst,
        status: 'done',
        completedAt: new Date().toISOString(),
        completedById: me?.id ?? '',
        completedByName: me?.name ?? '',
      });
      logActivity({
        action: 'task.complete',
        entityType: 'task',
        entityId: inst.id,
        entityLabel: inst.title,
      });
      toast.success('Tugas selesai');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menandai tugas selesai');
    }
  };

  const uncomplete = async (inst: TaskInstance) => {
    // Membatalkan centang orang lain menghapus catatan siapa yang mengerjakan.
    // Manager boleh (merekalah yang mengoreksi); selain itu hanya orang yang
    // mencentangnya sendiri.
    if (!canManage && inst.completedById && inst.completedById !== me?.id) {
      toast.warning(
        `Tugas ini diselesaikan ${inst.completedByName || 'orang lain'}. Minta manager untuk membatalkannya.`,
      );
      return;
    }
    try {
      await repository.put('taskInstances', {
        ...inst,
        status: 'pending',
        completedAt: null,
        completedById: null,
        completedByName: '',
      });
      // Dulu tidak tercatat sama sekali: tugas bisa "selesai" lalu dibatalkan
      // tanpa jejak siapa pun.
      logActivity({
        action: 'task.uncomplete',
        entityType: 'task',
        entityId: inst.id,
        entityLabel: inst.title,
        meta: { sebelumnyaOleh: inst.completedByName },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membatalkan tanda selesai');
    }
  };

  const addQuickTask = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    try {
      // Ad-hoc "quick task" for today: a TaskInstance with no template
      // (templateId null), so it never collides with template generation and
      // is a valid NULL UUID in cloud Postgres (empty string '' would throw).
      await repository.put('taskInstances', {
        id: newId(),
        orgId,
        outletId: null,
        templateId: null,
        itemId: null,
        title,
        description: '',
        dueDate: today,
        status: 'pending',
        completedAt: null,
        completedById: null,
        completedByName: '',
        note: '',
        // Land at the bottom of today's list, not in the middle of the SOP.
        sortOrder: todayTasks.length
          ? Math.max(...todayTasks.map((t) => t.sortOrder ?? 0)) + 1
          : 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      setQuickTitle('');
      logActivity({
        action: 'task.create',
        entityType: 'task',
        entityLabel: title,
      });
      toast.success('Tugas cepat ditambahkan');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah tugas');
    }
  };

  /** Persist a ↑↓ move. `reorder` returns only the rows that actually changed. */
  const move = async (
    collection: 'taskInstances' | 'taskTemplates',
    list: (TaskInstance | TaskTemplate)[],
    index: number,
    dir: -1 | 1,
  ) => {
    const changed = reorder(list, index, dir);
    if (!changed.length) return;
    try {
      await repository.putMany(collection as 'taskInstances', changed as TaskInstance[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah urutan');
    }
  };

  /** Move a template group. Index is resolved against the FULL ordered list —
   *  groups with no pending task are hidden, so group index != template index. */
  const moveTemplate = (tpl: TaskTemplate, dir: -1 | 1) => {
    const idx = orderedTemplates.findIndex((x) => x.id === tpl.id);
    return move('taskTemplates', orderedTemplates, idx, dir);
  };

  // Ad-hoc tasks have no managing template, so allow direct removal.
  const deleteAdhoc = async (inst: TaskInstance) => {
    try {
      await repository.remove('taskInstances', inst.id);
      toast.success('Tugas dihapus');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus tugas');
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await repository.remove('taskTemplates', toDelete.id);
      // Tugas yang belum selesai dari template ini ikut dihapus. Tanpa itu baris
      // tersebut kehilangan induknya: tak tampil di daftar, tapi tetap dihitung.
      const orphans = instances.filter(
        (i) => i.templateId === toDelete.id && i.status === 'pending',
      );
      // Berbarengan: jendela pembuatan 30 hari bisa meninggalkan ratusan baris,
      // dan satu-per-satu berarti ratusan round-trip + ratusan refetch.
      await Promise.all(orphans.map((o) => repository.remove('taskInstances', o.id)));
      toast.success('Template dihapus');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus template');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const assigneeLabel = (t: TaskTemplate): string => {
    if (t.assigneeType === 'employee') {
      return employees.find((e) => e.id === t.assigneeEmployeeId)?.name ?? 'Karyawan';
    }
    if (t.assigneeType === 'outlet') {
      return outlets.find((o) => o.id === t.assigneeOutletId)?.name ?? 'Outlet';
    }
    return ROLE_LABEL[t.assigneeRole ?? 'karyawan'];
  };

  return (
    <div data-nu className="@container/tugas flex flex-col gap-4 bg-transparent">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={CHIP} aria-pressed={tab === 'today'} onClick={() => setTab('today')}>
          Tugas Hari Ini
          {/* Nada sama dengan rail (useNavSignals): merah hanya bila ada yang
              telat; tugas yang jatuh tempo hari ini cukup peringatan. */}
          {todayTasks.length > 0 && (
            <Badge variant={todayTasks.some((i) => isOverdue(i, today)) ? 'destructive-soft' : 'warning'} className="px-2">
              {todayTasks.length}
            </Badge>
          )}
        </button>
        {canManage && (
          <button type="button" className={CHIP} aria-pressed={tab === 'templates'} onClick={() => setTab('templates')}>
            Template ({templates.length})
          </button>
        )}
        {canManage && tab === 'templates' && (
          <Button
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus aria-hidden />
            Template Baru
          </Button>
        )}
      </div>

      {tab === 'today' ? (
        <>
          <div className="flex items-center gap-2">
            {/* Pembungkus: dengan ikon `start`, kelas TextInput jatuh ke <input>-nya, bukan ke kotak luarnya. */}
            <div className="min-w-0 flex-1">
              <TextInput
                placeholder="Tugas cepat hari ini… (mis. telepon supplier)"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addQuickTask()}
                start={<ListChecks aria-hidden />}
                aria-label="Tugas cepat hari ini"
              />
            </div>
            <Button onClick={addQuickTask} disabled={!quickTitle.trim()}>
              <Plus aria-hidden />
              Tambah
            </Button>
          </div>
          <Panel>
            <PanelHead icon={<ListChecks aria-hidden />} title="Perlu Dikerjakan" />
            {loadPending(templatesLoad, instancesLoad) ? (
              <LoadState queries={[templatesLoad, instancesLoad]} />
            ) : todayTasks.length === 0 ? (
              <EmptyState
                icon={<CircleCheck aria-hidden />}
                title="Semua tugas selesai"
                description={templates.length === 0 ? 'Belum ada template tugas.' : 'Kerja bagus! Tidak ada tugas tertunda.'}
              />
            ) : (
              <div>
                {/* Template groups first: one header per template, its items
                    below. Items are read-only here — a template's contents are
                    managed in the Template tab (reorder/delete live only there). */}
                {groups.map(({ tpl, tasks }, gi) => (
                  <section key={tpl.id} className={GROUP}>
                    <header className={GROUP_HEAD}>
                      <Repeat aria-hidden />
                      <strong className="text-sm font-semibold">{tpl.name || tpl.title}</strong>
                      <span className={GROUP_COUNT}>{tasks.length} tugas</span>
                      {canManage && (
                        // Satu pembungkus untuk KETIGA tombol, supaya saat kepala grup
                        // patah baris di layar sempit, pensil tidak terpisah sendiri ke
                        // baris baru dari pasangan naik/turun.
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <OrderButtons
                            onUp={() => moveTemplate(tpl, -1)}
                            onDown={() => moveTemplate(tpl, 1)}
                            upDisabled={gi === 0}
                            downDisabled={gi === groups.length - 1}
                            upLabel="Naikkan urutan template"
                            downLabel="Turunkan urutan template"
                            upTitle="Naikkan template"
                            downTitle="Turunkan template"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(tpl);
                              setModalOpen(true);
                            }}
                            aria-label="Ubah template"
                            title="Atur isi & urutan tugas template"
                          >
                            <Pencil aria-hidden />
                          </Button>
                        </span>
                      )}
                    </header>
                    <ul>
                      {tasks.map((t) => (
                        <TaskRow key={t.id} task={t} overdue={isOverdue(t, today)} onComplete={() => complete(t)} />
                      ))}
                    </ul>
                  </section>
                ))}

                {/* Ad-hoc quick tasks: their own zone below the groups. */}
                {adhocTasks.length > 0 && (
                  <section className={GROUP}>
                    <header className={GROUP_HEAD}>
                      <ListChecks aria-hidden />
                      <strong className="text-sm font-semibold">Tugas Lain</strong>
                      <span className={GROUP_COUNT}>{adhocTasks.length} tugas</span>
                    </header>
                    <ul>
                      {adhocTasks.map((t, i) => (
                        <TaskRow key={t.id} task={t} overdue={isOverdue(t, today)} onComplete={() => complete(t)}>
                          {canManage && (
                            <>
                              <OrderButtons
                                onUp={() => move('taskInstances', adhocTasks, i, -1)}
                                onDown={() => move('taskInstances', adhocTasks, i, 1)}
                                upDisabled={i === 0}
                                downDisabled={i === adhocTasks.length - 1}
                                upLabel="Naikkan urutan"
                                downLabel="Turunkan urutan"
                                upTitle="Naikkan"
                                downTitle="Turunkan"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className={DANGER_HOVER}
                                onClick={() => deleteAdhoc(t)}
                                aria-label="Hapus tugas cepat"
                                title="Hapus tugas cepat"
                              >
                                <Trash2 aria-hidden />
                              </Button>
                            </>
                          )}
                        </TaskRow>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </Panel>

          {doneToday.length > 0 && (
            <Panel>
              <PanelHead icon={<CheckCheck aria-hidden />} title={`Selesai Hari Ini (${doneToday.length})`} />
              <ul>
                {doneToday.map((t) => (
                  <li key={t.id} className={TASK_ROW}>
                    {/* Selesai dibaca dari coretan, warna redup, dan kotak tercentang,
                        bukan opacity seluruh baris: 0.65 menurunkan teks redupnya ke 3,3:1. */}
                    <button type="button" className={cn(CHECK, CHECKED)} onClick={() => uncomplete(t)} aria-label="Batalkan">
                      <Check aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm font-semibold text-muted-foreground line-through">{t.title}</strong>
                      <small className="block text-xs text-muted-foreground">oleh {t.completedByName || <EmptyValue />}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          {loadPending(templatesLoad) ? (
            <LoadState queries={[templatesLoad]} />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={<ListChecks aria-hidden />}
              title="Belum ada template tugas"
              description="Buat template SOP berulang untuk tim Anda."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus aria-hidden />
                  Template Baru
                </Button>
              }
            />
          ) : (
            <ul>
              {orderedTemplates.map((t, i) => (
                <li key={t.id} className={`flex flex-wrap items-center gap-3 py-3.5 ${ROW}`}>
                  {/* Empat tombol aksi makan 172px; di wadah <400px kolom info tinggal
                      di bawah 160px (chip terpanjang) dan chip meluber, jadi aksi turun
                      ke baris kedua. */}
                  <div className="min-w-0 flex-1 @max-[400px]/tugas:basis-full">
                    <strong className="block text-sm font-semibold">{t.name || t.title}</strong>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <span className={META_CHIP}>
                        <ListChecks aria-hidden />
                        {t.items?.length ?? 0} tugas
                      </span>
                      <span className={META_CHIP}>
                        <Repeat aria-hidden />
                        {describeRecurrence(t)}
                      </span>
                      <span className={META_CHIP}>
                        <User aria-hidden />
                        {assigneeLabel(t)}
                      </span>
                    </div>
                    {/* Preview the contents so the tab is scannable without
                        opening each template. */}
                    {(t.items?.length ?? 0) > 0 && (
                      <small className="mt-1 block truncate text-xs text-muted-foreground">
                        {templateItems(t)
                          .map((it) => it.title)
                          .join(' · ')}
                      </small>
                    )}
                  </div>
                  {!t.active && <Badge variant="secondary">Nonaktif</Badge>}
                  <div className="ml-auto flex shrink-0 gap-1">
                    {/* SOP order — seeds every new day's task list. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move('taskTemplates', orderedTemplates, i, -1)}
                      disabled={i === 0}
                      aria-label="Naikkan urutan template"
                      title="Naikkan (urutan default tiap hari)"
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move('taskTemplates', orderedTemplates, i, 1)}
                      disabled={i === orderedTemplates.length - 1}
                      aria-label="Turunkan urutan template"
                      title="Turunkan (urutan default tiap hari)"
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                      aria-label="Ubah"
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" className={DANGER_HOVER} onClick={() => setToDelete(t)} aria-label="Hapus">
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <TaskTemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        employees={employees}
        outlets={outlets}
        nextSortOrder={orderedTemplates.length}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Hapus Template?"
        message={`Template "${toDelete?.name || toDelete?.title}" beserta ${toDelete?.items?.length ?? 0} tugas di dalamnya akan dihapus. Tugas hari ini yang belum selesai ikut dihapus; yang sudah selesai tetap tersimpan sebagai riwayat. Untuk menghentikan sementara, ubah statusnya jadi Nonaktif.`}
        confirmLabel="Hapus"
        danger
        loading={deleting}
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const CHIP =
  'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-card px-3.5 text-[13px] font-semibold text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:min-h-11';
const ROW = 'border-b border-dashed border-border px-5 last:border-b-0 hover:bg-accent/40';
const TASK_ROW = `flex items-center gap-3 py-3.5 ${ROW}`;
const GROUP = 'border-t border-border first:border-t-0';
/* Kepala grup = nama template. Boleh patah baris di layar sempit; tombolnya satu
   pembungkus sehingga tetap berkelompok. */
const GROUP_HEAD = 'flex flex-wrap items-center gap-2 bg-surface px-5 py-3 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground';
const GROUP_COUNT = 'mr-auto text-xs tabular-nums text-muted-foreground';
const META_CHIP =
  'inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground [&>svg]:size-3.5 [&>svg]:text-muted-foreground';
const DANGER_HOVER = 'hover:bg-destructive-soft hover:text-destructive';
/* Kotak tanda selesai: 26px, area ketuknya diperluas ke 44px lewat ::after di
   layar sentuh supaya baris tidak ikut meninggi. ::after diukur dari dalam garis
   tepi 2px (22px), jadi perluasannya 11px, bukan 9px. */
const CHECK =
  'relative grid size-[26px] shrink-0 place-items-center rounded-md border-2 border-input bg-card text-primary-foreground outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 pointer-coarse:after:absolute pointer-coarse:after:-inset-[11px]';
const CHECKED = 'border-success-foreground bg-success-foreground hover:border-success-foreground';

/** Satu tugas: kotak selesai, judul + keterangan, tanggal jatuh tempo, lalu aksi opsional. */
function TaskRow({
  task,
  overdue,
  onComplete,
  children,
}: {
  task: TaskInstance;
  overdue: boolean;
  onComplete: () => void;
  children?: ReactNode;
}) {
  return (
    <li className={TASK_ROW}>
      <button type="button" className={CHECK} onClick={onComplete} aria-label="Tandai selesai" />
      <div className="min-w-0 flex-1">
        <strong className="block text-sm font-semibold">{task.title}</strong>
        {task.description && <small className="block text-xs text-muted-foreground">{task.description}</small>}
      </div>
      {overdue ? (
        <Badge variant="destructive-soft" className="font-mono">
          <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
          Telat · {fmtDate(task.dueDate)}
        </Badge>
      ) : (
        <Badge variant="secondary" className="font-mono">
          {fmtDate(task.dueDate)}
        </Badge>
      )}
      {children}
    </li>
  );
}

/** Pasangan naik/turun yang rapat, supaya terbaca sebagai SATU kontrol. */
function OrderButtons({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  upLabel,
  downLabel,
  upTitle,
  downTitle,
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
  upLabel: string;
  downLabel: string;
  upTitle: string;
  downTitle: string;
}) {
  const narrow = 'w-[26px] pointer-coarse:w-11';
  return (
    <span className="inline-flex shrink-0">
      <Button variant="ghost" size="icon" className={narrow} onClick={onUp} disabled={upDisabled} aria-label={upLabel} title={upTitle}>
        <ArrowUp aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" className={narrow} onClick={onDown} disabled={downDisabled} aria-label={downLabel} title={downTitle}>
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">{children}</div>;
}

function PanelHead({ icon, title }: { icon: ReactNode; title: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-3">
      <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}
        <span className="min-w-0">{title}</span>
      </h2>
    </div>
  );
}
