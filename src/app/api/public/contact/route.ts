import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";
import { extractRequestNetworkMeta } from "@/server/audit/audit";
import { checkRateLimit, hashRateIdentifier } from "@/server/rate-limit/rate-limit";

const contactBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  whatsapp: z.string().trim().min(9).max(20),
  message: z.string().trim().min(10).max(1500),
  website: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = contactBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Honeypot anti-spam: bila field tersembunyi "website" diisi bot, abaikan diam-diam tanpa menyimpan ke DB (§6.H)
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const normalizedWa = normalizeIndonesianWhatsapp(parsed.data.whatsapp);
  if (!normalizedWa) {
    return NextResponse.json(
      {
        error: "INVALID_WHATSAPP",
      },
      { status: 400 }
    );
  }

  const net = extractRequestNetworkMeta(request.headers);
  const ipIdentifier = net.ip || "local-client";
  const rl = await checkRateLimit({
    bucket: "public_contact",
    identifier: ipIdentifier,
    maxRequests: 5,
    windowSeconds: 900,
    headers: request.headers,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  const ipHash = hashRateIdentifier(`contact-ip:${ipIdentifier}`);

  const created = await db.$transaction(async (tx) => {
    const msg = await tx.contactMessage.create({
      data: {
        name: parsed.data.name,
        whatsapp: normalizedWa,
        message: parsed.data.message,
        ipHash,
      },
    });

    await tx.notification.create({
      data: {
        recipientRole: Role.ADMIN,
        type: "CONTACT_MESSAGE",
        titleKey: "Notifications.contactTitle",
        bodyKey: "Notifications.contactBody",
        params: {
          name: parsed.data.name,
          whatsapp: normalizedWa,
        },
        linkPath: "/dashboard/admin?tab=contacts",
      },
    });

    return msg;
  });

  return NextResponse.json(
    {
      ok: true,
      id: created.id,
    },
    { status: 201 }
  );
}
