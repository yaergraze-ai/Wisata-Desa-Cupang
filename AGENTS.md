# AGENTS.md — Aturan Tetap Proyek "Wisata Cirebon" (Batu Lawang & Gunung Bendera)

Dokumen ini dibaca agen SETIAP kali bekerja di repo ini. Patuhi tanpa perlu diingatkan. Jika sebuah instruksi sesaat bertentangan dengan dokumen ini, tanyakan dulu ke pengguna.

---

## 1. Prinsip utama

1. **Nol demo.** Tidak ada mock, simulasi, data palsu, tombol "uji cepat", kode OTP/TOTP yang terisi otomatis, `MockProvider`, atau endpoint yang hanya ada untuk pamer. Setiap tombol harus menjalankan aksi nyata ke server dan database.
2. **Server adalah otoritas.** Harga, kuota, peran, status tiket, dan validasi scan dihitung dan diputuskan di server. Klien hanya menampilkan.
3. **Satu sumber kebenaran.** Angka bisnis (harga, kuota, jam buka, koordinat, titik jalur) hidup di database dan dibaca lewat service. Dilarang meng-hardcode angka bisnis di komponen UI. Teks antarmuka dan teks pemasaran hidup di file pesan per bahasa (`messages/id.json`, `messages/en.json`), bukan di JSX.
4. **Integrasi pihak ketiga diimplementasikan penuh, bukan dipalsukan.** Jika kredensial belum diisi di `.env`, fitur itu otomatis nonaktif/tersembunyi dengan pesan jelas dan tampil sebagai "belum dikonfigurasi" di panel Super Admin. Jangan pernah mengisi dengan nilai palsu.
5. **Jujur saat terblokir.** Jika sesuatu tidak bisa diselesaikan (butuh kredensial, akses jaringan, aset), catat di `docs/KEPUTUSAN.md` dan `TUTORIAL.md`, lalu lanjutkan bagian lain. Jangan menutupinya dengan solusi semu.

## 2. Stack (terkunci)

| Area | Pilihan |
|---|---|
| Framework | Next.js versi stabil terbaru, App Router, React, TypeScript `strict` |
| Runtime | Node.js LTS terbaru (cek dengan `node -v`, tulis di `package.json` → `engines`) |
| Styling | Tailwind CSS v4 (token di `@theme`), CSS modern (container queries, `color-mix`, `:has`) |
| Ikon | **Bootstrap Icons** (paket npm `bootstrap-icons`, self-hosted, tanpa CDN). Hanya ikon, bukan CSS Bootstrap |
| Animasi | **GSAP** (`gsap`, `@gsap/react`, ScrollTrigger, Draggable, SplitText) untuk hero & scroll; **Motion** (`motion/react`) untuk UI (dialog, tab, toast, layout). Jangan dua-duanya pada elemen yang sama |
| Database | PostgreSQL + Prisma ORM (migrasi tercatat di repo) |
| Auth | Better Auth (plugin `twoFactor`, `phoneNumber`, `admin`; sosial Google & Facebook). Verifikasi dulu di dokumentasi resminya; jika ada plugin yang tidak tersedia, pakai Auth.js v5 + implementasi sendiri, dengan syarat semua kebutuhan di prompt tetap terpenuhi |
| Validasi | Zod di server DAN klien; React Hook Form di klien |
| Data klien | Server Components + Server Actions/Route Handlers; TanStack Query untuk panel interaktif; TanStack Table untuk tabel |
| Bahasa (i18n) | next-intl, dua bahasa: Indonesia (`id`, bawaan) dan Inggris (`en`) |
| Peta | MapLibre GL JS + PMTiles (self-hosted) |
| Pembayaran | Midtrans Snap (sandbox/produksi via env) |
| Grafik | Recharts, di-restyle penuh mengikuti token desain |
| Lain-lain | `sharp` (gambar), `qrcode`, pemindai QR berbasis kamera, `otplib`/plugin 2FA, `date-fns` + zona waktu, Sonner (toast), Radix UI (primitif aksesibel) |
| Uji | Vitest (unit), Playwright (e2e) |
| Manajer paket | npm |

Versi dipilih agen saat scaffolding (cek `npm view <paket> version`), lalu dikunci di `package-lock.json`. Jangan memakai paket yang terakhir dirilis kurang dari 14 hari.

## 3. Struktur folder

