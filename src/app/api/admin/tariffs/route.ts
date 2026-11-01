import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  createNewTariffVersion,
  getVersionedTariffsList,
} from "@/server/admin/admin-quota-tariffs-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const products = await getVersionedTariffsList();
    return NextResponse.json({ products });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat tarif tiket.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      productId: string;
      basePrice: number;
      parkingFee: number;
      validFrom: string;
    };

    if (
      !body.productId ||
      typeof body.basePrice !== "number" ||
      typeof body.parkingFee !== "number" ||
      !body.validFrom
    ) {
      return NextResponse.json(
        { error: "Data tarif baru tidak lengkap." },
        { status: 400 }
      );
    }

    await createNewTariffVersion(
      body.productId,
      body.basePrice,
      body.parkingFee,
      body.validFrom,
      authCtx.user.id
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal membuat versi tarif baru.";
    return NextResponse.json({ error: message }, { status });
  }
}
