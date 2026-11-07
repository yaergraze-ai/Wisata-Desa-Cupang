"use client";

import { useEffect } from "react";

const CURRENT_SHELL_CACHE = "wisata-cirebon-shell-v5";
const MAP_CACHE = "wisata_cirebon_map_cache";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Bersihkan cache shell versi lama agar ponsel tidak pernah memuat bundle JS/CSS usang
    if ("caches" in window) {
      void window.caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.map((key) => {
              if (key !== CURRENT_SHELL_CACHE && key !== MAP_CACHE) {
                return window.caches.delete(key);
              }
              return Promise.resolve(false);
            })
          )
        )
        .catch(() => {});
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          void reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (
                  installing.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  installing.postMessage({ type: "SKIP_WAITING" });
                }
              });
            }
          });
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
