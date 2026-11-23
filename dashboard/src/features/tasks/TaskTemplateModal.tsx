import { useState } from 'react';
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { Textarea } from '@/components/dens/textarea';
import { useFormFault } from '@/hooks/useFormFault';
import { repository } from '@/data';
import { newId } from '@/lib/id';
import { capitalizeLines } from '@/lib/text';
import { localDateStr } from '@/lib/time';
import { reorder, templateItems } from '@/lib/business/tasks';
import { toast } from '@/stores/toast';
import { useSessionStore } from '@/stores/session';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import type {
  TaskTemplate,
  TaskTemplateItem,
  RecurrenceType,
  AssigneeType,
  Role,
  Employee,
  Outlet,
} from '@/data/types';

interface TaskTemplateModalProps {
  open: boolean;
  onClose: () => void;
  editing: TaskTemplate | null;
  employees: Employee[];
  outlets: Outlet[];
  /** Manual SOP order for a NEW template (= current template count). */
  nextSortOrder: number;
}

const WEEKDAYS = [
  { d: 1, label: 'Sen' },
  { d: 2, label: 'Sel' },
  { d: 3, label: 'Rab' },
  { d: 4, label: 'Kam' },
  { d: 5, label: 'Jum' },
  { d: 6, label: 'Sab' },
  { d: 0, label: 'Min' },
];

/**
 * Create/edit one task TEMPLATE — a named group (e.g. "SOP Buka Toko") that
 * holds many task items sharing one schedule + assignee (migration 0041).
 * The item list here is the ONLY place a template's contents can be reordered
 * or removed; the daily tab just renders them.
 */
