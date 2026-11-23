import { useState } from 'react';
import { ArrowLeftRight, ListChecks, LoaderCircle, Pencil, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { repository } from '@/data';
import { createFinanceEntry } from '@/data/financeEntry';
import { createTransfer } from '@/features/finance/transferActions';
import { CountModal } from '@/features/finance/CountModal';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { interpolate } from '@/lib/business/notify';
import { localDateStr } from '@/lib/time';
import { newId } from '@/lib/id';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { Outlet, Wallet } from '@/data/types';
import { CheckOption, SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

/** Pagar kewajaran jumlah akun kas, sama dengan plan_quota di server (0101). */
const MAX_WALLETS = 99;

/** Tab Wallet (L-66): akun kas, saldo awal, kas tunai laci, dan transfer antar kas. */
export function WalletSettings({ wallets, outlets }: { wallets: Wallet[]; outlets: Outlet[] }) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  // Pagar kewajaran yang sama dengan server (plan_quota, 0101), dicek
  // terhadap jumlah SESUDAH penambahan.
  const canAddWallet = wallets.length + 1 <= MAX_WALLETS;
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  // Hybrid wallet (OQ Q2): a wallet is either shared org-wide (null) or tied
  // to a specific branch. '' = Bersama (shared).
  const [outletId, setOutletId] = useState('');
  // Uang fisik di laci: kembalian Kasir selalu diambil dari wallet ini (0095).
  const [isCash, setIsCash] = useState(false);
  // Transfer sub-action: move funds between two wallets.
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [adding, setAdding] = useState(false);

  const outletName = (id: string | null) =>
    id ? (outlets.find((o) => o.id === id)?.name ?? t('settingsPage.cabang')) : t('settingsPage.bersama');

  const add = async () => {
    if (!canAddWallet)
      return toast.error(
        interpolate(t('settingsPage.walletQuota'), { n: String(MAX_WALLETS) }),
      );
    if (!name.trim()) return toast.error(t('settingsPage.namaWalletWajibDiisi'));
    if (adding) return;
    setAdding(true);
    const now = new Date().toISOString();
    const initial = parseRpInput(balance);
    try {
      const walletId = newId();
      // Wallet SELALU lahir bersaldo nol. Saldo awal adalah uang yang benar-benar
      // masuk ke kas, jadi ia dicatat sebagai setoran Modal — dulu angkanya
      // langsung ditulis ke saldo dan Buku Kas tak pernah bisa menjelaskan
      // dari mana uang itu datang.
      await repository.put('wallets', {
        id: walletId,
        orgId,
        outletId: outletId || null,
        name: name.trim(),
        balance: 0,
        sortOrder: wallets.length,
        isCash,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      if (initial > 0) {
        await createFinanceEntry({
          orgId,
          kind: 'income',
          date: localDateStr(),
          category: 'Modal',
          amount: initial,
          walletId,
          description: `Saldo awal ${name.trim()}`,
          outletId: outletId || null,
        });
      }
      toast.success(
        initial > 0 ? t('settingsPage.walletAddedModal') : t('settingsPage.walletAdded'),
      );
      setName('');
      setBalance('');
      setOutletId('');
      setIsCash(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletAddFailed'));
    } finally {
      setAdding(false);
    }
  };

  const doTransfer = async () => {
    const amount = parseRpInput(transferAmount);
    const from = wallets.find((w) => w.id === fromId);
    const to = wallets.find((w) => w.id === toId);
    if (!from || !to) return toast.error(t('settingsPage.pilihWalletAsalTujuan'));
    setTransferring(true);
    try {
      // Jalur yang sama dengan Buku Kas (0086): validasi kembar server, RPC di
      // cloud, tabel wallet_transfers + log di lokal.
      await createTransfer({ wallets, fromWalletId: fromId, toWalletId: toId, amount, note: '' });
      toast.success(interpolate(t('settingsPage.transferDone'), { amount: fmtRp(amount), from: from.name, to: to.name }));
      setTransferAmount('');
      setFromId('');
      setToId('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.transferFailed'));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <SettingsSection>
      <SettingsCard icon={<WalletIcon aria-hidden />} title={t('settingsPage.walletKas')}>
        <SettingsHint>
          Kas bisa <strong>{t('settingsPage.bersama')}</strong> (dipakai semua cabang) atau dikhususkan ke satu cabang. Saat
          transaksi, hanya kas bersama + kas cabang aktif yang tampil.
        </SettingsHint>
        <ul className="mb-4 flex flex-col gap-2">
          {wallets.map((w) => (
            <WalletRow key={w.id} wallet={w} outletLabel={outletName(w.outletId)} outlets={outlets} />
          ))}
        </ul>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[140px] flex-1">
            <TextInput placeholder={t('settingsPage.namaWallet')} aria-label={t('settingsPage.namaWallet')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-[140px] flex-1">
            <Input
              inputMode="numeric"
              className={NUM}
              placeholder={t('settingsPage.saldoAwal')}
              aria-label={t('settingsPage.saldoAwal')}
              value={balance}
              onChange={(e) => setBalance(fmtRpInput(e.target.value))}
            />
          </div>
          {outlets.length > 0 && (
            <div className="min-w-[210px] flex-1">
              <SelectBox
                aria-label={t('settingsPage.cabangWallet')}
                value={outletId}
                onValueChange={setOutletId}
                options={[{ value: '', label: 'Bersama (semua cabang)' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
              />
            </div>
          )}
          <Button onClick={add} disabled={adding || !canAddWallet} aria-busy={adding || undefined}>
            {adding ? <Spinner /> : <Plus aria-hidden />}
            {t('settingsPage.tambah')}
          </Button>
        </div>
        <div className="mt-2">
          <CheckOption
            checked={isCash}
            onChange={setIsCash}
            label={t('settingsPage.uangTunaiLaci')}
            hint={t('settingsPage.kembalianKasirSelaluDiambil')}
          />
        </div>

        {wallets.length >= 2 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-border pt-4">
            <span className="text-sm font-semibold">{t('settingsPage.transferSaldoAntarWallet')}</span>
            <SettingsHint className="mb-1">{t('settingsPage.pPindahkanSaldoAntarKas')}</SettingsHint>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[210px] flex-1">
                <SelectBox
                  aria-label={t('settingsPage.walletAsal')}
                  value={fromId}
                  onValueChange={setFromId}
                  options={wallets.map((w) => ({ value: w.id, label: `${w.name} (${fmtRp(w.balance)})` }))}
                  placeholder={t('settingsPage.dariWallet')}
                />
              </div>
              <div className="min-w-[210px] flex-1">
                <SelectBox
                  aria-label={t('settingsPage.walletTujuan')}
                  value={toId}
                  onValueChange={setToId}
                  options={wallets.filter((w) => w.id !== fromId).map((w) => ({ value: w.id, label: w.name }))}
                  placeholder={t('settingsPage.keWallet')}
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <Input
                  inputMode="numeric"
                  className={NUM}
                  placeholder={t('settingsPage.nominal')}
                  aria-label={t('settingsPage.nominal')}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(fmtRpInput(e.target.value))}
                />
              </div>
              <Button onClick={doTransfer} disabled={transferring} aria-busy={transferring || undefined}>
                {transferring ? <Spinner /> : <ArrowLeftRight aria-hidden />}
                {t('settingsPage.transfer')}
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}

/**
 * Satu baris wallet: ganti nama dan hapus. Sebelumnya kas hanya bisa DITAMBAH —
 * salah ketik nama menetap selamanya, dan kas yang tak dipakai lagi tetap
 * muncul di setiap form pembayaran. Penghapusan dijaga server (0077): kas yang
 * masih memegang saldo atau masih dipakai baris kas tidak boleh hilang.
 */
function WalletRow({ wallet, outletLabel, outlets }: { wallet: Wallet; outletLabel: string; outlets: Outlet[] }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  // Kalibrasi saldo lewat jendela yang sama dengan Keuangan: selisihnya dicatat,
  // bukan saldo ditimpa diam-diam.
  const [counting, setCounting] = useState(false);
  const [name, setName] = useState(wallet.name);
  const [outletId, setOutletId] = useState(wallet.outletId ?? '');
  const [isCash, setIsCash] = useState(!!wallet.isCash);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const rename = async () => {
    if (!name.trim()) return toast.error(t('settingsPage.namaWalletWajibDiisi'));
    setBusy(true);
    try {
      await repository.put('wallets', {
        ...wallet,
        name: name.trim(),
        // Cabang & tunai bisa diatur belakangan — wallet lama lahir "Bersama".
        outletId: outletId || null,
        isCash,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t('settingsPage.walletDiperbarui'));
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletRenameFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirm(false);
    // Cermin penjagaan server, supaya alasannya muncul sebelum permintaan dikirim.
    if (wallet.balance !== 0) {
      return toast.error(
        `"${wallet.name}" masih memegang ${fmtRp(wallet.balance)}. Pindahkan saldonya lewat transfer terlebih dahulu.`,
      );
    }
    setBusy(true);
    try {
      await repository.remove('wallets', wallet.id);
      toast.success(t('settingsPage.walletDihapus'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.walletDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-4 py-2.5 text-sm ring-1 ring-border/60">
      {editing ? (
        <>
          <div className="min-w-[140px] flex-1">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={interpolate(t('settingsPage.walletNameOf'), { name: wallet.name })}
            />
          </div>
          {outlets.length > 0 && (
            <div className="min-w-[210px] flex-1">
              <SelectBox
                aria-label={interpolate(t('settingsPage.walletBranchOf'), { name: wallet.name })}
                value={outletId}
                onValueChange={setOutletId}
                options={[{ value: '', label: 'Bersama (semua cabang)' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
              />
            </div>
          )}
          <CheckOption checked={isCash} onChange={setIsCash} label={t('settingsPage.uangTunaiLaci')} />
          <span className={ACTIONS}>
            <Button size="sm" onClick={rename} disabled={busy} aria-busy={busy || undefined}>
              {busy && <Spinner />}
              {t('settingsPage.simpan')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setName(wallet.name);
                setOutletId(wallet.outletId ?? '');
                setIsCash(!!wallet.isCash);
                setEditing(false);
              }}
            >
              {t('settingsPage.batal')}
            </Button>
          </span>
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-[1_1_10rem] flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">
            {wallet.name}
            <Badge variant={wallet.outletId ? 'info' : 'secondary'}>{outletLabel}</Badge>
            {wallet.isCash && <Badge variant="success">{t('settingsPage.tunai')}</Badge>}
          </span>
          <strong className="font-mono font-semibold whitespace-nowrap tabular-nums">{fmtRp(wallet.balance)}</strong>
          <span className={ACTIONS}>
            <Button size="sm" variant="ghost" onClick={() => setCounting(true)}>
              <ListChecks aria-hidden />
              {t('finance.countAction')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              {t('settingsPage.ubah')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={busy}>
              <Trash2 aria-hidden />
              {t('settingsPage.hapus')}
            </Button>
          </span>
        </>
      )}
      <CountModal open={counting} onClose={() => setCounting(false)} wallets={[wallet]} initialWalletId={wallet.id} />
      <ConfirmDialog
        open={confirm}
        title={t('settingsPage.hapusWallet')}
        message={`"${wallet.name}" akan dihapus. Hanya bisa dihapus bila saldonya nol dan belum pernah dipakai di pemasukan atau pengeluaran.`}
        confirmLabel={t('settingsPage.hapus')}
        danger
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

// Angka uang di kotak isian juga mono.
const NUM = 'font-mono tabular-nums placeholder:font-sans';
// Label pemilih ("Bersama (semua cabang)", "Tunai (Rp 2.500.000)") butuh ±210px; lebih sempit dari itu dipotong elipsis.
const ACTIONS = 'ml-auto flex flex-wrap items-center justify-end gap-1 @max-[641px]/settings:basis-full';
