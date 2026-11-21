import { describe, expect, it } from 'vitest';
import tsxRaw from './ServicesPage.tsx?raw';
import modalTsxRaw from './ServiceModal.tsx?raw';
import detailTsxRaw from './ServiceDetailPage.tsx?raw';
import pickerTsxRaw from './SparepartPickerModal.tsx?raw';
import pickerCssRaw from './SparepartPickerModal.module.css?raw';
import detailCssRaw from './ServiceDetailPage.module.css?raw';
import appCssRaw from '../../styles/app.css?raw';
import themeRaw from '../../styles/nuara-theme.css?raw';
import { STATUS_BADGE } from '@/lib/business/services';
import { id } from '@/i18n/id';

// Checkout Windows (core.autocrlf) memberi CRLF pada ?raw; pola di bawah memakai LF.
const lf = (s: string) => s.replace(/\r\n/g, '\n');
const tsx = lf(tsxRaw);
const modalTsx = lf(modalTsxRaw);
const detailTsx = lf(detailTsxRaw);
const pickerTsx = lf(pickerTsxRaw);
const pickerCss = lf(pickerCssRaw);
const detailCss = lf(detailCssRaw);
const appCss = lf(appCssRaw);
const theme = lf(themeRaw);

const rem = (v: string) => parseFloat(v) * 16;
const num = '(\\d+(?:\\.\\d+)?)';
const pick = (re: RegExp, src: string) => {
  const m = re.exec(src);
  if (!m) throw new Error(`tak ketemu: ${re}`);
  return m;
};
// Ukuran teks tema Nuara (nuara-theme.css), dalam px.
const textPx = (name: string) => rem(pick(new RegExp(`--text-${name}:\\s*${num}rem`), theme)[1]);
// Kelas utilitas spasi Tailwind (gap-x-3, pl-4, ...) dalam px: 1 satuan = 4px.
const spacePx = (cls: string, src: string) => Number(pick(new RegExp(`\\b${cls}-${num}\\b`), src)[1]) * 4;

/**
 * Tampilan Daftar Servis berupa baris seperti Inventori & Kasir, bukan tabel.
 * Tabel dulu harus diukur lalu jatuh ke kartu saat tak muat, sehingga "Daftar"
 * sering tampil sebagai kartu. Tes ini tidak mengukur piksel (tak bisa di
 * jsdom); ia mengunci mekanismenya. Sejak L-48 tata letaknya kelas Tailwind di
 * ServicesPage.tsx (ROW_*, TABLE_AT), bukan CSS Module.
 */
