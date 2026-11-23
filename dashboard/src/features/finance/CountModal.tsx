import { EmptyValue } from '@/components/ui/EmptyValue';
import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { cn } from '@/lib/utils';
import { useFormFault } from '@/hooks/useFormFault';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr } from '@/lib/time';
import { reconcileWallet } from '@/lib/business/finance';
import { createFinanceEntry } from '@/data/financeEntry';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import { useCollection } from '@/hooks/useCollection';
import { useT } from '@/i18n';
import type { ActivityAction, Wallet } from '@/data/types';

interface CountModalProps {
  open: boolean;
  onClose: () => void;
  wallets: Wallet[];
  /** Wallet yang sedang difilter di Buku Kas, bila ada. */
  initialWalletId?: string | null;
}

/**
 * Hitung laci / cek rekening: pemilik memasukkan uang yang BENAR-BENAR ada,
 * aplikasi menunjukkan selisihnya terhadap saldo, dan satu ketukan mencatat
 * penyesuaiannya sebagai pengeluaran/pemasukan "Lainnya" — sehingga saldo
 * kembali cocok tanpa menimpa angka diam-diam.
 */
export function CountModal({ open, onClose, wallets, initialWalletId }: CountModalProps) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const allowedOutletIds = useSessionStore((s) => s.allowedOutletIds);
  useSessionStore((s) => s.activeOutletId);
  const { data: outlets } = useCollection('outlets');
  const [walletId, setWalletId] = useState('');
  const [counted, setCounted] = useState('');
  const [outletId, setOutletId] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'count' | 'outlet'>();
  const [busy, setBusy] = useState(false);

  const [wasOpen, setWasOpen] = useState(false);
  if (!open && wasOpen) setWasOpen(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setWalletId(initialWalletId ?? wallets[0]?.id ?? '');
    setCounted('');
    setOutletId('');
    setError('');
  }

  const wallet = wallets.find((w) => w.id === walletId) ?? null;
  const hasCount = counted.trim() !== '';
  const { diff, entry } = reconcileWallet(wallet?.balance ?? 0, parseRpInput(counted));
  // Wallet khusus cabang: selisihnya milik cabang itu, tak perlu ditanya.
  const needOutlet = !!entry && !wallet?.outletId && mustPickOutlet(outlets.length);
  const outletOptions = outlets
    .filter((o) => allowedOutletIds.length === 0 || allowedOutletIds.includes(o.id))
    .map((o) => ({ value: o.id, label: o.name }));

  const apply = async () => {
    if (!wallet) return setError(t('finance.countRequired'));
    if (!hasCount) return fail('count', t('finance.countRequired'));
    if (!entry) {
      toast.success(t('finance.countMatch').replace('{wallet}', wallet.name));
      onClose();
      return;
    }
    if (needOutlet && !outletId) return fail('outlet', t('finance.outletRequired'));
    setBusy(true);
    // Kurang = beban (Selisih Kas Kurang); lebih = non-operasional, bukan omzet.
    const category = entry.kind === 'expense' ? 'Selisih Kas Kurang' : 'Selisih Kas Lebih';
    const description = t(entry.kind === 'expense' ? 'finance.countShortNote' : 'finance.countOverNote')
      .replace('{wallet}', wallet.name)
      .replace('{counted}', fmtRp(parseRpInput(counted)));
    try {
      const id = await createFinanceEntry({
        orgId,
        kind: entry.kind,
        date: localDateStr(),
        category,
        amount: entry.amount,
        walletId: wallet.id,
        description,
        outletId: wallet.outletId ?? (needOutlet ? outletId : resolveCreateOutlet(outlets)),
      });
      logActivity({
        action: `${entry.kind}.create` as ActivityAction,
        entityType: entry.kind,
        entityId: id,
        entityLabel: description,
        meta: { amount: entry.amount, category },
      });
      toast.success(t('finance.countApplied').replace('{wallet}', wallet.name));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('finance.countFailed'));
    } finally {
      setBusy(false);
    }
  };

  const tone = !hasCount ? 'idle' : diff === 0 ? 'ok' : diff < 0 ? 'short' : 'over';

  // Warna selisih hitung laci: pas hijau, kurang merah (memang salah), lebih kuning.
  const TONE_TEXT = { ok: 'text-success-foreground', short: 'text-destructive', over: 'text-warning-foreground' } as const;
  const TONE_DOT = { ok: 'bg-success-foreground', short: 'bg-destructive', over: 'bg-warning-foreground' } as const;
  const toneKey = tone as keyof typeof TONE_TEXT | undefined;
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('finance.countTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="wallet-count" disabled={busy || !hasCount} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {!hasCount || !entry
              ? t('finance.countConfirm')
              : t('finance.countAdjust').replace('{amount}', `${diff > 0 ? '+' : '−'}${fmtRp(Math.abs(diff))}`)}
          </Button>
        </>
      }
    >
      <form
        id="wallet-count"
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
        <FormMessage>{error}</FormMessage>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2" role="group" aria-label={t('finance.wallet')}>
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              className="flex min-h-11 items-center gap-2 rounded-xl bg-card px-3 text-left text-sm font-medium ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
              aria-pressed={w.id === walletId}
              onClick={() => {
                setWalletId(w.id);
                setError('');
              }}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{w.name}</span>
            </button>
          ))}
        </div>
        <Field label={t('finance.countLabel')} invalid={invalid('count')} hint={t('finance.countHint')}>
          <TextInput
            capitalize="none"
            className="font-mono placeholder:font-sans"
            inputMode="numeric"
            value={counted}
            onChange={(e) => {
              setCounted(fmtRpInput(e.target.value));
              setError('');
            }}
            placeholder="0"
            data-autofocus
          />
        </Field>
        {/* Readout: saldo aplikasi / dihitung / selisih — satu persamaan, bukan
            tiga kartu. Wadahnya container sendiri (jendela ada di portal); di
            <=420px tiga sel jadi tiga baris. */}
        <div className="@container/count">
          <dl
            data-tone={tone}
            className="m-0 grid grid-cols-3 overflow-hidden rounded-xl font-mono ring-1 ring-border @max-[421px]/count:grid-cols-1 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&>div]:gap-1 [&>div]:border-r [&>div]:border-dashed [&>div]:border-border [&>div]:p-3 [&>div:last-child]:border-r-0 @max-[421px]/count:[&>div]:flex-row @max-[421px]/count:[&>div]:items-baseline @max-[421px]/count:[&>div]:justify-between @max-[421px]/count:[&>div]:border-r-0 @max-[421px]/count:[&>div]:border-b @max-[421px]/count:[&>div:last-child]:border-b-0 [&_dd]:m-0 [&_dd]:font-semibold [&_dd]:tabular-nums [&_dd]:[overflow-wrap:anywhere] [&_dt]:font-sans [&_dt]:text-xs [&_dt]:text-muted-foreground"
          >
            <div>
              <dt>{t('finance.countApp')}</dt>
              <dd>{wallet ? fmtRp(wallet.balance) : <EmptyValue />}</dd>
            </div>
            <div>
              <dt>{t('finance.countCounted')}</dt>
              <dd>{hasCount ? fmtRp(parseRpInput(counted)) : <EmptyValue />}</dd>
            </div>
            <div>
              <dt className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-full bg-muted-foreground/50', toneKey && TONE_DOT[toneKey])} />
                {t('finance.countDiff')}
              </dt>
              <dd className={cn(toneKey && TONE_TEXT[toneKey])}>
                {!hasCount
                  ? <EmptyValue />
                  : diff === 0
                    ? t('finance.countDiffNone')
                    : `${diff > 0 ? '+' : '−'}${fmtRp(Math.abs(diff))}`}
              </dd>
            </div>
          </dl>
        </div>
        {entry && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(entry.kind === 'expense' ? 'finance.countShortHint' : 'finance.countOverHint')}
          </p>
        )}
        {needOutlet && (
          <Field label={t('finance.outlet')} invalid={invalid('outlet')}>
            <SelectBox
              value={outletId}
              onValueChange={(v) => {
                setOutletId(v);
                setError('');
              }}
              options={outletOptions}
              placeholder={t('finance.outletPlaceholder')}
            />
          </Field>
        )}
      </form>
    </FormDialog>
  );
}
