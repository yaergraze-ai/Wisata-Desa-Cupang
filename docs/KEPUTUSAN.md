# KEPUTUSAN ARSITEKTUR & PRODUK — Wisata Cirebon (Batu Lawang & Gunung Bendera)

Dokumen ini mencatat seluruh verifikasi dokumentasi resmi, keputusan teknis, dan asumsi terukur yang diambil selama perencanaan dan pembangunan proyek sesuai `AGENTS.md` §1.5 & §8.4.

---

## KEP-01 — Pemilihan & Verifikasi Better Auth (OAuth, 2FA TOTP, Phone/WhatsApp OTP, Admin)

- **Konteks (`AGENTS.md` §2):** Wajib memverifikasi ketersediaan plugin `twoFactor`, `phoneNumber`, dan `admin` serta OAuth Google & Facebook pada dokumentasi resmi Better Auth sebelum memilih antara Better Auth atau Auth.js v5.
- **Hasil Verifikasi:** Dokumentasi resmi Better Auth mengonfirmasi dukungan penuh untuk PostgreSQL lewat `prismaAdapter` (`better-auth/adapters/prisma`), social providers `google` dan `facebook`, serta ketiga plugin resmi di `better-auth/plugins` dan `better-auth/client/plugins`:
  1. `twoFactor()` — TOTP berbasis aplikasi autentikator (URI QR + backup codes terenkripsi).
  2. `phoneNumber()` — OTP berbasis nomor telepon (`sendOTP` callback di-wire langsung ke adapter WhatsApp nyata).
  3. `admin()` — manajemen sesi, pemblokiran akun, dan fondasi peran.
- **Keputusan:** Memakai **Better Auth** sebagai mesin autentikasi utama, diperkuat dengan:
  - Enum peran ketat di Prisma (`MEMBER | STAFF | ADMIN | SUPER_ADMIN`), default `MEMBER` yang tidak pernah dapat dikirim dari payload registrasi publik.
  - Guard otorisasi server-side eksplisit (`requireAuth`, `requireRole`, `requireTwoFactor`, `requireStepUp`) di **setiap** Route Handler dan Server Action (`src/server/auth/guards.ts`), sehingga middleware hanya bertugas mengarahkan rute halaman dan pengalihan bahasa.
  - Step-up verification berbasis kode TOTP segar (masa berlaku token step-up bertanda tangan 5 menit yang terikat pada `sessionId` dan `userId`) untuk perubahan peran, penonaktifan akun, dan perubahan pengaturan sensitif.
  - Bila kredensial Google, Facebook, atau WhatsApp belum diisi di `.env`, tombol login provider terkait otomatis disembunyikan di halaman `/masuk` dan `/daftar` serta dilaporkan sebagai "Belum dikonfigurasi" di panel Super Admin.

---

## KEP-02 — Penghapusan Login Instagram (Verifikasi Resmi Meta)

- **Konteks (`PROMPT` §2):** File referensi menampilkan tombol login sosial Instagram palsu yang hanya mengisi nama contoh `@kananurhana_ig`.
- **Hasil Verifikasi Dokumentasi Meta:** Meta secara resmi menghentikan dan mematikan **Instagram Basic Display API** pada **4 Desember 2024**. API resmi Meta yang tersisa (*Instagram API with Instagram Login / Facebook Login* di atas *Graph API*) secara eksklusif mewajibkan akun **Professional (Business atau Creator)** dan tidak menyediakan mekanisme OAuth/login konsumen umum untuk akun Instagram personal wisatawan.
- **Keputusan:** Menghapus opsi login Instagram sepenuhnya. Autentikasi menggunakan Email + Kata Sandi, Google OAuth, Facebook Login, dan WhatsApp OTP (bila `WA_PROVIDER` dikonfigurasi).

---

## KEP-03 — Penguncian Kuota Harian Atomik Tanpa Race Condition & Tanpa Ketergantungan Cron

- **Konteks (`PROMPT` §4 & §5.2):**
  - `DailyQuota` memiliki kunci unik `(date, destinationId)` dan bila baris belum ada maka memakai kapasitas default destinasi (`150` untuk Batu Lawang, `120` untuk Gunung Bendera).
  - `Tiket Reguler` memakan kuota `batu-lawang`; `Tiket Putih` memakan kuota `batu-lawang` **dan** `gunung-bendera`.
  - Checkout wajib mengunci baris `DailyQuota` dengan `SELECT … FOR UPDATE` dan lulus uji 100 pembelian paralel untuk sisa kuota 10 tanpa oversell.
