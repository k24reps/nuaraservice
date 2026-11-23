import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useFormFault } from '@/hooks/useFormFault';
import { useCollection } from '@/hooks/useCollection';
import { useSessionStore, mustPickOutlet } from '@/stores/session';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr } from '@/lib/time';
import { entryDateError, walletsForOutlet } from '@/lib/business/finance';
import { netPay, type PayrollRow } from '@/lib/business/payroll';
import { loadPayrollOverview, paySalary } from '@/data/payroll';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { interpolate } from '@/lib/business/notify';
import { useT } from '@/i18n';
import type { Wallet } from '@/data/types';

interface PayrollModalProps {
  open: boolean;
  onClose: () => void;
  wallets: Wallet[];
}

/**
 * Bayar Gaji: gaji penuh (beban) + potongan kasbon (pelunasan piutang) dalam
 * satu simpan. Dulu dua catatan manual dan sisa kasbon dihitung sendiri dari
 * keterangan. Sisa kasbon & gaji terakhir tiap karyawan dimuat saat dibuka.
 */
export function PayrollModal({ open, onClose, wallets }: PayrollModalProps) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  const allowedOutletIds = useSessionStore((s) => s.allowedOutletIds);
  const { data: employees } = useCollection('employees');
  const { data: outlets } = useCollection('outlets');
  const [overview, setOverview] = useState<Map<string, PayrollRow>>(new Map());
  const [employeeId, setEmployeeId] = useState('');
  const [gross, setGross] = useState('');
  const [deduction, setDeduction] = useState('');
  const [walletId, setWalletId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [date, setDate] = useState(localDateStr());
  const [description, setDescription] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'employee' | 'gross' | 'deduction' | 'outlet' | 'wallet' | 'date'>();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<string[]>([]);

  const needOutlet = mustPickOutlet(outlets.length);
  const payOutlet = needOutlet ? outletId || null : activeOutletId;
  const usableWallets = walletsForOutlet(wallets, payOutlet);
  const staff = employees.filter((e) => e.active);
  const employee = staff.find((e) => e.id === employeeId) ?? null;
  const row = employee ? overview.get(employee.id) : undefined;
  const outstanding = row?.advanceOutstanding ?? 0;
  const grossNum = parseRpInput(gross);
  const deductNum = parseRpInput(deduction);
  const today = localDateStr();

  const refresh = () => {
    void loadPayrollOverview(orgId)
      .then(setOverview)
      .catch(() => setOverview(new Map()));
  };

  const [wasOpen, setWasOpen] = useState(false);
  if (!open && wasOpen) setWasOpen(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setEmployeeId('');
    setGross('');
    setDeduction('');
    setWalletId(walletsForOutlet(wallets, activeOutletId)[0]?.id ?? '');
    setOutletId('');
    setDate(localDateStr());
    setDescription('');
    setError('');
    setPaid([]);
    refresh();
  }

  const pickEmployee = (id: string) => {
    setEmployeeId(id);
    setError('');
    const r = overview.get(id);
    const g = r?.lastSalary ?? 0;
    setGross(g ? fmtRpInput(String(g)) : '');
    const d = Math.min(r?.advanceOutstanding ?? 0, g || (r?.advanceOutstanding ?? 0));
    setDeduction(d ? fmtRpInput(String(d)) : '');
  };

  const save = async (another: boolean) => {
    if (!employee) return fail('employee', t('payroll.employeeRequired'));
    if (grossNum <= 0) return fail('gross', t('payroll.grossRequired'));
    if (deductNum > outstanding) {
      return fail('deduction', interpolate(t('payroll.deductTooBig'), { amount: fmtRp(outstanding) }));
    }
    if (deductNum > grossNum) return fail('deduction', t('payroll.deductOverGross'));
    if (needOutlet && !outletId) return fail('outlet', t('finance.outletRequired'));
    if (!walletId) return fail('wallet', t('payroll.walletRequired'));
    const dateErr = entryDateError(date, today);
    if (dateErr) return fail('date', dateErr);
    setBusy(true);
    try {
      await paySalary({
        orgId,
        employeeId: employee.id,
        employeeName: employee.name,
        gross: grossNum,
        deduction: deductNum,
        walletId,
        outletId: payOutlet,
        date,
        description,
      });
      logActivity({
        action: 'expense.create',
        entityType: 'expense',
        entityLabel: description.trim() || `Gaji ${employee.name}`,
        meta: { amount: grossNum, category: 'Gaji', advanceDeduction: deductNum },
      });
      toast.success(
        interpolate(t('payroll.saved'), { name: employee.name, amount: fmtRp(netPay(grossNum, deductNum)) }),
      );
      if (another) {
        setPaid((p) => [...p, employee.id]);
        setEmployeeId('');
        setGross('');
        setDeduction('');
        setDescription('');
        refresh();
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('payroll.failed'));
    } finally {
      setBusy(false);
    }
  };

  const row2 = 'grid gap-4 @sm/form:grid-cols-2';
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('payroll.title')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" onClick={() => void save(true)} disabled={busy}>
            {t('payroll.saveAnother')}
          </Button>
          <Button onClick={() => void save(false)} disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {/* Nominal rupiah tak bisa dipatah: di ponsel tombol 3 kolom meluber. Jumlahnya ada di readout. */}
            {t('payroll.payShort')}
          </Button>
        </>
      }
    >
      <div className="@container/form grid gap-4">
        <FormMessage>{error}</FormMessage>
        {needOutlet && (
          <Field label={t('finance.outlet')} invalid={invalid('outlet')}>
            <SelectBox
              value={outletId}
              onValueChange={setOutletId}
              options={outlets
                .filter((o) => allowedOutletIds.length === 0 || allowedOutletIds.includes(o.id))
                .map((o) => ({ value: o.id, label: o.name }))}
              placeholder={t('finance.outletPlaceholder')}
              data-autofocus
            />
          </Field>
        )}
        <Field label={t('payroll.employee')} invalid={invalid('employee')}>
          <SelectBox
            value={employeeId}
            onValueChange={pickEmployee}
            placeholder={t('payroll.pickEmployee')}
            options={staff.map((e) => {
              const r = overview.get(e.id);
              const tags = [
                paid.includes(e.id) ? t('payroll.tagPaid') : '',
                r && r.advanceOutstanding > 0 ? interpolate(t('payroll.tagAdvance'), { amount: fmtRp(r.advanceOutstanding) }) : '',
              ].filter(Boolean);
              return { value: e.id, label: tags.length ? `${e.name} · ${tags.join(' · ')}` : e.name };
            })}
            data-autofocus={!needOutlet || undefined}
          />
        </Field>
        <div className={row2}>
          <Field
            label={t('payroll.gross')}
            invalid={invalid('gross')}
            hint={row?.lastSalary ? interpolate(t('payroll.lastSalary'), { amount: fmtRp(row.lastSalary) }) : undefined}
          >
            <TextInput
              capitalize="none"
              className="font-mono placeholder:font-sans"
              inputMode="numeric"
              value={gross}
              onChange={(e) => {
                setGross(fmtRpInput(e.target.value));
                setError('');
              }}
              placeholder="2.500.000"
            />
          </Field>
          <Field
            label={t('payroll.deduction')}
            invalid={invalid('deduction')}
            hint={employee ? interpolate(t('payroll.outstanding'), { amount: fmtRp(outstanding) }) : undefined}
          >
            <TextInput
              capitalize="none"
              className="font-mono placeholder:font-sans"
              inputMode="numeric"
              value={deduction}
              onChange={(e) => {
                setDeduction(fmtRpInput(e.target.value));
                setError('');
              }}
              placeholder="0"
              disabled={!employee || outstanding <= 0}
            />
          </Field>
        </div>
        <div className={row2}>
          <Field label={t('payroll.wallet')} invalid={invalid('wallet')}>
            <SelectBox
              value={walletId}
              onValueChange={(v) => {
                setWalletId(v);
                const picked = wallets.find((w) => w.id === v);
                if (needOutlet && picked?.outletId) setOutletId(picked.outletId);
              }}
              options={usableWallets.map((w) => ({ value: w.id, label: `${w.name} · ${fmtRp(w.balance)}` }))}
            />
          </Field>
          <Field label={t('finance.date')} invalid={invalid('date')}>
            <TextInput
              type="date"
              className="font-mono"
              value={date}
              min={today.slice(0, 8) + '01'}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('finance.noteOptional')}>
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={employee ? interpolate(t('payroll.notePh'), { name: employee.name }) : ''}
          />
        </Field>
        {/* Gaji penuh − potongan kasbon = yang ditransfer. */}
        {employee && grossNum > 0 && (
          <div
            className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-dashed border-border bg-surface/60 p-3 font-mono text-xs text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
            aria-live="polite"
          >
            <span>
              {t('payroll.rGross')} <b>{fmtRp(grossNum)}</b>
            </span>
            {deductNum > 0 && (
              <span>
                {t('payroll.rDeduct')} <b>−{fmtRp(deductNum)}</b>
              </span>
            )}
            <span className="text-foreground [&_b]:text-sm">
              {t('payroll.rNet')} <b>{fmtRp(netPay(grossNum, deductNum))}</b>
            </span>
            {outstanding > 0 && (
              <span>
                {t('payroll.rRemaining')} <b>{fmtRp(Math.max(0, outstanding - deductNum))}</b>
              </span>
            )}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
