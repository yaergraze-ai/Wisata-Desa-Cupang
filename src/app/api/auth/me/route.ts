import { NextResponse } from "next/server";
import { getRoleHomePath, getServerAuthContext } from "@/server/auth/guards";

export async function GET(request: Request) {
  const ctx = await getServerAuthContext(request.headers);
  if (!ctx) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: ctx.user,
    stepUpVerifiedAt: ctx.stepUpVerifiedAt?.toISOString() ?? null,
    homePath: getRoleHomePath(ctx.user.role),
  });
}