export function TaskTemplateModal({
  open,
  onClose,
  editing,
  employees,
  outlets,
  nextSortOrder,
}: TaskTemplateModalProps) {
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const [name, setName] = useState('');
  const [items, setItems] = useState<TaskTemplateItem[]>([]);
  /** New template only: one item per line, entered in bulk. */
  const [bulkTitles, setBulkTitles] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState<string>('1');
  const [onceDate, setOnceDate] = useState(localDateStr());
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('role');
  const [assigneeRole, setAssigneeRole] = useState<Role>('karyawan');
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState('');
  const [assigneeOutletId, setAssigneeOutletId] = useState('');
  // Nonaktif & tanggal berakhir sudah lama ada di data (dan badge "Nonaktif"
  // ikut ditampilkan), tapi tak ada satu pun kendali untuk mengubahnya — jadi
  // satu-satunya cara menghentikan template adalah menghapusnya.
  const [active, setActive] = useState(true);
  const [endDate, setEndDate] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'name' | 'items' | 'monthDays'>();
  const [busy, setBusy] = useState(false);

  useResetOnOpen(open, editing?.id ?? 'new', () => {
    setName(editing?.name ?? '');
    setItems(editing ? templateItems(editing) : []);
    setBulkTitles('');
    setDescription(editing?.description ?? '');
    setRecurrence(editing?.recurrence ?? 'daily');
    setWeekdays(editing?.weekdays ?? [1]);
    setMonthDays(editing?.monthDays?.join(', ') ?? '1');
    setOnceDate(editing?.onceDate ?? localDateStr());
    setAssigneeType(editing?.assigneeType ?? 'role');
    setAssigneeRole(editing?.assigneeRole ?? 'karyawan');
    setAssigneeEmployeeId(editing?.assigneeEmployeeId ?? '');
    setAssigneeOutletId(editing?.assigneeOutletId ?? '');
    setActive(editing?.active ?? true);
    setEndDate(editing?.endDate ?? '');
    setError('');
  });

  const toggleWeekday = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  // NEW template: each line becomes an ITEM inside this one template.
  // (Pre-0041 each line became a separate template.)
  const parsedBulk = bulkTitles
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  // ---- item editing (edit mode) ----
  const setItemTitle = (id: string, v: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, title: v } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));
  const addItem = () =>
    setItems((prev) => [...prev, { id: newId(), title: '', description: '', sortOrder: prev.length }]);
  /** Reuse the shared pure helper so items order exactly like every other list. */
  const moveItem = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const changed = reorder(prev, index, dir);
      if (!changed.length) return prev;
      const byId = new Map(changed.map((c) => [c.id, c]));
      return prev.map((it) => byId.get(it.id) ?? it).sort((a, b) => a.sortOrder - b.sortOrder);
    });

  const save = async () => {
    if (!name.trim()) return fail('name', 'Nama template wajib diisi');

    // Resolve the final item list: edit mode uses the editor, create mode the
    // bulk textarea. Blank titles are dropped so an empty row can't sneak in.
    const finalItems: TaskTemplateItem[] = editing
      ? items
          .filter((it) => it.title.trim())
          .map((it, idx) => ({ ...it, title: it.title.trim(), sortOrder: idx }))
      : parsedBulk.map((t, idx) => ({ id: newId(), title: t, description: '', sortOrder: idx }));

    if (finalItems.length === 0) return fail('items', 'Isi minimal satu tugas di dalam template');
    if (recurrence === 'weekly' && weekdays.length === 0) return setError('Pilih minimal satu hari');

    const parsedMonthDays = monthDays
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 31);
    if (recurrence === 'monthly' && parsedMonthDays.length === 0)
      return fail('monthDays', 'Masukkan tanggal yang valid (1-31)');

    setBusy(true);
    const now = new Date().toISOString();
    const record: TaskTemplate = {
      id: editing?.id ?? newId(),
      orgId,
      outletId: null,
      name: name.trim(),
      items: finalItems,
      // Legacy single-task column (pre-0041). Mirror the first item so any
      // un-migrated reader still shows something sane.
      title: finalItems[0].title,
      description: description.trim(),
      recurrence,
      weekdays: recurrence === 'weekly' ? weekdays : [],
      monthDays: recurrence === 'monthly' ? parsedMonthDays : [],
      onceDate: recurrence === 'once' ? onceDate : null,
      assigneeType,
      assigneeRole: assigneeType === 'role' ? assigneeRole : null,
      assigneeEmployeeId: assigneeType === 'employee' ? assigneeEmployeeId : null,
      assigneeOutletId: assigneeType === 'outlet' ? assigneeOutletId : null,
      active,
      startDate: editing?.startDate ?? localDateStr(),
      endDate: endDate || null,
      sortOrder: editing?.sortOrder ?? nextSortOrder,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };

    try {
      await repository.put('taskTemplates', record);

      // Reconcile TODAY's already-generated tasks with the edited template.
      // The daily list holds a COPY of each item's text, so without this an
      // edit would leave today showing the OLD wording. Only PENDING rows are
      // touched — `done` ones record what was actually worked on.
      if (editing) {
        const instances = await repository.list('taskInstances');
        const mine = instances.filter((i) => i.templateId === editing.id && i.status === 'pending');
        const byItem = new Map(finalItems.map((it) => [it.id, it]));

        // (a) text drifted → refresh title/description
        const stale = mine.filter((i) => {
          const it = i.itemId ? byItem.get(i.itemId) : undefined;
          return it && (i.title !== it.title || i.description !== it.description);
        });
        if (stale.length) {
          await repository.putMany(
            'taskInstances',
            stale.map((i) => {
              const it = byItem.get(i.itemId!)!;
              return { ...i, title: it.title, description: it.description, updatedAt: now };
            }),
          );
        }

        // (b) item removed from the template → its pending task is orphaned
        //     (nothing in the UI could ever complete or delete it), so drop it.
        const orphans = mine.filter((i) => i.itemId && !byItem.has(i.itemId));
        for (const o of orphans) await repository.remove('taskInstances', o.id);
      }

      toast.success(editing ? 'Template tugas diperbarui' : 'Template tugas dibuat');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan template');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Template Tugas' : 'Template Tugas Baru'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="task-template" disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Simpan
          </Button>
        </>
      }
    >
      <form
        id="task-template"
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <FormMessage>{error}</FormMessage>

        <Field label="Nama Template" hint="Judul grup yang tampil di atas daftar tugas hari ini." invalid={invalid('name')}>
          <TextInput
            name="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: SOP Buka Toko"
            data-autofocus
          />
        </Field>

        {editing ? (
          /* Item editor — the ONLY place a template's contents can be
             reordered or removed (daily tab is read-only for these). */
          <div className="grid gap-1.5">
            <span className={LABEL} id="task-items-label">
              Tugas di dalam template
            </span>
            <ul className="mb-2 grid gap-2" aria-labelledby="task-items-label">
              {items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-2">
                  <span className="w-[18px] shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <TextInput
                    name={`item-${it.id}`}
                    className="min-w-0 flex-1"
                    value={it.title}
                    onChange={(e) => setItemTitle(it.id, e.target.value)}
                    placeholder="Judul tugas"
                    aria-label={`Judul tugas ${i + 1}`}
                  />
                  <span className="inline-flex shrink-0">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label="Naikkan urutan tugas" title="Naikkan">
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="Turunkan urutan tugas"
                      title="Turunkan"
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => removeItem(it.id)}
                      aria-label="Hapus tugas dari template"
                      title="Hapus dari template"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" className="justify-self-start border-dashed" onClick={addItem}>
              <Plus aria-hidden />
              Tambah tugas
            </Button>
          </div>
        ) : (
          <Field
            label={
              <>
                Tugas di dalam template
                {parsedBulk.length > 0 && <span className="ml-2 font-mono text-xs font-semibold text-primary">{parsedBulk.length} tugas</span>}
              </>
            }
            hint="Satu tugas per baris. Semuanya masuk ke template ini dengan jadwal & penerima yang sama. Urutannya bisa diatur setelah disimpan."
            invalid={invalid('items')}
          >
            <Textarea
              value={bulkTitles}
              onChange={(e) => setBulkTitles(capitalizeLines(e.target.value))}
              placeholder={'Satu tugas per baris, contoh:\nBersih-bersih area kerja\nCek stok sparepart\nBackup data kasir'}
              rows={4}
              className="resize-y"
            />
          </Field>
        )}

        <Field label="Deskripsi (opsional)">
          <TextInput name="template-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label="Pengulangan">
          <SelectBox
            value={recurrence}
            onValueChange={(v) => setRecurrence(v as RecurrenceType)}
            options={[
              { value: 'daily', label: 'Harian' },
              { value: 'weekly', label: 'Mingguan' },
              { value: 'monthly', label: 'Bulanan' },
              { value: 'once', label: 'Tanggal Tertentu (sekali)' },
            ]}
          />
        </Field>

        {recurrence === 'weekly' && (
          <div className="grid gap-1.5">
            <span className={LABEL} id="task-weekdays-label">
              Hari
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="task-weekdays-label">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.d}
                  type="button"
                  aria-pressed={weekdays.includes(w.d)}
                  className="h-[38px] w-[46px] rounded-lg bg-card text-sm font-semibold text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:h-11 pointer-coarse:w-11"
                  onClick={() => toggleWeekday(w.d)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {recurrence === 'monthly' && (
          <Field label="Tanggal dalam Bulan" hint="Pisahkan dengan koma (1-31)" invalid={invalid('monthDays')}>
            <TextInput
              capitalize="none"
              name="month-days"
              value={monthDays}
              onChange={(e) => setMonthDays(e.target.value)}
              placeholder="Contoh: 1, 15, 28"
              inputMode="numeric"
            />
          </Field>
        )}

        {recurrence === 'once' && (
          <Field label="Tanggal">
            <Input name="once-date" type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} className="font-mono" />
          </Field>
        )}

        <Field label="Berakhir Pada (opsional)" hint="Kosongkan bila template ini berjalan terus">
          <Input name="template-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-mono" />
        </Field>

        <Field label="Status" hint="Menonaktifkan tidak menghapus tugas yang sudah ada">
          <SelectBox
            value={active ? 'aktif' : 'nonaktif'}
            onValueChange={(v) => setActive(v === 'aktif')}
            options={[
              { value: 'aktif', label: 'Aktif: tugas dibuat sesuai jadwal' },
              { value: 'nonaktif', label: 'Nonaktif: berhenti membuat tugas baru' },
            ]}
          />
        </Field>

        <Field label="Tugaskan Ke">
          <SelectBox
            value={assigneeType}
            onValueChange={(v) => setAssigneeType(v as AssigneeType)}
            options={[
              { value: 'role', label: 'Peran' },
              { value: 'employee', label: 'Karyawan Spesifik' },
              ...(outlets.length ? [{ value: 'outlet', label: 'Outlet' }] : []),
            ]}
          />
        </Field>
        {assigneeType === 'role' && (
          <Field label="Peran">
            <SelectBox
              value={assigneeRole}
              onValueChange={(v) => setAssigneeRole(v as Role)}
              options={[
                { value: 'karyawan', label: 'Semua Karyawan' },
                { value: 'admin', label: 'Admin' },
                { value: 'owner', label: 'Owner' },
              ]}
            />
          </Field>
        )}
        {assigneeType === 'employee' && (
          <Field label="Karyawan">
            <SelectBox
              value={assigneeEmployeeId}
              onValueChange={setAssigneeEmployeeId}
              options={employees.map((emp) => ({ value: emp.id, label: emp.name }))}
              placeholder="Pilih karyawan…"
            />
          </Field>
        )}
        {assigneeType === 'outlet' && (
          <Field label="Outlet">
            <SelectBox
              value={assigneeOutletId}
              onValueChange={setAssigneeOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Pilih outlet…"
            />
          </Field>
        )}
      </form>
    </FormDialog>
  );
}

// Sama dengan Label dens, untuk judul kelompok yang bukan label satu isian.
const LABEL = 'text-sm leading-none font-semibold';
