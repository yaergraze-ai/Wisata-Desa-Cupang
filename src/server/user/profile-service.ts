import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "USER_NOT_FOUND"
      | "WRONG_PASSWORD"
      | "SUPERADMIN_CANNOT_DELETE_SELF"
      | "INVALID_WHATSAPP"
      | "PASSWORD_TOO_SHORT"
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

export async function exportUserDataJson(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      accounts: {
        select: {
          providerId: true,
          createdAt: true,
        },
      },
      orders: {
        include: {
          items: true,
          tickets: {
            include: {
              gateScans: true,
              review: {
                include: {
                  photos: true,
                },
              },
            },
          },
          refundRequests: true,
        },
        orderBy: { createdAt: "desc" },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  if (!user) {
    throw new ProfileServiceError("Pengguna tidak ditemukan.", "USER_NOT_FOUND");
  }

  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      regulation: "UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)",
      dataSubject: user.name,
      email: user.email,
    },
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      whatsapp: user.whatsapp,
      role: user.role,
      locale: user.locale,
      createdAt: user.createdAt,
      connectedProviders: user.accounts.map((a) => a.providerId),
    },
    orders: user.orders,
    notifications: user.notifications,
    recentActivityLogs: user.auditLogs,
  };
}

export async function updateMemberProfile(
  userId: string,
  input: {
    name?: string;
    whatsapp?: string;
    bio?: string;
    city?: string;
    emergencyContact?: string;
    currentPassword?: string;
    newPassword?: string;
  },
  context?: { ip?: string; userAgent?: string }
) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ProfileServiceError("Pengguna tidak ditemukan.", "USER_NOT_FOUND");
  }

  const updateUserData: {
    name?: string;
    whatsapp?: string | null;
    bio?: string | null;
    city?: string | null;
    emergencyContact?: string | null;
  } = {};

  if (typeof input.name === "string" && input.name.trim().length >= 2) {
    updateUserData.name = input.name.trim();
  }

  if (typeof input.bio === "string") {
    updateUserData.bio = input.bio.trim().slice(0, 500);
  }

  if (typeof input.city === "string") {
    updateUserData.city = input.city.trim().slice(0, 100);
  }

  if (typeof input.emergencyContact === "string") {
    updateUserData.emergencyContact = input.emergencyContact.trim().slice(0, 100);
  }

  if (typeof input.whatsapp === "string") {
    const normalized = normalizeIndonesianWhatsapp(input.whatsapp);
    if (!normalized) {
      throw new ProfileServiceError(
        "Format nomor WhatsApp tidak valid. Gunakan format Indonesia seperti 0812... atau +62812...",
        "INVALID_WHATSAPP"
      );
    }
    updateUserData.whatsapp = normalized;
  }

  // Handle password update
  let newPasswordHash: string | null = null;
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new ProfileServiceError(
        "Kata sandi saat ini wajib diisi untuk mengubah kata sandi.",
        "WRONG_PASSWORD"
      );
    }

    const credentialAccount = await db.account.findFirst({
      where: { userId, providerId: "credential" },
    });

    if (!credentialAccount || !credentialAccount.password) {
      throw new ProfileServiceError(
        "Akun ini terdaftar tanpa kata sandi lokal.",
        "WRONG_PASSWORD"
      );
    }

    const isValid = await verifyPassword({
      password: input.currentPassword,
      hash: credentialAccount.password,
    });
    if (!isValid) {
      throw new ProfileServiceError(
        "Kata sandi saat ini salah.",
        "WRONG_PASSWORD"
      );
    }

    if (input.newPassword.length < 8) {
      throw new ProfileServiceError(
        "Kata sandi baru minimal 8 karakter.",
        "PASSWORD_TOO_SHORT"
      );
    }

    newPasswordHash = await hashPassword(input.newPassword);
  }

  const updated = await db.$transaction(async (tx) => {
    if (newPasswordHash) {
      await tx.account.updateMany({
        where: { userId, providerId: "credential" },
        data: { password: newPasswordHash },
      });
    }

    const res = await tx.user.update({
      where: { id: userId },
      data: updateUserData,
    });

    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: user.role,
        action: "PROFILE_UPDATED",
        entity: "User",
        entityId: userId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          updatedFields: [
            ...Object.keys(updateUserData),
            ...(newPasswordHash ? ["password"] : []),
          ],
        },
      },
    });

    return res;
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    whatsapp: updated.whatsapp,
    bio: updated.bio,
    city: updated.city,
    emergencyContact: updated.emergencyContact,
    role: updated.role,
  };
}

export async function anonymizeAndDeleteUserAccount(
  userId: string,
  currentPassword: string,
  context?: { ip?: string; userAgent?: string }
) {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ProfileServiceError("Pengguna tidak ditemukan.", "USER_NOT_FOUND");
  }

  // Prevent deleting the last Super Admin
  if (user.role === "SUPER_ADMIN") {
    const superAdminCount = await db.user.count({
      where: { role: "SUPER_ADMIN", deletedAt: null },
    });
    if (superAdminCount <= 1) {
      throw new ProfileServiceError(
        "Akun Super Admin terakhir tidak dapat dihapus demi kelangsungan tata kelola sistem.",
        "SUPERADMIN_CANNOT_DELETE_SELF"
      );
    }
  }

  // If user has a password, verify it
  const credentialAccount = await db.account.findFirst({
    where: { userId, providerId: "credential" },
  });

  if (credentialAccount?.password) {
    const isValid = await verifyPassword({
      password: currentPassword,
      hash: credentialAccount.password,
    });
    if (!isValid) {
      throw new ProfileServiceError(
        "Kata sandi salah. Konfirmasi penghapusan akun ditolak.",
        "WRONG_PASSWORD"
      );
    }
  }

  const anonymousSuffix = user.id.slice(-6);

  await db.$transaction(async (tx) => {
    // Anonymize PII in User record per UU PDP
    await tx.user.update({
      where: { id: userId },
      data: {
        name: `Pengguna Dihapus #${anonymousSuffix}`,
        email: `deleted_${user.id}@anonymized.wisatacirebon.id`,
        whatsapp: null,
        phoneNumber: null,
        image: null,
        twoFactorEnabled: false,
        banned: true,
        banReason: "Hak untuk Dilupakan (UU No. 27/2022 tentang PDP)",
        deletedAt: new Date(),
      },
    });

    // Delete accounts, sessions, and 2FA secrets
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.twoFactor.deleteMany({ where: { userId } });

    // Audit Log append-only (PII stripped)
    await tx.auditLog.create({
      data: {
        actorId: null,
        actorRole: user.role,
        action: "ACCOUNT_DELETED_PDP",
        entity: "User",
        entityId: user.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          originalUserId: user.id,
          reason: "Hak untuk Dilupakan (UU No. 27/2022 tentang PDP)",
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  return { success: true };
}
