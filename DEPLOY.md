# PANDUAN PEMULA — Dari Ekstrak ZIP sampai Online di Vercel

Ikuti urutan **A → G**. Setiap bagian punya kotak centang. Jangan loncat.
Perintah Windows ditulis untuk **PowerShell** (pakai `npm.cmd`; di Mac/Linux cukup `npm`).

```
A. Siapkan alat  →  B. Ekstrak & jalankan lokal  →  C. UBAH data sebelum upload
→  D. Upload ke GitHub  →  E. Siapkan Supabase & R2  →  F. Deploy Vercel  →  G. Cek & amankan
```

---

## A. Siapkan alat (sekali saja)
- [ ] **Node.js LTS** (nodejs.org) — cek: `node -v`
- [ ] **Git** (git-scm.com) — cek: `git --version`
- [ ] Akun gratis: **GitHub**, **Supabase**, **Vercel**, **Cloudflare**, **Midtrans** (pilih Sandbox dulu)
- [ ] Atur identitas Git (sekali):
  ```powershell
  git config --global user.name "Nama Anda"
  git config --global user.email "email@anda.com"
  ```

## B. Ekstrak dan coba jalan di komputer
1. Klik kanan `wisata-cirebon.zip` → **Extract All** → buka folder hasilnya di terminal.
2. Pasang dependensi: `npm.cmd ci`
3. Buat file pengaturan: `copy .env.example .env`
4. Buka `.env`, lalu isi minimal ini untuk percobaan lokal:
   - `DATABASE_URL` dan `DIRECT_URL` → database PostgreSQL lokal Anda, **atau langsung lompat ke bagian E** dan pakai Supabase (lebih mudah, tidak perlu pasang PostgreSQL).
   - `BETTER_AUTH_SECRET`, `QR_SIGNING_SECRET`, `CRON_SECRET` → buat masing-masing dengan:
     ```powershell
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
     (jalankan 3 kali, tempel hasil yang **berbeda** untuk tiap variabel)
   - `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD`, `SEED_SUPERADMIN_NAME`, `SEED_SUPERADMIN_WHATSAPP` → data **Anda sendiri** (lihat bagian C).
5. Buat tabel dan isi data awal:
   ```powershell
   npm.cmd run db:migrate
   npm.cmd run db:seed
   ```
6. Jalankan: `npm.cmd run dev` → buka http://localhost:3000

## C. YANG HARUS DIUBAH SEBELUM UPLOAD / DEPLOY

Ini bagian terpenting. Data bawaan hanyalah data awal dan **bukan data asli pengelola**.

### C1. Wajib diubah (sebelum `db:seed` ke database produksi)
| # | Apa | Di mana | Ubah jadi |
|---|---|---|---|
| 1 | Akun Super Admin | `.env` → `SEED_SUPERADMIN_*` | Email, nama, WhatsApp, dan **password kuat** milik pengelola |
| 2 | Kata sandi semua petugas | `.env` → `SEED_STAFF_PASSWORD` | Sandi acak yang kuat (jangan pakai bawaan) |
| 3 | Nama, email, dan nomor WA petugas | `prisma/seed.ts`, daftar `initialStaffList` (sekitar baris 434–482) | Data petugas **asli**: `email`, `name`, `publicName`, `initials`, `whatsapp`, `jobTitleId/En`. Hapus petugas yang tidak ada. Nomor WA bawaan (`+628572490883x`) hanyalah contoh |
| 4 | Petugas di bawah 18 tahun | `isMinor: true` pada petugas terkait | Set `true` bila petugas berusia <18 (nama lengkap disembunyikan di publik). Set `false` bila bukan |

> Aman diedit: cukup ubah nilai teks di dalam `initialStaffList`. Jangan hapus tanda kutip atau koma.

### C2. Bisa diubah setelah online (lewat dashboard, tanpa edit kode)
| Apa | Menu |
|---|---|
| Harga tiket dan parkir | Admin → Kuota & Tarif (membuat versi tarif baru) |
| Kuota harian per destinasi | Admin → Kuota & Tarif |
| Nomor WA dan email pengelola (tombol bantuan publik) | Super Admin → Pengaturan Situs |
| Jendela bayar, batas tiket/pesanan, kebijakan refund | Super Admin → Pengaturan Situs |
| Foto hero, kartu, galeri (13 gambar bawaan berupa ilustrasi kontur) | Admin → Media & Konten (ganti dengan foto asli) |
| Admin baru dan petugas baru | Super Admin → Pengguna; Admin → Petugas |

### C3. Peta offline — baca ini
File `public/maps/cirebon.pmtiles` di ZIP ini hanyalah **kerangka kosong (±500 byte), bukan peta sungguhan**. Untuk peta offline asli, jalankan sekali (butuh internet):
```powershell
npm.cmd run maps:build
```
Lalu cek ukuran file `public/maps/cirebon.pmtiles` (peta asli berukuran jauh lebih besar). Tanpa langkah ini, tombol unduh peta offline tidak berisi peta nyata. Skrip ini belum saya uji terhadap server Protomaps, jadi jika gagal, aplikasi tetap berjalan tetapi memakai peta online.

### C4. Jangan diubah
- `AGENTS.md`, folder `src/messages/` (hanya jika ingin ubah teks; kunci `id.json` dan `en.json` harus tetap sama — cek `npm.cmd run i18n:check`).
- Jangan commit `.env`.

## D. Upload ke GitHub
1. Di github.com → **New repository** → nama `wisata-cirebon` → pilih **Private** → **jangan** centang README/gitignore → Create.
2. Di folder proyek:
   ```powershell
   git init
   git add .
   ```
3. **Cek keamanan sebelum commit** — `.env` tidak boleh muncul:
   ```powershell
   git status
   git check-ignore .env
   ```
   Perintah kedua harus mencetak `.env`. Jika `.env` ada di daftar `git status`, **berhenti** dan jangan commit.
4. Commit dan push:
   ```powershell
   git commit -m "Wisata Cirebon: versi awal"
   git branch -M main
   git remote add origin https://github.com/USERNAME/wisata-cirebon.git
   git push -u origin main
   ```
   (Jika diminta login, masuk lewat jendela browser GitHub.)

## E. Siapkan Supabase dan Cloudflare R2

### E1. Database Supabase
1. supabase.com → **New project** → region **Singapore** → catat password database.
2. Klik **Connect** → pilih **Session pooler** → salin string:
   `postgresql://postgres.PROJECTREF:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
