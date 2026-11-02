import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { getTodayWibDateString } from "@/lib/datetime-wib";
import { requirePageRole } from "@/server/auth/guards";
import { calculateServerOrderQuote } from "@/server/pricing/quote-service";
import { getMemberDashboardSnapshot } from "@/server/orders/order-service";
import {
  MemberDashboardClient,
  type MemberDashboardTab,
} from "@/components/dashboard/member/MemberDashboardClient";

export const dynamic = "force-dynamic";

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(50, parsed);
}

export default async function MemberDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  // Pertahankan query pilihan paket saat redirect ke /masuk?next=... (§6.B)
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(rawQuery)) {
    if (typeof v === "string" && v.length > 0) {
      qs.set(k, v);
    }
  }
  const currentPath =
    qs.toString().length > 0 ? `/dashboard?${qs.toString()}` : "/dashboard";

  const authCtx = await requirePageRole({
    locale,
    allowedRoles: [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
    currentPath,
  });

  const rawTab = typeof rawQuery.tab === "string" ? rawQuery.tab : undefined;
  const rawPkg = typeof rawQuery.pkg === "string" ? rawQuery.pkg : undefined;
  const focusOrderId =
    typeof rawQuery.order === "string" ? rawQuery.order : null;

  const initialTab: MemberDashboardTab =
    rawTab === "buy" ||
    rawTab === "wallet" ||
    rawTab === "orders" ||
    rawTab === "profile"
      ? rawTab
      : rawPkg || focusOrderId
        ? "buy"
        : "overview";

  const todayWib = getTodayWibDateString();
  const requestedDate =
    typeof rawQuery.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawQuery.date)
      ? rawQuery.date
      : todayWib;

  const defaultPutih = rawPkg === "TIKET_PUTIH" ? 1 : 0;
  const defaultReguler = rawPkg === "REGULER_BL" ? 1 : 0;

  const requestedPutih = parseNonNegativeInt(
    typeof rawQuery.putih === "string" ? rawQuery.putih : undefined,
    defaultPutih
  );
  const requestedReguler = parseNonNegativeInt(
    typeof rawQuery.reguler === "string" ? rawQuery.reguler : undefined,
    defaultReguler
  );

  const [initialQuote, initialSnapshot] = await Promise.all([
    calculateServerOrderQuote({
      visitDate: requestedDate,
      putihQty: requestedPutih,
      regulerQty: requestedReguler,
      locale,
    }),
    getMemberDashboardSnapshot({
      userId: authCtx.user.id,
      locale,
    }),
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour dashboard-font font-sans">
      <main className="w-full flex-1">
        <MemberDashboardClient
          locale={locale}
          userId={authCtx.user.id}
          userName={authCtx.user.name}
          userEmail={authCtx.user.email}
          userWhatsapp={authCtx.user.whatsapp}
          authCtx={authCtx}
          initialTab={initialTab}
          initialQuote={initialQuote}
          initialSnapshot={initialSnapshot}
          initialFocusOrderId={focusOrderId}
        />
      </main>
    </div>
  );
}
