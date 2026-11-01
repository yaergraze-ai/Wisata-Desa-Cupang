import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/server/auth/guards";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getServerAuthContext(request.headers);
  if (!ctx) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const accounts = await db.account.findMany({
    where: { userId: ctx.user.id },
    select: { providerId: true, password: true },
  });

  const hasCredentialPassword = accounts.some(
    (a) => a.providerId === "credential" && Boolean(a.password)
  );

  const isOAuthUser = accounts.some(
    (a) => a.providerId === "google" || a.providerId === "facebook"
  );

  return NextResponse.json({
    authenticated: true,
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
    },
    hasPassword: hasCredentialPassword,
    isOAuthUser,
    needsInitialPasswordSetup: isOAuthUser && !hasCredentialPassword,
  });
}