- **Masalah Teknis yang Diantisipasi:** Jika 100 request paralel datang pada tanggal kunjungan baru yang belum memiliki baris `DailyQuota`, `SELECT … FOR UPDATE` tidak akan mengunci baris apa pun bila baris tidak diwujudkan lebih dulu.
- **Keputusan:** Di dalam satu transaksi database (`prisma.$transaction`):
  1. Kumpulkan seluruh `destinationId` yang dikonsumsi item pesanan, lalu **urutkan secara leksikografis (`ASC`)** untuk mencegah deadlock lintas transaksi.
  2. Lakukan materialisasi baris `DailyQuota` terlebih dahulu dengan `INSERT INTO "DailyQuota" ... ON CONFLICT ("date", "destinationId") DO NOTHING` memakai `Destination.defaultCapacity` dan penanda `isCustom = false`.
  3. Kunci baris-baris tersebut dengan `SELECT "id", "destinationId", "capacity" FROM "DailyQuota" WHERE "date" = $visitDate AND "destinationId" IN (...) ORDER BY "destinationId" ASC FOR UPDATE`.
  4. Hitung pemakaian aktif secara real-time di dalam kunci:
     - `paidUsed` = jumlah `qty` item pada pesanan `PAID` (dengan tiket bukan `REFUNDED`/`CANCELLED`) untuk tanggal dan destinasi terkait.
     - `pendingUsed` = jumlah `qty` item pada pesanan `PENDING` yang `expiresAt > NOW()`.
  5. Jika `requestedQty > (capacity - paidUsed - pendingUsed)`, batalkan transaksi dan kembalikan sisa kuota aktual per destinasi.
  6. Dengan formula `expiresAt > NOW()`, kuota pesanan yang kedaluwarsa otomatis kembali detik itu juga tanpa menunggu cron. Endpoint `/api/cron/expire-orders` (dilindungi header `Authorization: Bearer <CRON_SECRET>`) hanya bertugas merapikan kolom `status` menjadi `EXPIRED`.

---

## KEP-04 — Versi Tarif Produk Tiket (`TicketProduct` + `TicketTariff`)

- **Konteks (`PROMPT` §4 & §6.E.3):** Perubahan tarif harus membuat versi baru dengan `effectiveFrom` sehingga histori pesanan dan laporan retribusi parkir lama tidak pernah berubah.
- **Keputusan:**
  - `TicketProduct` menyimpan identitas produk stabil (`code` unik: `REGULER_BL` dan `TIKET_PUTIH`, nama dwibahasa, `allowedGates[]`, `consumesDestinations[]`, `isActive`).
  - `TicketTariff` menyimpan versi harga berurutan (`productId`, `version`, `basePrice`, `parkingFee`, `effectiveFrom`, `createdById`, `createdAt`). Tarif aktif pada waktu `T` adalah baris `TicketTariff` dengan `effectiveFrom <= T` terbaru (`ORDER BY effectiveFrom DESC, version DESC LIMIT 1`).
  - `OrderItem` menyimpan `productId`, `tariffId`, serta snapshot integer `unitBase`, `unitParking`, dan `unitTotal`.

---

## KEP-05 — Constraint Unik Parsial pada `GateScan` & Token QR Bertanda Tangan HMAC

- **Konteks (`PROMPT` §4 & §5.4):** QR tidak boleh memuat data pribadi; `Tiket Putih` dapat dipindai 1× di `GERBANG_BATU_LAWANG` dan 1× di `PINTU_GUNUNG_BENDERA`, sedangkan `Tiket Reguler` hanya 1× di `GERBANG_BATU_LAWANG`. Semua percobaan gagal tetap harus tercatat di `GateScan`.
- **Keputusan:**
  - Payload QR berformat `WC1.<random128BitBase64Url>.<hmacSha256Base64Url>` menggunakan `QR_SIGNING_SECRET`. Database (`Ticket.qrTokenHash`) hanya menyimpan SHA-256 hash dari token acak tersebut. Untuk dompet pengguna pemilik tiket yang terautentikasi, token QR diturunkan secara deterministik-aman dari secret server + nonce terenkripsi AES-256-GCM milik tiket sehingga hanya pemilik sah yang dapat merender ulang QR e-ticket miliknya tanpa pernah menyimpan plaintext token di kolom pencarian.
  - Migrasi SQL Prisma menyertakan **partial unique index PostgreSQL**:
    ```sql
    CREATE UNIQUE INDEX "GateScan_ticket_gate_accepted_idx"
    ON "GateScan" ("ticketId", "gate")
    WHERE "result" = 'ACCEPTED';
    ```
    Dengan indeks parsial ini, banyak baris `REJECTED` tetap dapat dicatat untuk audit, namun dua petugas yang memindai QR yang sama di gerbang yang sama pada milidetik yang sama dijamin hanya menghasilkan tepat satu `ACCEPTED`.

