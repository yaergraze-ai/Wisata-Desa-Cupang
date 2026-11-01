"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import type { PublicReviewPhotoDto } from "@/server/reviews/public-reviews";

export function MotionTabPill() {
  return (
    <motion.span
      layoutId="reviews-filter-pill"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="absolute inset-0 rounded-lg bg-fajar"
    />
  );
}

export function MotionPhotoLightbox({
  photo,
  closeAriaLabel,
  onClose,
}: {
  photo: PublicReviewPhotoDto | null;
  closeAriaLabel: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {photo ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-kabut/25 bg-hutan p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={closeAriaLabel}
              className="absolute top-4 right-4 z-10 btn-ui btn-fajar min-w-[44px] px-3"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-obsidian">
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 768px) 95vw, 768px"
                className="object-contain"
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
