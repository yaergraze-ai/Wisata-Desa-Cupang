import { NextResponse } from "next/server";
import {
  getPublicReviewsData,
  type ReviewDestinationFilter,
} from "@/server/reviews/public-reviews";
import { getServerAuthContext } from "@/server/auth/guards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDest = searchParams.get("destination");
  const filter: ReviewDestinationFilter =
    rawDest === "batu-lawang" || rawDest === "gunung-bendera" ? rawDest : "all";
  const locale = searchParams.get("locale") === "en" ? "en" : "id";
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "12", 10);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 12;

  let currentUserId: string | null = null;
  try {
    const auth = await getServerAuthContext();
    currentUserId = auth?.user?.id ?? null;
  } catch {
    // Abaikan jika unauthenticated
  }

  const payload = await getPublicReviewsData({
    filter,
    locale,
    limit,
    currentUserId,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
