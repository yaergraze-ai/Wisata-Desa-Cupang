"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const LazySonnerToaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

export function DeferredToaster() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activate = () => setReady(true);
    window.addEventListener("pointerdown", activate, { once: true, passive: true });
    window.addEventListener("keydown", activate, { once: true, passive: true });
    const timer = window.setTimeout(activate, 3500);
    return () => {
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <LazySonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#0F2A24",
          color: "#E8F1EC",
          border: "1px solid #23746A",
        },
      }}
    />
  );
}
