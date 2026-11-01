# Panduan Struktur Arsitektur Wisata Cirebon (Desa Cupang)

Dokumen ini memetakan secara jelas arsitektur pemisahan **Frontend (Klien/UI)** dan **Backend (Server/API/Database)** pada proyek Wisata Cirebon.

---

## 🗺️ Peta Direktori Utama

```
wisata-cirebon/
├── prisma/                     # [BACKEND] Skema database PostgreSQL & seeding
│   ├── schema.prisma           # Model User, Session, Order, Ticket, Quota, Scan, Media, Review
│   └── seed.ts                 # Data awal master destinasi, tarif, dan akun pengelola
│
├── public/                     # [ASSETS STATIS]
│   ├── manifest.webmanifest    # Konfigurasi PWA Offline
│   ├── sw.js                   # Service Worker untuk caching aset & dompet tiket
│   └── media/                  # Gambar statis default & ikon
│
├── src/
│   │
│   ├── app/                    # [ORCHESTRATION & ROUTING - NEXT.JS APP ROUTER]
│   │   │
│   │   ├── [locale]/           # [FRONTEND SSR/PAGE ROUTES] Server-side rendered pages & layouts
│   │   │   ├── page.tsx        # Beranda publik (Hero, 4 Tahap, Tiket, Galeri, Kontak)
│   │   │   ├── jalur/          # Halaman peta GPS interaktif & navigasi koridor jalur
│   │   │   ├── masuk/          # Halaman login (Email, WhatsApp OTP, OAuth Google)
│   │   │   ├── daftar/         # Halaman pendaftaran akun member
│   │   │   ├── dashboard/      # Dasbor pengguna:
│   │   │   │   ├── page.tsx            # Dasbor Member (Dompet tiket, Pembelian tiket, Profil)
│   │   │   │   ├── staff/page.tsx      # Dasbor Petugas Lapangan (Pemindai QR, Riwayat scan)
│   │   │   │   ├── admin/page.tsx      # Dasbor Admin (Metrik, Pesanan, Kuota, Refund, Media)
│   │   │   │   └── super-admin/page.tsx# Dasbor Super Admin (Kelola Pengguna, Audit log, Konfigurasi)
│   │   │   ├── verifikasi-2fa/ # Halaman verifikasi TOTP Authenticator
│   │   │   ├── reset-kata-sandi/
│   │   │   └── syarat-ketentuan/
│   │   │
│   │   └── api/                # [BACKEND HTTP API & WEBHOOKS]
│   │       ├── admin/          # API Admin (kuota, tarif, petugas, refund, inbox, media)
│   │       ├── auth/           # API Autentikasi (Better Auth, WhatsApp OTP request & verify, me)
│   │       ├── orders/         # API Pemesanan (hitung kuota, kunci kuota, cancel, pay-simulated, qris)
│   │       ├── public/         # API Publik (kalkulator kuota, ulasan, kontak saran)
│   │       ├── refunds/        # API Pengajuan & verifikasi refund H-24
│   │       ├── staff/          # API Petugas (scan tiket, riwayat validasi, override darurat)
│   │       ├── super-admin/    # API Super Admin (manajemen user, audit log, switch maintenance)
│   │       ├── tickets/        # API Unduh PDF e-tiket & validasi QR
│   │       ├── webhooks/       # Webhook Midtrans HTTP notification callback
│   │       └── gallery/        # API Unggah & hapus foto galeri spot wisata
│   │
│   ├── components/             # [FRONTEND UI COMPONENTS]
│   │   ├── auth/               # Komponen login, register, password input, ChatOtpCard, 2FA
│   │   ├── dashboard/          # Komponen tampilan dasbor:
│   │   │   ├── member/         # MemberDashboardClient, PerforatedTicketCard, ReviewModal, RefundModal
│   │   │   ├── staff/          # StaffDashboardClient, CameraQrScanner, ManualTicketValidator
│   │   │   ├── admin/          # AdminMetricsView, AdminOrdersView, AdminRefundsView, AdminMediaClient
│   │   │   └── super-admin/    # SuperAdminUsersView, SuperAdminAuditView, SuperAdminSettingsView
│   │   ├── public/             # Komponen beranda publik:
│   │   │   ├── PublicNavbar.tsx            # Navbar responsif desktop & tab bar bawah mobile
│   │   │   ├── HeroGallery.tsx             # Galeri coverflow 3D Ken Burns & panel tiket kaca
│   │   │   ├── TrailTimelineAndMapSection.tsx # Linimasa 4 Tahap Asimetris & profil altimeter
│   │   │   ├── PriceQuotaCalculator.tsx    # Kalkulator tarif & kuota harian waktu nyata
│   │   │   ├── TouristSpotGallerySection.tsx # Galeri foto pengunjung & spot selfie tebing
│   │   │   ├── StaffOnDutySection.tsx      # Status petugas siaga pos
│   │   │   ├── VerifiedReviewsSection.tsx  # Ulasan bintang terverifikasi pemegang tiket
│   │   │   └── ContactAndFooterSection.tsx # Kontak resmi pengelola & footer desa
│   │   ├── shared/             # Komponen global (LocaleSwitcher, DeferredToaster, PWA installer)
│   │   └── trail/              # Komponen navigasi jalur peta offline (TrailNavigatorClient)
│   │
│   ├── server/                 # [BACKEND SERVICES & BUSINESS LOGIC - SERVER-ONLY]
│   │   ├── db.ts               # Prisma ORM client singleton & connection pooler
│   │   ├── env.ts              # Validasi Zod variabel lingkungan & flags integrasi
│   │   ├── audit/              # Pencatatan audit log mutasi data sensitif
│   │   ├── auth/               # Server-side Better Auth, RBAC guards, WhatsApp OTP logic
│   │   ├── catalog/            # Pengambilan data katalog destinasi & slot media publik
│   │   ├── gallery/            # Pemrosesan gambar Sharp (WebP, strip EXIF, thumbnail)
│   │   ├── integrations/       # Integrasi pihak ketiga:
│   │   │   ├── midtrans/       # Midtrans Snap & Core API (dengan fallback Sandbox simulator)
│   │   │   ├── payment/        # ASPI QRIS generator & simulator scan fake
│   │   │   ├── email/          # Nodemailer SMTP anti-spam (DKIM/SPF compliant)
│   │   │   └── whatsapp/       # WhatsApp Wablas & Fonnte Gateway API
│   │   ├── orders/             # State machine pesanan tiket & cron kuota kadaluwarsa
│   │   ├── pricing/            # Mesin kalkulasi tarif, batas H-0 cutoff & kuota destinasi
│   │   ├── rate-limit/         # Rate limiter in-memory sliding window
│   │   ├── refund/             # Aturan kelayakan refund H-24 & verifikasi 0-scan
│   │   ├── scan/               # Validasi QR gate, verifikasi HMAC, anti-passback
│   │   ├── staff/              # Penjadwalan giliran kerja & presensi petugas
│   │   └── super-admin/        # Manajemen akun pengguna & konfigurasi global
│   │
│   ├── lib/                    # [SHARED UTILITIES - BISA DIPAKAI FRONTEND & BACKEND]
│   │   ├── currency.ts         # Pemformat mata uang IDR & parsing angka
│   │   ├── datetime-wib.ts     # Penanganan zona waktu WIB (Asia/Jakarta), format tanggal
│   │   ├── qr-crypto.ts        # Enkripsi & verifikasi tanda tangan HMAC QR tiket
│   │   ├── cn.ts               # Utilitas penggabungan class Tailwind (clsx + twMerge)
│   │   └── auth-client.ts      # Better-Auth client instance untuk React
│   │
│   ├── styles/                 # [FRONTEND DESIGN TOKENS & STYLING]
│   │   ├── tokens.css          # Palet warna alam (obsidian, kabut, fajar, telaga, hutan)
│   │   ├── glass.css           # Glassmorphism, backdrop blur & border glow
│   │   └── bootstrap-icons-swap.css # Ikon Bootstrap lokal tanpa ketergantungan CDN eksternal
│   │
│   ├── i18n/                   # [SHARED LOCALIZATION ROUTING]
│   │   ├── routing.ts          # Konfigurasi locale: "id" (utama) & "en" (internasional)
│   │   └── navigation.ts       # Link, useRouter, usePathname terintegrasi i18n
│   │
│   └── messages/               # [KAMUS TERJEMAHAN JSON]
│       ├── id.json             # Bahasa Indonesia lengkap
│       └── en.json             # Bahasa Inggris lengkap
```

---

## 🛡️ Batasan Arsitektur & Prinsip Pemisahan

1. **Aturan `server-only`:**
   * Seluruh kode di `src/server/` dilindungi dengan `import "server-only";`.
   * Modul server tidak boleh diimpor langsung ke komponen klien (`"use client"`). Komunikasi antara Frontend dan Backend dilakukan via:
     - **Server Components (SSR Props):** Page loader mengambil data dari service server dan meneruskannya ke Client Component sebagai props.
     - **API Route Handlers:** Komponen klien memanggil endpoint REST di `src/app/api/...` via `fetch()`.

2. **Keamanan Kredensial:**
   * Secret key seperti `BETTER_AUTH_SECRET`, `MIDTRANS_SERVER_KEY`, `WABLAS_API_KEY`, dan `DATABASE_URL` hanya berada di runtime server dan tidak pernah terekspos ke browser pengguna.
