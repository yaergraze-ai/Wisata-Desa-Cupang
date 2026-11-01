import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getAdminReviewsList,
  submitAdminReviewReply,
  toggleReviewPublishStatus,
} from "@/server/admin/admin-reviews-service";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "15");
    const rating = sp.get("rating") ? Number(sp.get("rating")) : undefined;
    const isPublished =
      sp.get("isPublished") !== null ? sp.get("isPublished") === "true" : undefined;

    const data = await getAdminReviewsList({
      page,
      limit,
      rating,
      isPublished,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat ulasan.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      reviewId: string;
      action: "togglePublish" | "reply";
      isPublished?: boolean;
      replyText?: string;
    };

    if (!body.reviewId || !body.action) {
      return NextResponse.json(
        { error: "reviewId dan action wajib disertakan." },
        { status: 400 }
      );
    }

    if (body.action === "togglePublish") {
      if (typeof body.isPublished !== "boolean") {
        return NextResponse.json(
          { error: "isPublished boolean wajib disertakan." },
          { status: 400 }
        );
      }
      await toggleReviewPublishStatus(
        body.reviewId,
        body.isPublished,
        authCtx.user.id
      );
      return NextResponse.json({ success: true });
    }

    if (body.action === "reply") {
      if (!body.replyText?.trim()) {
        return NextResponse.json(
          { error: "replyText wajib disertakan." },
          { status: 400 }
        );
      }
      await submitAdminReviewReply(
        body.reviewId,
        body.replyText,
        authCtx.user.id
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui ulasan.";
    return NextResponse.json({ error: message }, { status });
  }
}
