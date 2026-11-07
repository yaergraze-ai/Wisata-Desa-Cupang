import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/server/auth/guards";

export async function GET(request: Request) {
  try {
    const authCtx = await getServerAuthContext(request.headers);
    if (!authCtx) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: authCtx.user.id,
        name: authCtx.user.name,
        email: authCtx.user.email,
        emailVerified: authCtx.user.emailVerified,
      },
      hasPassword: Boolean(authCtx.user.hasPassword),
      isOAuthUser: Boolean(authCtx.user.isOAuthUser),
      needsSetup: Boolean(authCtx.user.needsPasswordSetup),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
