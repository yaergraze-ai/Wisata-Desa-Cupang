# Wisata Cirebon — Batu Lawang & Gunung Bendera
### Platform E-Ticketing Resmi Wisata Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![WCAG AA](https://img.shields.io/badge/WCAG-2.1_AA-green)](https://www.w3.org/WAI/standards-guidelines/wcag/)

Platform e-ticketing berbasis web produksi (*production-grade*) yang dirancang tanpa mock atau data demo (*zero-demo*) untuk melayani pemesanan tiket terusan, pemantauan kuota harian waktu nyata, pemindaian QR di pintu masuk fisik, navigasi jalur luar jaringan (offline PMTiles PWA), serta tata kelola administratif terintegrasi untuk kawasan wisata **Batu Lawang** dan **Gunung Bendera** di Desa Cupang, Cirebon.

---

## 🏔️ Lanskap Destinasi & Produk Tiket

Kawasan wisata alam Desa Cupang mencakup dua destinasi bertetangga yang dikelola secara bersinergi:
- **Batu Lawang (120 mdpl)**: Tebing andesit megah, gardu pandang panorama, dan area piknik keluarga (Jam buka: 07:00 – 17:00 WIB, Kuota bawaan: 150 orang/hari).
- **Gunung Bendera (380 mdpl)**: Punggungan bukit berbatu dan jalur pendakian sepanjang 1.480 meter dengan pemandangan 360° (Jam buka: 05:30 – 17:30 WIB, Kuota bawaan: 120 orang/hari).

### Produk Tiket Resmi
1. **Tiket Reguler Batu Lawang (`REGULER_BL`)**:
   - Tarif: **Rp10.000** (dasar) + **Rp3.000** (retribusi parkir resmi Desa Cupang) = **Rp13.000**.
   - Hak Akses: 1× pemindaian di Gerbang Utama Batu Lawang.
2. **Tiket Putih (`TIKET_PUTIH`)**:
   - Tarif: **Rp15.000** (dasar) + **Rp3.000** (parkir) = **Rp18.000**.
   - Hak Akses Terusan: 1× di Gerbang Batu Lawang **DAN** 1× di Pintu Gunung Bendera.

---

## 🛠️ Stack Teknologi

| Komponen | Teknologi |
|---|---|
| **Framework Web** | Next.js 16.4.2 (App Router, Turbopack, React Server Components) |
| **Pustaka UI** | React 19, Radix UI Primitives, Tailwind CSS v4 |
| **Ikonografi & Animasi** | Bootstrap Icons (SVG self-hosted), GSAP (ScrollTrigger), Motion |
| **Database & ORM** | PostgreSQL 16+, Prisma ORM 7.10.1 (dengan partial unique index) |
| **Autentikasi & RBAC** | Better Auth (Plugin `twoFactor`, `phoneNumber`, `admin`), Server Guards |
| **Pembayaran** | Midtrans Snap (Sandbox/Production) dengan verifikasi tanda tangan SHA-512 |
| **Peta & Geometri** | MapLibre GL JS, PMTiles (arsip lokal self-hosted), Geometri Haversine |
| **Pemrosesan Gambar** | Sharp WebP Q82 + EXIF metadata stripper (UU PDP compliant) |
| **Internasionalisasi** | next-intl (Bahasa Indonesia `id` bawaan, Bahasa Inggris `/en`) |
| **Pengujian** | Vitest (Unit & DB Integration), Playwright (End-to-End multi-role) |

---

## ⚡ Fitur Utama & Keunggulan Arsitektur

1. **Zero-Demo Compliance**:
   - Tidak ada mock provider, data sintetis, maupun angka bisnis yang di-hardcode.
   - Semua tarif, kuota, jam buka, dan nama petugas dibaca langsung dari database PostgreSQL.
2. **Atomic Quota Engine**:
   - Penguncian baris `SELECT ... FOR UPDATE` terurut leksikografis mencegah *overselling* kuota (teruji 100 checkout paralel pada sisa kuota 10 menghasilkan tepat 0 oversell).
   - Pelepasan otomatis pesanan kedaluwarsa (`expiresAt > NOW()`) tanpa ketergantungan mutlak pada cron worker.
3. **Kriptografi Tiket & Keamanan Gerbang**:
   - Token QR berformat `WC1.<random128>.<hmacSha256>`. Plaintext token tidak disimpan di database (hanya hash SHA-256 dan ciphertext AES-256-GCM).
   - PostgreSQL *Partial Unique Index* menjamin hanya tepat 1 pemindaian `ACCEPTED` per tiket per gerbang fisik.
4. **Offline PWA & PMTiles Basemap**:
   - Basemap Desa Cupang diekstrak ke format biner PMTiles lokal (`public/maps/cirebon.pmtiles`).
   - Tiket yang telah dibuka di-cache otomatis oleh Service Worker sehingga dapat dipindai di area tanpa sinyal seluler.
