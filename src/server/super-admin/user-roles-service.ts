import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";

export interface SuperAdminUserDto {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  activeSessionsCount: number;
  createdAt: string;
}

export async function getSuperAdminUsersList(params: {
  page?: number;
  limit?: number;
  role?: Role;
  search?: string;
}): Promise<{
  users: SuperAdminUserDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 15));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};
  if (params.role) whereClause.role = params.role;
  if (params.search?.trim()) {
    const s = params.search.trim();
    whereClause.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { whatsapp: { contains: s, mode: "insensitive" } },
    ];
  }

  const [total, rawUsers] = await Promise.all([
    db.user.count({ where: whereClause }),
    db.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          select: { id: true },
        },
      },
    }),
  ]);

  const users: SuperAdminUserDto[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    whatsapp: u.whatsapp,
    role: u.role,
    twoFactorEnabled: u.twoFactorEnabled ?? false,
    activeSessionsCount: u.sessions.length,
    createdAt: u.createdAt.toISOString(),
  }));

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Mengubah peran user dengan perlindungan ketat Super Admin terakhir (§7.2, §10.3).
 */
export async function updateUserRoleWithLastAdminGuard(
  targetUserId: string,
  newRole: Role,
  actorId: string
): Promise<void> {
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  // Jika target adalah SUPER_ADMIN dan peran akan diubah ke peran lain,
  // verifikasi bahwa masih ada Super Admin lain yang aktif di sistem.
  if (targetUser.role === Role.SUPER_ADMIN && newRole !== Role.SUPER_ADMIN) {
    const superAdminCount = await db.user.count({
      where: { role: Role.SUPER_ADMIN },
    });
    if (superAdminCount <= 1) {
      throw new Error(
        "LAST_SUPER_ADMIN_CANNOT_BE_DEMOTED: Tidak dapat menurunkan atau mencabut peran Super Admin terakhir dalam sistem."
      );
    }
  }

  await db.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.SUPER_ADMIN,
    action: "USER_ROLE_CHANGED",
    entity: "User",
    entityId: targetUserId,
    metadata: {
      targetEmail: targetUser.email,
      oldRole: targetUser.role,
      newRole,
    },
  });
}

/**
 * Mencabut paksa seluruh sesi aktif milik user (§7.2).
 */
export async function forceRevokeUserSessions(
  targetUserId: string,
  actorId: string
): Promise<{ revokedCount: number }> {
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  const deleteResult = await db.session.deleteMany({
    where: { userId: targetUserId },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.SUPER_ADMIN,
    action: "USER_SESSIONS_REVOKED",
    entity: "User",
    entityId: targetUserId,
    metadata: {
      targetEmail: targetUser.email,
      revokedSessionsCount: deleteResult.count,
    },
  });

  return { revokedCount: deleteResult.count };
}

/**
 * Menghapus akun pengguna oleh Super Admin dengan perlindungan Super Admin terakhir.
 */
export async function superAdminDeleteUser(
  targetUserId: string,
  actorId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; message: string }> {
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  // Perlindungan ketat: Super Admin terakhir tidak boleh dihapus
  if (targetUser.role === Role.SUPER_ADMIN) {
    const superAdminCount = await db.user.count({
      where: { role: Role.SUPER_ADMIN, deletedAt: null },
    });
    if (superAdminCount <= 1) {
      throw new Error(
        "LAST_SUPER_ADMIN_CANNOT_BE_DELETED: Akun Super Admin terakhir tidak dapat dihapus demi kelangsungan tata kelola sistem."
      );
    }
  }

  const anonymousSuffix = targetUser.id.slice(-6);

  await db.$transaction(async (tx) => {
    // Hapus sesi aktif, kredensial auth, dan 2FA
    await tx.account.deleteMany({ where: { userId: targetUserId } });
    await tx.session.deleteMany({ where: { userId: targetUserId } });
    await tx.twoFactor.deleteMany({ where: { userId: targetUserId } });

    // Hapus atau anonimkan data pengguna sesuai standar keamanan PDP
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        name: `Pengguna Dihapus #${anonymousSuffix}`,
        email: `deleted_${targetUser.id}@anonymized.wisatacirebon.id`,
        whatsapp: null,
        phoneNumber: null,
        image: null,
        twoFactorEnabled: false,
        banned: true,
        banReason: "Akun dihapus oleh Super Admin",
        deletedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        actorRole: Role.SUPER_ADMIN,
        action: "USER_DELETED_BY_SUPER_ADMIN",
        entity: "User",
        entityId: targetUserId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          targetEmail: targetUser.email,
          targetRole: targetUser.role,
        },
      },
    });
  });

  return {
    success: true,
    message: `Pengguna '${targetUser.name}' (${targetUser.email}) berhasil dihapus.`,
  };
}
