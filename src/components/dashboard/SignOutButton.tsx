"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

export const USER_WALLET_CACHE_NAME = "wisata-cirebon-user-wallet-v1";

export function SignOutButton() {
  const t = useTranslations("DashboardShell");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
      // Bersihkan cache dompet tiket milik user saat logout (§6.I)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("wisata_cirebon_wallet_cache");
        if ("caches" in window) {
          await window.caches.delete(USER_WALLET_CACHE_NAME).catch(() => false);
        }
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "CLEAR_USER_CACHE",
          });
        }
      }
    } finally {
      window.location.assign(locale === "en" ? "/en" : "/");
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleSignOut}
      className="btn-ui group relative inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-bold text-rose-300 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-500/70 hover:bg-rose-500/25 hover:text-white hover:shadow-[0_0_24px_rgba(244,63,94,0.4)] active:translate-y-0 disabled:opacity-50"
      title={t("signOutBtn")}
    >
      <i
        className={`bi ${loading ? "bi-arrow-repeat animate-spin" : "bi-box-arrow-right"} text-rose-400 group-hover:translate-x-0.5 transition-transform duration-200`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{t("signOutBtn")}</span>
    </button>
  );
}
