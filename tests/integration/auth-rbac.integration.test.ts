import { afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import {
  AuthGuardError,
  requireApiRole,
} from "@/server/auth/guards";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";

const createdEmails: string[] = [];

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
  }
});

describe("Integrasi Nyata Better Auth, RBAC Server & Rate Limit PostgreSQL", () => {
  it("menolak suntikan role SUPER_ADMIN saat registrasi publik dan membatasi akun publik sebagai MEMBER dengan 403 di seluruh guard staf/admin (§10.3)", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const injectedEmail = `uji.inject.${suffix}@wisatacirebon.id`;
    const memberEmail = `uji.member.${suffix}@wisatacirebon.id`;
    createdEmails.push(injectedEmail, memberEmail);

    // A) Upaya suntikan `role: "SUPER_ADMIN"` ditolak oleh skema input:false Better Auth atau dipaksa menjadi MEMBER
    const injectedReq = new Request(
      "http://localhost:3000/api/auth/sign-up/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          name: "Upaya Eskalasi Peran",
          email: injectedEmail,
          password: "SandiPengunjungKuat#2026!",
          whatsapp: "081234560099",
          locale: "id",
          role: "SUPER_ADMIN",
        }),
      }
    );
    const injectedRes = await auth.handler(injectedReq);
    const maybeInjectedUser = await db.user.findUnique({
      where: { email: injectedEmail },
    });
    if (maybeInjectedUser) {
      expect(maybeInjectedUser.role).toBe(Role.MEMBER);
    } else {
      expect(injectedRes.status).toBeGreaterThanOrEqual(400);
    }

    // B) Registrasi pengunjung standar menghasilkan akun MEMBER dengan sesi aktif
    const req = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: "Pengunjung Uji RBAC",
        email: memberEmail,
        password: "SandiPengunjungKuat#2026!",
        whatsapp: "081234560011",
        locale: "id",
      }),
    });

    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();

    const dbUser = await db.user.findUnique({ where: { email: memberEmail } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe(Role.MEMBER);
    expect(dbUser?.whatsapp).toBe("+6281234560011");
    expect(dbUser?.consentAt).not.toBeNull();

    // Gunakan cookie sesi MEMBER untuk memanggil guard STAFF, ADMIN, dan SUPER_ADMIN -> semuanya wajib 403!
    const cookieHeader = setCookie!
      .split(",")
      .map((c) => c.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");
    const memberHeaders = new Headers({ cookie: cookieHeader });

    for (const forbiddenRole of [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN]) {
      let caught: AuthGuardError | null = null;
      try {
        await requireApiRole([forbiddenRole], { headers: memberHeaders });
      } catch (err) {
        if (err instanceof AuthGuardError) caught = err;
      }
      expect(caught).not.toBeNull();
      expect(caught?.status).toBe(403);
      expect(caught?.code).toBe("FORBIDDEN_ROLE");
    }

    const auditForbidden = await db.auditLog.findFirst({
      where: {
        actorId: dbUser!.id,
        action: "AUTH_FORBIDDEN_ACCESS",
      },
    });
    expect(auditForbidden).not.toBeNull();
  });

  it("menegakkan rate limiter PostgreSQL secara atomik dan mencatat RATE_LIMIT_TRIGGERED ke AuditLog", async () => {
    const bucket = `test-bucket-${crypto.randomBytes(4).toString("hex")}`;
    const d1 = await checkRateLimit({
      bucket,
      identifier: "198.51.100.42",
      maxRequests: 2,
      windowSeconds: 60,
    });
    const d2 = await checkRateLimit({
      bucket,
      identifier: "198.51.100.42",
      maxRequests: 2,
      windowSeconds: 60,
    });
    const d3 = await checkRateLimit({
      bucket,
      identifier: "198.51.100.42",
      maxRequests: 2,
      windowSeconds: 60,
    });

    expect(d1.allowed).toBe(true);
    expect(d2.allowed).toBe(true);
    expect(d3.allowed).toBe(false);
    expect(d3.count).toBe(3);

    const logRow = await db.auditLog.findFirst({
      where: {
        action: "RATE_LIMIT_TRIGGERED",
        entityId: bucket,
      },
    });
    expect(logRow).not.toBeNull();
  });
});
