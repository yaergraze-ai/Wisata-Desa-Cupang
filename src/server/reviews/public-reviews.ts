import { ReviewStatus } from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import { formatTimestampWib } from "@/lib/datetime-wib";
import { getStorageProvider } from "@/server/integrations/storage";

export type ReviewDestinationFilter = "all" | "batu-lawang" | "gunung-bendera";

import {
  ALLOWED_REACTIONS,
  type AllowedReaction,
  type PublicReviewReactionsDto,
} from "@/lib/reviews/reactions";

export { ALLOWED_REACTIONS, type AllowedReaction, type PublicReviewReactionsDto };

export interface PublicReviewPhotoDto {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface PublicReviewItemDto {
  id: string;
  authorName: string;
  authorInitials: string;
  productCode: string;
  destinationSlugs: string[];
  rating: number;
  comment: string;
  createdAtDisplay: string;
  managerReply: string | null;
  repliedAtDisplay: string | null;
  photos: PublicReviewPhotoDto[];
  reactions: PublicReviewReactionsDto;
}

export interface RatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

export interface PublicReviewsResponse {
  filter: ReviewDestinationFilter;
  totalPublishedCount: number;
  averageRating: number | null;
  ratingDistribution: RatingDistributionItem[];
  reviews: PublicReviewItemDto[];
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "PG";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export async function getPublicReviewsData(params: {
  filter: ReviewDestinationFilter;
  locale: SupportedLocale;
  limit?: number;
  currentUserId?: string | null;
}): Promise<PublicReviewsResponse> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));

  const whereClause =
    params.filter === "all"
      ? { status: ReviewStatus.PUBLISHED }
      : {
          status: ReviewStatus.PUBLISHED,
          destinationSlugs: { has: params.filter },
        };

  const [aggregate, ratingCounts, rows] = await Promise.all([
    db.review.aggregate({
      where: whereClause,
      _count: { _all: true },
      _avg: { rating: true },
    }),
    db.review.groupBy({
      by: ["rating"],
      where: whereClause,
      _count: { _all: true },
    }),
    db.review.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
          },
        },
        photos: {
          orderBy: { order: "asc" },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const totalPublishedCount = aggregate._count._all;
  const averageRating =
    totalPublishedCount > 0 && typeof aggregate._avg.rating === "number"
      ? Math.round(aggregate._avg.rating * 10) / 10
      : null;

  // Bangun distribusi bintang 5 hingga 1
  const countMap = new Map<number, number>();
  for (const item of ratingCounts) {
    countMap.set(item.rating, item._count._all);
  }

  const ratingDistribution: RatingDistributionItem[] = [5, 4, 3, 2, 1].map((stars) => {
    const count = countMap.get(stars) ?? 0;
    const percentage =
      totalPublishedCount > 0 ? Math.round((count / totalPublishedCount) * 100) : 0;
    return { stars, count, percentage };
  });

  const reviews: PublicReviewItemDto[] = rows.map((row) => {
    const reactionCounts: Record<string, number> = {};
    let userReaction: string | null = null;
    for (const rx of row.reactions) {
      reactionCounts[rx.emoji] = (reactionCounts[rx.emoji] ?? 0) + 1;
      if (params.currentUserId && rx.userId === params.currentUserId) {
        userReaction = rx.emoji;
      }
    }

    return {
      id: row.id,
      authorName: row.user.name,
      authorInitials: getInitials(row.user.name),
      productCode: row.productCode,
      destinationSlugs: row.destinationSlugs,
      rating: row.rating,
      comment: row.comment,
      createdAtDisplay: formatTimestampWib(row.createdAt, params.locale),
      managerReply: row.managerReply,
      repliedAtDisplay: row.repliedAt
        ? formatTimestampWib(row.repliedAt, params.locale)
        : null,
      photos: row.photos.map((p) => ({
        id: p.id,
        url: p.storageKey.startsWith("/")
          ? p.storageKey
          : getStorageProvider().getUrl(p.storageKey),
        width: p.width,
        height: p.height,
      })),
      reactions: {
        counts: reactionCounts,
        total: row.reactions.length,
        userReaction,
      },
    };
  });

  return {
    filter: params.filter,
    totalPublishedCount,
    averageRating,
    ratingDistribution,
    reviews,
  };
}

export async function toggleReviewReaction(params: {
  reviewId: string;
  userId: string;
  emoji: string;
}): Promise<{
  userReaction: string | null;
  counts: Record<string, number>;
  total: number;
}> {
  const { reviewId, userId, emoji } = params;

  if (!ALLOWED_REACTIONS.includes(emoji as AllowedReaction)) {
    throw new Error("Emoji reaksi tidak valid.");
  }

  // Cek apakah ulasan ada dan berstatus PUBLISHED
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true, status: true },
  });

  if (!review || review.status !== ReviewStatus.PUBLISHED) {
    throw new Error("Ulasan tidak ditemukan.");
  }

  // Cek reaksi yang ada untuk akun ini (1 akun 1 reaksi)
  const existing = await db.reviewReaction.findUnique({
    where: {
      reviewId_userId: {
        reviewId,
        userId,
      },
    },
  });

  let nextUserReaction: string | null = null;

  if (existing) {
    if (existing.emoji === emoji) {
      // Toggle off (batal reaksi jika klik emote yang sama)
      await db.reviewReaction.delete({
        where: { id: existing.id },
      });
      nextUserReaction = null;
    } else {
      // Ganti reaksi ke emoji baru (1 akun 1 reaksi)
      await db.reviewReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      nextUserReaction = emoji;
    }
  } else {
    // Tambah reaksi baru
    await db.reviewReaction.create({
      data: {
        reviewId,
        userId,
        emoji,
      },
    });
    nextUserReaction = emoji;
  }

  // Hitung ulang agregat reaksi untuk ulasan ini
  const allReactions = await db.reviewReaction.findMany({
    where: { reviewId },
    select: { emoji: true },
  });

  const counts: Record<string, number> = {};
  for (const rx of allReactions) {
    counts[rx.emoji] = (counts[rx.emoji] ?? 0) + 1;
  }

  return {
    userReaction: nextUserReaction,
    counts,
    total: allReactions.length,
  };
}
