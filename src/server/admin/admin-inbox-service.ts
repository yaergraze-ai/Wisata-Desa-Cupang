import { ContactMessageStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";

export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  isRead: boolean;
  isReplied: boolean;
  createdAt: string;
}

export async function getContactMessagesList(): Promise<ContactMessageDto[]> {
  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return messages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.whatsapp, // kontak WhatsApp/email
    phone: m.whatsapp,
    subject: "Formulir Kontak Pengunjung",
    message: m.message,
    isRead: m.status !== ContactMessageStatus.UNREAD,
    isReplied: m.status === ContactMessageStatus.ARCHIVED,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function markContactMessageAsRead(messageId: string): Promise<void> {
  await db.contactMessage.update({
    where: { id: messageId },
    data: {
      status: ContactMessageStatus.READ,
      readAt: new Date(),
    },
  });
}

export async function replyToContactMessage(
  messageId: string,
  replyText: string,
  actorId: string
): Promise<void> {
  const trimmed = replyText.trim();
  if (trimmed.length < 5) {
    throw new Error("Isi balasan pesan minimal 5 karakter.");
  }

  const msg = await db.contactMessage.findUnique({
    where: { id: messageId },
  });
  if (!msg) {
    throw new Error("Pesan kontak tidak ditemukan.");
  }

  await db.contactMessage.update({
    where: { id: messageId },
    data: {
      status: ContactMessageStatus.ARCHIVED,
      readAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "CONTACT_MESSAGE_REPLIED",
    entity: "ContactMessage",
    entityId: messageId,
    metadata: {
      toContact: msg.whatsapp,
      replyLength: trimmed.length,
    },
  });
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export async function getAdminNotificationsList(userId: string): Promise<NotificationDto[]> {
  const notifs = await db.notification.findMany({
    where: {
      OR: [
        { recipientUserId: userId },
        { recipientRole: Role.ADMIN },
        { recipientRole: Role.SUPER_ADMIN },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return notifs.map((n) => ({
    id: n.id,
    title: n.titleKey,
    message: n.bodyKey,
    isRead: n.readAt !== null,
    link: n.linkPath,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  await db.notification.update({
    where: { id: notifId },
    data: { readAt: new Date() },
  });
}
