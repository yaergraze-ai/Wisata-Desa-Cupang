import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole, getServerAuthContext } from "@/server/auth/guards";
import {
  checkReviewEligibility,
  submitTicketReview,
  ReviewServiceError,
} from "@/server/reviews/review-service";
import { getPublicReviewsData } from "@/server/reviews/public-reviews";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filter = (url.searchParams.get("filter") || "all") as
      | "all"
      | "batu-lawang"
      | "gunung-bendera";
    const locale = (url.searchParams.get("locale") || "id") as "id" | "en";
    const limit = Number.parseInt(url.searchParams.get("limit") || "12", 10);

    const checkTicketId = url.searchParams.get("checkTicketId");
    if (checkTicketId) {
      const auth = await requireApiRole([
        Role.MEMBER,
        Role.STAFF,
        Role.ADMIN,
        Role.SUPER_ADMIN,
      ]);
      const eligibility = await checkReviewEligibility(
        auth.user.id,
        checkTicketId
      );
      return NextResponse.json(eligibility);
    }

    let currentUserId: string | null = null;
    try {
      const auth = await getServerAuthContext();
      currentUserId = auth?.user?.id ?? null;
    } catch {
      // unauthenticated
    }

    const data = await getPublicReviewsData({
      filter:
        filter === "batu-lawang" || filter === "gunung-bendera"
          ? filter
          : "all",
      locale: locale === "en" ? "en" : "id",
      limit: Number.isFinite(limit) ? limit : 12,
      currentUserId,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat ulasan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    let ticketId: string | null = null;
    let ratingRaw: unknown = null;
    let comment: string | null = null;
    const photos: Array<{ buffer: Buffer; filename: string }> = [];

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = (await req.json().catch(() => ({}))) as {
        ticketId?: string;
        rating?: unknown;
        comment?: string;
        photos?: unknown[];
      };
      ticketId = json.ticketId ?? null;
      ratingRaw = json.rating ?? null;
      comment = json.comment ?? null;
      if (Array.isArray(json.photos)) {
        for (const item of json.photos) {
          if (typeof item === "string" && item.startsWith("data:")) {
            const parts = item.split(",");
            const buffer = Buffer.from(parts[1] || "", "base64");
            photos.push({ buffer, filename: "review-photo.webp" });
          }
        }
      }
    } else {
      const formData = await req.formData();
      ticketId = (formData.get("ticketId") as string) ?? null;
      ratingRaw = formData.get("rating");
      comment = (formData.get("comment") as string) ?? null;

      const photoFiles = formData.getAll("photos");
      for (const item of photoFiles) {
        if (item instanceof File && item.size > 0) {
          const arrayBuf = await item.arrayBuffer();
          photos.push({
            buffer: Buffer.from(arrayBuf),
            filename: item.name,
          });
        }
      }
    }

    if (typeof ticketId !== "string" || !ticketId.trim()) {
      return NextResponse.json(
        { error: "ID tiket wajib disertakan." },
        { status: 400 }
      );
    }

    const rating = Number.parseFloat(String(ratingRaw));
    if (!Number.isFinite(rating)) {
      return NextResponse.json(
        { error: "Rating wajib berupa angka." },
        { status: 400 }
      );
    }

    if (typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json(
        { error: "Komentar ulasan wajib diisi." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const review = await submitTicketReview(
      auth.user.id,
      {
        ticketId: ticketId.trim(),
        rating,
        comment,
        photos,
      },
      { ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Ulasan berhasil dikirim dan diverifikasi.",
        reviewId: review.id,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof ReviewServiceError) {
      const status =
        err.code === "NOT_TICKET_OWNER" || err.code === "NOT_SCANNED_YET"
          ? 403
          : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }

    const message =
      err instanceof Error ? err.message : "Gagal mengirim ulasan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
