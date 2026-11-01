# PANDUAN PENGEMBANGAN & PENGGUNAAN SISTEM (TUTORIAL LENGKAP)

> **Pemula? Mulai dari [DEPLOY.md](DEPLOY.md)** � langkah A�G dari ekstrak ZIP sampai online, termasuk daftar data yang harus diubah sebelum upload.
## Platform E-Ticketing Wisata Cirebon: Batu Lawang & Gunung Bendera

Dokumen ini adalah tutorial lengkap berbahasa Indonesia yang memandu pengembang, administrator sistem, dan staf operasional dalam menyiapkan, menguji, dan mengelola platform tiket wisata Desa Cupang dari awal hingga tahap operasional produksi.

---

## Daftar Isi
1. [Bab 1 — Pengenalan Proyek & Lanskap Wisata Desa Cupang](#bab-1--pengenalan-proyek--lanskap-wisata-desa-cupang)
2. [Bab 2 — Prasyarat Lingkungan Pengembangan & Produksi](#bab-2--prasyarat-lingkungan-pengembangan--produksi)
3. [Bab 3 — Kloning Repositori & Instalasi Dependensi](#bab-3--kloning-repositori--instalasi-dependensi)
4. [Bab 4 — Konfigurasi Variabel Lingkungan (.env)](#bab-4--konfigurasi-variabel-lingkungan-env)
5. [Bab 5 — Migrasi Database & Seeding Idempoten](#bab-5--migrasi-database--seeding-idempoten)
6. [Bab 6 — Membangun Aset Ikon & Peta Offline PMTiles](#bab-6--membangun-aset-ikon--peta-offline-pmtiles)
7. [Bab 7 — Menjalankan Server (Pengembangan & Produksi)](#bab-7--menjalankan-server-pengembangan--produksi)
8. [Bab 8 — Menjelajahi Beranda Publik & Kalkulator Kuota Harian](#bab-8--menjelajahi-beranda-publik--kalkulator-kuota-harian)
9. [Bab 9 — Registrasi Wisatawan, Persetujuan UU PDP, & Otentikasi Sesi](#bab-9--registrasi-wisatawan-persetujuan-uu-pdp--otentikasi-sesi)
10. [Bab 10 — Pemesanan Tiket Putih & Webhook Pembayaran Midtrans](#bab-10--pemesanan-tiket-putih--webhook-pembayaran-midtrans)
11. [Bab 11 — Dompet Tiket Offline & Penggunaan Tiket di PWA](#bab-11--dompet-tiket-offline--penggunaan-tiket-di-pwa)
12. [Bab 12 — Pemindaian Tiket Petugas Lapangan di 2 Gerbang](#bab-12--pemindaian-tiket-petugas-lapangan-di-2-gerbang)
13. [Bab 13 — Penulisan Ulasan Pengunjung Berfoto Bebas EXIF](#bab-13--penulisan-ulasan-pengunjung-berfoto-bebas-exif)
14. [Bab 14 — Tata Kelola Dashboard Admin](#bab-14--tata-kelola-dashboard-admin)
15. [Bab 15 — Tata Kelola Dashboard Super Admin & Keamanan](#bab-15--tata-kelola-dashboard-super-admin--keamanan)

---

## Bab 1 — Pengenalan Proyek & Lanskap Wisata Desa Cupang

Platform ini dibangun khusus untuk digitalisasi e-ticketing resmi kawasan wisata alam di **Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon, Jawa Barat**. Kawasan ini mencakup dua destinasi utama yang saling bertetangga:
1. **Batu Lawang (Elevasi 120 mdpl)**: Kawasan tebing batu andesit alami menjulang tinggi menyerupai gerbang alam, dilengkapi gardu pandang, area istirahat rindang, dan fasilitas ramah keluarga. Jam dinas harian: `07:00 – 17:00 WIB`.
2. **Gunung Bendera (Puncak 380 mdpl)**: Jalur pendakian punggungan bukit berbatu sepanjang 1.480 meter dengan pemandangan 360 derajat ke arah Cirebon, Majalengka, dan Gunung Ciremai. Jam dinas harian: `05:30 – 17:30 WIB`.

Kawasan ini menerapkan dua produk tiket resmi:
- **Tiket Reguler Batu Lawang (`REGULER_BL`)**: Rp10.000 (dasar) + Rp3.000 (retribusi parkir resmi Desa Cupang) = **Rp13.000**. Hak akses: Gerbang Utama Batu Lawang.
- **Tiket Putih (`TIKET_PUTIH`)**: Rp15.000 (dasar) + Rp3.000 (parkir) = **Rp18.000**. Hak terusan 2 gerbang: Gerbang Batu Lawang dan Pintu Gunung Bendera.

---

## Bab 2 — Prasyarat Lingkungan Pengembangan & Produksi

Sebelum memulai, pastikan perangkat keras dan lingkungan sistem operasi Anda memenuhi prasyarat berikut:
- **Node.js**: Versi LTS modern (v22+ atau v24+ disarankan). Periksa via `node -v`.
- **npm**: Versi 10+. Periksa via `npm -v`.
- **PostgreSQL**: Versi 16+ (lokal atau cloud seperti Neon / Supabase).
- **Git**: Versi 2.40+.
- **Peramban Web Modern**: Chromium, Firefox, atau WebKit dengan dukungan Service Worker, Web Workers, dan WebAssembly untuk peta PMTiles.

---

## Bab 3 — Kloning Repositori & Instalasi Dependensi

1. Kloning repositori proyek:
   ```bash
   git clone <URL_REPOSITORI> wisata-cirebon
   cd wisata-cirebon
   ```
2. Instal dependensi npm sesuai `package-lock.json`:
   ```bash
   npm ci
   ```
   *Catatan: Pada sistem Windows PowerShell, jika terjadi pembatasan Execution Policy saat menjalankan perintah npm, gunakan `npm.cmd` atau `npx.cmd`.*

---

## Bab 4 — Konfigurasi Variabel Lingkungan (.env)

Salin file contoh konfigurasi dan sesuaikan nilai rahasia Anda:
```bash
cp .env.example .env
```
Parameter penting dalam `.env`:
- `DATABASE_URL`: URI koneksi PostgreSQL berformat `postgresql://user:password@localhost:5432/wisata_cirebon?schema=public`.
- `APP_URL`: URL dasar aplikasi (pengembangan: `http://localhost:3000`).
- `BETTER_AUTH_SECRET`: Kunci enkripsi sesi acak 32 karakter atau lebih (`openssl rand -hex 32`).
- `QR_SIGNING_SECRET`: Kunci rahasia penandatanganan HMAC token QR.
- `CRON_SECRET` dan `STORAGE_DRIVER` (lihat `.env.example`).
- `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY`: Kredensial Midtrans Snap Sandbox/Production.
- `STORAGE_PROVIDER`: `local` (pengembangan) atau `s3` (produksi dengan Cloudflare R2 / AWS S3).
- `CRON_SECRET`: Token rahasia otentikasi cron job pembersihan pesanan kedaluwarsa.

---

## Bab 5 — Migrasi Database & Seeding Idempoten

1. Jalankan migrasi Prisma untuk membuat skema tabel:
   ```bash
   npx prisma migrate deploy
   ```
2. Jalankan skrip *seeding* idempoten:
   ```bash
   npm run db:seed
   ```
Skrip seeding akan otomatis menyiapkan:
- Data destinasi `batu-lawang` dan `gunung-bendera`.
- Definisi produk `REGULER_BL` dan `TIKET_PUTIH` beserta versi tarif aktif pertama.
- 6 titik koordinat jalur GeoJSON resmi.
- 4 akun Petugas Lapangan (`STAFF`), 1 akun Admin (`admin@wisatacirebon.id`), dan 1 akun Super Admin (`superadmin@wisatacirebon.id`).
- 13 slot media default WebP kontur topografi.

---

## Bab 6 — Membangun Aset Ikon & Peta Offline PMTiles

1. Bangun berkas CSS ikon Bootstrap lokal:
   ```bash
   node scripts/build-icons-css.mjs
   ```
   *Mengekstrak 114 glyph SVG Bootstrap Icons aktif menjadi file CSS `public/bootstrap-icons-swap.css` mandiri tanpa CDN eksternal.*
2. Bangun arsip peta vektor offline Desa Cupang:
   ```bash
   npm run maps:build
   ```
   *Mengekstrak basemap bounding box Desa Cupang ke `public/maps/cirebon.pmtiles` dan membuat `public/maps/manifest.json`.*

---

## Bab 7 — Menjalankan Server (Pengembangan & Produksi)

### Mode Pengembangan (Dev)
```bash
npm run dev
```
Buka peramban pada `http://localhost:3000` untuk versi bahasa Indonesia, atau `http://localhost:3000/en` untuk versi bahasa Inggris.

### Mode Produksi (Build & Start)
```bash
npm run build
npm run start
```
Aplikasi akan mengoptimalkan seluruh aset, menghasilkan halaman statis (SSG), dan mengaktifkan Turbopack runtime dengan performa maksimal.

---

## Bab 8 — Menjelajahi Beranda Publik & Kalkulator Kuota Harian

1. Buka Beranda Utama di `http://localhost:3000`.
2. **Hero Section**: Animasi kontur topografi GSAP dengan pilihan eksplorasi langsung.
3. **Kalkulator Kuota & Harga Interaktif**:
   - Pilih tanggal kunjungan (kalender otomatis menolak tanggal masa lalu).
   - Tentukan jumlah pengunjung Tiket Putih dan Tiket Reguler.
   - Sisa kuota harian untuk Batu Lawang (maks 150) dan Gunung Bendera (maks 120) akan dihitung secara langsung dari database via `/api/public/quote`.
   - Ringkasan tarif menampilkan rincian tiket dasar dan retribusi parkir resmi Desa Cupang.

---

## Bab 9 — Registrasi Wisatawan, Persetujuan UU PDP, & Otentikasi Sesi

1. Klik tombol **Daftar** di navbar atau kunjungi `/daftar`.
2. Masukkan nama lengkap, alamat email aktif, nomor WhatsApp Indonesia (`08...` atau `+62...`), dan kata sandi minimal 10 karakter.
3. Centang kotak persetujuan **Syarat Ketentuan & Kebijakan Privasi UU PDP No. 27/2022**.
4. Klik **Daftar Akun Baru**. Sistem akan membuat akun dengan peran `MEMBER` dan mengalihkan wisatawan ke Dashboard Pengunjung.

---

## Bab 10 — Pemesanan Tiket Putih & Webhook Pembayaran Midtrans

1. Di Dashboard Pengunjung, buka tab **Beli Tiket**.
2. Masukkan tanggal kunjungan dan jumlah tiket.
3. Klik **Lanjutkan Pembayaran**. Sistem memanggil `/api/orders` yang mengunci kuota atomik via `SELECT ... FOR UPDATE` dan menerbitkan token Midtrans Snap.
4. Jendela pop-up Midtrans Snap akan terbuka. Selesaikan pembayaran menggunakan metode transfer virtual account atau QRIS Sandbox.
5. Midtrans Server akan mengirim webhook ke `/api/webhooks/midtrans` dengan tanda tangan SHA-512.
6. Status pesanan berubah menjadi `PAID`, dan tiket diterbitkan seketika.

---

## Bab 11 — Dompet Tiket Offline & Penggunaan Tiket di PWA

1. Buka tab **Dompet Tiket** (`/dashboard?tab=wallet`).
2. Setiap tiket yang telah dibeli akan tampil dengan desain kertas berlubang takik perforasi:
   - Kode publik unik (misal: `PUTIH-CBN-KVDTVN`).
   - Kode QR kriptografis dinamis.
   - Indikator status per gerbang: `Gerbang Batu Lawang` dan `Pintu Gunung Bendera`.
   - Tombol **Unduh PDF Resmi** dan **Unduh QR PNG**.
3. Saat peramban kehilangan koneksi internet (blank spot perbukitan), tiket yang pernah dibuka tetap dapat ditampilkan dan dipindai secara offline berkat Service Worker cache.

---

## Bab 12 — Pemindaian Tiket Petugas Lapangan di 2 Gerbang

1. Masuk sebagai petugas lapangan di `/masuk`:
   - Gerbang Batu Lawang: `staff.batulawang@wisatacirebon.id` (Kata Sandi: `Petugas#Cirebon2026!`).
   - Pintu Gunung Bendera: `staff.bendera@wisatacirebon.id` (Kata Sandi: `Petugas#Cirebon2026!`).
2. Antarmuka Scanner Lapangan menggunakan desain kontras tinggi ramah cahaya matahari langsung.
3. Arahkan kamera ke QR tiket pengunjung atau ketik kode tiket secara manual.
4. **Hasil Validasi**:
   - `ACCEPTED`: Tiket sah, kuota pengunjung bertambah, audio konfirmasi berbunyi.
   - `REJECTED`: Menampilkan alasan penolakan spesifik (misal: `WRONG_DATE`, `OUTSIDE_HOURS`, atau `NOT_WHITE_TICKET` jika Tiket Reguler dicoba di Pintu Gunung Bendera).
   - `ALREADY_SCANNED_AT_GATE`: Mencegah penggunaan ulang tiket di gerbang yang sama.

---

## Bab 13 — Penulisan Ulasan Pengunjung Berfoto Bebas EXIF

1. Tiket yang telah berhasil dipindai minimal 1× memenuhi syarat penulisan ulasan.
2. Di Dashboard Wisatawan, klik **Tulis Ulasan** pada tiket yang aktif.
3. Berikan rating bintang (1–5), ketik komentar pengalaman pendakian, dan unggah foto perjalanan (maksimal 4 foto).
4. Pipeline pemrosesan foto (`sharp`) akan otomatis membersihkan metadata EXIF (termasuk tag koordinat GPS pribadi) demi kepatuhan UU PDP dan mengonversi gambar ke format WebP terkompresi.
5. Ulasan yang dikirim langsung berstatus `PUBLISHED` dan tampil pada bagian Ulasan Wisatawan di Beranda Publik.

---

## Bab 14 — Tata Kelola Dashboard Admin

Masuk dengan akun Admin (`akun Admin yang dibuat Super Admin`) untuk mengelola operasional:
1. **Metrik & Analitik**: Grafik area Recharts real-time menampilkan tren penjualan tiket, pendapatan retribusi parkir, dan arus pemindaian per gerbang.
2. **Manajemen Pesanan**: Tabel TanStack interaktif dengan pencarian, filter status, pembatalan manual bersyarat, dan ekspor CSV.
3. **Kalender Kuota & Versi Tarif**: Mengatur kuota khusus pada tanggal libur nasional serta membuat versi tarif tiket baru dengan `effectiveFrom`.
4. **Persetujuan Refund**: Meninjau pengajuan pembatalan dengan validasi H-24 sebelum tanggal kunjungan dan 0 pemindaian.
5. **Jadwal & Izin Petugas**: Meninjau jadwal mingguan petugas dan memproses izin cuti dinas dengan batasan cooldown antar destinasi.

---

## Bab 15 — Tata Kelola Dashboard Super Admin & Keamanan

Masuk dengan akun Super Admin (`akun dari `SEED_SUPERADMIN_*`) untuk fungsi tata kelola tertinggi:
1. **Manajemen Pengguna**: Mengubah peran pengguna (dengan step-up verification), mencabut sesi aktif paksa, dan perlindungan larangan menurunkan Super Admin terakhir.
2. **Kesehatan Integrasi (Health Check)**: Probe live non-invasif untuk 6 komponen sistem: Database, Better Auth, Midtrans, Storage, Email SMTP, dan WhatsApp Gateway.
3. **Audit Log Forensik**: Tabel audit append-only yang mencatat setiap aksi sensitif (login gagal, scan ditolak, pembukaan kontak darurat) beserta alamat IP dan user-agent.
4. **Pusat Keamanan**: Pemantauan percobaan login gagal dan pelepasan rate limiting IP yang terblokir.
