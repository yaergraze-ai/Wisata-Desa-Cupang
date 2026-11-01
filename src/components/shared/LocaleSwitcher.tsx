"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    const rawSearch =
      typeof window !== "undefined" ? window.location.search : "";
    const target = rawSearch ? `${pathname}${rawSearch}` : pathname;
    router.replace(target, { locale: nextLocale, scroll: false });
  }

  return (
    <div
      role="group"
      aria-label={t("langLabel")}
      className={cn(
        "inline-flex items-center rounded-lg border border-kabut/25 bg-hutan/80 p-0.5 text-xs font-semibold",
        className
      )}
    >
      <button
        type="button"
        onClick={() => switchLocale("id")}
        aria-pressed={locale === "id"}
        className={cn(
          "min-h-[44px] min-w-[44px] rounded-md px-3 py-1 transition-colors cursor-pointer",
          locale === "id"
            ? "bg-fajar text-hutan-950 font-bold"
            : "text-kabut/85 hover:text-kabut"
        )}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        aria-pressed={locale === "en"}
        className={cn(
          "min-h-[44px] min-w-[44px] rounded-md px-3 py-1 transition-colors cursor-pointer",
          locale === "en"
            ? "bg-fajar text-hutan-950 font-bold"
            : "text-kabut/85 hover:text-kabut"
        )}
      >
        EN
      </button>
    </div>
  );
}
