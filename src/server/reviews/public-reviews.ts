import { ReviewStatus } from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import { formatTimestampWib } from "@/lib/datetime-wib";
import { getStorageProvider } from "@/server/integrations/storage";

export type ReviewDestinationFilter = "all" | "batu-lawang" | "gunung-bendera";

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

  const reviews: PublicReviewItemDto[] = rows.map((row) => ({
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
  }));

  return {
    filter: params.filter,
    totalPublishedCount,
    averageRating,
    ratingDistribution,
    reviews,
  };
}
