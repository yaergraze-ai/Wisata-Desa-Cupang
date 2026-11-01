import { NextResponse } from "next/server";
import { getPublicStaffStatusData } from "@/server/staff/staff-availability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "en" ? "en" : "id";

  const payload = await getPublicStaffStatusData(locale);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
