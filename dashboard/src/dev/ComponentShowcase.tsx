import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  MessageCircleIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  Settings2Icon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/dens/alert';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { NotFoundPage } from '@/components/NotFoundPage';
import { DensitySwitch, ZoomGauge, ZoomStepper } from '@/components/layout/DisplayControls';
import { LoadState } from '@/components/ui/LoadState';
import { Term } from '@/components/ui/Term';
import { Badge, StatusDot } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/dens/card';
import { Checkbox } from '@/components/dens/checkbox';
import { Combobox } from '@/components/dens/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/dens/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/dens/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/dens/dropdown-menu';
import { Input, InputGroup } from '@/components/dens/input';
import { Label } from '@/components/dens/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/dens/popover';
import { Progress } from '@/components/dens/progress';
import { RadioGroup, RadioGroupItem } from '@/components/dens/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/dens/select';
import { Separator } from '@/components/dens/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/dens/sheet';
import { Skeleton, SkeletonText } from '@/components/dens/skeleton';
import { Toaster, toast } from '@/components/dens/sonner';
import { Switch } from '@/components/dens/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/dens/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/dens/tabs';
import { Textarea } from '@/components/dens/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/dens/tooltip';

/**
 * Katalog komponen dens-ui bertema Nuara di `/dev/komponen`, KHUSUS dev server
 * (App.tsx memasangnya di balik `import.meta.env.DEV`). Dipakai untuk foto,
 * pemeriksaan kontras DOM, dan sebagai acuan saat memindah halaman di Fase B.
 *
 * Teks di sini contoh untuk alat pengembang, bukan teks produk, jadi tidak
 * lewat i18n. Angka dan nama adalah contoh, bukan data Nuara.
 */

// Pemetaan badge tahap tiket menurut DBD bagian 3.
const STAGES = [
  { label: 'Diterima', variant: 'info' },
  { label: 'Diagnosa', variant: 'info' },
  { label: 'Konfirmasi biaya', variant: 'highlight' },
  { label: 'Tunggu part', variant: 'warning' },
  { label: 'Pengerjaan', variant: 'info' },
  { label: 'Selesai', variant: 'success' },
  { label: 'Diambil', variant: 'success' },
  { label: 'Dibatalkan', variant: 'destructive-soft' },
  { label: 'Dikembalikan', variant: 'info' },
] as const;

const PARTS = [
  { value: 'lcd-a12', label: 'LCD Samsung A12', hint: 'stok 3' },
  { value: 'bat-rn8', label: 'Baterai Redmi Note 8', hint: 'stok 0' },
  { value: 'ssd-512', label: 'SSD SATA 512 GB', hint: 'stok 5' },
  { value: 'kb-x441', label: 'Keyboard Asus X441', hint: 'stok 1' },
];

