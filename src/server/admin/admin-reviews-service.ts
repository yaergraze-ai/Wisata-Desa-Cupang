import { ReviewStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";
import { getStorageProvider } from "@/server/integrations/storage";

export interface AdminReviewItemDto {
  id: string;
  ticketId: string;
  ticketPublicCode: string;
  productName: string;
  userName: string;
  rating: number;
  comment: string;
  isPublished: boolean;
  adminReply: string | null;
  adminRepliedAt: string | null;
  createdAt: string;
  photos: {
    id: string;
    url: string;
  }[];
}

export async function getAdminReviewsList(params: {
  page?: number;
  limit?: number;
  rating?: number;
  isPublished?: boolean;
}): Promise<{
  reviews: AdminReviewItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 15));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};
  if (params.rating) whereClause.rating = params.rating;
  if (params.isPublished !== undefined) {
    whereClause.status = params.isPublished ? ReviewStatus.PUBLISHED : ReviewStatus.HIDDEN;
  }

  const [total, rawReviews] = await Promise.all([
    db.review.count({ where: whereClause }),
    db.review.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
        ticket: {
          select: {
            publicCode: true,
            product: { select: { nameId: true } },
          },
        },
        photos: {
          orderBy: { order: "asc" },
        },
      },
    }),
  ]);

  const storage = getStorageProvider();
  const reviews: AdminReviewItemDto[] = rawReviews.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    ticketPublicCode: r.ticket.publicCode,
    productName: r.ticket.product.nameId,
    userName: r.user.name,
    rating: r.rating,
    comment: r.comment,
    isPublished: r.status === ReviewStatus.PUBLISHED,
    adminReply: r.managerReply,
    adminRepliedAt: r.repliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    photos: r.photos.map((p) => ({
      id: p.id,
      url: storage.getUrl(p.storageKey),
    })),
  }));

  return {
    reviews,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function toggleReviewPublishStatus(
  reviewId: string,
  isPublished: boolean,
  actorId: string
): Promise<void> {
  const rev = await db.review.findUnique({
    where: { id: reviewId },
  });
  if (!rev) {
    throw new Error("Ulasan tidak ditemukan.");
  }

  await db.review.update({
    where: { id: reviewId },
    data: {
      status: isPublished ? ReviewStatus.PUBLISHED : ReviewStatus.HIDDEN,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: isPublished ? "REVIEW_PUBLISHED" : "REVIEW_HIDDEN",
    entity: "Review",
    entityId: reviewId,
    metadata: {
      isPublished,
    },
  });
}

export async function submitAdminReviewReply(
  reviewId: string,
  replyText: string,
  actorId: string
): Promise<void> {
  const trimmed = replyText.trim();
  if (trimmed.length < 5) {
    throw new Error("Balasan ulasan minimal 5 karakter.");
  }
  if (trimmed.length > 1000) {
    throw new Error("Balasan ulasan maksimal 1.000 karakter.");
  }

  const rev = await db.review.findUnique({
    where: { id: reviewId },
  });
  if (!rev) {
    throw new Error("Ulasan tidak ditemukan.");
  }

  await db.review.update({
    where: { id: reviewId },
    data: {
      managerReply: trimmed,
      repliedAt: new Date(),
      repliedById: actorId,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "REVIEW_REPLIED",
    entity: "Review",
    entityId: reviewId,
    metadata: {
      replyLength: trimmed.length,
    },
  });
}
