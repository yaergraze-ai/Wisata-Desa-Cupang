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
      className="btn-ui btn-glass"
    >
      <i className="bi bi-box-arrow-right" aria-hidden="true" />
      <span>{t("signOutBtn")}</span>
    </button>
  );
}
