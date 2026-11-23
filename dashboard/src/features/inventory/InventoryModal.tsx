import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/dens/radio-group';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useFormFault } from '@/hooks/useFormFault';
import { repository } from '@/data';
import { useCollection } from '@/hooks/useCollection';
import { adjustInventoryStock, purchaseInventoryStock } from '@/data/supabase-client';
import { newId } from '@/lib/id';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr } from '@/lib/time';
import { averageCost } from '@/lib/business/purchase';
import { applyBalance, walletsForOutlet } from '@/lib/business/finance';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import { isCloudMode } from '@/stores/demo';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import type { InventoryItem } from '@/data/types';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
  editing: InventoryItem | null;
  categories: string[];
  /** Dibuka dari tombol "+ Stok" di kartu: fokus langsung ke kolom stok. */
  restock?: boolean;
  /** Tombol Hapus di footer (mode ubah). Dulu ikon tong sampah di tiap baris. */
  canDelete?: boolean;
}

export function InventoryModal({ open, onClose, editing, categories, restock = false, canDelete = false }: InventoryModalProps) {
  const t = useT();
  // Peringatan "masih dipakai di N servis aktif". Cloud menghitungnya di server
  // saat Hapus diketuk; adapter lokal memakai daftar di memori.
  const serverCount = !!repository.countActiveServicesUsingItem;
  const { data: services } = useCollection('services', { enabled: open && canDelete && !serverCount });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const { data: outlets } = useCollection('outlets');
  const { data: allWallets } = useCollection('wallets');
  const [name, setName] = useState('');
  const [outletId, setOutletId] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('');
  const [stockReason, setStockReason] = useState('');
  // Stok yang bertambah harus dijawab asalnya: dibeli sekarang (stok + modal
  // rata-rata + kas sekaligus) atau koreksi/stok yang sudah ada. Dulu hanya
  // koreksi — pembelian lalu dicatat ulang di Keuangan, sering lupa atau dobel.
  const [inSource, setInSource] = useState<'buy' | 'adjust' | null>(null);
  const [unitCost, setUnitCost] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'name' | 'stock' | 'unitCost' | 'outlet'>();
  const [busy, setBusy] = useState(false);

  // Barang baru selalu mulai kosong; mode edit mencerminkan recordnya.
  useResetOnOpen(open, editing?.id ?? 'new', () => {
    setName(editing?.name ?? '');
    setOutletId(editing?.outletId ?? '');
    setCategory(editing?.category ?? '');
    setStock(editing ? String(editing.stock) : '');
    setMinStock(editing ? String(editing.minStock) : '');
    setCostPrice(editing?.costPrice ? fmtRpInput(String(editing.costPrice)) : '');
    setSellPrice(editing?.sellPrice ? fmtRpInput(String(editing.sellPrice)) : '');
    setWarrantyDays(editing?.warrantyDays != null ? String(editing.warrantyDays) : '');
    setStockReason('');
    setInSource(null);
    setUnitCost(editing?.costPrice ? fmtRpInput(String(editing.costPrice)) : '');
    setPayWalletId('');
    setError('');
  });

  // Stock/minStock are integer counts (inventoryItemSchema requires int); this
  // modal writes straight via repository.put, so round here — a type=number
  // input otherwise lets "2.5" through and corrupts the count.
  const stockNum = Math.round(Number(stock) || 0);
  const stockDelta = editing ? stockNum - editing.stock : 0;
  const added = editing ? stockDelta : stockNum;
  const buying = added > 0 && inSource === 'buy';
  const unit = parseRpInput(unitCost);
  // Wallet cabang pemilik stok (atau cabang aktif) + wallet bersama (0095).
  const payOutlet = outletId || resolveCreateOutlet(outlets);
  const wallets = walletsForOutlet(allWallets, payOutlet);
  const defaultWallet = (wallets.find((w) => w.isCash) ?? wallets[0])?.id ?? '';
  const walletPick = payWalletId === '' ? defaultWallet : payWalletId === 'none' ? '' : payWalletId;
  const previewCost = averageCost(editing?.stock ?? 0, editing?.costPrice ?? 0, added, unit);

  const save = async () => {
    if (!name.trim()) return fail('name', t('inventory.namaBarangWajibDiisi'));
    if (stockNum < 0) return fail('stock', t('inventory.stokTidakBolehNegatif'));
    if (added > 0 && !inSource) return setError(t('inventory.inSourceRequired'));
    if (buying && unit <= 0) return fail('unitCost', t('inventory.unitCostRequired'));
    if (buying && walletPick && !outletId && mustPickOutlet(outlets.length)) {
      return fail('outlet', t('inventory.pickOutletFirst'));
    }

    setBusy(true);
    const now = new Date().toISOString();
    try {
      // Edit: stok TIDAK ditulis ulang dari angka saat form dibuka — penjualan di
      // sela-sela akan tertimpa. Yang diterapkan hanya selisih yang diketik, di
      // atas stok terkini (cloud: RPC atomik, 0069).
      const cloud = isCloudMode();
      const fresh = editing ? await repository.get('inventory', editing.id) : null;
      const currentStock = fresh?.stock ?? editing?.stock ?? 0;
      if (editing && currentStock + stockDelta < 0) {
        throw new Error(interpolate(t('inventory.negativeStock'), { stock: String(currentStock), delta: String(stockDelta) }));
      }
      const record: InventoryItem = {
        id: editing?.id ?? newId(),
        orgId,
        // Kosong = stok dipakai bersama semua cabang (bawaan). Diisi = stok milik
        // cabang itu: hanya terlihat & terjual di sana (0070).
        outletId: outletId || null,
        name: name.trim(),
        category: category.trim(),
        sku: editing?.sku ?? '',
        // Pembelian: stok & modal diterapkan RPC (cloud) atau di bawah (lokal).
        stock: buying ? currentStock : editing ? (cloud ? currentStock : currentStock + stockDelta) : stockNum,
        minStock: Math.max(0, Math.round(Number(minStock) || 0)),
        costPrice: buying ? (editing ? (fresh?.costPrice ?? editing.costPrice) : unit) : parseRpInput(costPrice),
        sellPrice: parseRpInput(sellPrice),
        supplierId: editing?.supplierId ?? null,
        warrantyDays: warrantyDays.trim() === '' ? null : Math.max(0, Math.round(Number(warrantyDays) || 0)),
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      await repository.put('inventory', record);
      let finalStock = record.stock;
      if (buying) {
        const txOutlet = record.outletId ?? payOutlet;
        if (cloud) {
          finalStock = await purchaseInventoryStock({
            orgId,
            itemId: record.id,
            qty: added,
            unitCost: unit,
            outletId: txOutlet,
            walletId: walletPick || null,
          });
        } else {
          finalStock = currentStock + added;
          await repository.put('inventory', {
            ...record,
            stock: finalStock,
            costPrice: averageCost(currentStock, record.costPrice, added, unit),
          });
          const wallet = allWallets.find((w) => w.id === walletPick);
          if (wallet) {
            await repository.put('expenses', {
              id: newId(),
              orgId,
              outletId: txOutlet,
              date: localDateStr(),
              category: 'Sparepart',
              amount: added * unit,
              walletId: wallet.id,
              description: `Pembelian stok ${record.name} ×${added}`,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            });
            await repository.put('wallets', applyBalance(wallet, -added * unit));
          }
        }
      } else if (editing && stockDelta !== 0 && cloud) {
        finalStock = await adjustInventoryStock({ orgId, itemId: editing.id, delta: stockDelta });
      }
      logActivity({
        action: editing ? 'inventory.update' : 'inventory.create',
        entityType: 'inventory',
        entityId: record.id,
        entityLabel: record.name,
        meta: {
          stock: finalStock,
          sellPrice: record.sellPrice,
          ...(stockDelta !== 0 ? { stockDelta, reason: stockReason.trim() } : {}),
          ...(buying ? { purchased: added, unitCost: unit, paid: walletPick ? added * unit : 0 } : {}),
        },
      });
      toast.success(editing ? t('inventory.updated') : t('inventory.added'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('inventory.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Peringatan ini SARAN: dialog konfirmasi tetap dibuka apa pun hasilnya,
  // termasuk bila penghitungan gagal.
  const requestDelete = async () => {
    if (!editing) return;
    let usedIn: number;
    try {
      usedIn = repository.countActiveServicesUsingItem
        ? await repository.countActiveServicesUsingItem(editing.id)
        : services.filter(
            (s) => !['lunas', 'batal'].includes(s.status) && s.spareparts.some((sp) => sp.itemId === editing.id),
          ).length;
    } catch {
      usedIn = 0;
    }
    if (usedIn > 0) {
      toast.warning(interpolate(t('inventory.usedInServices'), { name: editing.name, n: String(usedIn) }));
    }
    setConfirmingDelete(true);
  };

  const confirmDelete = async () => {
    if (!editing) return;
    try {
      await repository.remove('inventory', editing.id);
      toast.success(t('inventory.sparepartDihapus'));
      logActivity({
        action: 'inventory.delete',
        entityType: 'inventory',
        entityId: editing.id,
        entityLabel: editing.name,
      });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('inventory.deleteFailed'));
    } finally {
      setConfirmingDelete(false);
    }
  };

  // Dua kolom selama jendela cukup lebar (container query: zoom aplikasi ikut dihitung).
  const row = 'grid gap-4 @sm/form:grid-cols-2';
  const money = 'font-mono tabular-nums placeholder:font-sans';

  return (
    <>
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? t(restock ? 'inventory.restockTitle' : 'inventory.editTitle') : t('inventory.newTitle')}
      footer={
        <>
          {/* Hapus didorong ke kiri, jauh dari Simpan. */}
          {editing && canDelete && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:bg-destructive-soft hover:text-destructive compact:mr-0"
              onClick={requestDelete}
              disabled={busy}
            >
              <Trash2 aria-hidden />
              {t('inventory.hapus')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('inventory.batal')}
          </Button>
          <Button onClick={save} disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t('inventory.simpan')}
          </Button>
        </>
      }
    >
      <div className="@container/form grid gap-4">
        <FormMessage>{error}</FormMessage>
        <Field label={t('inventory.namaSparepartProduk')} invalid={invalid('name')}>
          <TextInput
            capitalize="words"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-autofocus={!restock || undefined}
          />
        </Field>
        <Field label={t('inventory.kategori')}>
          <TextInput
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="inv-categories"
            placeholder={t('inventory.contohRamLcdBaterai')}
          />
        </Field>
        <datalist id="inv-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {outlets.length > 1 && (
          <Field label={t('inventory.cabangPemilikStok')} invalid={invalid('outlet')} hint={t('inventory.dipilihSalahSatuCabang')}>
            <SelectBox
              value={outletId}
              onValueChange={setOutletId}
              options={[
                { value: '', label: 'Semua cabang (stok bersama)' },
                ...outlets.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          </Field>
        )}
        <div className={row}>
          <Field label={t('inventory.stok')} invalid={invalid('stock')} hint={editing ? t('inventory.deltaHint') : undefined}>
            <TextInput
              type="number"
              className={money}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              data-autofocus={restock || undefined}
              // Angka lama terpilih: ketik stok baru langsung menimpanya.
              onFocus={restock ? (e) => e.currentTarget.select() : undefined}
            />
          </Field>
          <Field label={t('inventory.stokMinimum')} hint={t('inventory.untukPeringatanStokMenipis')}>
            <TextInput type="number" className={money} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </Field>
        </div>
        {added > 0 && (
          <fieldset className="m-0 grid min-w-0 gap-3 rounded-xl border border-dashed border-border bg-surface/60 p-3">
            <legend className="px-1.5 text-xs font-semibold text-muted-foreground">
              {interpolate(t('inventory.inTitle'), { qty: String(added) })}
            </legend>
            <RadioGroup
              value={inSource ?? ''}
              onValueChange={(v) => {
                setInSource(v as 'buy' | 'adjust');
                setError('');
              }}
              className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2"
            >
              {(['buy', 'adjust'] as const).map((k) => (
                // Seluruh kartu = area ketuk; cincin brand menandai pilihan.
                <label
                  key={k}
                  className="flex cursor-pointer gap-3 rounded-xl bg-card p-3 ring-1 ring-border transition-colors hover:bg-accent has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary"
                >
                  <RadioGroupItem value={k} className="mt-0.5" />
                  <span className="grid min-w-0 gap-0.5">
                    <strong className="text-sm font-semibold">
                      {t(k === 'buy' ? 'inventory.inBuy' : editing ? 'inventory.inAdjust' : 'inventory.inExisting')}
                    </strong>
                    <small className="text-xs leading-snug text-muted-foreground">
                      {t(k === 'buy' ? 'inventory.inBuyHint' : editing ? 'inventory.inAdjustHint' : 'inventory.inExistingHint')}
                    </small>
                  </span>
                </label>
              ))}
            </RadioGroup>
            {buying && (
              <>
                <div className={row}>
                  <Field label={t('inventory.unitCost')} invalid={invalid('unitCost')} hint={t('inventory.unitCostHint')}>
                    <TextInput
                      capitalize="none"
                      className={money}
                      inputMode="numeric"
                      value={unitCost}
                      onChange={(e) => setUnitCost(fmtRpInput(e.target.value))}
                      placeholder="60.000"
                    />
                  </Field>
                  <Field label={t('inventory.payFrom')}>
                    <SelectBox
                      value={walletPick || 'none'}
                      onValueChange={setPayWalletId}
                      options={[
                        ...wallets.map((w) => ({ value: w.id, label: `${w.name} · ${fmtRp(w.balance)}` })),
                        { value: 'none', label: t('inventory.payNone') },
                      ]}
                    />
                  </Field>
                </div>
                <p className="font-mono text-xs text-muted-foreground tabular-nums">
                  {interpolate(t('inventory.inReadout'), {
                    stock: String((editing?.stock ?? 0) + added),
                    cost: fmtRp(previewCost),
                  })}
                  {walletPick
                    ? ` · ${interpolate(t('inventory.inCash'), { amount: fmtRp(added * unit) })}`
                    : ` · ${t('inventory.inNoCash')}`}
                </p>
              </>
            )}
            {editing && inSource === 'adjust' && (
              <Field label={interpolate(t('inventory.deltaReason'), { delta: `+${stockDelta}` })}>
                <TextInput
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder={t('inventory.contohHasilStokOpname')}
                />
              </Field>
            )}
          </fieldset>
        )}
        {editing && stockDelta < 0 && (
          <Field label={interpolate(t('inventory.deltaReason'), { delta: String(stockDelta) })}>
            <TextInput
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value)}
              placeholder={t('inventory.contohHasilStokOpname')}
            />
          </Field>
        )}
        <div className={row}>
          <Field label={t('inventory.hargaModalHpp')} hint={buying ? t('inventory.costFromPurchase') : undefined}>
            <TextInput
              capitalize="none"
              className={money}
              inputMode="numeric"
              value={buying ? fmtRpInput(String(Math.round(previewCost))) : costPrice}
              onChange={(e) => setCostPrice(fmtRpInput(e.target.value))}
              placeholder="60.000"
              disabled={buying}
            />
          </Field>
          <Field label={t('inventory.hargaJual')}>
            <TextInput
              capitalize="none"
              className={money}
              inputMode="numeric"
              value={sellPrice}
              onChange={(e) => setSellPrice(fmtRpInput(e.target.value))}
              placeholder="100.000"
            />
          </Field>
        </div>
        <Field label={t('inventory.garansiBawaanHari')} hint={t('inventory.isianAwalGaransiSaat')}>
          <TextInput
            type="number"
            inputMode="numeric"
            className={money}
            min={0}
            value={warrantyDays}
            onChange={(e) => setWarrantyDays(e.target.value)}
            placeholder={t('inventory.kosongkanGaransiPartToko')}
          />
        </Field>
      </div>
    </FormDialog>
    <ConfirmDialog
      open={confirmingDelete}
      title={t('inventory.hapusSparepart')}
      message={interpolate(t('inventory.deleteConfirm'), { name: editing?.name ?? '' })}
      confirmLabel={t('inventory.hapus')}
      danger
      onConfirm={confirmDelete}
      onCancel={() => setConfirmingDelete(false)}
    />
    </>
  );
}
