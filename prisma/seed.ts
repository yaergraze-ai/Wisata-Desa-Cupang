import "dotenv/config";
import { PrismaClient, GateType, Role, Locale } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { ensureDefaultMediaFiles } from "../scripts/generate-default-media.mjs";
import { normalizeIndonesianWhatsapp } from "../src/lib/datetime-wib";

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL / DIRECT_URL wajib diatur sebelum menjalankan db:seed.");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // 1. Destinasi Resmi (§4)
    const batuLawang = await prisma.destination.upsert({
      where: { slug: "batu-lawang" },
      update: {
        nameId: "Batu Lawang",
        nameEn: "Batu Lawang",
        descriptionId:
          "Kawasan tebing batuan andesit purba menjulang di Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon dengan gardu pandang lembah dan hutan teduh.",
        descriptionEn:
          "Ancient towering andesite rock cliffs in Cupang Village, Gempol District, Cirebon Regency featuring valley lookouts and shaded forest.",
        lat: -6.727607167637373,
        lng: 108.38072279460317,
        elevationM: 380,
        openTime: "06:00",
        closeTime: "17:00",
        defaultCapacity: 150,
        isActive: true,
      },
      create: {
        slug: "batu-lawang",
        nameId: "Batu Lawang",
        nameEn: "Batu Lawang",
        descriptionId:
          "Kawasan tebing batuan andesit purba menjulang di Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon dengan gardu pandang lembah dan hutan teduh.",
        descriptionEn:
          "Ancient towering andesite rock cliffs in Cupang Village, Gempol District, Cirebon Regency featuring valley lookouts and shaded forest.",
        lat: -6.727607167637373,
        lng: 108.38072279460317,
        elevationM: 380,
        openTime: "06:00",
        closeTime: "17:00",
        defaultCapacity: 150,
        isActive: true,
      },
    });

    const gunungBendera = await prisma.destination.upsert({
      where: { slug: "gunung-bendera" },
      update: {
        nameId: "Gunung Bendera",
        nameEn: "Gunung Bendera",
        descriptionId:
          "Jalur pendakian 4 pos sepanjang ±870 meter menuju puncak terbuka 520 mdpl dengan panorama 360 derajat Cirebon. Wajib menggunakan Tiket Putih.",
        descriptionEn:
          "A ~870-meter 4-post hiking trail ascending to an open 520 masl summit with 360-degree views of Cirebon. Requires Tiket Putih (White Ticket).",
        lat: -6.7287300041484785,
        lng: 108.382065227753,
        elevationM: 520,
        openTime: "05:30",
        closeTime: "17:00",
        defaultCapacity: 120,
        isActive: true,
      },
      create: {
        slug: "gunung-bendera",
        nameId: "Gunung Bendera",
        nameEn: "Gunung Bendera",
        descriptionId:
          "Jalur pendakian 4 pos sepanjang ±870 meter menuju puncak terbuka 520 mdpl dengan panorama 360 derajat Cirebon. Wajib menggunakan Tiket Putih.",
        descriptionEn:
          "A ~870-meter 4-post hiking trail ascending to an open 520 masl summit with 360-degree views of Cirebon. Requires Tiket Putih (White Ticket).",
        lat: -6.7287300041484785,
        lng: 108.382065227753,
        elevationM: 520,
        openTime: "05:30",
        closeTime: "17:00",
        defaultCapacity: 120,
        isActive: true,
      },
    });

    // 2. Produk Tiket & Tarif Awal v1 (§4)
    const regulerProduct = await prisma.ticketProduct.upsert({
      where: { code: "REGULER_BL" },
      update: {
        nameId: "Tiket Reguler Batu Lawang",
        nameEn: "Batu Lawang Regular Ticket",
        descriptionId:
          "Akses kawasan wisata tebing Batu Lawang, gardu pandang, dan fasilitas dasar (termasuk retribusi parkir satu kali masuk di Gerbang Batu Lawang).",
        descriptionEn:
          "Entry pass to the Batu Lawang cliff recreation area, lookouts, and base facilities (includes parking levy, single entry at Batu Lawang Gate).",
        allowedGates: [GateType.GERBANG_BATU_LAWANG],
        consumesDestinations: ["batu-lawang"],
        isActive: true,
      },
      create: {
        code: "REGULER_BL",
        nameId: "Tiket Reguler Batu Lawang",
        nameEn: "Batu Lawang Regular Ticket",
        descriptionId:
          "Akses kawasan wisata tebing Batu Lawang, gardu pandang, dan fasilitas dasar (termasuk retribusi parkir satu kali masuk di Gerbang Batu Lawang).",
        descriptionEn:
          "Entry pass to the Batu Lawang cliff recreation area, lookouts, and base facilities (includes parking levy, single entry at Batu Lawang Gate).",
        allowedGates: [GateType.GERBANG_BATU_LAWANG],
        consumesDestinations: ["batu-lawang"],
        isActive: true,
      },
    });

    await prisma.ticketTariff.upsert({
      where: {
        productId_version: {
          productId: regulerProduct.id,
          version: 1,
        },
      },
      update: {},
      create: {
        productId: regulerProduct.id,
        version: 1,
        basePrice: 10000,
        parkingFee: 3000,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const putihProduct = await prisma.ticketProduct.upsert({
      where: { code: "TIKET_PUTIH" },
      update: {
        nameId: "Tiket Putih (Batu Lawang + Gunung Bendera)",
        nameEn: "Tiket Putih — White Ticket (Batu Lawang + Gunung Bendera)",
        descriptionId:
          "Tiket terusan resmi untuk masuk Gerbang Batu Lawang sekaligus mendaki melalui Pintu Gunung Bendera hingga Pos 1–4 dan Puncak 520 mdpl (termasuk retribusi parkir).",
        descriptionEn:
          "Combined White Ticket granting entry at Batu Lawang Gate plus full hiking access through Mount Bendera Trailhead across Posts 1–4 to the 520 masl summit (includes parking levy).",
        allowedGates: [
          GateType.GERBANG_BATU_LAWANG,
          GateType.PINTU_GUNUNG_BENDERA,
        ],
        consumesDestinations: ["batu-lawang", "gunung-bendera"],
        isActive: true,
      },
      create: {
        code: "TIKET_PUTIH",
        nameId: "Tiket Putih (Batu Lawang + Gunung Bendera)",
        nameEn: "Tiket Putih — White Ticket (Batu Lawang + Gunung Bendera)",
        descriptionId:
          "Tiket terusan resmi untuk masuk Gerbang Batu Lawang sekaligus mendaki melalui Pintu Gunung Bendera hingga Pos 1–4 dan Puncak 520 mdpl (termasuk retribusi parkir).",
        descriptionEn:
          "Combined White Ticket granting entry at Batu Lawang Gate plus full hiking access through Mount Bendera Trailhead across Posts 1–4 to the 520 masl summit (includes parking levy).",
        allowedGates: [
          GateType.GERBANG_BATU_LAWANG,
          GateType.PINTU_GUNUNG_BENDERA,
        ],
        consumesDestinations: ["batu-lawang", "gunung-bendera"],
        isActive: true,
      },
    });

    await prisma.ticketTariff.upsert({
      where: {
        productId_version: {
          productId: putihProduct.id,
          version: 1,
        },
      },
      update: {},
      create: {
        productId: putihProduct.id,
        version: 1,
        basePrice: 15000,
        parkingFee: 3000,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    // 3. 6 Titik Jalur Resmi Gunung Bendera (§4 & referensi/jalur-gunung-bendera.geojson)
    const trailPointsData = [
      {
        order: 0,
        code: "GATE",
        nameId: "Pintu Gunung Bendera",
        nameEn: "Gunung Bendera Trailhead",
        noteId:
          "Gerbang pemeriksaan Tiket Putih sebelum memulai pendakian jalur Gunung Bendera.",
        noteEn:
          "Tiket Putih (White Ticket) checkpoint gate before starting the Gunung Bendera climb.",
        lat: -6.7287300041484785,
        lng: 108.382065227753,
        elevationM: 365,
        distFromPrevM: 0,
        minsFromPrev: 0,
      },
      {
        order: 1,
        code: "POS-1",
        nameId: "Pos 1",
        nameEn: "Post 1",
        noteId: "Pos istirahat pertama setelah tanjakan awal dari pintu masuk.",
        noteEn: "First rest post after the initial ascent from the trailhead.",
        lat: -6.731303051407472,
        lng: 108.38230336912525,
        elevationM: 410,
        distFromPrevM: 290,
        minsFromPrev: 12,
      },
      {
        order: 2,
        code: "POS-2",
        nameId: "Pos 2",
        nameEn: "Post 2",
        noteId: "Area teduh pepohonan sebelum jalur punggungan bukit.",
        noteEn: "Shaded tree canopy stretch before entering the open ridgeline.",
        lat: -6.732029541218015,
        lng: 108.38256010969788,
        elevationM: 438,
        distFromPrevM: 95,
        minsFromPrev: 6,
      },
      {
        order: 3,
        code: "POS-3",
        nameId: "Pos 3",
        nameEn: "Post 3",
        noteId: "Titik pandang terbuka ke arah lembah timur Cirebon.",
        noteEn: "Open viewpoint overlooking the eastern valley of Cirebon.",
        lat: -6.733036871907536,
        lng: 108.38324270590506,
        elevationM: 472,
        distFromPrevM: 140,
        minsFromPrev: 8,
      },
      {
        order: 4,
        code: "POS-4",
        nameId: "Pos 4",
        nameEn: "Post 4",
        noteId: "Pos terakhir sebelum tanjakan menuju puncak utama.",
        noteEn: "Final rest post before the summit push.",
        lat: -6.733372648339432,
        lng: 108.38289821809958,
        elevationM: 490,
        distFromPrevM: 60,
        minsFromPrev: 4,
      },
      {
        order: 5,
        code: "SUMMIT",
        nameId: "Puncak Gunung Bendera",
        nameEn: "Gunung Bendera Summit",
        noteId:
          "Puncak tertinggi Gunung Bendera (520 mdpl) dengan pemandangan 360 derajat.",
        noteEn:
          "Highest summit of Gunung Bendera (520 masl) with 360-degree panoramic views.",
        lat: -6.73529125216858,
        lng: 108.38117851090418,
        elevationM: 520,
        distFromPrevM: 285,
        minsFromPrev: 15,
      },
    ];

    for (const pt of trailPointsData) {
      await prisma.trailPoint.upsert({
        where: {
          destinationId_code: {
            destinationId: gunungBendera.id,
            code: pt.code,
          },
        },
        update: {
          order: pt.order,
          nameId: pt.nameId,
          nameEn: pt.nameEn,
          noteId: pt.noteId,
          noteEn: pt.noteEn,
          lat: pt.lat,
          lng: pt.lng,
          elevationM: pt.elevationM,
          distFromPrevM: pt.distFromPrevM,
          minsFromPrev: pt.minsFromPrev,
        },
        create: {
          destinationId: gunungBendera.id,
          ...pt,
        },
      });
    }

    // 4. Pengaturan Sistem Bertipe (SiteSetting — §4)
    const defaultSettings = [
      {
        key: "paymentWindowMinutes",
        valueType: "number",
        value: "15",
        descriptionId: "Batas waktu pembayaran pesanan PENDING dalam menit sebelum kuota otomatis dilepas.",
        descriptionEn: "Payment time window in minutes for PENDING orders before quota is automatically released.",
      },
      {
        key: "maxTicketsPerOrder",
        valueType: "number",
        value: "10",
        descriptionId: "Jumlah maksimum pengunjung dalam satu pesanan tiket.",
        descriptionEn: "Maximum total visitors allowed in a single ticket order.",
      },
      {
        key: "bookingWindowDays",
        valueType: "number",
        value: "60",
        descriptionId: "Rentang hari maksimum pemesanan tiket ke depan (WIB).",
        descriptionEn: "Maximum advance booking window in days (WIB).",
      },
      {
        key: "offTrailThresholdM",
        valueType: "number",
        value: "35",
        descriptionId: "Ambang jarak deviasi dari polyline jalur Gunung Bendera (meter) sebelum peringatan luar jalur menyala.",
        descriptionEn: "Distance threshold from the Gunung Bendera trail polyline (meters) before triggering off-trail alerts.",
      },
      {
        key: "leaveCooldownMinutes",
        valueType: "number",
        value: "30",
        descriptionId: "Jeda minimum antar pengajuan libur mendadak per destinasi (menit).",
        descriptionEn: "Minimum cooldown between sudden leave requests per destination (minutes).",
      },
      {
        key: "refundMinHoursBeforeVisit",
        valueType: "number",
        value: "24",
        descriptionId: "Batas waktu minimum pengajuan refund sebelum hari kunjungan (jam).",
        descriptionEn: "Minimum hours before the visit date required to submit a refund request.",
      },
      {
        key: "sameDayCloseBufferMinutes",
        valueType: "number",
        value: "60",
        descriptionId: "Penutupan pembelian tiket hari-H dalam menit sebelum jam tutup destinasi.",
        descriptionEn: "Same-day ticket purchase cutoff in minutes prior to destination closing time.",
      },
      {
        key: "managerWhatsapp",
        valueType: "string",
        value:
          normalizeIndonesianWhatsapp(
            process.env.SEED_SUPERADMIN_WHATSAPP || "+6281224001001"
          ) || "+6281224001001",
        descriptionId: "Nomor WhatsApp resmi pengelola Desa Cupang untuk tombol bantuan publik & kontak darurat.",
        descriptionEn: "Official Cupang Village management WhatsApp number for public assistance and emergency contact.",
      },
      {
        key: "managerEmail",
        valueType: "string",
        value:
          process.env.SEED_SUPERADMIN_EMAIL || "pengelola@wisatacirebon.id",
        descriptionId: "Alamat email resmi pengelola wisata Batu Lawang & Gunung Bendera.",
        descriptionEn: "Official management email address for Batu Lawang & Gunung Bendera tourism.",
      },
    ];

    for (const s of defaultSettings) {
      await prisma.siteSetting.upsert({
        where: { key: s.key },
        update: {
          descriptionId: s.descriptionId,
          descriptionEn: s.descriptionEn,
        },
        create: s,
      });
    }

    // 5. Media Default Lokal (13 slot — self-hosted WebP tanpa ketergantungan URL luar)
    const defaultMedia = await ensureDefaultMediaFiles();
    for (const item of defaultMedia) {
      const asset = await prisma.mediaAsset.upsert({
        where: { storageKey: item.storageKey },
        update: {
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          sizeBytes: item.sizeBytes,
          altId: item.altId,
          altEn: item.altEn,
          isDefault: true,
        },
        create: {
          storageKey: item.storageKey,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          sizeBytes: item.sizeBytes,
          altId: item.altId,
          altEn: item.altEn,
          isDefault: true,
        },
      });

      const existingSlot = await prisma.mediaSlot.findUnique({
        where: { slot: item.slot },
      });

      if (!existingSlot) {
        await prisma.mediaSlot.create({
          data: {
            slot: item.slot,
            assetId: asset.id,
            labelId: item.labelId,
            labelEn: item.labelEn,
          },
        });
      }
    }

    // 6. Akun & Profil Petugas Lapangan Resmi (§5.7 & AGENTS.md §7)
    const staffPasswordHash = await hashPassword(process.env.SEED_STAFF_PASSWORD || "Petugas#Cirebon2026!");
    const routineSchedule = {
      "0": { enabled: true, start: "06:00", end: "17:00" },
      "1": { enabled: true, start: "06:00", end: "17:00" },
      "2": { enabled: true, start: "06:00", end: "17:00" },
      "3": { enabled: true, start: "06:00", end: "17:00" },
      "4": { enabled: true, start: "06:00", end: "17:00" },
      "5": { enabled: true, start: "06:00", end: "17:00" },
      "6": { enabled: true, start: "06:00", end: "17:00" },
    };

    const initialStaffList = [
      {
        email: "staff.batulawang@wisatacirebon.id",
        name: "Kurniawan",
        publicName: "Kurniawan",
        initials: "KW",
        jobTitleId: "Petugas Gerbang Batu Lawang",
        jobTitleEn: "Batu Lawang Gate Ranger",
        destinationId: batuLawang.id,
        assignedGates: [GateType.GERBANG_BATU_LAWANG],
        whatsapp: "+6285724908831",
        isMinor: false,
      },
      {
        email: "staff.bendera@wisatacirebon.id",
        name: "Dedi Sutrisno",
        publicName: "Dedi Sutrisno",
        initials: "DS",
        jobTitleId: "Petugas Pintu Gunung Bendera",
        jobTitleEn: "Gunung Bendera Trailhead Ranger",
        destinationId: gunungBendera.id,
        assignedGates: [GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA],
        whatsapp: "+6285724908832",
        isMinor: false,
      },
      {
        email: "staff.ranger@wisatacirebon.id",
        name: "Asep Setiawan",
        publicName: "Asep Setiawan",
        initials: "AS",
        jobTitleId: "Ranger Jalur & Pemandu",
        jobTitleEn: "Trail Ranger & Guide",
        destinationId: gunungBendera.id,
        assignedGates: [GateType.PINTU_GUNUNG_BENDERA],
        whatsapp: "+6285724908833",
        isMinor: false,
      },
      {
        email: "staff.magang@wisatacirebon.id",
        name: "Rian Hidayat",
        publicName: "Rian Hidayat",
        initials: "RH",
        jobTitleId: "Petugas Informasi Wisata",
        jobTitleEn: "Tourism Information Assistant",
        destinationId: batuLawang.id,
        assignedGates: [GateType.GERBANG_BATU_LAWANG],
        whatsapp: "+6285724908834",
        isMinor: true, // Petugas di bawah 18 tahun untuk pengujian perlindungan privasi inisial (§5.7 & AGENTS.md §7)
      },
    ];

    for (const s of initialStaffList) {
      const staffUser = await prisma.user.upsert({
        where: { email: s.email },
        update: {
          name: s.name,
          role: Role.STAFF,
          emailVerified: true,
          whatsapp: s.whatsapp,
          phoneNumber: s.whatsapp,
        },
        create: {
          email: s.email,
          name: s.name,
          role: Role.STAFF,
          locale: Locale.id,
          emailVerified: true,
          whatsapp: s.whatsapp,
          phoneNumber: s.whatsapp,
          phoneNumberVerified: true,
          consentAt: new Date(),
        },
      });

      const existingCred = await prisma.account.findFirst({
        where: { userId: staffUser.id, providerId: "credential" },
      });
      if (existingCred) {
        await prisma.account.update({
          where: { id: existingCred.id },
          data: { password: staffPasswordHash },
        });
      } else {
        await prisma.account.create({
          data: {
            userId: staffUser.id,
            accountId: staffUser.id,
            providerId: "credential",
            password: staffPasswordHash,
          },
        });
      }

      await prisma.staffProfile.upsert({
        where: { userId: staffUser.id },
        update: {
          destinationId: s.destinationId,
          jobTitleId: s.jobTitleId,
          jobTitleEn: s.jobTitleEn,
          publicName: s.publicName,
          initials: s.initials,
          whatsapp: s.whatsapp,
          isMinor: s.isMinor,
          assignedGates: s.assignedGates,
        },
        create: {
          userId: staffUser.id,
          destinationId: s.destinationId,
          jobTitleId: s.jobTitleId,
          jobTitleEn: s.jobTitleEn,
          publicName: s.publicName,
          initials: s.initials,
          whatsapp: s.whatsapp,
          isMinor: s.isMinor,
          assignedGates: s.assignedGates,
          weeklySchedule: routineSchedule,
        },
      });
    }

    // 7. Akun Super Admin Pertama dari SEED_SUPERADMIN_* (tanpa data contoh/demo!)
    const saEmail = process.env.SEED_SUPERADMIN_EMAIL?.trim();
    const saPassword = process.env.SEED_SUPERADMIN_PASSWORD;
    const saName =
      process.env.SEED_SUPERADMIN_NAME?.trim() ||
      "Super Admin Wisata Cirebon";
    const saWhatsappRaw = process.env.SEED_SUPERADMIN_WHATSAPP?.trim();
    const saWhatsapp = saWhatsappRaw
      ? normalizeIndonesianWhatsapp(saWhatsappRaw)
      : null;

    if (saEmail && saPassword) {
      const passwordHash = await hashPassword(saPassword);
      const superAdmin = await prisma.user.upsert({
        where: { email: saEmail.toLowerCase() },
        update: {
          name: saName,
          role: Role.SUPER_ADMIN,
          emailVerified: true,
          ...(saWhatsapp
            ? {
                whatsapp: saWhatsapp,
                phoneNumber: saWhatsapp,
                phoneNumberVerified: true,
                whatsappVerifiedAt: new Date(),
              }
            : {}),
        },
        create: {
          email: saEmail.toLowerCase(),
          name: saName,
          role: Role.SUPER_ADMIN,
          locale: Locale.id,
          emailVerified: true,
          consentAt: new Date(),
          ...(saWhatsapp
            ? {
                whatsapp: saWhatsapp,
                phoneNumber: saWhatsapp,
                phoneNumberVerified: true,
                whatsappVerifiedAt: new Date(),
              }
            : {}),
        },
      });

      const existingCredential = await prisma.account.findFirst({
        where: {
          userId: superAdmin.id,
          providerId: "credential",
        },
      });

      if (existingCredential) {
        await prisma.account.update({
          where: { id: existingCredential.id },
          data: {
            accountId: superAdmin.id,
            password: passwordHash,
          },
        });
      } else {
        await prisma.account.create({
          data: {
            userId: superAdmin.id,
            accountId: superAdmin.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      }

      console.log(
        `OK: Seed selesai (Destinasi=${batuLawang.slug},${gunungBendera.slug}; Produk=2; TitikJalur=6; MediaSlot=13; SuperAdmin=${superAdmin.email}).`
      );
    } else {
      console.log(
        `OK: Seed konfigurasi selesai tanpa Super Admin (SEED_SUPERADMIN_EMAIL/PASSWORD kosong).`
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gagal menjalankan seed:", err);
  process.exit(1);
});
