import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { getPaymentProvider } from "@/server/integrations/payment/payment-provider";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const authCtx = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const { orderId } = await context.params;

    const order = await db.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        visitorName: true,
        userId: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (
      order.userId !== authCtx.user.id &&
      authCtx.user.role !== Role.ADMIN &&
      authCtx.user.role !== Role.SUPER_ADMIN
    ) {
      return NextResponse.json(
        { error: "Akses ditolak untuk pesanan ini." },
        { status: 403 }
      );
    }

    const paymentProvider = getPaymentProvider();
    const qrisSession = await paymentProvider.createQrisCharge({
      orderNumber: order.orderNumber,
      grossAmount: order.totalAmount,
    });

    // Generate real scannable QR Code base64 Data URL
    const qrDataUrl = await QRCode.toDataURL(qrisSession.qrString, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        grossAmount: order.totalAmount,
        status: order.status,
        qrString: qrisSession.qrString,
        qrDataUrl,
        qrUrl: qrisSession.qrUrl ?? null,
        isDirectMidtrans: qrisSession.isDirectMidtrans,
        merchantName: "Wisata Desa Cupang",
        nmid: "ID1020039281749",
        simulatorUrl: "https://simulator.sandbox.midtrans.com/qris/index",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error ? err.message : "Gagal memuat QRIS pembayaran.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
