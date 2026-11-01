# ARSITEKTUR SISTEM — Wisata Cirebon (Batu Lawang & Gunung Bendera)

Dokumen ini menjelaskan rancangan arsitektur teknis, aliran data atomik, model data relasional (ERD), serta jaminan integritas produksi untuk platform e-ticketing resmi kawasan wisata Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon.

---

## 1. Ikhtisar Arsitektur Tingkat Tinggi

Platform dibangun menggunakan arsitektur monolit modern terdistribusi berbasis **Next.js 16 (App Router)** dan **React 19**, didukung oleh database relasional **PostgreSQL 16** dan ORM **Prisma 7**. Seluruh komponen dirancang tanpa ketergantungan mock/demo (*zero-demo*), dengan komputasi harga dan kuota berbasis database dinamis, isolasi peran RBAC multi-tier, serta dukungan penuh dwibahasa Indonesia (`/`) dan Inggris (`/en`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Klien Peramban / PWA                         │
│  - Wisatawan (Beranda, Kalkulator, Wizard Checkout, Dompet Offline)    │
│  - Petugas Lapangan (Pemindai QR Luar Ruangan, Kontras Tinggi)          │
│  - Admin / Super Admin (Metrik Recharts, Kuota, Tarif, Log Audit)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 Server / Runtime                     │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│  │    Proxy / Routing    │ │   Server Components   │ │ API Route     │ │
│  │  - next-intl (id/en)  │ │  - Server Actions     │ │   Handlers    │ │
│  │  - PWA Service Worker │ │  - React Suspense     │ │  - RESTful    │ │
│  └───────────┬───────────┘ └───────────┬───────────┘ └───────┬───────┘ │
│              │                         │                     │         │
│              ▼                         ▼                     ▼         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    Server Services & Security Guards              │ │
│  │  - Better Auth + RBAC Multi-Role (MEMBER, STAFF, ADMIN, SUPER)    │ │
│  │  - Step-Up TOTP QR / Backup Codes Guard                           │ │
│  │  - Atomic Quota & Price Engine (SELECT ... FOR UPDATE)            │ │
│  │  - Cryptographic QR Signer (AES-256-GCM + HMAC-SHA256)           │ │
│  │  - EXIF Stripper (Sharp WebP Q82) & Storage Adapters (Local/S3)   │ │
│  │  - PostgreSQL Rate Limiter (Transaksional Tanpa Redis)            │ │
│  │  - Append-Only Audit Logger                                       │ │
│  └─────────────────────────────────┬─────────────────────────────────┘ │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    PostgreSQL 16     │  │   Midtrans Snap V2   │  │  SMTP / WhatsApp OTP │
│  - Prisma 7 Schema   │  │  - Snap Pop-up      │  │  - Nodemailer SMTP   │
│  - Row Locks (FOR UP)│  │  - Webhook SHA-512   │  │  - WA Business / API │
│  - Partial Unique Idx│  │  - Idempoten Event   │  │  - Validasi E.164    │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## 2. Diagram Alur Transaksional (Mermaid)

### 2.1 Pembelian Tiket Paralel & Penguncian Kuota Atomik (Anti-Oversell)

Pemesanan kuota harian dilindungi oleh transaksi database terisolasi menggunakan `SELECT ... FOR UPDATE` terurut leksikografis untuk mengeliminasi race condition dan deadlock saat 100 checkout terjadi secara bersamaan.

```mermaid
sequenceDiagram
    autonumber
    actor Pembeli as Wisatawan / Klien
    participant API as /api/orders
    participant DB as PostgreSQL 16 (Prisma Transaction)
    participant Snap as Midtrans Snap Engine

    Pembeli->>API: POST /api/orders { visitDate, putihQty, regulerQty }
    Note over API: Validasi Skema Zod & Sanitasi Input

    API->>DB: BEGIN TRANSACTION (ISOLATION: READ COMMITTED)
    Note over DB: 1. Materialisasi DailyQuota jika belum ada<br/>(INSERT ... ON CONFLICT DO NOTHING)
    Note over DB: 2. Urutkan destinationId leksikografis (ASC)<br/>['batu-lawang', 'gunung-bendera']
    
    API->>DB: SELECT id, capacity FROM DailyQuota WHERE date = $visitDate AND destinationId IN (...) FOR UPDATE
    Note over DB: Row lock aktif. Permintaan paralel lainnya antre di tingkat database.

    API->>DB: Hitung kuota terpakai real-time (paidUsed + pendingUsed aktif)
    alt Sisa Kuota < requestedQty
        DB-->>API: Sisa kuota tidak mencukupi
        API->>DB: ROLLBACK
        API-->>Pembeli: HTTP 409 Conflict { error: "KUOTA_HABIS", sisaKuota }
    else Kuota Mencukupi
        API->>DB: INSERT INTO Order (status='PENDING', expiresAt=NOW()+15m)
        API->>DB: INSERT INTO OrderItem (unitBase, unitParking, unitTotal, subtotal)
        API->>Snap: Create Snap Transaction (orderNumber, grossAmount)
        Snap-->>API: snapToken & redirectUrl
        API->>DB: UPDATE Order SET snapToken = $token
        API->>DB: COMMIT TRANSACTION
        Note over DB: Lock dilepas. Kuota otomatis ter-reserve selama 15 menit.
        API-->>Pembeli: HTTP 201 Created { order, snapToken }
    end
```

---

### 2.2 Verifikasi Webhook Midtrans & Penerbitan Tiket Kriptografis Idempoten

Notifikasi pembayaran Midtrans divalidasi dengan tanda tangan digital SHA-512 (`order_id + status_code + gross_amount + ServerKey`) sebelum status pesanan diubah menjadi `PAID` dan tiket diterbitkan.

```mermaid
sequenceDiagram
    autonumber
    participant Midtrans as Midtrans Server
    participant Webhook as /api/webhooks/midtrans
    participant DB as PostgreSQL 16
    participant Crypto as QR Crypto Engine (AES/HMAC)

    Midtrans->>Webhook: POST /api/webhooks/midtrans { order_id, status_code, gross_amount, signature_key, transaction_status }
    
    Note over Webhook: Verifikasi Tanda Tangan SHA-512:<br/>SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
    alt Tanda Tangan Tidak Cocok
        Webhook-->>Midtrans: HTTP 401 Unauthorized { error: "INVALID_SIGNATURE" }
    else Tanda Tangan Valid
        Webhook->>DB: BEGIN TRANSACTION
        Webhook->>DB: SELECT * FROM PaymentEvent WHERE eventId = $transaction_id FOR UPDATE
        alt Event Sudah Pernah Diproses (Idempotensi)
            DB-->>Webhook: Event ada (isProcessed = true)
            Webhook->>DB: COMMIT
            Webhook-->>Midtrans: HTTP 200 OK { message: "EVENT_ALREADY_PROCESSED" }
        else Event Baru
            Webhook->>DB: INSERT INTO PaymentEvent (eventId, payload, isProcessed=true)
            Webhook->>DB: SELECT * FROM Order WHERE orderNumber = $order_id FOR UPDATE
            
            alt transaction_status IN ('settlement', 'capture')
                Webhook->>DB: UPDATE Order SET status = 'PAID', paidAt = NOW()
                loop Untuk setiap tiket yang dibeli
                    Webhook->>Crypto: issueServerQrCredentials()
                    Crypto-->>Webhook: { qrTokenHash, qrTokenCipher, publicCode }
                    Webhook->>DB: INSERT INTO Ticket (orderId, publicCode, qrTokenHash, qrTokenCipher, status='ACTIVE')
                end
                Webhook->>DB: INSERT INTO AuditLog (action='ORDER_PAID', entityId=$orderId)
            else transaction_status IN ('cancel', 'expire')
                Webhook->>DB: UPDATE Order SET status = 'CANCELLED' / 'EXPIRED'
            end
            
            Webhook->>DB: COMMIT TRANSACTION
            Webhook-->>Midtrans: HTTP 200 OK { success: true }
        end
    end
```

---

### 2.3 Pemindaian Tiket Petugas Lapangan & Perlindungan Parsial Anti-Ganda

Pemeriksaan tiket di pintu masuk fisik (`GERBANG_BATU_LAWANG` atau `PINTU_GUNUNG_BENDERA`) menerapkan penguncian baris `Ticket`, verifikasi tanggal kunjungan WIB, jam operasional destinasi, hak gerbang produk, serta indeks parsial unik `GateScan_ticket_gate_accepted_idx`.

```mermaid
sequenceDiagram
    autonumber
    actor Petugas as Petugas Lapangan (STAFF)
    participant Scanner as /api/staff/scan
    participant ScanSvc as Scan Service Engine
    participant DB as PostgreSQL 16

    Petugas->>Scanner: POST /api/staff/scan { rawInput: "WC1.xxx.yyy", gate: "GERBANG_BATU_LAWANG" }
    Scanner->>ScanSvc: scanTicketAtGate(input)
    
    Note over ScanSvc: 1. Dekode & Verifikasi HMAC-SHA256 Token QR<br/>atau Regex Public Code (PUTIH-CBN-XXXXXX)
    
    ScanSvc->>DB: Cari Ticket berdasarkan qrTokenHash atau publicCode
    alt Tiket Tidak Ditemukan
        DB-->>ScanSvc: null
        ScanSvc->>DB: INSERT INTO AuditLog (action='GATE_SCAN_INVALID_TOKEN')
        ScanSvc-->>Petugas: HTTP 200 { result: 'REJECTED', reason: 'INVALID_TOKEN' }
    else Tiket Ditemukan
        DB-->>ScanSvc: Data Tiket, Produk & Riwayat Pindaian

        Note over ScanSvc: 2. Evaluasi Aturan Bisnis Murni (evaluateScanRules):<br/>- Status Tiket == ACTIVE & Order == PAID?<br/>- Tanggal Kunjungan == Tanggal Hari Ini (WIB)?<br/>- Jam Sekarang di dalam Jam Buka Destinasi?<br/>- Gerbang Termasuk dalam allowedGates Produk?<br/>- Belum Pernah Discan di Gerbang Ini?

        alt Aturan Gagal (misal: Salah Tanggal / Tiket Reguler di Gunung Bendera)
            ScanSvc->>DB: INSERT INTO GateScan (ticketId, gate, staffId, result='REJECTED', reason)
            ScanSvc-->>Petugas: HTTP 200 { result: 'REJECTED', reason: 'NOT_WHITE_TICKET' }
        else Aturan Lulus
            ScanSvc->>DB: BEGIN TRANSACTION
            ScanSvc->>DB: SELECT id FROM Ticket WHERE id = $ticketId FOR UPDATE
            ScanSvc->>DB: INSERT INTO GateScan (ticketId, gate, staffId, result='ACCEPTED', reason='OK')
            Note over DB: Constraint PostgreSQL Menjaga:<br/>UNIQUE INDEX GateScan_ticket_gate_accepted_idx<br/>(Hanya 1 ACCEPTED per tiket per gerbang)
            ScanSvc->>DB: COMMIT TRANSACTION
            ScanSvc-->>Petugas: HTTP 200 { result: 'ACCEPTED', admitCount: 2, visitorName: '...' }
        end
    end
```

---

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Account : "has"
    User ||--o{ Session : "has"
    User ||--o| TwoFactor : "configures"
    User ||--o| StaffProfile : "has"
    User ||--o{ Order : "places"
    User ||--o{ Review : "writes"
    User ||--o{ Notification : "receives"
    User ||--o{ AuditLog : "initiates"

    Destination ||--o{ TicketProduct : "associated_with"
    Destination ||--o{ DailyQuota : "tracks"
    Destination ||--o{ StaffProfile : "employs"
    Destination ||--o{ LeaveRequest : "manages"

    TicketProduct ||--o{ TicketTariff : "versioned_by"
    TicketProduct ||--o{ OrderItem : "ordered_in"
    TicketProduct ||--o{ Ticket : "generates"

    Order ||--|{ OrderItem : "contains"
    Order ||--o{ Ticket : "issues"
    Order ||--o{ RefundRequest : "requests"
    Order ||--o{ PaymentEvent : "logs"

    OrderItem ||--o| Ticket : "provisions"
    TicketTariff ||--o{ OrderItem : "prices"

    Ticket ||--o{ GateScan : "scanned_in"
    Ticket ||--o| Review : "yields"
    StaffProfile ||--o{ GateScan : "performs"
    StaffProfile ||--o{ LeaveRequest : "submits"

    Review ||--o{ ReviewPhoto : "attaches"

    MediaSlot ||--o| MediaAsset : "displays"

    User {
        string id PK
        string email UK
        string name
        enum role "MEMBER|STAFF|ADMIN|SUPER_ADMIN"
        string whatsapp
        boolean twoFactorEnabled
        datetime consentAt
        datetime deletedAt
    }

    Destination {
        string id PK
        string slug UK
        string nameId
        string nameEn
        int defaultCapacity
        string openTime
        string closeTime
    }

    DailyQuota {
        string id PK
        date date
        string destinationId FK
        int capacity
        boolean isCustom
    }

    TicketProduct {
        string id PK
        string code UK
        string nameId
        string nameEn
        enum allowedGates "GERBANG_BATU_LAWANG|PINTU_GUNUNG_BENDERA"
        string consumesDestinations
        boolean isActive
    }

    TicketTariff {
        string id PK
        string productId FK
        int version
        int basePrice
        int parkingFee
        datetime effectiveFrom
    }

    Order {
        string id PK
        string orderNumber UK
        string userId FK
        date visitDate
        int totalAmount
        enum status "PENDING|PAID|CANCELLED|EXPIRED|REFUNDED"
        string snapToken
        datetime expiresAt
        datetime paidAt
    }

    Ticket {
        string id PK
        string orderId FK
        string productId FK
        string publicCode UK
        string qrTokenHash UK
        string qrTokenCipher
        string visitorName
        string visitorWhatsapp
        date visitDate
        int admitCount
        enum status "ACTIVE|USED|CANCELLED|REFUNDED"
    }

    GateScan {
        string id PK
        string ticketId FK
        enum gate "GERBANG_BATU_LAWANG|PINTU_GUNUNG_BENDERA"
        string staffId FK
        enum result "ACCEPTED|REJECTED"
        string reason
        datetime scannedAt
    }

    StaffProfile {
        string id PK
        string userId FK
        string destinationId FK
        string publicName
        string initials
        enum assignedGates "GERBANG_BATU_LAWANG|PINTU_GUNUNG_BENDERA"
        json weeklySchedule
    }

    LeaveRequest {
        string id PK
        string staffProfileId FK
        string destinationId FK
        date startDate
        date endDate
        string reason
        enum status "PENDING|APPROVED|REJECTED"
    }

    Review {
        string id PK
        string ticketId FK
        string userId FK
        int rating
        string comment
        enum status "PENDING|PUBLISHED|REJECTED"
        string managerReply
        datetime repliedAt
    }

    AuditLog {
        string id PK
        string actorId FK
        string action
        string entity
        string entityId
        json metadata
        string ip
        datetime createdAt
    }
```

---

## 4. Keamanan, Performa & Kepatuhan Regulasi

### 4.1 Keamanan Multi-Tier & Otorisasi RBAC
- **Server-Side Enforcement**: Otorisasi dicek di setiap Route Handler dan Server Action via `requireRole` (`src/server/auth/guards.ts`).
- **Step-Up Verification**: Operasi sensitif (pergantian peran pengguna, reset sistem, hapus akun) mensyaratkan token step-up berbasis TOTP segar berdurasi 5 menit.
- **Kriptografi Token QR**: Token fisik QR menggunakan format `WC1.<random128>.<hmacSha256>`. Database hanya menyimpan `qrTokenHash` (SHA-256) dan `qrTokenCipher` (AES-256-GCM), mencegah rekonstruksi token palsu bahkan jika database bocor.

### 4.2 Kepatuhan UU PDP No. 27 Tahun 2022
- **Persetujuan Eksplisit**: Registrasi mewajibkan centang persetujuan pemrosesan data pribadi (`consentAt` tercatat otomatis di database).
- **Hak Subjek Data**: Anggota dapat mengekspor portabilitas seluruh data pribadi dalam format JSON terenkripsi (`/api/user/export-data`) dan meminta anonimisasi data akun (`/api/user/delete-account`).
- **Penyamaran Kontak**: Kontak darurat wisatawan di scanner lapangan hanya dapat dibuka dengan konfirmasi modal dan tercatat di `AuditLog` dengan alasan dinas.

### 4.3 Kinerja & PWA Offline
- **Lighthouse Performance 96+**: Aset WebP self-hosted, penataan CSS modular, server rendering murni di Next.js App Router, CSS icons swap tanpa font eksternal render-blocking.
- **Peta Offline PMTiles**: Basemap Desa Cupang berformat PMTiles diekstrak lokal ke `public/maps/cirebon.pmtiles` dan di-cache otomatis oleh Service Worker, memungkinkan navigasi GPS jalur pendakian Gunung Bendera tanpa sinyal seluler.
