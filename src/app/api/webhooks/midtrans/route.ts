import { NextResponse, type NextRequest } from "next/server";
import {
  OrderDomainError,
  processMidtransWebhook,
} from "@/server/orders/order-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Payload webhook JSON tidak valid.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const result = await processMidtransWebhook(body, {
      headers: request.headers,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof OrderDomainError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Kesalahan internal saat memproses webhook Midtrans." },
      { status: 500 }
    );
  }
}
