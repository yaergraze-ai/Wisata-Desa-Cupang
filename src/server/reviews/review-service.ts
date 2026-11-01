import { ReviewStatus, ScanResult, TicketStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getStorageProvider } from "@/server/integrations/storage";
import {
  processAndStripImage,
  ImageValidationError,
} from "@/server/media/image-processor";

export class ReviewServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TICKET_NOT_FOUND"
      | "NOT_TICKET_OWNER"
      | "TICKET_NOT_ACTIVE"
      | "NOT_SCANNED_YET"
      | "ALREADY_REVIEWED"
      | "INVALID_RATING"
      | "INVALID_COMMENT"
      | "TOO_MANY_PHOTOS"
      | "IMAGE_PROCESSING_FAILED"
  ) {
    super(message);
    this.name = "ReviewServiceError";
  }
}

export interface ReviewEligibilityResult {
  canReview: boolean;
  code?: string;
  reasonId?: string;
  reasonEn?: string;
  ticket?: {
    id: string;
    publicCode: string;
    productName: string;
    visitDate: string;
    hasAcceptedScan: boolean;
  };
}

export async function checkReviewEligibility(
  userId: string,
  ticketId: string
): Promise<ReviewEligibilityResult> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      order: true,
      product: true,
      gateScans: {
        where: { result: ScanResult.ACCEPTED },
        take: 1,
      },
      review: {
        select: { id: true },
      },
    },
  });

  if (!ticket || ticket.order.userId !== userId) {
    return {
      canReview: false,
      code: "TICKET_NOT_FOUND",
      reasonId: "Tiket tidak ditemukan atau bukan milik Anda.",
      reasonEn: "Ticket not found or does not belong to you.",
    };
  }

  if (ticket.review) {
    return {
      canReview: false,
      code: "ALREADY_REVIEWED",
      reasonId: "Tiket ini sudah memiliki ulasan.",
      reasonEn: "This ticket has already been reviewed.",
    };
  }

  if (ticket.status !== TicketStatus.ACTIVE) {
    return {
      canReview: false,
      code: "TICKET_NOT_ACTIVE",
      reasonId: "Tiket tidak dalam status aktif.",
      reasonEn: "Ticket is not in active status.",
    };
  }

  if (ticket.gateScans.length === 0) {
    return {
      canReview: false,
      code: "NOT_SCANNED_YET",
      reasonId:
        "Ulasan hanya dapat dikirim setelah tiket diverifikasi di gerbang masuk.",
      reasonEn:
        "Reviews can only be submitted after ticket verification at the entrance gate.",
    };
  }

  return {
    canReview: true,
    ticket: {
      id: ticket.id,
      publicCode: ticket.publicCode,
      productName: ticket.product.nameId,
      visitDate: ticket.visitDate.toISOString().slice(0, 10),
      hasAcceptedScan: true,
    },
  };
}

export interface SubmitReviewInput {
  ticketId: string;
  rating: number;
  comment: string;
  photos?: Array<{ buffer: Buffer; filename?: string }>;
}

