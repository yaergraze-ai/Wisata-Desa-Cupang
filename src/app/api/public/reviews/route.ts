import { NextResponse } from "next/server";
import {
  getPublicReviewsData,
  type ReviewDestinationFilter,
} from "@/server/reviews/public-reviews";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDest = searchParams.get("destination");
  const filter: ReviewDestinationFilter =
    rawDest === "batu-lawang" || rawDest === "gunung-bendera" ? rawDest : "all";
  const locale = searchParams.get("locale") === "en" ? "en" : "id";
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "12", 10);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 12;

  const payload = await getPublicReviewsData({
    filter,
    locale,
    limit,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
