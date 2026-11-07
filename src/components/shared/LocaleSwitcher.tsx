"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
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
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("wisata:page-transition-start"));
      });
    }
  }

  if (compact) {
    return (
      <div
        role="group"
        aria-label={t("langLabel")}
        className={cn(
          "inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold",
          className
        )}
      >
        <button
          type="button"
          onClick={() => switchLocale("id")}
          aria-pressed={locale === "id"}
          className={cn(
            "rounded px-2 py-0.5 transition-all duration-200 cursor-pointer",
            locale === "id"
              ? "bg-white/15 text-kabut font-bold shadow-xs"
              : "text-kabut/50 hover:text-kabut"
          )}
        >
          ID
        </button>
        <button
          type="button"
          onClick={() => switchLocale("en")}
          aria-pressed={locale === "en"}
          className={cn(
            "rounded px-2 py-0.5 transition-all duration-200 cursor-pointer",
            locale === "en"
              ? "bg-white/15 text-kabut font-bold shadow-xs"
              : "text-kabut/50 hover:text-kabut"
          )}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("langLabel")}
      className={cn(
        "inline-flex items-center rounded-xl border border-white/15 bg-white/5 backdrop-blur-md p-0.5 text-xs font-semibold shadow-inner",
        className
      )}
    >
      <button
        type="button"
        onClick={() => switchLocale("id")}
        aria-pressed={locale === "id"}
        className={cn(
          "min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-lg px-2.5 py-1 transition-all duration-200 cursor-pointer",
          locale === "id"
            ? "bg-white/15 border border-white/25 text-kabut font-bold shadow-sm backdrop-blur-sm"
            : "text-kabut/75 hover:text-kabut hover:bg-white/5"
        )}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        aria-pressed={locale === "en"}
        className={cn(
          "min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-lg px-2.5 py-1 transition-all duration-200 cursor-pointer",
          locale === "en"
            ? "bg-white/15 border border-white/25 text-kabut font-bold shadow-sm backdrop-blur-sm"
            : "text-kabut/75 hover:text-kabut hover:bg-white/5"
        )}
      >
        EN
      </button>
    </div>
  );
}
