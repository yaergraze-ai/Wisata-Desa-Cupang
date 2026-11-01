import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@/server/auth/guards";
import { db } from "@/server/db";
import { hashPassword } from "better-auth/crypto";
import { writeAuditLog } from "@/server/audit/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req.headers);

    const body = (await req.json()) as {
      username?: string;
      password?: string;
      confirmPassword?: string;
    };

    const username = body.username?.trim();
    const password = body.password;

    if (!username || username.length < 2) {
      return NextResponse.json(
        { error: "Nama / username minimal 2 karakter." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Kata sandi minimal 8 karakter." },
        { status: 400 }
      );
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Kata sandi wajib mengandung kombinasi huruf dan angka." },
        { status: 400 }
      );
    }

    if (body.confirmPassword && password !== body.confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi kata sandi tidak cocok." },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    await db.$transaction(async (tx) => {
      // 1. Update nama user
      await tx.user.update({
        where: { id: auth.user.id },
        data: { name: username },
      });

      // 2. Cek apakah sudah ada akun credential
      const existingCredential = await tx.account.findFirst({
        where: { userId: auth.user.id, providerId: "credential" },
      });

      if (existingCredential) {
        await tx.account.update({
          where: { id: existingCredential.id },
          data: { password: hashedPassword },
        });
      } else {
        await tx.account.create({
          data: {
            userId: auth.user.id,
            providerId: "credential",
            accountId: auth.user.email,
            password: hashedPassword,
          },
        });
      }

      // 3. Catat audit log
      await writeAuditLog({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "PASSWORD_SETUP_INITIAL",
        entity: "User",
        entityId: auth.user.id,
        metadata: {
          usernameUpdated: username !== auth.user.name,
          email: auth.user.email,
        },
      }).catch(() => undefined);
    });

    return NextResponse.json({
      success: true,
      message: "Username dan kata sandi berhasil ditetapkan! Anda sekarang dapat masuk menggunakan email dan kata sandi.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menetapkan kata sandi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
