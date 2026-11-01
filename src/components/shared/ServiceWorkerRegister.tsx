"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // Ada versi baru service worker
                  console.log("PWA: Versi baru aplikasi tersedia.");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("PWA: Gagal mendaftarkan service worker:", err);
        });
    }
  }, []);

  return null;
}
