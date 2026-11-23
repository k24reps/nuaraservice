import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { useSessionStore } from '@/stores/session';
import { linkEntryEmployee } from '@/data/payroll';
import { fmtRp } from '@/lib/format';
import { fmtDate } from '@/lib/time';
import { toast } from '@/stores/toast';
import { useT } from '@/i18n';
import type { Employee, Expense, Income } from '@/data/types';

interface LinkEmployeeModalProps {
  /** Baris buku kas Gaji / Kasbon Karyawan / Pelunasan Kasbon; null = tertutup. */
  entry: { kind: 'income' | 'expense' | 'transfer'; id: string; date: string; amount: number; category: string; description: string; record: unknown } | null;
  employees: Employee[];
  onClose: () => void;
}

/**
 * Tautkan catatan lama ke karyawan (0099) supaya sisa kasbon terhitung —
 * tanpa mencatat ulang & menghapus. Hanya kolom karyawan yang berubah.
 */
export function LinkEmployeeModal({ entry, employees, onClose }: LinkEmployeeModalProps) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  if (entry && entry.id !== seen) {
    setSeen(entry.id);
    setEmployeeId((entry.record as Expense | Income).employeeId ?? '');
    setError('');
  }
  if (!entry && seen) setSeen(null);

  const save = async () => {
    if (!entry || entry.kind === 'transfer') return;
    setBusy(true);
    try {
      await linkEntryEmployee({ orgId, kind: entry.kind, id: entry.id, employeeId: employeeId || null });
      toast.success(t('finance.linkSaved'));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('finance.linkFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={!!entry}
      onClose={onClose}
      title={t('finance.linkTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t('common.save')}
          </Button>
        </>
      }
    >
      {entry && (
        <div className="grid gap-4">
          <FormMessage>{error}</FormMessage>
          <p className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-dashed border-border bg-surface/60 p-3 font-mono text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
            <span>{entry.category}</span>
            <span>{fmtDate(entry.date)}</span>
            <b>{fmtRp(entry.amount)}</b>
            {entry.description && <span className="font-sans">{entry.description}</span>}
          </p>
          <Field label={t('finance.employee')} hint={t('finance.linkHint')}>
            <SelectBox
              value={employeeId}
              onValueChange={setEmployeeId}
              options={[
                { value: '', label: t('finance.linkNone') },
                ...employees.filter((e) => e.active || e.id === employeeId).map((e) => ({ value: e.id, label: e.name })),
              ]}
              data-autofocus
            />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