3. Isi **kedua** `DATABASE_URL` dan `DIRECT_URL` di `.env` dengan string itu.
4. Buat tabel dan data (dari komputer, setelah C1 selesai):
   ```powershell
   npm.cmd run db:migrate
   npm.cmd run db:seed
   ```

### E2. Penyimpanan foto Cloudflare R2 (wajib di Vercel)
1. Cloudflare → **R2** → **Create bucket** (`wisata-cirebon`) → Settings → aktifkan **Public access (r2.dev)**, salin URL publik.
2. **Manage API tokens** → buat token **Object Read & Write** → catat Access Key ID, Secret, dan endpoint `https://ACCOUNTID.r2.cloudflarestorage.com`.
3. Nilai untuk Vercel (bagian F): `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`.

### E3. Midtrans (sandbox)
Midtrans → Settings → Access Keys → salin `Server Key` dan `Client Key`.

## F. Deploy ke Vercel
1. vercel.com → **Add New → Project** → impor repo `wisata-cirebon`.
2. Buka **Environment Variables**, masukkan semua ini (salin dari `.env`, **kecuali** `SEED_*` yang tidak dibutuhkan server):

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL`, `DIRECT_URL` | string Session pooler Supabase |
   | `APP_URL` | `https://NAMA-PROYEK.vercel.app` (isi perkiraan dulu, perbaiki setelah deploy) |
   | `BETTER_AUTH_SECRET`, `QR_SIGNING_SECRET`, `CRON_SECRET` | 3 kunci acak dari langkah B |
   | `STORAGE_DRIVER` + 6 variabel `S3_*` | dari E2 |
   | `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | dari E3 |
   | `MIDTRANS_IS_PRODUCTION` | `false` (jadi `true` saat produksi sungguhan) |
   | `SMTP_*`, `MAIL_FROM`, `WA_*`, `GOOGLE_*`, `FACEBOOK_*` | opsional; kosong = fitur otomatis nonaktif |

3. Klik **Deploy**. Setelah selesai, salin alamat situs. Jika berbeda dari `APP_URL`, ubah `APP_URL` di Vercel → **Redeploy**.
4. Midtrans → Settings → Configuration → **Payment Notification URL**:
   `https://ALAMAT-SITUS/api/webhooks/midtrans`
5. (Opsional) domain sendiri: Vercel → Settings → Domains, lalu ubah `APP_URL` dan URL webhook Midtrans.

## G. Cek dan amankan setelah online
- [ ] `/` dan `/en` tampil; harga dan kuota muncul.
- [ ] Login dengan akun `SEED_SUPERADMIN_*` → aktifkan **2FA** saat diminta.
- [ ] Super Admin → **Kesehatan Integrasi**: database, penyimpanan, Midtrans hijau.
- [ ] Super Admin → **Pengaturan Situs**: periksa nomor WA dan email pengelola.
- [ ] Admin → **Media & Konten**: ganti gambar bawaan dengan foto asli.
- [ ] Daftar akun wisatawan → beli tiket sandbox → tiket muncul di Dompet.
- [ ] Petugas login dengan sandi dari `SEED_STAFF_PASSWORD` → minta mereka menggantinya.
- [ ] Baru setelah semua lolos: ganti Midtrans ke kunci Production dan `MIDTRANS_IS_PRODUCTION=true`.

## Masalah umum
| Gejala | Solusi |
|---|---|
| `npm` diblokir di PowerShell | pakai `npm.cmd` |
| Migrasi gagal / timeout | pakai **Session pooler**, bukan Direct connection |
| Build Vercel: `DATABASE_URL belum diatur` | tambahkan variabel di Vercel, lalu Redeploy |
| Unggah foto gagal | pastikan `STORAGE_DRIVER=s3` dan semua `S3_*` terisi |
| Webhook Midtrans 401 | `MIDTRANS_SERVER_KEY` beda dengan di dashboard Midtrans |
| Login Google/Facebook tidak muncul | normal bila kunci kosong |
| Lupa password Super Admin | ubah `SEED_SUPERADMIN_PASSWORD`, jalankan ulang `npm.cmd run db:seed` |
