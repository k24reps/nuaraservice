import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr } from '@/lib/time';
import { transferMoneyLocked } from '@/lib/business/finance';
import { toast } from '@/stores/toast';
import type { Wallet, WalletTransfer } from '@/data/types';
import { createTransfer, editTransfer } from './transferActions';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  wallets: Wallet[];
  /** Transfer yang diedit; null = transfer baru. */
  editing?: WalletTransfer | null;
}

/**
 * Transfer saldo antar wallet — buat baru atau edit (0086). Transfer bukan
 * pemasukan/pengeluaran (bukan untung/rugi), jadi tidak membukukan baris kas;
 * ia punya tabel sendiri, `wallet_transfers`.
 */
export function TransferModal({ open, onClose, wallets, editing = null }: TransferModalProps) {
  const t = useT();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Transfer bulan lalu: uangnya terkunci (kunci bulan 0071), keterangannya tidak.
  const moneyLocked = !!editing && transferMoneyLocked(editing, localDateStr());

  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setLastOpen(true);
    // Default both selects to real wallets so the displayed option matches
    // state. A native <select> with an unmatched value silently shows the
    // first option while state stays empty → misleading "pick wallet" error.
    const first = editing?.fromWalletId || wallets[0]?.id || '';
    const second = editing?.toWalletId || wallets.find((w) => w.id !== first)?.id || '';
    setFromId(first);
    setToId(second);
    setAmount(editing ? fmtRpInput(String(editing.amount)) : '');
    setNote(editing?.note ?? '');
    setError('');
  }
  if (!open && lastOpen) setLastOpen(false);

  // Keep the destination valid: if it collides with the new source, move it.
  const onFromChange = (id: string) => {
    setFromId(id);
    if (id === toId) setToId(wallets.find((w) => w.id !== id)?.id ?? '');
  };

  const save = async () => {
    const value = parseRpInput(amount);
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await editTransfer({ wallets, transfer: editing, fromWalletId: fromId, toWalletId: toId, amount: value, note });
        toast.success(t('finance.transferUpdated'));
      } else {
        await createTransfer({ wallets, fromWalletId: fromId, toWalletId: toId, amount: value, note });
        const from = wallets.find((w) => w.id === fromId)?.name ?? '';
        const to = wallets.find((w) => w.id === toId)?.name ?? '';
        toast.success(interpolate(t('finance.transferDone'), { amount: fmtRp(value), from, to }));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('finance.transferFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Wallet transfer lama bisa saja sudah tak ada di daftar (cabang lain /
  // dihapus); tampilkan namanya dari riwayat supaya pilihan tidak kosong.
  const options = (keep: string, name: string) => {
    const list = wallets.map((w) => ({ value: w.id, label: `${w.name} (${fmtRp(w.balance)})` }));
    return keep && !wallets.some((w) => w.id === keep) ? [{ value: keep, label: name }, ...list] : list;
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? t('finance.editTransfer') : t('finance.transferTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="wallet-transfer" disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t(editing ? 'common.save' : 'finance.transfer')}
          </Button>
        </>
      }
    >
      {/* <form>: Enter menyimpan, sama seperti jendela Pemasukan/Pengeluaran. */}
      <form
        id="wallet-transfer"
        className="@container/form grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <FormMessage>{error}</FormMessage>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {moneyLocked ? t('finance.transferLockedHint') : t('finance.transferHint')}
        </p>
        <div className="grid gap-4 @sm/form:grid-cols-2">
          <Field label={t('finance.fromWallet')}>
            <SelectBox
              value={fromId}
              onValueChange={onFromChange}
              options={options(fromId, editing?.fromName ?? '')}
              disabled={moneyLocked}
            />
          </Field>
          <Field label={t('finance.toWallet')}>
            <SelectBox
              value={toId}
              onValueChange={setToId}
              options={options(toId, editing?.toName ?? '')
                .filter((o) => o.value !== fromId)
                .map((o) => ({ ...o, label: o.label.replace(/ \(Rp.*\)$/, '') }))}
              disabled={moneyLocked}
            />
          </Field>
        </div>
        <Field label={t('finance.amount')}>
          <TextInput
            capitalize="none"
            className="font-mono placeholder:font-sans"
            value={amount}
            onChange={(e) => setAmount(fmtRpInput(e.target.value))}
            placeholder="100.000"
            inputMode="numeric"
            disabled={moneyLocked}
            data-autofocus={!moneyLocked || undefined}
          />
        </Field>
        <Field label={t('finance.noteOptional')}>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('finance.transferNotePh')}
            maxLength={120}
            data-autofocus={moneyLocked || undefined}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
