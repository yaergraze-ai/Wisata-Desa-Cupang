import { GateType, Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";

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

  if (newRole === Role.STAFF) {
    const existingProfile = await db.staffProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (!existingProfile) {
      const defaultDest = await db.destination.findFirst({ orderBy: { id: "asc" } });
      if (defaultDest) {
        const nameParts = targetUser.name.trim().split(/\s+/);
        const initials =
          nameParts.length >= 2
            ? `${nameParts[0]![0]}${nameParts[1]![0]}`.toUpperCase()
            : targetUser.name.slice(0, 2).toUpperCase();
        await db.staffProfile.create({
          data: {
            userId: targetUserId,
            destinationId: defaultDest.id,
            jobTitleId: "Petugas Gerbang & Tiket",
            jobTitleEn: "Gate & Ticketing Staff",
            publicName: targetUser.name,
            initials: initials || "ST",
            whatsapp: targetUser.whatsapp || "+6281200000000",
            assignedGates: [GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA],
            weeklySchedule: {
              SENIN: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              SELASA: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              RABU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              KAMIS: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              JUMAT: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              SABTU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              MINGGU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
            },
            isActive: true,
          },
        });
      }
    } else if (!existingProfile.isActive) {
      await db.staffProfile.update({
        where: { id: existingProfile.id },
        data: { isActive: true },
      });
    }
  } else {
    // Jika role diubah dari STAFF ke role lain, nonaktifkan status keaktifan petugas
    await db.staffProfile.updateMany({
      where: { userId: targetUserId, isActive: true },
      data: { isActive: false },
    });
  }

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

/**
 * Memperbarui profil pengguna oleh Super Admin (nama, email, whatsapp, role).
 */
export async function superAdminUpdateUserProfile(
  targetUserId: string,
  data: {
    name?: string;
    email?: string;
    whatsapp?: string;
    role?: Role;
  },
  actorId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<SuperAdminUserDto> {
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan.");
  }

  // Perlindungan Super Admin terakhir jika peran diubah
  if (
    data.role &&
    targetUser.role === Role.SUPER_ADMIN &&
    data.role !== Role.SUPER_ADMIN
  ) {
    const superAdminCount = await db.user.count({
      where: { role: Role.SUPER_ADMIN },
    });
    if (superAdminCount <= 1) {
      throw new Error(
        "LAST_SUPER_ADMIN_CANNOT_BE_DEMOTED: Tidak dapat menurunkan atau mencabut peran Super Admin terakhir dalam sistem."
      );
    }
  }

  const updateData: {
    name?: string;
    email?: string;
    whatsapp?: string | null;
    phoneNumber?: string | null;
    role?: Role;
  } = {};

  if (typeof data.name === "string" && data.name.trim().length >= 2) {
    updateData.name = data.name.trim();
  }

  if (typeof data.email === "string" && data.email.trim().length >= 5) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (cleanEmail !== targetUser.email.toLowerCase()) {
      const emailCollision = await db.user.findFirst({
        where: { email: cleanEmail, id: { not: targetUserId } },
      });
      if (emailCollision) {
        throw new Error("Email sudah terdaftar pada akun lain.");
      }
      updateData.email = cleanEmail;
    }
  }

  if (typeof data.whatsapp === "string") {
    if (data.whatsapp.trim()) {
      const normalized = normalizeIndonesianWhatsapp(data.whatsapp);
      if (!normalized) {
        throw new Error("Nomor WhatsApp tidak valid untuk format Indonesia.");
      }
      if (normalized !== targetUser.whatsapp) {
        const waCollision = await db.user.findFirst({
          where: { whatsapp: normalized, id: { not: targetUserId } },
        });
        if (waCollision) {
          throw new Error("Nomor WhatsApp sudah terdaftar pada akun lain.");
        }
        updateData.whatsapp = normalized;
        updateData.phoneNumber = normalized;
      }
    } else {
      updateData.whatsapp = null;
      updateData.phoneNumber = null;
    }
  }

  if (data.role && data.role !== targetUser.role) {
    updateData.role = data.role;
  }

  const updatedUser = await db.user.update({
    where: { id: targetUserId },
    data: updateData,
    include: {
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
      },
    },
  });

  if (data.role === Role.STAFF) {
    const existingProfile = await db.staffProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (!existingProfile) {
      const defaultDest = await db.destination.findFirst({ orderBy: { id: "asc" } });
      if (defaultDest) {
        const nameParts = updatedUser.name.trim().split(/\s+/);
        const initials =
          nameParts.length >= 2
            ? `${nameParts[0]![0]}${nameParts[1]![0]}`.toUpperCase()
            : updatedUser.name.slice(0, 2).toUpperCase();
        await db.staffProfile.create({
          data: {
            userId: targetUserId,
            destinationId: defaultDest.id,
            jobTitleId: "Petugas Gerbang & Tiket",
            jobTitleEn: "Gate & Ticketing Staff",
            publicName: updatedUser.name,
            initials: initials || "ST",
            whatsapp: updatedUser.whatsapp || "+6281200000000",
            assignedGates: [GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA],
            weeklySchedule: {
              SENIN: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              SELASA: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              RABU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              KAMIS: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              JUMAT: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              SABTU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
              MINGGU: { shift: "MORNING", startWib: "07:00", endWib: "15:00" },
            },
            isActive: true,
          },
        });
      }
    } else if (!existingProfile.isActive) {
      await db.staffProfile.update({
        where: { id: existingProfile.id },
        data: { isActive: true },
      });
    }
  } else if (data.role) {
    await db.staffProfile.updateMany({
      where: { userId: targetUserId, isActive: true },
      data: { isActive: false },
    });
  }

  await writeAuditLog({
    actorId,
    actorRole: Role.SUPER_ADMIN,
    action: "USER_PROFILE_UPDATED_BY_SUPER_ADMIN",
    entity: "User",
    entityId: targetUserId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      old: {
        name: targetUser.name,
        email: targetUser.email,
        whatsapp: targetUser.whatsapp,
        role: targetUser.role,
      },
      updated: updateData,
    },
  });

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    whatsapp: updatedUser.whatsapp,
    role: updatedUser.role,
    twoFactorEnabled: updatedUser.twoFactorEnabled ?? false,
    activeSessionsCount: updatedUser.sessions.length,
    createdAt: updatedUser.createdAt.toISOString(),
  };
}
