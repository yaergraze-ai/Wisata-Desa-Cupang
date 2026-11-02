import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/server/auth/guards";
import {
  toggleReviewReaction,
  ALLOWED_REACTIONS,
  type AllowedReaction,
} from "@/server/reviews/public-reviews";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ reviewId: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth?.user?.id) {
      return NextResponse.json(
        {
          error: "UNAUTHENTICATED",
          message:
            "Silakan masuk ke akun Anda terlebih dahulu untuk memberikan reaksi ulasan.",
        },
        { status: 401 }
      );
    }

    const { reviewId } = await context.params;
    if (!reviewId) {
      return NextResponse.json(
        { error: "Parameter ID ulasan tidak valid." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const emoji = String(body.emoji || "").trim();

    if (!ALLOWED_REACTIONS.includes(emoji as AllowedReaction)) {
      return NextResponse.json(
        {
          error: "INVALID_EMOJI",
          message: "Emoji reaksi tidak dikenali.",
          allowed: ALLOWED_REACTIONS,
        },
        { status: 400 }
      );
    }

    const result = await toggleReviewReaction({
      reviewId,
      userId: auth.user.id,
      emoji,
    });

    return NextResponse.json({
      success: true,
      reviewId,
      ...result,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses reaksi ulasan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
