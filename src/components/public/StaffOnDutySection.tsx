"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import type { PublicStaffStatusResponse } from "@/server/staff/staff-availability";

export interface StaffOnDutySectionProps {
  locale: AppLocale;
  initialData: PublicStaffStatusResponse;
}

export function StaffOnDutySection({
  locale,
  initialData,
}: StaffOnDutySectionProps) {
  const tStaff = useTranslations("StaffPublic");
  const [data, setData] = useState<PublicStaffStatusResponse>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/public/staff-status?locale=${locale}`, {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const next = (await res.json()) as PublicStaffStatusResponse;
        setData(next);
      }
    } catch {
      // Pertahankan snapshot terakhir bila jaringan terputus sementara
    } finally {
      setIsRefreshing(false);
    }
  }, [locale]);

  // Menyegarkan diri otomatis setiap 45 detik (≤60 dtk sesuai §5.7)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshStatus();
      }
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  return (
    <section
      id="petugas-siaga"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 scroll-mt-24"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-wider text-fajar uppercase">
            {tStaff("eyebrow")}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
            {tStaff("heading")}
          </h2>
          <p className="mt-2 text-sm text-kabut/85">{tStaff("lead")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-kabut/80">
            {tStaff("evaluatedAt", { time: data.wibTimeDisplay })}
          </span>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={isRefreshing}
            className="btn-ui btn-hutan text-xs px-3.5"
          >
            <i
              className={cn(
                "bi bi-arrow-clockwise text-sm",
                isRefreshing ? "animate-spin" : ""
              )}
              aria-hidden="true"
            />
            <span>{tStaff("refreshNowBtn")}</span>
          </button>
        </div>
      </div>

      {data.staffCards.length === 0 ? (
        <div className="mt-8 surface-solid-dark p-6 sm:p-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-obsidian border border-telaga-700 text-fajar">
              <i className="bi bi-person-workspace text-xl" aria-hidden="true" />
            </div>
            <h3 className="mt-3 font-heading text-xl font-bold text-kabut">
              {tStaff("emptyTitle")}
            </h3>
            <p className="mt-1.5 text-sm text-kabut/85">{tStaff("emptyDesc")}</p>
          </div>

          <a
            href={`https://wa.me/${data.managerWhatsappDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ui btn-telaga shrink-0"
          >
            <i className="bi bi-whatsapp text-base" aria-hidden="true" />
            <span>{tStaff("contactAdminBtn")}</span>
          </a>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.staffCards.map((staff) => (
            <article
              key={staff.id}
              className="surface-solid-dark p-5 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-obsidian border border-telaga-700 font-heading text-base font-extrabold text-fajar">
                      {staff.initials}
                    </span>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-kabut">
                        {staff.displayName}
                      </h3>
                      <p className="text-xs font-medium text-kabut/80">
                        {staff.jobTitle} • {staff.destinationName}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shrink-0",
                      staff.onDuty
                        ? "border-telaga bg-telaga-900 text-kabut"
                        : "border-kabut/25 bg-obsidian text-kabut/80"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        staff.onDuty ? "bg-fajar" : "bg-batu-400"
                      )}
                    />
                    <span>
                      {staff.onDuty
                        ? tStaff("statusOnDuty")
                        : tStaff("statusOffDuty")}
                    </span>
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 border-t border-kabut/15 pt-3 text-xs">
                  <p className="text-kabut/80">
                    <i className="bi bi-clock mr-1.5 text-telaga-200" aria-hidden="true" />
                    <span>
                      {staff.todayShiftLabel
                        ? tStaff("shiftToday", { window: staff.todayShiftLabel })
                        : tStaff("noShiftToday")}
                    </span>
                  </p>
                  {staff.isMinorProtected ? (
                    <p className="font-semibold text-fajar">
                      <i className="bi bi-shield-lock-fill mr-1.5" aria-hidden="true" />
                      <span>{tStaff("minorProtectedBadge")}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <a
                href={`https://wa.me/${staff.contactWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-full btn-ui",
                  staff.contactAction === "DIRECT_STAFF"
                    ? "btn-telaga"
                    : "btn-hutan"
                )}
              >
                <i className="bi bi-whatsapp text-base" aria-hidden="true" />
                <span>
                  {staff.contactAction === "DIRECT_STAFF"
                    ? tStaff("contactStaffBtn")
                    : tStaff("contactAdminBtn")}
                </span>
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
