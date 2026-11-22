import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Banknote, Info, LoaderCircle, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useCollection } from '@/hooks/useCollection';
import { useSessionStore } from '@/stores/session';
import { isManager } from '@/config/plans';
import { EMPTY_VALUE, fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { cn } from '@/lib/utils';
import { modalDadakanIssue, STATUS_BADGE, type ModalDadakanInput } from '@/lib/business/services';
import { toast } from '@/stores/toast';
import type { Service, ServiceSparepart, Wallet } from '@/data/types';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

interface SparepartPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Item ids already on the ticket (to mark as added / avoid confusion). */
  existingItemIds: string[];
  /** Called with a fully-formed inventory cost line to append. */
  onPick: (line: ServiceSparepart) => void;
  /** Tiket tujuan, ditampilkan di atas pencarian. Dibuka dari Daftar Servis,
   * jendela ini tidak punya halaman tiket di belakangnya yang memberi tahu. */
  ticket?: Pick<Service, 'serviceNo' | 'device' | 'customerName' | 'status'>;
  /** Tab Modal Dadakan untuk part yang dibeli di luar stok (owner/admin).
   * Tanpa prop ini jendela hanya berisi inventori, seperti di detail tiket
   * yang punya form Modal Dadakan sendiri di panel BOM. */
  modalDadakan?: {
    wallets: Wallet[];
    defaultWalletId: string;
    /** true bila tersimpan; form lalu dikosongkan untuk part berikutnya. */
    onSave: (input: ModalDadakanInput) => Promise<boolean>;
  };
}

type Source = 'inventory' | 'modal';

/**
 * Picks an inventory item to add to a service as a sparepart cost line. Pulls
 * costPrice (HPP) and sellPrice from the item. The qty<=stock check here is a
 * cached-state UX guard; the caller (addSparepartLine) re-reads the item and
 * deducts stock immediately on add (authoritative), so this only builds the line.
 */