---

## KEP-06 — Penyimpanan Konten Dwibahasa di Database & Midtrans Snap Locale

- **Konteks (`PROMPT` §4 & §6.J):** Seluruh UI dan konten DB yang dikelola Admin wajib mendukung bahasa Indonesia (`id`, bawaan tanpa prefix) dan Inggris (`en`, prefix `/en`), serta Midtrans Snap dikirim bahasa sesuai locale bila didukung.
- **Hasil Verifikasi Midtrans:** `window.snap.pay(snapToken, { language: locale })` mendukung `'id'` dan `'en'` secara resmi.
- **Keputusan:**
  - Memakai pendekatan **kolom eksplisit `…Id` dan `…En` bertipe `NOT NULL`** pada tabel `Destination` (`nameId`, `nameEn`, `descriptionId`, `descriptionEn`), `TicketProduct` (`nameId`, `nameEn`, `descriptionId`, `descriptionEn`), `TrailPoint` (`nameId`, `nameEn`, `noteId`, `noteEn`), `StaffProfile` (`jobTitleId`, `jobTitleEn`), dan `MediaSlot`/`MediaAsset` (`altId`, `altEn`). Pendekatan kolom `NOT NULL` menjamin integritas dwibahasa langsung di level constraint PostgreSQL dan bebas query N+1.
  - Konten buatan pengguna (`Review.comment`, `Review.managerReply`, `ContactMessage.message`, `RefundRequest.reason`) disimpan apa adanya tanpa terjemahan otomatis.
  - Nama produk **"Tiket Putih"** dipertahankan sebagai nama khas lokal di bahasa Inggris dengan penjelas natural (*"Tiket Putih (White Ticket — Batu Lawang & Gunung Bendera Combined Pass)"*).

---

## KEP-07 — Kontras Warna WCAG AA & Token Skala 50–950

- **Konteks (`AGENTS.md` §4):** Pada file HTML asli, teks `kabut` (`#E8F1EC`) di atas `telaga` (`#2F8F83`) dan teks `telaga` di atas `kabut` hanya memiliki rasio kontras **3,39:1** (gagal WCAG AA 4,5:1), serta `batu` (`#5B6B66`) di atas `obsidian` (`#08110E`) hanya ≈3,4:1.
- **Hasil Perhitungan Luminansi Relatif WCAG 2.1:**
  - `kabut` (`#E8F1EC`) di atas `obsidian` (`#08110E`) = **16,62:1** (AAA)
  - `kabut` (`#E8F1EC`) di atas `hutan` (`#0F2A24`) = **13,24:1** (AAA)
  - `kabut` (`#E8F1EC`) di atas `telaga-700` (`#23746A`) = **4,82:1** (Lulus AA)
  - `kabut` (`#E8F1EC`) di atas `telaga-750` (`#1D685F`) = **5,70:1** (Lulus AA dengan margin kuat)
  - `telaga-800` (`#195E56`) di atas `kabut` (`#E8F1EC`) = **6,56:1** (Lulus AA untuk teks aksen di permukaan terang)
  - `hutan` (`#0F2A24`) di atas `fajar` (`#F2A65A`) = **7,54:1** (AAA untuk CTA utama)
  - `batu-700` (`#3F4E49`) di atas `kabut` (`#E8F1EC`) = **7,60:1** (AAA untuk teks sekunder di permukaan terang/luar ruangan)
- **Keputusan:**
  - Tombol berlapis `telaga` menggunakan `telaga-700` (`#23746A`) sebagai warna dasar dan `telaga-800` (`#195E56`) saat hover.
  - Teks aksen hijau-telaga di atas permukaan terang (`kabut`/putih) wajib memakai `telaga-800` (`#195E56`), bukan `#2F8F83`.
  - `batu` (`#5B6B66`) hanya dipakai untuk garis pembatas/ikon dekoratif di latar gelap; teks sekunder di atas latar gelap wajib memakai `kabut` dengan opasitas minimal `75%` (≥ 9,5:1).
  - Ukuran font terkecil untuk teks bermakna dikunci pada `12px` (`0.75rem`).

