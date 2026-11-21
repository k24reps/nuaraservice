import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/dens/select"

/*
 * Select dens-ui dari daftar opsi (Nuara, bukan bagian dens-ui), pengganti
 * `<select>` FixMaster. `id` dan `aria-*` (dari `Field` atau pemanggil) jatuh
 * ke tombol pemicunya, jadi label dan pesan galat tetap tersambung.
 *
 * Radix menolak opsi bernilai "" (dipakai untuk "tidak dipilih", mis. teknisi
 * belum ditugaskan), jadi nilai itu diganti penanda internal. Nilai "" TANPA
 * opsi "" berarti belum memilih: yang tampil `placeholder`.
 */
const EMPTY = "__kosong__"

type SelectBoxProps = {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  size?: "sm" | "default"
  disabled?: boolean
  className?: string
  id?: string
  /** Fokus awal di FormDialog (lihat form-dialog.tsx), bukan autoFocus. */
  "data-autofocus"?: boolean
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

function SelectBox({
  value,
  onValueChange,
  options,
  placeholder,
  size,
  disabled,
  className,
  ...trigger
}: SelectBoxProps) {
  const hasEmpty = options.some((o) => o.value === "")
  const toItem = (v: string) => (v === "" ? EMPTY : v)
  return (
    <Select
      value={value === "" && !hasEmpty ? "" : toItem(value)}
      onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger size={size} className={className} {...trigger}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY} value={toItem(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { SelectBox }