```
src/
  app/[locale]/         # route App Router: (publik), (auth), dashboard/{member,staff,admin,super-admin}; api/ di luar [locale]
  components/{ui,landing,dashboard,map,ticket}/
  messages/             # id.json, en.json: semua teks UI dan pemasaran (kunci kedua file harus identik)
  server/               # logika bisnis (server-only): pricing, quota, orders, tickets, scan, geo, auth, audit
    integrations/       # payment/, whatsapp/, email/, storage/  (masing-masing dengan interface + adapter nyata)
  lib/                  # util murni (format Rupiah, tanggal WIB, geo)
  styles/               # tokens.css, glass.css
prisma/                 # schema.prisma, migrations/, seed.ts (data konfigurasi saja)
public/maps/            # cirebon.pmtiles, glyphs, sprites
tests/{unit,e2e}/
docs/                   # ARSITEKTUR.md, KEPUTUSAN.md, PENERIMAAN.md
referensi/              # file HTML asli (hanya dibaca, jangan di-deploy)
```

## 4. Desain

**Identitas (dipertahankan dari file asli):** editorial, tenang, alam pegunungan berkabut.

Token warna (tulis di `@theme`, buat skala 50–950 untuk tiap warna):

| Token | Hex | Peran |
|---|---|---|
| `obsidian` | `#08110E` | kanvas gelap utama |
| `hutan` | `#0F2A24` | permukaan solid gelap |
| `kabut` | `#E8F1EC` | teks di atas gelap, permukaan solid terang |
| `telaga` | `#2F8F83` | aksen utama |
| `fajar` | `#F2A65A` | aksen hangat, CTA, rating |
| `batu` | `#5B6B66` | garis halus dan ikon dekoratif |

**Kontras (wajib lulus WCAG AA, 4.5:1 untuk teks normal).** Hasil hitung pada file asli: teks `kabut` di atas `telaga` hanya ≈3,4:1, dan `batu` di atas `obsidian` ≈3,4:1. Karena itu: tombol utama memakai varian `telaga` yang lebih gelap (sekitar `#23746A`, verifikasi dengan alat kontras); `batu` tidak boleh jadi warna teks di atas gelap; teks sekunder di atas gelap minimal `kabut` opasitas 72%. Dilarang ukuran teks di bawah 12px untuk konten bermakna.

**Tipografi:** Bricolage Grotesque (judul) dan Plus Jakarta Sans (isi), di-host lewat `next/font` (bukan Google Fonts CDN). Skala: 12 / 14 / 16 / 20 / 28 / 40 / display (clamp). Tata letak harus tahan perbedaan panjang teks Indonesia dan Inggris (tombol tidak boleh meluap, teks tidak boleh terpotong).

**Glassmorphism (aturan pakai):**
- Resep: `background: rgb(255 255 255 / .12–.16)`, `border: 1px solid rgb(255 255 255 / .24)`, `backdrop-filter: blur(16–20px) saturate(140%)`, radius 20px, bayangan lembut, plus highlight tepi atas 1px.
- Dipakai hanya di atas foto/latar visual (hero, navbar, kartu galeri, sidebar dashboard, modal).
- Data padat (tabel, form checkout, scanner, peta, laporan) memakai **permukaan solid** (`hutan` atau `kabut`) agar terbaca di bawah matahari.
- Wajib ada fallback `@supports not (backdrop-filter…)` dan `prefers-reduced-transparency`.

**Motif khas (supaya tidak generik):** garis kontur topografi (SVG, opasitas 4–6%) sebagai tekstur latar, dan garis jalur dengan penanda pos sebagai elemen berulang (stepper checkout, timeline, loader). Tiket Putih berdesain kertas putih dengan takik perforasi dan stempel; Tiket Reguler hijau gelap.

**Uji anti-AI-slop. Setiap layar dianggap gagal bila:**
- memakai gradien ungu-biru generik, blob melayang, atau gradient-text di mana-mana;
- memakai emoji sebagai ikon;
- berupa grid kartu identik dengan radius dan bayangan seragam tanpa hierarki;
- memakai tampilan default shadcn/Radix tanpa di-restyle;
- berisi teks "Welcome back 👋", lorem ipsum, angka statistik palsu, atau testimoni karangan;
- memuat klaim yang tak bisa diverifikasi (mis. "ribuan spot foto", "paling populer" tanpa data);
- punya lebih dari satu aksi utama yang bersaing;
- terlihat sama jika logo ditutup (tidak ada identitas).

**Dashboard:** shell dengan sidebar (collapsible) + topbar (breadcrumb, notifikasi nyata, menu akun); di ponsel jadi tab bar bawah (maks 5 item) + sheet. Setiap layar punya: skeleton loading, empty state yang memberi langkah berikutnya, error state dengan tombol coba lagi, dan status tombol (loading/disabled) yang jelas. Filter dan pagination tabel disimpan di URL (`searchParams`).

## 5. Animasi
- Hanya animasikan `transform` dan `opacity`. Bersihkan semua timeline/trigger saat unmount (`useGSAP` dengan `scope`).
- Hormati `prefers-reduced-motion`: tanpa autoplay, tanpa parallax, transisi instan.
- Gunakan `gsap.matchMedia()` untuk perilaku per breakpoint.
- Animasi tidak boleh menghalangi interaksi atau memperburuk LCP/CLS.

