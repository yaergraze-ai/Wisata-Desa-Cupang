import { afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import {
  forceRevokeUserSessions,
  getSuperAdminUsersList,
  updateUserRoleWithLastAdminGuard,
} from "@/server/super-admin/user-roles-service";

const testUserIds: string[] = [];

afterAll(async () => {
  if (testUserIds.length > 0) {
    await db.session.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: testUserIds } },
          { entityId: { in: testUserIds } },
        ],
      },
    });
    await db.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
  }
});

describe("Super Admin RBAC & Tata Kelola Pengguna Nyata (§7.2, §10.3)", () => {
  it("melarang penurunan peran Super Admin jika hanya tersisa 1 Super Admin di sistem", async () => {
    // Cari semua Super Admin yang ada saat ini
    const existingSuperAdmins = await db.user.findMany({
      where: { role: Role.SUPER_ADMIN },
    });

    // Buat Super Admin sementara baru jika hanya ada 1 atau 0
    const suffix = crypto.randomBytes(4).toString("hex");
    const testAdminA = await db.user.create({
      data: {
        id: `user-sa-a-${suffix}`,
        name: `Super Admin Uji A ${suffix}`,
        email: `sa.a.${suffix}@wisatacirebon.id`,
        role: Role.SUPER_ADMIN,
        locale: "id",
      },
    });
    testUserIds.push(testAdminA.id);

    // Jika tadinya sudah ada Super Admin lain, ubah sementara menjadi ADMIN agar testAdminA adalah satu-satunya Super Admin
    const otherSuperAdminIds = existingSuperAdmins.map((u) => u.id);
    if (otherSuperAdminIds.length > 0) {
      await db.user.updateMany({
        where: { id: { in: otherSuperAdminIds } },
        data: { role: Role.ADMIN },
      });
    }

    try {
      // Sekarang persis hanya ada 1 Super Admin di database (testAdminA)
      const currentSaCount = await db.user.count({
        where: { role: Role.SUPER_ADMIN },
      });
      expect(currentSaCount).toBe(1);

      // Coba turunkan testAdminA menjadi ADMIN -> HARUS DITOLAK
      await expect(
        updateUserRoleWithLastAdminGuard(testAdminA.id, Role.ADMIN, testAdminA.id)
      ).rejects.toThrow("LAST_SUPER_ADMIN_CANNOT_BE_DEMOTED");

      // Verifikasi peran di database tetap SUPER_ADMIN
      const recheck = await db.user.findUnique({ where: { id: testAdminA.id } });
      expect(recheck?.role).toBe(Role.SUPER_ADMIN);

      // Tambahkan Super Admin kedua
      const testAdminB = await db.user.create({
        data: {
          id: `user-sa-b-${suffix}`,
          name: `Super Admin Uji B ${suffix}`,
          email: `sa.b.${suffix}@wisatacirebon.id`,
          role: Role.SUPER_ADMIN,
          locale: "id",
        },
      });
      testUserIds.push(testAdminB.id);

      // Sekarang ada 2 Super Admin, penurunan peran testAdminA harus berhasil
      await updateUserRoleWithLastAdminGuard(testAdminA.id, Role.ADMIN, testAdminB.id);

      const afterDemote = await db.user.findUnique({ where: { id: testAdminA.id } });
      expect(afterDemote?.role).toBe(Role.ADMIN);

      // Verifikasi Audit Log tercatat
      const auditLog = await db.auditLog.findFirst({
        where: {
          action: "USER_ROLE_CHANGED",
          entityId: testAdminA.id,
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(testAdminB.id);
    } finally {
      // Pulihkan Super Admin yang asli jika ada
      if (otherSuperAdminIds.length > 0) {
        await db.user.updateMany({
          where: { id: { in: otherSuperAdminIds } },
          data: { role: Role.SUPER_ADMIN },
        });
      }
    }
  });

  it("mencabut paksa seluruh sesi aktif pengguna dan mencatat USER_SESSIONS_REVOKED ke AuditLog", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const targetUser = await db.user.create({
      data: {
        id: `user-target-${suffix}`,
        name: `User Sesi Target ${suffix}`,
        email: `sesi.target.${suffix}@wisatacirebon.id`,
        role: Role.MEMBER,
        locale: "id",
      },
    });
    const saActor = await db.user.create({
      data: {
        id: `user-actor-${suffix}`,
        name: `Super Admin Actor ${suffix}`,
        email: `actor.${suffix}@wisatacirebon.id`,
        role: Role.SUPER_ADMIN,
        locale: "id",
      },
    });
    testUserIds.push(targetUser.id, saActor.id);

    // Buat 3 sesi aktif untuk target user
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.session.createMany({
      data: [
        {
          id: `sess-1-${suffix}`,
          userId: targetUser.id,
          token: `token-1-${suffix}`,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `sess-2-${suffix}`,
          userId: targetUser.id,
          token: `token-2-${suffix}`,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `sess-3-${suffix}`,
          userId: targetUser.id,
          token: `token-3-${suffix}`,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    // Verifikasi sesi terdata di list pengguna
    const usersListBefore = await getSuperAdminUsersList({
      search: targetUser.email,
    });
    expect(usersListBefore.users[0]?.activeSessionsCount).toBe(3);

    // Cabut paksa seluruh sesi
    const revokeResult = await forceRevokeUserSessions(targetUser.id, saActor.id);
    expect(revokeResult.revokedCount).toBe(3);

    // Verifikasi sesi di database sudah 0
    const remainingSessions = await db.session.count({
      where: { userId: targetUser.id },
    });
    expect(remainingSessions).toBe(0);

    // Verifikasi audit log
    const auditRevoke = await db.auditLog.findFirst({
      where: {
        action: "USER_SESSIONS_REVOKED",
        entityId: targetUser.id,
      },
    });
    expect(auditRevoke).not.toBeNull();
    expect(auditRevoke?.actorId).toBe(saActor.id);
    expect(
      Number(
        (auditRevoke?.metadata as Record<string, unknown>)?.revokedSessionsCount
      )
    ).toBe(3);
  });
});