const TICKETS = [
  { no: 'NS-00012', unit: 'Laptop Asus X441', stage: 2, total: 450000 },
  { no: 'NS-00013', unit: 'HP Samsung A12', stage: 5, total: 1250000 },
  { no: 'NS-00014', unit: 'TV LED 32 inci', stage: 7, total: 0 },
];

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ComponentShowcase() {
  const [part, setPart] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  return (
    <TooltipProvider>
      <div data-nu className="min-h-dvh">
        <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
          <header className="flex flex-wrap items-center gap-3">
            <img
              src="/logo-mark.png"
              alt=""
              width="40"
              height="40"
              className="rounded-xl"
            />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-[-0.02em]">
                Komponen dens-ui, tema Nuara
              </h1>
              <p className="text-sm text-muted-foreground">
                Fondasi L-46. Halaman ini hanya ada di dev server.
              </p>
            </div>
            <Badge variant="outline" className="ml-auto font-mono">
              <StatusDot tone="highlight" /> DEV
            </Badge>
          </header>

          <Section title="Tombol">
            <div className="flex flex-wrap items-center gap-3">
              <Button>
                <PlusIcon /> Tiket baru
              </Button>
              <Button variant="ink">Simpan</Button>
              <Button variant="highlight">Tindak lanjuti</Button>
              <Button variant="soft">Tandai selesai</Button>
              <Button variant="secondary">Batal</Button>
              <Button variant="outline">
                <PrinterIcon /> Cetak
              </Button>
              <Button variant="ghost">Lainnya</Button>
              <Button variant="destructive">Batalkan tiket</Button>
              <Button variant="link">Lihat riwayat</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Kecil</Button>
              <Button>Bawaan</Button>
              <Button size="lg">Besar</Button>
              <Button size="icon" aria-label="Pengaturan">
                <Settings2Icon />
              </Button>
              <Button disabled>Nonaktif</Button>
            </div>
          </Section>

          <Section title="Badge tahap tiket (DBD bagian 3)">
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <Badge key={s.label} variant={s.variant}>
                  {s.label}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="highlight">
                <StatusDot tone="destructive" /> Perlu ditindaklanjuti
              </Badge>
              <Badge variant="warning">Stok menipis</Badge>
              <Badge variant="outline">Express</Badge>
              <Badge variant="secondary">Link belum dikirim</Badge>
              <Badge variant="default">Lunas</Badge>
            </div>
          </Section>

          <Section title="Kartu">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tiket aktif</CardTitle>
                  <CardDescription>Unit yang belum diambil pelanggan.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-semibold tabular-nums">14</p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">
                    Buka antrean
                  </Button>
                </CardFooter>
              </Card>
              <Card className="bg-highlight-soft ring-highlight/40">
                <CardHeader>
                  <CardTitle>Perlu tindakan</CardTitle>
                  <CardDescription className="text-foreground/80">
                    3 tiket menunggu jawaban pelanggan lebih dari 2 hari.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card variant="inset">
                <CardHeader>
                  <CardTitle>Sumur (inset)</CardTitle>
                  <CardDescription>Latar tersembunyi di dalam panel.</CardDescription>
                </CardHeader>
              </Card>
              <Card variant="brand">
                <CardHeader>
                  <CardTitle>Kas hari ini</CardTitle>
                  <CardDescription className="text-brand-foreground/80">
                    Satu panel brand per layar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-semibold tabular-nums">
                    {rupiah(1250000)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Formulir">
            <Card>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nama">Nama pelanggan</Label>
                  <Input id="nama" placeholder="Nama lengkap" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="wa">Nomor WA</Label>
                  <Input
                    id="wa"
                    defaultValue="0812"
                    aria-invalid
                    aria-describedby="wa-error"
                  />
                  <p id="wa-error" className="text-sm text-destructive">
                    Nomor WA 08xx harus 10 sampai 13 digit.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cari">Cari tiket</Label>
                  <InputGroup start={<SearchIcon aria-hidden className="size-4" />}>
                    <Input id="cari" placeholder="Nomor, nama, atau WA" />
                  </InputGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jenis">Jenis perangkat</Label>
                  <Select>
                    <SelectTrigger id="jenis">
                      <SelectValue placeholder="Pilih jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop/PC</SelectItem>
                      <SelectItem value="hp">HP</SelectItem>
                      <SelectItem value="rumah">Elektronik rumah tangga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="part">Sparepart</Label>
                  <Combobox
                    id="part"
                    options={PARTS}
                    value={part}
                    onValueChange={setPart}
                    placeholder="Pilih sparepart"
                    searchPlaceholder="Cari nama barang"
                    emptyText="Barang tidak ditemukan."
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="keluhan">Keluhan</Label>
                  <Textarea id="keluhan" placeholder="Mati total setelah kena air" />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="charger" defaultChecked />
                  <Label htmlFor="charger">Charger ikut dititipkan</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="kabar" checked={notify} onCheckedChange={setNotify} />
                  <Label htmlFor="kabar">Kirim kabar WA saat selesai</Label>
                </div>
                <RadioGroup
                  defaultValue="tunai"
                  className="sm:col-span-2"
                  aria-label="Akun kas"
                >
                  {['Tunai', 'Rekening', 'QRIS'].map((k) => (
                    <div key={k} className="flex items-center gap-3">
                      <RadioGroupItem value={k.toLowerCase()} id={`kas-${k}`} />
                      <Label htmlFor={`kas-${k}`}>{k}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </Section>

          <Section title="Tab dan tabel">
            <Tabs defaultValue="aktif">
              <TabsList>
                <TabsTrigger value="aktif">Aktif</TabsTrigger>
                <TabsTrigger value="selesai">Selesai</TabsTrigger>
                <TabsTrigger value="batal">Dibatalkan</TabsTrigger>
              </TabsList>
              <TabsContent value="aktif">
                <Card className="py-2">
                  <CardContent>
                    <Table>
                      <TableCaption className="sr-only">Contoh daftar tiket</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nomor</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Tahap</TableHead>
                          <TableHead className="text-right">Biaya</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {TICKETS.map((t) => (
                          <TableRow key={t.no}>
                            <TableCell className="font-mono tabular-nums">
                              {t.no}
                            </TableCell>
                            <TableCell>{t.unit}</TableCell>
                            <TableCell>
                              <Badge variant={STAGES[t.stage].variant}>
                                {STAGES[t.stage].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {rupiah(t.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="selesai">
                <p className="text-sm text-muted-foreground">
                  Belum ada tiket selesai hari ini.
                </p>
              </TabsContent>
              <TabsContent value="batal">
                <p className="text-sm text-muted-foreground">
                  Belum ada tiket dibatalkan.
                </p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Peringatan, progres, kerangka">
            <div className="grid gap-3">
              <Alert>
                <MessageCircleIcon aria-hidden />
                <AlertTitle>Link tracking belum dikirim</AlertTitle>
                <AlertDescription>
                  Tiket NS-00012 dibuat. Kirim link tracking ke pelanggan.
                </AlertDescription>
              </Alert>
              <Alert variant="highlight">
                <AlertTitle>Estimasi menunggu persetujuan</AlertTitle>
                <AlertDescription>
                  Tahap Pengerjaan terkunci sampai persetujuan tercatat.
                </AlertDescription>
              </Alert>
              <Alert variant="soft">
                <AlertTitle>Pembayaran tercatat</AlertTitle>
                <AlertDescription>Sisa tagihan Rp0.</AlertDescription>
              </Alert>
              <Alert variant="warning">
                <AlertTitle>Stok menipis</AlertTitle>
                <AlertDescription>2 barang di bawah stok minimum.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Gagal menyimpan</AlertTitle>
                <AlertDescription>
                  Koneksi terputus. Isian tetap di form; coba lagi.
                </AlertDescription>
              </Alert>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Progress value={62} aria-label="Target bulan ini" />
              <Progress value={35} tone="highlight" aria-label="Stok" />
              <Progress value={80} tone="ink" aria-label="Absensi" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24" />
              <SkeletonText lines={3} />
            </div>
          </Section>

          <Section title="Komponen kerangka (L-68)">
            <MemoryRouter>
              <div className="grid gap-6">
                <LoadState queries={[{ loading: true, error: null, refetch: () => undefined }]} />
                <LoadState queries={[{ loading: false, error: new Error('contoh'), refetch: () => undefined }]} />
                <p className="text-sm">
                  Istilah di dalam kalimat: <Term id="arus-kas-bersih">Arus Kas Bersih</Term> bulan ini.
                </p>
                <ZoomGauge />
                <DensitySwitch />
                <ZoomStepper />
                <ErrorFallback error={new Error('Contoh galat render')} onRetry={() => undefined} />
                <NotFoundPage />
              </div>
            </MemoryRouter>
          </Section>

          <Section title="Lapisan (dialog, panel, laci, menu)">
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Batalkan tiket NS-00012?</DialogTitle>
                    <DialogDescription>
                      Password atau pola unit ikut dihapus. Biaya cek boleh Rp0.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="secondary">Kembali</Button>
                    <Button variant="destructive">Batalkan tiket</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Panel samping</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Saring tiket</SheetTitle>
                    <SheetDescription>
                      Tahap, teknisi, dan perlu tindakan.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetFooter>
                    <Button>Terapkan</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">Laci bawah</Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Tambah sparepart</DrawerTitle>
                    <DrawerDescription>Stok berkurang saat disimpan.</DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter>
                    <Button>Simpan</Button>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="text-sm">
                    Garansi jasa 30 hari, sparepart 7 hari (contoh).
                  </p>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Ubah data</DropdownMenuItem>
                  <DropdownMenuItem>Cetak ulang</DropdownMenuItem>
                  <Separator className="my-1" />
                  <DropdownMenuItem variant="destructive">
                    Batalkan tiket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Cetak tanda terima">
                    <PrinterIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cetak tanda terima</TooltipContent>
              </Tooltip>
              <Button
                variant="soft"
                onClick={() => toast.success('Tiket NS-00012 dibuat.')}
              >
                Toast
              </Button>
            </div>
          </Section>
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
