import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

const DEFAULT_TIKTOK = "https://www.tiktok.com/@desacupang_official";
const DEFAULT_INSTAGRAM = "https://www.instagram.com/wisatadesacupang";

export async function GET() {
  try {
    const auth = await requireApiRole([
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const [settings, requests] = await Promise.all([
      db.siteSetting.findMany({
        where: {
          key: { in: ["socialTiktokUrl", "socialInstagramUrl"] },
        },
      }),
      db.socialLinkRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    return NextResponse.json({
      success: true,
      tiktokUrl: settingsMap["socialTiktokUrl"] || DEFAULT_TIKTOK,
      instagramUrl: settingsMap["socialInstagramUrl"] || DEFAULT_INSTAGRAM,
      requests,
      canDirectEdit: auth.user.role === Role.ADMIN || auth.user.role === Role.SUPER_ADMIN,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat pengaturan medsos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const body = (await req.json()) as {
      platform?: "TIKTOK" | "INSTAGRAM";
      url?: string;
      note?: string;
      directSave?: boolean;
    };

    if (!body.url || !body.url.startsWith("http")) {
      return NextResponse.json(
        { error: "URL media sosial wajib diawali dengan https://" },
        { status: 400 }
      );
    }

    const platformKey =
      body.platform === "TIKTOK" ? "socialTiktokUrl" : "socialInstagramUrl";

    // Jika Admin / Super Admin, simpan langsung
    if (auth.user.role === Role.ADMIN || auth.user.role === Role.SUPER_ADMIN) {
      await db.siteSetting.upsert({
        where: { key: platformKey },
        create: {
          key: platformKey,
          valueType: "string",
          value: body.url.trim(),
          descriptionId: `Tautan Resmi ${body.platform}`,
          descriptionEn: `Official ${body.platform} URL`,
          updatedById: auth.user.id,
        },
        update: {
          value: body.url.trim(),
          updatedById: auth.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Tautan ${body.platform} berhasil diperbarui langsung oleh Admin.`,
      });
    }

    // Jika Petugas / Staff, buat pengajuan izin ke Admin
    const request = await db.socialLinkRequest.create({
      data: {
        staffId: auth.user.id,
        staffName: auth.user.name,
        platform: body.platform || "INSTAGRAM",
        proposedUrl: body.url.trim(),
        note: body.note?.trim() || "Pengajuan pembaruan tautan dari Petugas",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Pengajuan perubahan link telah dikirim ke Admin. Menunggu persetujuan.",
      request,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memproses tautan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Admin menyetujui atau menolak pengajuan Petugas
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const body = (await req.json()) as {
      requestId: string;
      decision: "APPROVE" | "REJECT";
    };

    const targetRequest = await db.socialLinkRequest.findUnique({
      where: { id: body.requestId },
    });

    if (!targetRequest) {
      return NextResponse.json(
        { error: "Pengajuan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (body.decision === "APPROVE") {
      const platformKey =
        targetRequest.platform === "TIKTOK"
          ? "socialTiktokUrl"
          : "socialInstagramUrl";

      await db.$transaction([
        db.siteSetting.upsert({
          where: { key: platformKey },
          create: {
            key: platformKey,
            valueType: "string",
            value: targetRequest.proposedUrl,
            descriptionId: `Tautan Resmi ${targetRequest.platform}`,
            descriptionEn: `Official ${targetRequest.platform} URL`,
            updatedById: auth.user.id,
          },
          update: {
            value: targetRequest.proposedUrl,
            updatedById: auth.user.id,
          },
        }),
        db.socialLinkRequest.update({
          where: { id: targetRequest.id },
          data: {
            status: "APPROVED",
            reviewedById: auth.user.id,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Pengajuan disetujui. Tautan ${targetRequest.platform} resmi diperbarui!`,
      });
    }

    await db.socialLinkRequest.update({
      where: { id: targetRequest.id },
      data: {
        status: "REJECTED",
        reviewedById: auth.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pengajuan perubahan tautan telah ditolak.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses persetujuan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
