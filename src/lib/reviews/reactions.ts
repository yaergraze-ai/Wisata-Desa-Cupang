export const ALLOWED_REACTIONS = ["👍", "❤️", "🔥", "👏", "⛰️", "💡"] as const;
export type AllowedReaction = (typeof ALLOWED_REACTIONS)[number];

export interface PublicReviewReactionsDto {
  counts: Record<string, number>;
  total: number;
  userReaction: string | null;
}