---

## KEP-08 — Aset Media Bawaan Self-Hosted & Penghapusan Klaim Tak Terverifikasi

- **Konteks (`AGENTS.md` §4 & §9, `PROMPT` §2):** File referensi memuat gambar dari CDN Unsplash serta klaim tak terverifikasi seperti *"ribuan spot foto"* dan *"Paling Populer"*.
- **Keputusan:**
  - Menghasilkan gambar pemandangan berlapis kontur topografi dan siluet pegunungan berkabut berformat **WebP self-hosted** di `public/media/defaults/` melalui `sharp` untuk ke-13 slot media (`hero`, `footer`, `card-1..5`, `timeline-1a/1b/2a/2b/3a/3b`) saat inisialisasi aset, lalu mendaftarkannya ke `MediaAsset` + `MediaSlot` pada `prisma/seed.ts`. Dengan demikian halaman langsung tampil utuh secara lokal/offline tanpa CDN eksternal dan Admin dapat mengganti slot mana pun dengan foto lapangan asli melalui **Admin → Media & Konten**.
  - Mengganti klaim *"ribuan spot foto"* menjadi deskripsi faktual (*"Tebing Andesit & Gardu Pandang 380 mdpl"*) dan menghapus label *"Paling Populer"* statis (hanya menampilkan fakta cakupan *"Akses 2 Destinasi"*).
  - Standarisasi penamaan destinasi kedua menjadi **"Gunung Bendera"** dengan slug `gunung-bendera` di database (menggantikan campuran `Bukit/Gunung Bendera` dan `bukit-bendera`).

---

## KEP-09 — Perlindungan Folder `referensi/` di Disk vs Pengecualian Git & Deploy

- **Konteks (`AGENTS.md` §3, §8.5 vs `PROMPT` §10.12):**
  - `AGENTS.md` §8.5 melarang menghapus atau menimpa `referensi/` dan `AGENTS.md`.
  - `PROMPT` §10.12 mensyaratkan `.env`, rahasia, dan `referensi/` tidak ikut ter-commit atau ter-deploy secara tidak semestinya.
- **Keputusan:** Menyimpan `referensi/tiket_wisata_cirebon_batu_lawang_bukit_bendera.html` dan `referensi/jalur-gunung-bendera.geojson` secara utuh di disk lokal tanpa pernah memodifikasinya, sekaligus mencantumkan `/referensi/` di `.gitignore`, `.dockerignore`, dan `.vercelignore` agar tidak pernah ter-commit ke repositori produksi maupun ter-deploy. `AGENTS.md` tetap di-commit di root repositori.

---

## KEP-10 — Peta Offline PMTiles, Gaya Peta Self-Hosted & Geometri Jalur

- **Konteks (`PROMPT` §5.8 & §6.G):** Navigator jalur membutuhkan perhitungan jarak titik GPS ke polyline jalur Gunung Bendera (ambang deviasi 35 m) serta dukungan peta offline berbasis PMTiles + Service Worker tanpa scraping massal server tile OSM.
- **Keputusan:**
  - Menyertakan data GeoJSON jalur resmi dari `jalur-gunung-bendera.geojson` dan pembacaan `TrailPoint` dari PostgreSQL.
  - Perhitungan jarak ke jalur memakai proyeksi equirectangular lokal per segmen dengan jarak Haversine akurat pada lintang `-6.73°`, mengembalikan jarak terpendek (meter), titik proyeksi terdekat di segmen jalur, bearing/arah kompas kembali ke jalur, serta pos berikutnya beserta estimasi menit.
  - Skrip `npm run maps:build` menggunakan CLI/pustaka `pmtiles` untuk mengekstrak bbox Desa Cupang–Gempol Cirebon (`108.365,-6.750,108.400,-6.715`, zoom 0–16) dari arsip Protomaps Basemap resmi ke `public/maps/cirebon.pmtiles`, menyalin glyph & sprite lokal, dan menulis `public/maps/manifest.json` berisi ukuran byte serta checksum SHA-256. Bila `cirebon.pmtiles` belum dibangun di mesin lokal, komponen peta otomatis mendeteksi ketiadaan manifest, merender peta online raster/vektor standar saat online, dan menonaktifkan tombol unduh offline dengan panduan jelas sesuai `PROMPT` §6.G.