export async function submitTicketReview(
  userId: string,
  input: SubmitReviewInput,
  context?: { ip?: string; userAgent?: string }
) {
  // 1. Check eligibility
  const eligibility = await checkReviewEligibility(userId, input.ticketId);
  if (!eligibility.canReview) {
    throw new ReviewServiceError(
      eligibility.reasonId || "Tidak memenuhi syarat ulasan.",
      (eligibility.code as ReviewServiceError["code"]) || "TICKET_NOT_FOUND"
    );
  }

  // 2. Validate rating
  const ratingInt = Math.round(input.rating);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    throw new ReviewServiceError(
      "Rating harus berupa angka 1 sampai 5.",
      "INVALID_RATING"
    );
  }

  // 3. Validate comment
  const trimmedComment = input.comment?.trim() ?? "";
  if (trimmedComment.length < 10 || trimmedComment.length > 1000) {
    throw new ReviewServiceError(
      "Ulasan harus terdiri dari 10 hingga 1.000 karakter.",
      "INVALID_COMMENT"
    );
  }

  // 4. Validate photos limit (max 4)
  const rawPhotos = input.photos || [];
  if (rawPhotos.length > 4) {
    throw new ReviewServiceError(
      "Maksimal 4 foto per ulasan.",
      "TOO_MANY_PHOTOS"
    );
  }

  // 5. Fetch ticket details for product code and destination slugs
  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: input.ticketId },
    include: { product: true },
  });

  // 6. Process photos through sharp WebP + EXIF-stripping pipeline
  const storage = getStorageProvider();
  const processedPhotos: Array<{
    storageKey: string;
    width: number;
    height: number;
    sizeBytes: number;
    order: number;
  }> = [];

  for (let i = 0; i < rawPhotos.length; i++) {
    const rawPhoto = rawPhotos[i]!;
    try {
      const processed = await processAndStripImage(rawPhoto.buffer, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 82,
      });

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storageKey = `reviews/${ticket.id}-${i + 1}-${uniqueSuffix}.webp`;

      await storage.put(storageKey, processed.buffer, {
        contentType: "image/webp",
        isPublic: true,
      });

      processedPhotos.push({
        storageKey,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        order: i,
      });
    } catch (err: unknown) {
      if (err instanceof ImageValidationError) {
        throw new ReviewServiceError(err.message, "IMAGE_PROCESSING_FAILED");
      }
      throw new ReviewServiceError(
        "Gagal memproses foto ulasan.",
        "IMAGE_PROCESSING_FAILED"
      );
    }
  }

  // 7. Transactional review creation
  const review = await db.$transaction(async (tx) => {
    const createdReview = await tx.review.create({
      data: {
        ticketId: ticket.id,
        userId,
        productCode: ticket.product.code,
        destinationSlugs: ticket.product.consumesDestinations,
        rating: ratingInt,
        comment: trimmedComment,
        status: ReviewStatus.PUBLISHED,
        photos: {
          create: processedPhotos.map((p) => ({
            storageKey: p.storageKey,
            width: p.width,
            height: p.height,
            sizeBytes: p.sizeBytes,
            order: p.order,
          })),
        },
      },
      include: {
        photos: true,
        user: { select: { name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: "MEMBER",
        action: "REVIEW_CREATED",
        entity: "Review",
        entityId: createdReview.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          ticketId: ticket.id,
          rating: ratingInt,
          photoCount: processedPhotos.length,
          productCode: ticket.product.code,
        },
      },
    });

    return createdReview;
  });

  return review;
}

export async function moderateReview(
  adminUserId: string,
  reviewId: string,
  input: {
    status?: ReviewStatus;
    managerReply?: string | null;
  },
  context?: { ip?: string; userAgent?: string }
) {
  const existing = await db.review.findUnique({
    where: { id: reviewId },
  });

  if (!existing) {
    throw new Error("Ulasan tidak ditemukan.");
  }

  const dataToUpdate: {
    status?: ReviewStatus;
    managerReply?: string | null;
    repliedAt?: Date | null;
    repliedById?: string | null;
  } = {};

  if (input.status) {
    dataToUpdate.status = input.status;
  }

  if (input.managerReply !== undefined) {
    dataToUpdate.managerReply = input.managerReply;
    if (input.managerReply) {
      dataToUpdate.repliedAt = new Date();
      dataToUpdate.repliedById = adminUserId;
    } else {
      dataToUpdate.repliedAt = null;
      dataToUpdate.repliedById = null;
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const rev = await tx.review.update({
      where: { id: reviewId },
      data: dataToUpdate,
    });

    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: "ADMIN",
        action: "REVIEW_MODERATED",
        entity: "Review",
        entityId: rev.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          prevStatus: existing.status,
          nextStatus: rev.status,
          hasReply: Boolean(rev.managerReply),
        },
      },
    });

    return rev;
  });

  return updated;
}