## 6. Kode & kualitas
- TypeScript `strict`, dilarang `any` dan `@ts-ignore` tanpa alasan tertulis.
- Setiap input dari luar (form, query, body, webhook) divalidasi Zod di server.
- Modul server diberi `import "server-only"`. Rahasia tidak boleh masuk bundel klien.
- Semua uang dalam **integer rupiah**. Semua tanggal bisnis dalam zona **Asia/Jakarta (WIB)**; simpan UTC di DB, tanggal kunjungan bertipe `DATE`.
- Dua bahasa (`id` bawaan, `en`): semua teks yang terlihat pengguna diambil dari `messages/*.json`, termasuk label, galat validasi Zod, toast, `aria-label`, judul halaman/metadata, email, pesan WhatsApp, dan PDF tiket. Angka, mata uang, dan tanggal memakai `Intl` sesuai locale (id: `Rp18.000`, `31 Okt 2026`; en: `IDR 18,000`, `31 Oct 2026`); mata uang tetap Rupiah di kedua bahasa. Kode di database (status, peran, aksi audit) bersifat netral dan baru diterjemahkan saat ditampilkan.
- Aksesibilitas: label pada semua input, fokus terlihat, navigasi keyboard penuh, `aria-live` untuk status dinamis, target sentuh ≥44px.
- Komponen kecil dan terpisah; tidak ada fungsi di atas ±80 baris tanpa alasan.
- Komentar menjelaskan *mengapa*, bukan *apa*.

## 7. Keamanan & privasi (OWASP + UU PDP)
- RBAC dicek **di setiap Route Handler dan Server Action** (middleware hanya untuk pengalihan). Peran tidak pernah dipilih pengguna saat daftar/login; pendaftaran publik selalu `MEMBER`.
- Admin dan Super Admin wajib 2FA TOTP. Perubahan peran dan aksi sensitif butuh step-up (verifikasi ulang).
- Rate limiting pada login, OTP, checkout, scan, kontak, dan upload.
- Header keamanan: CSP (nonce), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation dan camera hanya `self`).
- Webhook pembayaran: verifikasi tanda tangan **dan** idempoten (event yang sama diproses sekali).
- Upload gambar: cek tipe lewat magic bytes, batasi ukuran, re-encode ke WebP dengan `sharp`, **hapus EXIF/GPS**.
- Audit log append-only untuk login, perubahan peran/harga/kuota, penerbitan/pembatalan tiket, refund, akses data kontak pengunjung.
- Privasi: persetujuan eksplisit saat daftar, halaman Kebijakan Privasi dan Syarat & Ketentuan, minimisasi data, ekspor data pribadi, dan penghapusan akun (anonimisasi data pribadi, transaksi tetap tercatat tanpa identitas). Petugas di bawah 18 tahun tidak boleh menampilkan nama lengkap, usia, atau kontak pribadi di halaman publik (tampilkan inisial + kontak pengelola).
- Rahasia hanya di `.env`; sediakan `.env.example` berkomentar. `.env` masuk `.gitignore`.

## 8. Alur kerja agen
1. Mulai dengan **Planning Mode**: baca `referensi/`, buat Implementation Plan dan Task List.
2. Kerjakan per fase. Di akhir tiap fase jalankan `npm run lint`, `npm run typecheck`, `npm test`, lalu **verifikasi di browser** (buka halaman, klik alurnya, ambil screenshot sebagai artifact). Jangan lanjut jika ada yang gagal.
3. Satu commit per fase (Conventional Commits, mis. `feat(tiket): kunci kuota atomik`).
4. Putuskan sendiri hal yang bisa diputuskan, catat di `docs/KEPUTUSAN.md`. Bertanya hanya bila butuh kredensial atau aset yang tidak mungkin dibuat agen.
5. Jangan menghapus atau menimpa `referensi/` dan `AGENTS.md`.

## 9. Dilarang
- Menyalin HTML asli apa adanya. File asli adalah **referensi konten, data, dan arah visual**, bukan basis kode.
- Memuat Tailwind lewat CDN, atau ikon/font/skrip dari CDN pada build produksi.
- Menyimpan status penting di `localStorage` (token, peran, tiket).
- Kata "demo", "simulasi", "mock", "uji cepat", "placeholder" pada teks yang tampil ke pengguna.
- Teks UI ter-hardcode di JSX, atau kunci pesan yang hanya ada di salah satu bahasa.
- Menerjemahkan otomatis konten buatan pengguna (ulasan, pesan kontak); tampilkan apa adanya.
- Menampilkan istilah internal ke pengguna (mis. "Sesuai Bagian 6.3 Brief", "PostGIS", "OWASP A01", "27/27 tabel RLS").
