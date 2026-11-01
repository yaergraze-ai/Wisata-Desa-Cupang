import { NextResponse } from "next/server";
import { z } from "zod";
import { getTodayWibDateString } from "@/lib/datetime-wib";
import { calculateServerOrderQuote } from "@/server/pricing/quote-service";

const querySchema = z.object({
  visitDate: z.string().optional(),
  regulerQty: z.coerce.number().int().min(0).max(50).default(0),
  putihQty: z.coerce.number().int().min(0).max(50).default(0),
  locale: z.enum(["id", "en"]).default("id"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    visitDate: searchParams.get("visitDate") ?? undefined,
    regulerQty: searchParams.get("regulerQty") ?? 0,
    putihQty: searchParams.get("putihQty") ?? 0,
    locale: searchParams.get("locale") === "en" ? "en" : "id",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const visitDate = parsed.data.visitDate?.trim() || getTodayWibDateString();
  const quote = await calculateServerOrderQuote({
    visitDate,
    regulerQty: parsed.data.regulerQty,
    putihQty: parsed.data.putihQty,
    locale: parsed.data.locale,
  });

  return NextResponse.json(quote, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
