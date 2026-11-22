import { TextInput } from '@/components/dens/text-input';
import type { ServiceSparepart } from '@/data/types';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

/** Pilihan cepat hari garansi. "Tanpa" = 0, supaya tanpa garansi selalu disengaja. */
export function WarrantyPresets({
  presets,
  onPick,
  what,
}: {
  presets: number[];
  onPick: (days: number) => void;
  what: string;
}) {
  const t = useT();
  return (
    // data-nu: juga dipakai PartWarrantyModal yang masih FixMaster (L-60); tanpa
    // atribut ini tombolnya kehilangan reset dens-ui dan mewarisi gaya tombol lama.
    // bg-transparent: [data-nu] memberi latar halaman, yang di sini tak diinginkan.
    <div data-nu className="flex flex-wrap items-center gap-1.5 bg-transparent">
      {[0, ...presets.filter((d) => d > 0)].map((d) => (
        <button
          key={d}
          type="button"
          className="inline-flex h-7 items-center rounded-full bg-card px-2.5 text-xs font-medium text-muted-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          onClick={() => onPick(d)}
          title={
            d === 0
              ? interpolate(t('partWarranty.noneTitle'), { what })
              : interpolate(t('partWarranty.daysTitle'), { what, n: String(d) })
          }
        >
          {d === 0 ? t('partWarranty.none') : interpolate(t('partWarranty.days'), { n: String(d) })}
        </button>
      ))}
    </div>
  );
}

/**
 * Garansi per sparepart (hari), untuk part dari stok maupun modal dadakan.
 * `values[i]` milik `parts[i]`; 0 = tanpa garansi. Dipakai form Selesai dan
 * modal "Garansi part" di detail servis.
 */
export function PartWarrantyFields({
  parts,
  values,
  onChange,
  presets,
}: {
  parts: ServiceSparepart[];
  values: string[];
  onChange: (index: number, value: string) => void;
  presets: number[];
}) {
  const t = useT();
  return (
    // data-nu: lihat WarrantyPresets.
    <div data-nu className="flex flex-col gap-3 bg-transparent">
      {parts.map((p, i) => (
        <div
          key={`${p.itemId ?? 'm'}-${i}`}
          className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-2 gap-y-1 [&>[data-nu]]:col-span-full"
        >
          <span className="truncate text-sm text-foreground" title={p.name}>
            {p.name}
            {p.kind === 'manual' ? '' : ` ×${p.qty}`}
          </span>
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            className="font-mono tabular-nums"
            value={values[i] ?? ''}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder="0"
            aria-label={interpolate(t('partWarranty.fieldAria'), { name: p.name })}
          />
          <WarrantyPresets presets={presets} onPick={(d) => onChange(i, String(d))} what={p.name} />
        </div>
      ))}
    </div>
  );
}