export function SparepartPickerModal({
  open,
  onClose,
  existingItemIds,
  onPick,
  ticket,
  modalDadakan,
}: SparepartPickerModalProps) {
  const t = useT();
  const { data: inventory } = useCollection('inventory');
  // HPP adalah margin toko; karyawan tidak perlu — dan tidak boleh biasa —
  // melihatnya saat memasang part (audit #14).
  const me = useSessionStore((s) => s.currentEmployee);
  const isMgr = me ? isManager(me.role) : false;
  const [query, setQuery] = useState('');
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [source, setSource] = useState<Source>('inventory');
  const [modalName, setModalName] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Wallet bisa baru termuat setelah jendela terbuka; tanpa ini pilihan yang
  // tampil (opsi pertama) berbeda dari nilai yang disimpan (kosong).
  const wallet = modalDadakan?.wallets.some((w) => w.id === walletId)
    ? walletId
    : (modalDadakan?.defaultWalletId ?? '');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory
      .filter((i) => !i.deletedAt)
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, query]);

  const add = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const qty = Math.max(1, Math.round(Number(qtyById[itemId]) || 1));
    if (qty > item.stock) {
      toast.warning(interpolate(t('partPicker.stockLimit'), { name: item.name, n: String(item.stock) }));
      return;
    }
    const line: ServiceSparepart = {
      itemId: item.id,
      name: item.name,
      qty,
      costPrice: item.costPrice,
      sellPrice: item.sellPrice,
      deducted: false,
      kind: 'inventory',
      defaultWarrantyDays: item.warrantyDays ?? null,
    };
    // Tetap terbuka: satu unit sering butuh beberapa part (LCD + baterai + lem).
    // Barisnya berubah jadi "Tambah lagi" begitu tersimpan; Selesai menutup.
    onPick(line);
    setQtyById((m) => ({ ...m, [itemId]: '1' }));
  };

  // Part yang dicari tidak ada di stok: namanya dibawa ke form Modal Dadakan.
  const toModal = (name: string) => {
    setSource('modal');
    if (name) setModalName(name);
  };

  const saveModal = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalDadakan || saving) return;
    const input = { name: modalName, amount: parseRpInput(modalAmount), walletId: wallet };
    const issue = modalDadakanIssue(input);
    if (issue) {
      toast.warning(t(issue));
      return;
    }
    setSaving(true);
    try {
      if (await modalDadakan.onSave(input)) {
        // Tetap terbuka seperti tab inventori: satu unit bisa butuh dua part
        // dari toko sebelah. Wallet dibiarkan, biasanya sama.
        setModalName('');
        setModalAmount('');
        nameRef.current?.focus();
      }
    } finally {
      setSaving(false);
    }
  };

  const metaDot = <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t(modalDadakan ? 'partPicker.titleAny' : 'partPicker.title')}
      size="lg"
      footer={
        // Di tab Modal Dadakan aksi utamanya Simpan Modal; Selesai hanya menutup.
        <Button variant={source === 'modal' ? 'outline' : 'default'} onClick={onClose}>
          {t('partPicker.done')}
        </Button>
      }
    >
      <div className="@container/pk grid gap-4">
        {ticket && (
          // Tiket tujuan: dibuka dari Daftar Servis, jendela ini tak punya halaman tiket di belakangnya.
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface px-3.5 py-2.5 text-sm ring-1 ring-border/60">
            <span className="font-mono font-semibold">{ticket.serviceNo}</span>
            <Badge variant={STATUS_BADGE[ticket.status]}>{t(`statusLabel.${ticket.status}`)}</Badge>
            {metaDot}
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{ticket.device}</span>
            {ticket.customerName && (
              <>
                {metaDot}
                <span className="text-muted-foreground">{ticket.customerName}</span>
              </>
            )}
          </p>
        )}
        {modalDadakan && (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-2"
            role="group"
            aria-label={t('partPicker.sourceAria')}
          >
            {(['inventory', 'modal'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className="grid min-h-11 gap-0.5 rounded-xl bg-card px-3.5 py-2.5 text-left ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
                aria-pressed={source === id}
                onClick={() => setSource(id)}
              >
                <span className="text-sm font-semibold">
                  {t(id === 'inventory' ? 'nav.inventory' : 'serviceDetail.extraCost')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(id === 'inventory' ? 'partPicker.sourceInventorySub' : 'partPicker.sourceModalSub')}
                </span>
              </button>
            ))}
          </div>
        )}
        {modalDadakan && source === 'modal' ? (
          <form className="grid gap-3" onSubmit={saveModal}>
            <Field label={t('serviceDetail.modalName')}>
              <TextInput
                ref={nameRef}
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder={t('serviceDetail.modalNamePh')}
                // Jendela sudah terbuka saat tab ini dipilih, jadi autoFocus tak
                // mengganggu pemulihan fokus saat jendela ditutup.
                autoFocus
              />
            </Field>
            <div className="grid gap-3 @min-[26rem]/pk:grid-cols-2">
              <Field label={t('serviceDetail.modalAmount')}>
                <TextInput
                  capitalize="none"
                  className="font-mono tabular-nums placeholder:font-sans"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(fmtRpInput(e.target.value))}
                  placeholder="250.000"
                  inputMode="numeric"
                />
              </Field>
              <Field label={t('serviceDetail.fromWallet')}>
                <SelectBox
                  value={wallet}
                  onValueChange={setWalletId}
                  options={modalDadakan.wallets.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Field>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
              <Info aria-hidden /> {t('serviceDetail.modalAddHint')}
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden />}
                {t('serviceDetail.saveModal')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <TextInput
              placeholder={t('partPicker.searchPh')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              start={<Search aria-hidden />}
              aria-label={t('partPicker.searchPh')}
              data-autofocus
            />
            {rows.length === 0 ? (
              <div className="grid justify-items-center gap-3 rounded-xl bg-surface px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-border/60">
                <p>{inventory.length === 0 ? t('partPicker.noInventory') : t('partPicker.noMatch')}</p>
                {modalDadakan && (
                  <Button variant="outline" size="sm" onClick={() => toModal(query.trim())}>
                    <Banknote aria-hidden />
                    {query.trim()
                      ? interpolate(t('partPicker.toModalNamed'), { name: query.trim() })
                      : t('partPicker.toModal')}
                  </Button>
                )}
              </div>
            ) : (
              <ul className="m-0 grid max-h-[52dvh] list-none gap-2 overflow-y-auto p-0.5">
                {rows.map((item) => {
                  const out = item.stock <= 0;
                  const added = existingItemIds.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-border/60 data-[out=true]:opacity-60"
                      data-out={out}
                    >
                      <span
                        aria-hidden
                        className={cn('size-2 shrink-0 rounded-full', out ? 'bg-destructive' : 'bg-success-foreground')}
                      />
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="text-sm font-medium [overflow-wrap:anywhere]">{item.name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">
                            {item.sku || (
                              <>
                                <span aria-hidden="true">{EMPTY_VALUE}</span>
                                <span className="sr-only">{t('common.emptyValue')}</span>
                              </>
                            )}
                          </span>
                          {metaDot}
                          {interpolate(t('partPicker.stock'), { n: String(item.stock) })}
                          {isMgr && (
                            <>
                              {metaDot}
                              {interpolate(t('partPicker.cost'), { amount: fmtRp(item.costPrice) })}
                            </>
                          )}
                        </span>
                      </div>
                      <Input
                        className="w-16 shrink-0 px-2 text-center font-mono tabular-nums"
                        type="number"
                        min={1}
                        max={item.stock}
                        value={qtyById[item.id] ?? '1'}
                        onChange={(e) => setQtyById((m) => ({ ...m, [item.id]: e.target.value }))}
                        disabled={out}
                        aria-label={interpolate(t('partPicker.qtyAria'), { name: item.name })}
                      />
                      <Button
                        size="sm"
                        variant={added ? 'outline' : 'default'}
                        className="shrink-0"
                        onClick={() => add(item.id)}
                        disabled={out}
                      >
                        <Plus aria-hidden />
                        {added ? t('partPicker.addAgain') : t('common.add')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </FormDialog>
  );
}
