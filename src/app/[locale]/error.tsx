"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    // Log error digest internally without leaking sensitive stack trace to visitors
    console.error("Application error boundary triggered:", error.digest || error.message);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-obsidian bg-topo-contour px-4 py-16 text-center text-kabut sm:px-6">
      <div className="w-full max-w-md surface-solid-dark p-8 sm:p-10 rounded-3xl border border-red-700/50 shadow-2xl space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/40 bg-red-950/40 text-3xl text-red-400">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-kabut">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-kabut/80 leading-relaxed">
            {t("subtitle")}
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-kabut/50 pt-1">
              {error.digest}
            </p>
          ) : null}
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-ui btn-fajar justify-center py-3 text-xs font-bold"
          >
            <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            <span>{t("retryBtn")}</span>
          </button>
          <Link href="/" className="btn-ui btn-glass justify-center py-2.5 text-xs font-semibold">
            <i className="bi bi-house-door-fill" aria-hidden="true" />
            <span>{t("backHome")}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
