"use client";

import { useEffect, useState } from "react";
import { PageShadowSkeleton } from "@/components/shared/PageShadowSkeleton";
import { cn } from "@/lib/cn";

export function PageTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [overlayPhase, setOverlayPhase] = useState<
    "idle" | "entering" | "exiting"
  >("idle");

  useEffect(() => {
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;

    function handleTransitionStart() {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (doneTimer) clearTimeout(doneTimer);

      setOverlayPhase("entering");

      fadeOutTimer = setTimeout(() => {
        setOverlayPhase("exiting");
      }, 340);

      doneTimer = setTimeout(() => {
        setOverlayPhase("idle");
      }, 700);
    }

    window.addEventListener(
      "wisata:page-transition-start",
      handleTransitionStart
    );
    return () => {
      window.removeEventListener(
        "wisata:page-transition-start",
        handleTransitionStart
      );
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div className="relative min-h-dvh">
      {overlayPhase !== "idle" ? (
        <div
          aria-hidden="true"
          data-testid="page-transition-skeleton"
          className={cn(
            "pointer-events-none fixed inset-0 z-[90] bg-obsidian transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]",
            overlayPhase === "entering" ? "opacity-100" : "opacity-0"
          )}
        >
          <PageShadowSkeleton variant="auto" />
        </div>
      ) : null}

      <div
        className={cn(
          "animate-page-smooth-in transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]",
          overlayPhase === "entering" ? "opacity-95" : "opacity-100"
        )}
      >
        {children}
      </div>
    </div>
  );
}