describe('tampilan Daftar servis', () => {
  it('baris dengan container query, bukan tabel yang diukur lalu jatuh ke kartu', () => {
    expect(tsx).not.toContain('<table');
    expect(tsx).not.toContain('data-fit');
    expect(tsx).not.toContain('ResizeObserver');
    expect(tsx).toContain('className="@container/svc"');
  });

  it('kelas Tailwind halaman ini benar-benar dibuat: berkasnya ada di @source', () => {
    // Tanpa ini semua kelas di bawah hanya teks: Tailwind hanya memindai @source.
    expect(appCss).toContain('@source "../features/services/ServicesPage.tsx";');
    expect(appCss).toContain('@source "../features/services/ServiceModal.tsx";');
    // Halaman FixMaster di folder yang sama (detail, modal L-49) belum dipindai.
    expect(appCss).not.toContain('@source "../features/services";');
    expect(tsx).toContain('<div data-nu ');
  });

  it('tampilan ditentukan perangkat: kartu di <=1024px (DBD 4, P17.3), daftar di atasnya, tanpa pemilih', () => {
    expect(tsx).toContain("const CARDS_QUERY = '(max-width: 1024px)';");
    expect(tsx).toContain("useMediaQuery(CARDS_QUERY) ? 'cards' : 'list'");
    // Ambangnya sama dengan laci sidebar, supaya tablet melihat kartu tepat saat sidebar jadi laci.
    expect(appCss).toContain('@custom-variant drawer (@media (max-width: 1024px));');
    expect(tsx).not.toContain('ViewToggle');
    expect(tsx).not.toContain('usePersistedView');
    expect(tsx).not.toContain("'tiles'");
    // Kartu satu atau dua kolom mengikuti lebar, tanpa breakpoint.
    expect(tsx).toContain('grid-cols-[repeat(auto-fill,minmax(min(18.75rem,100%),1fr))]');
  });

  it('segmen opsional dan lajurnya mengikuti pengaturan kolom', () => {
    for (const col of ['customer', 'device']) {
      expect(tsx).toContain(`cols.has('${col}') && 'minmax(`);
    }
    expect(tsx).toContain("showTech && 'minmax(");
    for (const col of ['customer', 'device', 'cost']) {
      expect(tsx).toContain(`cols.has('${col}') && (`);
    }
    expect(tsx).toContain('showTech && (');
    expect(tsx).toContain("style={{ '--row-cols': rowTracks } as CSSProperties}");
    expect(tsx).toContain('grid-cols-(--row-cols)');
  });

  it('kolom Teknisi hilang sendiri bila toko tak punya yang bisa dibedakan', () => {
    // Yang dihitung nama pada tiket, bukan jumlah karyawan aktif (semua karyawan
    // bisa dipilih jadi teknisi, jadi demo berkaryawan banyak tetap satu nama).
    expect(tsx).toContain("const showTech = cols.has('technician') && distinctTechs > 1;");
    expect(tsx).toContain("new Set(services.map((s) => s.technicianName || '')).size");
    // Header, segmen, dan lajur semuanya lewat showTech; tak ada yang membaca kolomnya langsung.
    expect(tsx.match(/cols\.has\('technician'\)/g)).toHaveLength(1);
  });

  it('aksi cepat sparepart: pemilih dan jalur simpan sama dengan detail tiket', () => {
    expect(tsx).toContain('canQuickAddParts(s.status) && (');
    expect(tsx).toContain('<SparepartPickerModal');
    expect(tsx).toContain('await addServicePart(partsService, line)');
    // Lajur aksi memuat tiga tombol 40px; membuka tiket = klik barisnya.
    expect(tsx).toContain("const ROW_COST =\n  'grid-cols-[minmax(0,1fr)_11rem_9rem_7.5rem]");
    expect(tsx).toContain("const ROW_NO_COST =\n  'grid-cols-[minmax(0,1fr)_11rem_7.5rem]");
    expect(rem('7.5')).toBe(3 * 40);
    // Layar sentuh: tiga tombol 44px, bukan empat, selama lajurnya tetap.
    expect(tsx).toContain('pointer-coarse:@min-[861px]/svc:grid-cols-[minmax(0,1fr)_11rem_9rem_8.25rem]');
    expect(tsx).toContain('pointer-coarse:@min-[861px]/svc:grid-cols-[minmax(0,1fr)_11rem_8.25rem]');
    expect(rem('8.25')).toBe(3 * 44);
  });

  it('seluruh baris membuka tiket; ikon "Lihat tiket" hanya tersisa di Kartu', () => {
    expect(tsx).toContain('onClick={(e) => openTicket(e, s.id)}');
    // Kontrol di dalam baris, seleksi teks, dan klik bermodifikasi tidak ikut membuka.
    expect(tsx).toContain("closest('a, button, input, select, textarea, label')");
    expect(tsx).toContain('window.getSelection()?.toString()');
    expect(tsx).toContain('{renderActions(s)}');
    expect(tsx).toContain('{renderActions(s, true)}');
    expect(tsx).toContain('{viewLink && (');
    const li = tsx.slice(tsx.indexOf('<li\n                  key={s.id}'), tsx.indexOf('onClick={(e) => openTicket'));
    expect(li).toContain('cursor-pointer');
  });

  it('judul kolom tampil hanya bila lantai semua lajur muat sebaris', () => {
    // Bawaan = mengalir dan tanpa judul; tabel hanya dari ambang min-width wadah.
    const head = tsx.slice(tsx.indexOf('data-row-head'), tsx.indexOf('<ul className'));
    expect(head).toMatch(/'hidden min-h-0/);
    expect(head).toContain('wide.head');
    expect(tsx).toContain('data-segs={segCount}');
    expect(tsx).toContain("const wide = TABLE_AT[segCount === 5 ? 5 : 4];");
    expect(tsx).toContain("head: '@min-[1156px]/svc:grid'");
    expect(tsx).toContain("head: '@min-[1056px]/svc:grid'");
  });

  it('ambang tabel tak lebih kecil dari jumlah lantai lajur + lajur kanan', () => {
    // Lantai tiap segmen, dibaca dari tracks di TSX.
    const floors = {
      id: rem(pick(new RegExp(`const tracks = \\[\\s*'${num}rem'`), tsx)[1]),
      customer: rem(pick(new RegExp(`cols\\.has\\('customer'\\) && 'minmax\\(${num}rem`), tsx)[1]),
      device: rem(pick(new RegExp(`cols\\.has\\('device'\\) && 'minmax\\(${num}rem`), tsx)[1]),
      notes: rem(pick(new RegExp(`showNotes && \`minmax\\(${num}rem`), tsx)[1]),
      tech: rem(pick(new RegExp(`showTech && 'minmax\\(${num}rem`), tsx)[1]),
    };
    const rowCost = pick(/const ROW_COST =\n {2}'([^']+)'/, tsx)[1];
    const rowBase = pick(/const ROW_BASE =\n {2}'([^']+)'/, tsx)[1];
    const lanes = pick(new RegExp(`grid-cols-\\[minmax\\(0,1fr\\)_${num}rem_${num}rem_${num}rem\\]`), rowCost);
    // Jarak antarlajur baris (gap-x-4) dan antarsegmen saat tabel (gap-x-3), padding kiri + kanan.
    const laneGap = spacePx('gap-x', rowBase);
    const segGap = spacePx('gap-x', pick(/main: '([^']+)'/, tsx)[1].replace(/@min-\[\d+px\]\/svc:/g, ''));
    const pad = spacePx('pl', rowBase) + spacePx('pr', rowBase);
    const right = rem(lanes[1]) + rem(lanes[2]) + rem(lanes[3]) + 3 * laneGap + pad;
    const need = (segs: number[]) => segs.reduce((a, b) => a + b, 0) + (segs.length - 1) * segGap + right;
    const five = need([floors.id, floors.customer, floors.device, floors.notes, floors.tech]);
    const four = need([floors.id, floors.customer, floors.device, floors.notes]);
    const t5 = Number(pick(/5: \{\s*head: '@min-\[(\d+)px\]/, tsx)[1]);
    const t4 = Number(pick(/4: \{\s*head: '@min-\[(\d+)px\]/, tsx)[1]);
    expect(t5).toBeGreaterThanOrEqual(five);
    expect(t4).toBeGreaterThanOrEqual(four);
    // Persis, tak dibulatkan: pembulatan membuang ruang (Padat di 1366px = wadah 1056px).
    expect(t5 - five).toBeLessThan(8);
    expect(t4 - four).toBeLessThan(8);
    // Setiap kelas tabel memakai ambang yang sama dengan judulnya.
    for (const [n, t] of [[5, t5], [4, t4]] as const) {
      const block = pick(new RegExp(`${n}: \\{([^}]+)\\}`), tsx)[1];
      expect(block.match(/@min-\[(\d+)px\]/g)?.every((m) => m === `@min-[${t}px]`)).toBe(true);
    }
  });

  it('wadah sempit: biaya dan aksi turun ke baris kedua (<=860px), hanya identitas tiket di <=520px', () => {
    const rowBase = pick(/const ROW_BASE =\n {2}'([^']+)'/, tsx)[1];
    // @max-[861px] = lebar < 861px = <=860px, sama dengan CSS FixMaster.
    expect(rowBase).toContain('@max-[861px]/svc:grid-cols-[minmax(0,1fr)_auto]');
    expect(rowBase).toContain('@max-[861px]/svc:[grid-template-areas:"main_status"_"cost_actions"]');
    for (const seg of ['notes', 'technician']) {
      const cell = tsx.slice(tsx.lastIndexOf('className=', tsx.indexOf(`data-seg="${seg}"`)), tsx.indexOf(`data-seg="${seg}"`));
      expect(cell).toContain('@max-[521px]/svc:hidden');
    }
  });

  it('nomor tiket dan nomor HP muat utuh di lajurnya, bukan dipotong elipsis', () => {
    // Lebar mono = 0,6em per karakter (JetBrains Mono).
    const floor = (re: RegExp) => rem(pick(re, tsx)[1]);
    // Nomor HP terpanjang yang wajar: "+62 812-3456-78901" (18 karakter), mono text-xs.
    const phoneNeed = 18 * 0.6 * textPx('xs');
    expect(floor(/cols\.has\('customer'\) && 'minmax\((\d+(?:\.\d+)?)rem/)).toBeGreaterThanOrEqual(phoneNeed);
    expect(tsx).toContain('className="block max-w-full truncate font-mono text-xs text-muted-foreground');
    // Nomor tiket terpanjang: awalan 5 huruf (batas Wizard) + "-" + 6 digit, mono text-sm tebal.
    const idNeed = 12 * 0.6 * textPx('sm');
    expect(floor(/const tracks = \[\s*'(\d+(?:\.\d+)?)rem'/)).toBeGreaterThanOrEqual(idNeed);
    const idCell = tsx.slice(tsx.indexOf('data-seg="id"'));
    expect(idCell.slice(0, 900)).toContain('className="whitespace-nowrap font-mono font-semibold');
    expect(tsx.slice(tsx.lastIndexOf('<div', tsx.indexOf('data-seg="id"')), tsx.indexOf('data-seg="id"'))).toContain(
      'text-sm',
    );
  });

  it('tombol status muat di lajur Status: label terpanjang tak menjorok dari lajurnya', () => {
    const lane = rem(pick(/grid-cols-\[minmax\(0,1fr\)_(\d+(?:\.\d+)?)rem_/, tsx)[1]);
    const btn = pick(/className="group\/status ([^"]+)"/, tsx)[1];
    const padX = spacePx('px', btn);
    expect(btn).toContain(`-mx-${padX / 4}`);
    const gap = spacePx('gap', btn);
    const pencil = spacePx('size', tsx.slice(tsx.indexOf('<Pencil\n        aria-hidden\n        className="')));
    // Lencana dens-ui: padding px-2.5 tiap sisi, teks text-xs. Figtree proporsional;
    // 0,6em per huruf adalah batas atas yang aman untuk label campuran kapital/kecil.
    const longest = Math.max(
      ...Object.entries(id)
        .filter(([k]) => k.startsWith('statusLabel.'))
        .map(([, v]) => v.length),
    );
    const badge = 2 * 10 + longest * 0.6 * textPx('xs');
    // Margin negatif = padding: kotak mulai satu padding di kiri lajur, ujung kanannya
    // tak boleh melewati tepi lajur.
    expect(badge + gap + pencil + padX).toBeLessThanOrEqual(lane);
    // Bahasa UI terkunci Indonesia; tinjau ulang bila kunci bahasa dibuka.
  });

  it('nama pelanggan boleh dua baris dan punya title; nomor HP juga', () => {
    expect(tsx).toContain('title={s.customerName || undefined}');
    expect(tsx).toContain('title={s.customerPhone || undefined}');
    expect(tsx).toContain('className="line-clamp-2 max-w-full font-semibold text-foreground [overflow-wrap:anywhere]"');
  });

  it('warna status satu peta untuk Daftar dan Kartu, sesuai DBD (Lunas hijau, P17.2)', () => {
    // Satu renderStatus dipakai kedua tampilan, jadi satu status tak pernah punya dua warna.
    expect(tsx.match(/variant=\{STATUS_BADGE\[s\.status\]\}/g)).toHaveLength(1);
    expect(tsx.match(/\{renderStatus\(s\)\}/g)).toHaveLength(2);
    expect(STATUS_BADGE).toEqual({
      diterima: 'info',
      diagnosa: 'info',
      konfirmasi: 'highlight',
      tunggu: 'warning',
      pengerjaan: 'info',
      selesai: 'success',
      lunas: 'success',
      batal: 'destructive-soft',
    });
    // Spine warna di tepi baris (motif FixMaster) tidak dibawa ke dens-ui.
    expect(tsx).not.toContain('data-tone=');
  });

  it('strip tiket di pemilih sparepart memakai spine yang sama dengan baris (peta STATUS_TONE)', () => {
    // Spine resmi, bukan "side-stripe" hiasan: warnanya status tiket, dari peta yang sama.
    expect(pickerTsx).toContain('data-tone={STATUS_TONE[ticket.status]}');
    expect(pickerCss).toMatch(/\.context \{[^}]*border-left: 3px solid var\(--text-muted\);/);
    const tones: Record<string, string> = {
      info: '--info',
      warning: '--warning',
      accent: '--accent',
      success: '--success',
      danger: '--danger',
    };
    for (const [tone, token] of Object.entries(tones)) {
      expect(pickerCss).toContain(`.context[data-tone='${tone}'] {\n  border-left-color: var(${token});\n}`);
    }
    // Warna hanya lewat token: tak ada hex di berkasnya.
    expect(pickerCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('kartu biaya di detail tiket berbingkai 1px (tanpa tepi kiri tebal) dan angka besar memakai token', () => {
    const notice = detailCss.slice(detailCss.indexOf('.costNotice {'));
    const noticeBody = notice.slice(0, notice.indexOf('}'));
    expect(noticeBody).not.toContain('border-left-width');
    expect(detailCss).not.toMatch(/font-size:\s*3rem/);
    expect(detailCss).toMatch(/\.nfCode \{[^}]*font-size: var\(--text-3xl\);/);
  });

  it('status ambil dan tertahan satu zona di lajur status, titiknya tak terjepit', () => {
    const device = tsx.slice(tsx.indexOf('data-seg="device"'), tsx.indexOf('data-seg="notes"'));
    expect(device).not.toContain('renderPickup');
    const lane = tsx.slice(tsx.indexOf('[grid-area:status] @max-[861px]'));
    const laneBody = lane.slice(0, lane.indexOf('</div>'));
    expect(laneBody).toContain('{renderStatus(s)}');
    expect(laneBody.indexOf('{renderPickup(s)}')).toBeGreaterThan(laneBody.indexOf('{renderStatus(s)}'));
    expect(laneBody.indexOf('{renderStall(s)}')).toBeGreaterThan(laneBody.indexOf('{renderPickup(s)}'));
    expect(tsx).toContain('className="size-2 shrink-0 rounded-full bg-highlight"');
  });

  it('tombol yang berulang tiap baris menyebut tiketnya untuk pembaca layar', () => {
    // Tombol status: nama memuat teks lencana (label-in-name) + nomor tiket.
    expect(tsx).toContain("aria-label={interpolate(t('services.statusChangeAria'), {");
    // Tombol ikon (sparepart, lihat tiket, WhatsApp, ubah) menunjuk nomor tiketnya.
    expect(tsx.match(/aria-describedby=\{noId\(s\)\}/g)).toHaveLength(4);
    // Nomor tiket di Daftar dan di Kartu memegang id-nya.
    expect(tsx.match(/ id=\{noId\(s\)\}/g)).toHaveLength(2);
    expect(tsx).toContain('const noId = (s: Service) => `svc-no-${s.id}`;');
    // Tombol ambil (manajer): nama memuat teks yang terlihat, tiket, dan akibat klik.
    expect(tsx).toContain(
      "aria-label={`${t(s.pickedUp ? 'services.pickedUp' : 'services.notPickedUp')} ${s.serviceNo}. ${action}`}",
    );
    // Pensil di tombol status juga tampil saat fokus keyboard, bukan hanya hover.
    expect(tsx).toContain('group-focus-visible/status:opacity-100');
  });

  it('label margin lewat teks tersembunyi; aria-label pada <span> tak dibacakan', () => {
    expect(tsx).not.toMatch(/<span[^>]*aria-label=\{interpolate\(t\('services\.(modal|profit)Aria'\)/);
    expect(tsx).toContain('<span aria-hidden>-{fmtNumber(modal)}</span>');
    expect(tsx).toContain("interpolate(t('services.modalAria'), { amount: fmtRp(modal) })");
    expect(tsx).toContain("interpolate(t('services.profitAria'), { amount: fmtRp(profit) })");
    expect(tsx.match(/className="sr-only"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('judul kolom yang hanya label disembunyikan dari pembaca layar; tiap sel membawa labelnya sendiri', () => {
    // Wadah judul TIDAK aria-hidden (isinya tombol urut yang bisa difokus): ia grup berlabel,
    // dan hanya label murni (Perangkat, Keluhan/Penanganan, Teknisi, Aksi) yang aria-hidden.
    const head = tsx.slice(tsx.indexOf('data-row-head'), tsx.indexOf('<ul className'));
    expect(head).toContain('role="group"');
    expect(head).toContain("aria-label={t('services.sortAria')}");
    expect(head.slice(0, head.indexOf('>'))).not.toContain('aria-hidden');
    expect(head).toContain('<span aria-hidden="true">{t(\'services.colDevice\')}</span>');
    expect(head).toContain('<span aria-hidden="true">{t(\'services.colTech\')}</span>');
    for (const key of ['colCustomer', 'colDevice', 'colTech', 'colCost']) {
      expect(tsx).toContain(`{srLabel('services.${key}')}`);
    }
    // Label keluhan/penanganan yang mengulang judul disembunyikan secara visual
    // (sr-only), bukan display: none (yang menghapusnya dari pohon aksesibilitas).
    expect(tsx.match(/showComplaint !== showFix && wide\.srOnly/g)).toHaveLength(2);
    expect(tsx).toContain("srOnly: '@min-[1156px]/svc:sr-only'");
    expect(tsx).not.toMatch(/<b className=\{cn\([^)]*hidden/);
  });

  it('urut per kolom: empat judul adalah tombol, dropdown memuat nilai yang sama dan keduanya satu state', () => {
    const head = tsx.slice(tsx.indexOf('data-row-head'), tsx.indexOf('<ul className'));
    for (const [column, label] of [
      ['date', "t('services.colNo')"],
      ['customer', "t('services.colCustomer')"],
      ['status', "t('common.status')"],
    ]) {
      expect(head).toContain(`sortHead('${column}', ${label})`);
    }
    expect(head).toContain("sortHead('cost', t('services.colCost'), true)");
    // Tombol sungguhan, bukan div ber-onClick; tanpa aria-sort (tak sah di luar columnheader).
    expect(tsx).toMatch(/<button\s+type="button"\s+className=\{cn\(\s*'group\/sort /);
    expect(tsx).not.toContain('aria-sort=');
    // Klik lewat state yang sama dengan dropdown, lewat change() (balik ke halaman pertama).
    expect(tsx).toContain('change(() => setSort(nextSort(sort, column)))');
    expect(tsx).toContain('onValueChange={(v) => change(() => setSort(v as ServiceSort))}');
    expect(tsx).toContain('options={SERVICE_SORTS.map((value) => ({ value, label: t(SORT_LABEL_KEY[value]) }))}');
    // Urutan aktif dibacakan; panah hanya hiasan.
    expect(tsx).toContain("interpolate(t('services.sortCurrent')");
    expect(tsx).toMatch(/<Arrow\s+aria-hidden/);
    // Panah tak aktif tersembunyi, aktif penuh; fokus keyboard menampakkannya.
    expect(tsx).toContain("'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60'");
    expect(tsx).toContain("'text-primary opacity-100'");
    // Target >=24px: padding 4px (p-1) di sekeliling baris teks, margin negatif sama.
    const btn = pick(/'group\/sort ([^']+)'/, tsx)[1];
    expect(btn).toContain(' p-1 ');
    expect(btn).toContain('-m-1 ');
  });

  it('konteks daftar bertahan saat tiket dibuka: ingatan sesi, bukan state yang lenyap', () => {
    // Tampilan awal lewat satu pemutus (tautan vs ingatan), bukan baca ?status dst. satu-satu.
    expect(tsx).toContain('resolveListView({');
    expect(tsx).toContain('readListSnapshot()');
    expect(tsx).not.toContain("searchParams.get('status')");
    expect(tsx).toContain('useState(start.query)');
    expect(tsx).toContain('useState<ServiceScope>(start.scope)');
    // Setiap perubahan saringan dicatat; gulir dicatat hanya selama halaman ini masih terpasang
    // (peralihan rute memotong gulir ke 0 — itu bukan posisi daftar).
    expect(tsx).toContain('saveListView(listOwner, entryKey, {');
    expect(tsx).toContain('wrapRef.current?.isConnected');
    // Peristiwa scroll tak menggelembung dan wadahnya bisa elemen (demo): harus capture.
    expect(tsx).toMatch(/addEventListener\('scroll', onScroll, \{ capture: true/);
    // Penanda "sudah dipulihkan" dinyalakan DI DALAM rAF, supaya pembatalan efek tak menelannya.
    expect(tsx).toMatch(/requestAnimationFrame\(\(\) => \{\s*scrollRestored\.current = true;/);
  });

  it('limit dipulihkan bersama gulir, dan gulir menunggu arsip yang diminta', () => {
    // Satu sumber ukuran halaman: modul murni, bukan salinan lokal yang bisa menyimpang.
    expect(tsx).not.toMatch(/const PAGE_SIZE\b/);
    expect(tsx).toContain('useState(start.limit)');
    expect(tsx).toContain('setLimit(LIST_PAGE_SIZE);');
    expect(tsx).toContain('setLimit((n) => n + LIST_PAGE_SIZE)');
    // limit dicatat dan memicu pencatatan ulang saat "Tampilkan lebih banyak" diklik.
    const save = tsx.slice(tsx.indexOf('saveListView(listOwner, entryKey, {'));
    expect(save.slice(0, 120)).toMatch(/entryKey, \{\s*limit,/);
    expect(save).toMatch(/\}, \[\s*listOwner,\s*entryKey,\s*limit,/);
    // Pemulihan menunggu jendela DAN arsip; kosong dilewati, bukan ditunda selamanya.
    expect(tsx).toContain('const { rows: archive, pending: archivePending } = useServiceArchive({');
    expect(tsx).toContain('scrollRestoreStep({ loading, archivePending, rowCount })');
    expect(tsx).toContain("if (step === 'wait') return;");
    expect(tsx).toContain("if (step === 'skip') {");
    expect(tsx).toContain('[loading, archivePending, rowCount, initial.scrollTop]');
    // Bukan lagi sekadar "ada baris pertama": itu yang membuat gulir mendarat di halaman pendek.
    expect(tsx).not.toContain('const hasRows');
  });

  it('baris Penanganan kosong tak tampil sebelum tiket selesai', () => {
    expect(tsx).toContain('{showFixLine(s) && (');
    expect(tsx).toContain("s.status === 'selesai' || s.status === 'lunas'");
  });

  it('modal dadakan dari aksi cepat: owner/admin saja, jalur kas sama dengan detail', () => {
    expect(tsx).toContain('await addServiceModalLine(partsService, input)');
    expect(tsx).toMatch(/modalDadakan=\{\s*isManager\s*\?/);
    expect(detailTsx).toContain('await addServiceModalLine(service, input)');
    // Detail tak lagi menulis pengeluaran baru sendiri; satu jalur di data layer.
    expect(detailTsx).not.toContain('addServiceModal(');
    expect(pickerTsx).toContain('modalDadakanIssue(input)');
  });

  it('keluhan dan penanganan satu segmen, tiap barisnya tetap ikut pengaturan', () => {
    expect(tsx).toContain('const showNotes = showComplaint || showFix;');
    expect(tsx).toContain('showNotes && `minmax(');
    expect(tsx).toContain('data-seg="notes"');
    expect(tsx).not.toContain('data-seg="complaint"');
    expect(tsx).not.toContain('data-seg="completionNote"');
    // Label di dalam segmen hanya disembunyikan bila toko memakai satu jenis
    // (keluhan SAJA atau penanganan SAJA): tiket tanpa penanganan tetap
    // berlabel, karena baris dengan dan tanpa label di satu kolom membingungkan.
    expect(tsx).toContain("data-single={showComplaint !== showFix ? 'true' : undefined}");
    expect(tsx).not.toContain(':only-child');
  });
});

describe('form Servis Baru (L-48)', () => {
  it('fokus awal lewat data-autofocus, bukan autoFocus yang membuat fokus hilang saat ditutup', () => {
    expect(modalTsx).not.toMatch(/\bautoFocus\b/);
    expect(modalTsx).toContain('data-autofocus={!needOutlet || undefined}');
    expect(modalTsx).toMatch(/options=\{outletOptions\}[\s\S]{0,120}data-autofocus/);
  });

  it('kapitalisasi sama dengan FixMaster: nama orang dan perangkat per kata, kode dan nomor tidak', () => {
    const fieldOf = (labelKey: string) => {
      const at = modalTsx.indexOf(`label={t('serviceForm.${labelKey}')}`);
      return modalTsx.slice(at, modalTsx.indexOf('</Field>', at));
    };
    expect(fieldOf('customerName')).toContain('capitalize="words"');
    expect(fieldOf('device')).toContain('capitalize="words"');
    for (const key of ['customerPhone', 'serial', 'lockValue', 'estimate']) {
      expect(fieldOf(key)).toContain('capitalize="none"');
    }
    // Keluhan, kelengkapan, kondisi: huruf pertama saja (bawaan TextInput).
    for (const key of ['complaint', 'accessories', 'condition']) {
      expect(fieldOf(key)).not.toContain('capitalize=');
    }
  });

  it('isian rupiah, nomor, dan kunci layar memakai huruf mono; placeholdernya tidak', () => {
    expect(modalTsx.match(/font-mono[^"]*placeholder:font-sans/g)).toHaveLength(4);
  });
});
