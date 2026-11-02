"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import type { PublicReviewItemDto, PublicReviewPhotoDto } from "@/server/reviews/public-reviews";

export function MotionTabPill() {
  return (
    <motion.span
      layoutId="reviews-filter-pill"
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="absolute inset-0 rounded-lg bg-fajar"
    />
  );
}

export interface MotionReviewModalProps {
  review: PublicReviewItemDto | null;
  initialPhotoIndex?: number;
  onClose: () => void;
  closeAriaLabel?: string;
}

export function MotionReviewModal({
  review,
  initialPhotoIndex = 0,
  onClose,
  closeAriaLabel = "Tutup detail ulasan",
}: MotionReviewModalProps) {
  const [photoIndex, setPhotoIndex] = useState<number>(initialPhotoIndex);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setPhotoIndex(initialPhotoIndex);
    setImgError(false);
  }, [initialPhotoIndex, review]);

  const photos = review?.photos ?? [];
  const currentPhoto = photos[photoIndex] ?? null;

  const handlePrevPhoto = useCallback(() => {
    if (photos.length <= 1) return;
    setImgError(false);
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNextPhoto = useCallback(() => {
    if (photos.length <= 1) return;
    setImgError(false);
    setPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // Keyboard navigation: Escape to close, Arrows to cycle photos
  useEffect(() => {
    if (!review) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [review, onClose, handlePrevPhoto, handleNextPhoto]);

  return (
    <AnimatePresence>
      {review ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-telaga-700/80 bg-hutan shadow-2xl flex flex-col lg:flex-row max-h-[92vh]"
          >
            {/* Tombol Tutup Melayang di Pojok Kanan Atas */}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeAriaLabel}
              className="absolute top-3.5 right-3.5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-obsidian/80 border border-kabut/20 text-kabut shadow-lg backdrop-blur-md transition-all hover:bg-fajar hover:text-obsidian hover:scale-105 active:scale-95 cursor-pointer"
            >
              <i className="bi bi-x-lg text-sm" aria-hidden="true" />
            </button>

            {/* KOLOM KIRI: Galeri Foto Interaktif (Bila Ada Foto) */}
            {photos.length > 0 ? (
              <div className="relative flex flex-col justify-between bg-obsidian/95 lg:w-[58%] shrink-0 min-h-[280px] sm:min-h-[380px] lg:min-h-[480px]">
                {/* Area Tampilan Foto Utama */}
                <div className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPhoto?.id ?? photoIndex}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="relative h-full w-full min-h-[240px] sm:min-h-[320px] flex items-center justify-center rounded-2xl overflow-hidden"
                    >
                      {currentPhoto && !imgError ? (
                        <Image
                          src={currentPhoto.url}
                          alt={`Foto kunjungan oleh ${review.authorName}`}
                          fill
                          sizes="(max-width: 1024px) 100vw, 58vw"
                          className="object-contain select-none"
                          unoptimized
                          onError={() => setImgError(true)}
                          priority
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-kabut/60 p-6 text-center space-y-2">
                          <i className="bi bi-image text-4xl text-fajar" aria-hidden="true" />
                          <p className="text-xs">Foto kunjungan tersimpan</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Tombol Navigasi Kiri / Kanan Jika Multi Foto */}
                  {photos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        aria-label="Foto sebelumnya"
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-obsidian/75 border border-kabut/20 text-kabut backdrop-blur-sm transition-all hover:bg-fajar hover:text-obsidian hover:scale-110 active:scale-95 cursor-pointer shadow-lg z-10"
                      >
                        <i className="bi bi-chevron-left text-sm" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        aria-label="Foto selanjutnya"
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-obsidian/75 border border-kabut/20 text-kabut backdrop-blur-sm transition-all hover:bg-fajar hover:text-obsidian hover:scale-110 active:scale-95 cursor-pointer shadow-lg z-10"
                      >
                        <i className="bi bi-chevron-right text-sm" aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </div>

                {/* Footer Galeri: Indikator & Thumbnail Foto */}
                <div className="flex items-center justify-between border-t border-telaga-900/60 bg-obsidian/90 px-4 py-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {photos.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setImgError(false);
                          setPhotoIndex(idx);
                        }}
                        className={`relative h-11 w-11 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          idx === photoIndex
                            ? "border-fajar scale-105 shadow-md shadow-fajar/20"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={p.url}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>

                  {photos.length > 1 ? (
                    <span className="shrink-0 text-[11px] font-mono font-bold text-kabut/70 bg-obsidian px-2.5 py-1 rounded-full border border-telaga-800">
                      {photoIndex + 1} / {photos.length}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-kabut/60">
                      Foto Wisatawan Asli
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* KOLOM KANAN: Detail Informasi Pengunjung & Komentar Ulasan */}
            <div className={`flex flex-col justify-between p-6 sm:p-7 overflow-y-auto ${photos.length > 0 ? "lg:w-[42%]" : "w-full"}`}>
              <div className="space-y-5">
                {/* Header Profil Pengunjung */}
                <div className="flex items-start gap-3.5 pr-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/30 to-telaga-800 border border-fajar/50 font-heading text-sm font-extrabold text-fajar shadow-inner">
                    {review.authorInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base sm:text-lg font-bold text-kabut truncate">
                      {review.authorName}
                    </h3>
                    <p className="text-xs text-kabut/70 mt-0.5">
                      {review.createdAtDisplay}
                    </p>
                  </div>
                </div>

                {/* Rating Bintang & Badge Verifikasi */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-obsidian border border-fajar/50 px-3 py-1 text-xs font-extrabold text-fajar shadow-sm">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i
                        key={i}
                        className={`bi ${i < review.rating ? "bi-star-fill text-fajar" : "bi-star text-kabut/30"} text-[11px]`}
                        aria-hidden="true"
                      />
                    ))}
                    <span className="ml-1 text-kabut font-mono">{review.rating}.0</span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-telaga-900/80 border border-telaga-600/60 px-3 py-1 text-[11px] font-bold text-telaga-200">
                    <i className="bi bi-patch-check-fill text-fajar" aria-hidden="true" />
                    <span>Tiket Terverifikasi</span>
                  </span>

                  {review.destinationSlugs && review.destinationSlugs.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-obsidian border border-telaga-800 px-2.5 py-1 text-[10px] font-bold text-kabut/80">
                      <i className="bi bi-geo-alt-fill text-fajar" aria-hidden="true" />
                      <span>
                        {review.destinationSlugs.includes("batu-lawang")
                          ? "Batu Lawang"
                          : "Gunung Bendera"}
                      </span>
                    </span>
                  ) : null}
                </div>

                {/* Kotak Komentar Ulasan */}
                <div className="relative rounded-2xl border border-telaga-800/80 bg-obsidian/70 p-4 sm:p-5 shadow-inner">
                  <i
                    className="bi bi-quote absolute right-3 top-2 text-3xl text-fajar/15 select-none"
                    aria-hidden="true"
                  />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-fajar mb-2 flex items-center gap-1.5">
                    <i className="bi bi-chat-quote-fill" aria-hidden="true" />
                    <span>Pengalaman Berkunjung</span>
                  </h4>
                  <p className="text-sm leading-relaxed text-kabut/95 whitespace-pre-line relative z-10">
                    {review.comment}
                  </p>
                </div>

                {/* Tanggapan Resmi Pengelola (Bila Ada) */}
                {review.managerReply ? (
                  <div className="rounded-2xl border border-fajar/30 bg-fajar/5 p-4 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-fajar flex items-center gap-1.5">
                        <i className="bi bi-shield-check text-sm" aria-hidden="true" />
                        <span>Tanggapan Resmi Pengelola</span>
                      </span>
                      {review.repliedAtDisplay ? (
                        <span className="text-[10px] text-kabut/60">
                          {review.repliedAtDisplay}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-kabut/90 leading-relaxed pl-5 border-l-2 border-fajar/40">
                      {review.managerReply}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Catatan Kaki Modal */}
              <div className="pt-6 border-t border-telaga-900/60 mt-4 flex items-center justify-between text-[11px] text-kabut/60">
                <span className="flex items-center gap-1">
                  <i className="bi bi-shield-lock-fill text-telaga-400" aria-hidden="true" />
                  <span>Ulasan resmi pengunjung wisata</span>
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-fajar hover:underline font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// Kompatibilitas mundur dengan nama fungsi sebelumnya
export function MotionPhotoLightbox({
  photo,
  closeAriaLabel = "Tutup foto",
  onClose,
}: {
  photo: PublicReviewPhotoDto | null;
  closeAriaLabel?: string;
  onClose: () => void;
}) {
  if (!photo) return null;

  const dummyReview: PublicReviewItemDto = {
    id: photo.id,
    authorName: "Pengunjung Wisata",
    authorInitials: "PW",
    productCode: "TIKET",
    destinationSlugs: ["batu-lawang"],
    rating: 5,
    comment: "Dokumentasi foto keindahan alam kawasan Wisata Desa Cupang Cirebon.",
    createdAtDisplay: "Terverifikasi Resmi",
    managerReply: null,
    repliedAtDisplay: null,
    photos: [photo],
  };

  return (
    <MotionReviewModal
      review={dummyReview}
      initialPhotoIndex={0}
      onClose={onClose}
      closeAriaLabel={closeAriaLabel}
    />
  );
}