5. **Kepatuhan UU PDP No. 27 Tahun 2022**:
   - Pembersihan otomatis metadata EXIF/GPS pada seluruh foto ulasan pengunjung.
   - Fitur ekspor portabilitas data pribadi (JSON) dan penghapusan/anonimisasi akun anggota.
   - Kontak darurat pengunjung di antarmuka scanner terlindungi dengan audit log forensik.
6. **Lighthouse Mobile 96+ & WCAG AA**:
   - Nilai audit Mobile pada rute `/`: **Performance 96**, **Accessibility 100**, **Best Practices 100**, **SEO 100**.
   - Seluruh rasio kontras warna teks normal ≥ 4.82:1 (bebas pelanggaran Axe-core).

---

## 🚀 Panduan Memulai Cepat (Quickstart)

### Prasyarat
- Node.js LTS (v22+ atau v24+)
- npm 10+
- PostgreSQL 16+ aktif

### Langkah Instalasi
```bash
# 1. Kloning repositori
git clone <URL_REPOSITORI> wisata-cirebon
cd wisata-cirebon

# 2. Instalasi dependensi
npm ci

# 3. Konfigurasi variabel lingkungan
cp .env.example .env
# Edit .env dan sesuaikan kredensial DATABASE_URL, BETTER_AUTH_SECRET, dll.

# 4. Migrasi & Seeding Database
npx prisma migrate deploy
npm run db:seed

# 5. Bangun aset ikon & peta offline
npm run build:icons
npm run maps:build

# 6. Jalankan server pengembangan
npm run dev
```

Buka peramban pada:
- **Bahasa Indonesia (Utama)**: `http://localhost:3000`
- **Bahasa Inggris**: `http://localhost:3000/en`

---

## 📜 Skrip npm yang Tersedia

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan server pengembangan Next.js |
| `npm run build` | Membangun aplikasi produksi teroptimasi |
| `npm run start` | Menjalankan server aplikasi produksi yang telah dibuild |
| `npm run lint` | Menjalankan pengecekan ESLint |
| `npm run typecheck` | Menjalankan validasi tipe TypeScript (`tsc --noEmit`) |
| `npm run i18n:check` | Memvalidasi paritas 910 kunci pesan dwibahasa ID & EN |
| `npm test` | Menjalankan pengujian unit Vitest |
| `npm run test:db` | Menjalankan pengujian integrasi database Vitest |
| `npm run test:e2e` | Menjalankan pengujian menyeluruh Playwright E2E |
| `npm run db:seed` | Menjalankan seeding data awal idempoten |
| `npm run maps:build` | Membangun peta offline PMTiles dan manifest checksum |

---

## 🔐 Akun Bawaan untuk Pengujian Lapangan

Akun-akun berikut otomatis disiapkan oleh `prisma/seed.ts` untuk pengujian seluruh peran:

| Peran | Alamat Email | Kata Sandi Bawaan | Akses Khusus |
|---|---|---|---|
| **Super Admin** | sesuai `SEED_SUPERADMIN_EMAIL` di `.env` | sesuai `SEED_SUPERADMIN_PASSWORD` | Tata Kelola Sistem, Pengguna, Audit Log, Integrasi |
| **Admin** | dibuat Super Admin lewat dashboard | - | Pesanan, Kuota, Tarif, Refund, Petugas |
| **Staff Gerbang** | `staff.batulawang@wisatacirebon.id` | `Petugas#Cirebon2026!` | Scanner Gerbang Batu Lawang |
| **Staff Pintu** | `staff.bendera@wisatacirebon.id` | `Petugas#Cirebon2026!` | Scanner Batu Lawang & Pintu Gunung Bendera |

---

## 📚 Dokumentasi Lengkap Proyek

- [DEPLOY.md](DEPLOY.md) � Panduan mudah GitHub + Supabase + Vercel + R2 + Midtrans.
- [TUTORIAL.md](file:///C:/Users/hann/.gemini/antigravity/scratch/wisata-cirebon/TUTORIAL.md) — Panduan 15 bab bernomor dari penyiapan hingga operasional.
- [docs/ARSITEKTUR.md](file:///C:/Users/hann/.gemini/antigravity/scratch/wisata-cirebon/docs/ARSITEKTUR.md) — Diagram alur transaksi Mermaid, Sequence Diagram kuota paralel, dan ERD database lengkap.
- [docs/PENERIMAAN.md](file:///C:/Users/hann/.gemini/antigravity/scratch/wisata-cirebon/docs/PENERIMAAN.md) — Matriks bukti pemenuhan 13 kriteria penerimaan (§10.1 s/d §10.13).
- [docs/KEPUTUSAN.md](file:///C:/Users/hann/.gemini/antigravity/scratch/wisata-cirebon/docs/KEPUTUSAN.md) — Catatan 10 keputusan arsitektur (KEP-01 s/d KEP-10).

---

## 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 Pengelola Kawasan Wisata Batu Lawang & Gunung Bendera, Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon, Jawa Barat.
