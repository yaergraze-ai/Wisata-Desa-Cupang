import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { expireStaleOrders } from "@/server/orders/order-service";
import { writeAuditLog } from "@/server/audit/audit";

function verifyCronSecret(request: NextRequest): boolean {
  const expected = getEnv().CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const headerToken = request.headers.get("x-cron-secret")?.trim() ?? null;
  const candidate = bearerToken || headerToken;

  if (!candidate) {
    return false;
  }

  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

async function handleExpireCron(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "CRON_SECRET tidak sah.", code: "UNAUTHORIZED_CRON" },
      { status: 401 }
    );
  }

  const summary = await expireStaleOrders();

  if (summary.expiredOrdersCount > 0 || summary.expiredTicketsCount > 0) {
    await writeAuditLog({
      action: "CRON_EXPIRE_ORDERS_RUN",
      entity: "Order",
      headers: request.headers,
      metadata: summary,
    }).catch(() => undefined);
  }

  return NextResponse.json(
    {
      ok: true,
      ...summary,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  return handleExpireCron(request);
}

export async function GET(request: NextRequest) {
  return handleExpireCron(request);
}
