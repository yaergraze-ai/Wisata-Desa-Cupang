import { GateType, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";

export interface StaffListItemDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  whatsapp: string | null;
  assignedGates: GateType[];
  isMinor: boolean;
  isActive: boolean;
  scansTodayCount: number;
  createdAt: string;
}

export async function getStaffList(): Promise<StaffListItemDto[]> {
  const staffUsers = await db.user.findMany({
    where: { role: Role.STAFF },
    include: {
      staffProfile: true,
      gateScans: {
        where: {
          scannedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return staffUsers.map((u) => ({
    id: u.staffProfile?.id ?? u.id,
    userId: u.id,
    name: u.name,
    email: u.email,
    whatsapp: u.whatsapp,
    assignedGates: u.staffProfile?.assignedGates ?? [],
    isMinor: u.staffProfile?.isMinor ?? false,
    isActive: u.staffProfile?.isActive ?? true,
    scansTodayCount: u.gateScans.length,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function createStaffAccount(
  data: {
    name: string;
    email: string;
    whatsapp: string;
    password: string;
    assignedGates: GateType[];
    isMinor: boolean;
  },
  actorId: string
): Promise<{ staffId: string; userId: string }> {
  const normalizedWa = normalizeIndonesianWhatsapp(data.whatsapp);
  if (!normalizedWa) {
    throw new Error("Nomor WhatsApp tidak valid untuk format Indonesia.");
  }

  const existing = await db.user.findFirst({
    where: {
      OR: [{ email: data.email.trim().toLowerCase() }, { whatsapp: normalizedWa }],
    },
  });
  if (existing) {
    throw new Error("Email atau nomor WhatsApp staf sudah terdaftar.");
  }

  const defaultDest = await db.destination.findFirst();
  if (!defaultDest) {
    throw new Error("Destinasi belum dikonfigurasi.");
  }

  const passwordHash = await hashPassword(data.password);
  const cleanEmail = data.email.trim().toLowerCase();

  const routineSchedule = {
    "0": { enabled: true, start: "06:00", end: "17:00" },
    "1": { enabled: true, start: "06:00", end: "17:00" },
    "2": { enabled: true, start: "06:00", end: "17:00" },
    "3": { enabled: true, start: "06:00", end: "17:00" },
    "4": { enabled: true, start: "06:00", end: "17:00" },
    "5": { enabled: true, start: "06:00", end: "17:00" },
    "6": { enabled: true, start: "06:00", end: "17:00" },
  };

  const user = await db.user.create({
    data: {
      name: data.name.trim(),
      email: cleanEmail,
      whatsapp: normalizedWa,
      phoneNumber: normalizedWa,
      phoneNumberVerified: true,
      role: Role.STAFF,
      emailVerified: true,
      staffProfile: {
        create: {
          destinationId: defaultDest.id,
          jobTitleId: "Petugas Lapangan",
          jobTitleEn: "Field Staff",
          publicName: data.name.trim(),
          initials: data.name.trim().slice(0, 2).toUpperCase(),
          whatsapp: normalizedWa,
          assignedGates: data.assignedGates,
          isMinor: data.isMinor,
          isActive: true,
          weeklySchedule: routineSchedule,
        },
      },
      accounts: {
        create: {
          accountId: cleanEmail,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
    include: {
      staffProfile: true,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "STAFF_ACCOUNT_CREATED",
    entity: "StaffProfile",
    entityId: user.staffProfile!.id,
    metadata: {
      userId: user.id,
      email: cleanEmail,
      assignedGates: data.assignedGates,
      isMinor: data.isMinor,
    },
  });

  return { staffId: user.staffProfile!.id, userId: user.id };
}

export async function updateStaffProfile(
  staffProfileId: string,
  data: {
    name?: string;
    whatsapp?: string;
    assignedGates?: GateType[];
    isMinor?: boolean;
    isActive?: boolean;
  },
  actorId: string
): Promise<void> {
  const profile = await db.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: { user: true },
  });
  if (!profile) {
    throw new Error("Profil staf tidak ditemukan.");
  }

  const staffUpdateData: {
    assignedGates?: GateType[];
    isMinor?: boolean;
    isActive?: boolean;
    publicName?: string;
    whatsapp?: string;
  } = {};

  const userUpdateData: {
    name?: string;
    whatsapp?: string;
    phoneNumber?: string;
  } = {};

  if (typeof data.name === "string" && data.name.trim().length >= 2) {
    userUpdateData.name = data.name.trim();
    staffUpdateData.publicName = data.name.trim();
  }

  if (typeof data.whatsapp === "string" && data.whatsapp.trim().length > 0) {
    const normalized = normalizeIndonesianWhatsapp(data.whatsapp);
    if (!normalized) {
      throw new Error("Nomor WhatsApp tidak valid untuk format Indonesia.");
    }
    userUpdateData.whatsapp = normalized;
    userUpdateData.phoneNumber = normalized;
    staffUpdateData.whatsapp = normalized;
  }

  if (data.assignedGates !== undefined) {
    staffUpdateData.assignedGates = data.assignedGates;
  }
  if (data.isMinor !== undefined) {
    staffUpdateData.isMinor = data.isMinor;
  }
  if (data.isActive !== undefined) {
    staffUpdateData.isActive = data.isActive;
  }

  await db.$transaction(async (tx) => {
    if (Object.keys(staffUpdateData).length > 0) {
      await tx.staffProfile.update({
        where: { id: staffProfileId },
        data: staffUpdateData,
      });
    }

    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: profile.userId },
        data: userUpdateData,
      });
    }
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "STAFF_PROFILE_UPDATED",
    entity: "StaffProfile",
    entityId: staffProfileId,
    metadata: {
      ...data,
      staffUserId: profile.userId,
    },
  });
}

export async function deleteStaffMember(
  staffProfileId: string,
  actorId: string
): Promise<void> {
  const profile = await db.staffProfile.findUnique({
    where: { id: staffProfileId },
    include: { user: true },
  });
  if (!profile) {
    throw new Error("Profil staf tidak ditemukan.");
  }

  const userId = profile.userId;

  await db.$transaction(async (tx) => {
    await tx.leaveRequest.deleteMany({
      where: { staffProfileId },
    });

    await tx.staffProfile.delete({
      where: { id: staffProfileId },
    });

    await tx.user.update({
      where: { id: userId },
      data: { role: Role.MEMBER },
    });

    await tx.session.deleteMany({
      where: { userId },
    });
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "STAFF_ACCOUNT_DELETED",
    entity: "StaffProfile",
    entityId: staffProfileId,
    metadata: {
      deletedStaffName: profile.user.name,
      deletedStaffEmail: profile.user.email,
      userId,
    },
  });
}

export interface LeaveRequestDto {
  id: string;
  staffName: string;
  staffEmail: string;
  date: string;
  reason: string;
  status: string;
  createdAt: string;
}

export async function getLeaveRequestsList(): Promise<LeaveRequestDto[]> {
  const list = await db.leaveRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      staffProfile: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return list.map((l) => ({
    id: l.id,
    staffName: l.staffProfile.user.name,
    staffEmail: l.staffProfile.user.email,
    date: l.createdAt.toISOString().slice(0, 10),
    reason: l.reason ?? "Izin mendadak",
    status: "PENDING",
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function decideLeaveRequest(
  leaveRequestId: string,
  decision: "APPROVED" | "REJECTED",
  actorId: string
): Promise<void> {
  const req = await db.leaveRequest.findUnique({
    where: { id: leaveRequestId },
  });
  if (!req) {
    throw new Error("Pengajuan libur tidak ditemukan.");
  }

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: decision === "APPROVED" ? "STAFF_LEAVE_APPROVED" : "STAFF_LEAVE_REJECTED",
    entity: "LeaveRequest",
    entityId: leaveRequestId,
    metadata: {
      decision,
      staffProfileId: req.staffProfileId,
    },
  });
}
