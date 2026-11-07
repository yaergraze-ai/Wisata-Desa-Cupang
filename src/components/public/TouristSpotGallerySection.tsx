"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import type { GallerySpotItem } from "@/server/gallery/gallery-service";

interface TouristSpotGalleryProps {
  initialItems: GallerySpotItem[];
  userRole?: string | null;
  userName?: string | null;
}

export function TouristSpotGallerySection({
  initialItems,
  userRole,
  userName,
}: TouristSpotGalleryProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [items, setItems] = useState<GallerySpotItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<GallerySpotItem | null>(
    null
  );
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Refs untuk fitur geser (drag/swipe) pada tab kategori & kartu foto
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const galleryTrackRef = useRef<HTMLDivElement | null>(null);
  const catDragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const trackDragStateRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const lightboxTouchStartXRef = useRef<number | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<
    "spot-foto" | "pemandangan" | "pengunjung" | "aktivitas"
  >("spot-foto");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const canManage = Boolean(
    userRole && ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(userRole)
  );

  const categories = [
    {
      id: "all",
      label: isEn ? "All Spots & Photos" : "Semua Spot & Foto",
      icon: "bi-grid-fill",
    },
    {
      id: "spot-foto",
      label: isEn ? "Cliff Selfie Spots" : "Spot Selfie & Tebing",
      icon: "bi-camera-fill",
    },
    {
      id: "pemandangan",
      label: isEn ? "Summit Panoramas" : "Pemandangan Puncak",
      icon: "bi-image-fill",
    },
    {
      id: "pengunjung",
      label: isEn ? "Visitors & Community" : "Pengunjung & Komunitas",
      icon: "bi-people-fill",
    },
    {
      id: "aktivitas",
      label: isEn ? "Hiking Activities" : "Aktivitas Pendakian",
      icon: "bi-compass-fill",
    },
  ];

  const filteredItems = items.filter((item) => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

  const selectedPhotoIndex = selectedPhoto
    ? filteredItems.findIndex((i) => i.id === selectedPhoto.id)
    : -1;

  const goToRelativePhoto = useCallback(
    (delta: number) => {
      if (!selectedPhoto || filteredItems.length <= 1) return;
      const currentIdx = filteredItems.findIndex(
        (i) => i.id === selectedPhoto.id
      );
      if (currentIdx === -1) return;
      const nextIdx =
        (currentIdx + delta + filteredItems.length) % filteredItems.length;
      const nextItem = filteredItems[nextIdx];
      if (nextItem) {
        setModalImageLoaded(false);
        setSelectedPhoto(nextItem);
      }
    },
    [filteredItems, selectedPhoto]
  );

  // Kunci scroll halaman utama saat foto dibuka (Lightbox) atau modal unggah aktif
  useEffect(() => {
    const isAnyModalOpen = Boolean(selectedPhoto) || isUploadOpen;
    if (!isAnyModalOpen || typeof document === "undefined") return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior;

    htmlEl.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    bodyEl.style.overscrollBehavior = "none";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPhoto(null);
        setIsUploadOpen(false);
      } else if (selectedPhoto && e.key === "ArrowLeft") {
        e.preventDefault();
        goToRelativePhoto(-1);
      } else if (selectedPhoto && e.key === "ArrowRight") {
        e.preventDefault();
        goToRelativePhoto(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [goToRelativePhoto, isUploadOpen, selectedPhoto]);

  function getCategoryBadgeLabel(cat: string): string {
    if (cat === "spot-foto") return isEn ? "Selfie Spot" : "Spot Swafoto";
    if (cat === "pemandangan") return isEn ? "Panorama" : "Panorama Alam";
    if (cat === "pengunjung") return isEn ? "Visitors" : "Wisatawan";
    return isEn ? "Activity" : "Aktivitas";
  }

  function scrollGalleryByCard(direction: -1 | 1) {
    const track = galleryTrackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>("[data-gallery-card]");
    const step = (firstCard?.offsetWidth ?? 320) + 20;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function scrollToSlideIndex(idx: number) {
    const track = galleryTrackRef.current;
    if (!track) return;
    const cardsEls = track.querySelectorAll<HTMLElement>("[data-gallery-card]");
    const target = cardsEls[idx];
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      setActiveSlideIndex(idx);
    }
  }

  function handleTrackScroll() {
    const track = galleryTrackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>("[data-gallery-card]");
    const cardWidth = (firstCard?.offsetWidth ?? 320) + 20;
    const idx = Math.round(track.scrollLeft / Math.max(1, cardWidth));
    const clamped = Math.max(
      0,
      Math.min(filteredItems.length - 1, idx)
    );
    if (clamped !== activeSlideIndex) {
      setActiveSlideIndex(clamped);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
      setUploadError(null);
    }
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError(
        isEn
          ? "Please select a photo file first."
          : "Pilih berkas foto terlebih dahulu."
      );
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError(
        isEn ? "Photo title is required." : "Judul foto wajib diisi."
      );
      return;
    }

    setUploadError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("title", uploadTitle.trim());
        formData.append("category", uploadCategory);
        formData.append("caption", uploadCaption.trim());
        if (userName) formData.append("uploaderName", userName.trim());

        const res = await fetch("/api/gallery", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          throw new Error(
            errData.error ||
              (isEn ? "Failed to upload photo." : "Gagal mengunggah foto.")
          );
        }

        const data = (await res.json()) as { item: GallerySpotItem };
        setItems((prev) => [data.item, ...prev]);
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadPreview(null);
        setUploadTitle("");
        setUploadCaption("");
      } catch (err: unknown) {
        setUploadError(
          err instanceof Error
            ? err.message
            : isEn
            ? "Failed to upload photo."
            : "Gagal mengunggah foto."
        );
      }
    });
  }

  async function handleDelete(id: string, title: string) {
    if (
      !confirm(
        isEn
          ? `Delete photo '${title}' from the gallery?`
          : `Hapus foto '${title}' dari galeri wisata?`
      )
    )
      return;

    try {
      const res = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(
          errData.error ||
            (isEn ? "Failed to delete photo." : "Gagal menghapus foto.")
        );
      }

      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedPhoto?.id === id) setSelectedPhoto(null);
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : isEn
          ? "Failed to delete photo."
          : "Gagal menghapus foto."
      );
    }
  }

  return (
    <section
      id="galeri-wisata"
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 scroll-mt-24 space-y-7 sm:space-y-9"
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-telaga-400/35 bg-telaga/15 px-3.5 py-1.5 text-xs font-bold text-kabut uppercase tracking-widest shadow-[0_6px_20px_rgba(47,143,131,0.2)]">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-fajar/20 text-fajar">
              <i
                className="bi bi-camera-reels-fill text-xs"
                aria-hidden="true"
              />
            </span>
            <span>
              {isEn
                ? "Scenic Spots & Photo Gallery"
                : "Spot & Galeri Foto Wisata"}
            </span>
          </div>
          <h2 className="mt-3 font-heading text-2xl font-bold text-kabut sm:text-4xl drop-shadow-md">
            {isEn
              ? "Aesthetic Corners & Scenic Views of Cupang Village"
              : "Sudut Estetik & Keindahan Desa Cupang"}
          </h2>
          <p className="mt-2 text-sm text-kabut/85 leading-relaxed">
            {isEn
              ? "Swipe through the scenic cliff spots of Batu Lawang, shaded forest canopy trails, and the 520 masl summit of Gunung Bendera."
              : "Geser kartu foto untuk menjelajahi spot swafoto tebing purba Batu Lawang, jalur hutan kanopi, dan puncak Gunung Bendera."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
          {/* Tombol Geser Kiri / Kanan untuk Carousel Foto */}
          {filteredItems.length > 1 ? (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollGalleryByCard(-1)}
                aria-label={isEn ? "Previous spot photo" : "Geser foto sebelumnya"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-obsidian/90 text-kabut hover:border-fajar/55 hover:text-fajar transition-all shadow-md cursor-pointer"
              >
                <i className="bi bi-chevron-left text-sm" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollGalleryByCard(1)}
                aria-label={isEn ? "Next spot photo" : "Geser foto selanjutnya"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-obsidian/90 text-kabut hover:border-fajar/55 hover:text-fajar transition-all shadow-md cursor-pointer"
              >
                <i className="bi bi-chevron-right text-sm" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {/* Action Button for Staff / Admin */}
          {canManage ? (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="btn-ui btn-fajar shadow-lg shadow-fajar/20"
            >
              <i
                className="bi bi-cloud-arrow-up-fill text-base"
                aria-hidden="true"
              />
              <span>
                {isEn ? "Upload New Spot Photo" : "Unggah Foto Spot Baru"}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {/* CATEGORY FILTER TABS — Bisa Digeser (Touch Swipe & Mouse Drag) */}
      <div
        ref={categoryScrollRef}
        onMouseDown={(e) => {
          const el = categoryScrollRef.current;
          if (!el) return;
          catDragStateRef.current = {
            isDown: true,
            startX: e.pageX - el.offsetLeft,
            scrollLeft: el.scrollLeft,
            moved: false,
          };
        }}
        onMouseLeave={() => {
          catDragStateRef.current.isDown = false;
        }}
        onMouseUp={() => {
          catDragStateRef.current.isDown = false;
        }}
        onMouseMove={(e) => {
          const el = categoryScrollRef.current;
          if (!el || !catDragStateRef.current.isDown) return;
          const x = e.pageX - el.offsetLeft;
          const walk = x - catDragStateRef.current.startX;
          if (Math.abs(walk) > 5) {
            catDragStateRef.current.moved = true;
            e.preventDefault();
            el.scrollLeft = catDragStateRef.current.scrollLeft - walk * 1.25;
          }
        }}
        className="flex items-center gap-2.5 overflow-x-auto pb-2 touch-pan-x select-none cursor-grab active:cursor-grabbing custom-scroll -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={(e) => {
                if (catDragStateRef.current.moved) {
                  catDragStateRef.current.moved = false;
                  return;
                }
                setActiveCategory(cat.id);
                setActiveSlideIndex(0);
                e.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  inline: "center",
                  block: "nearest",
                });
                if (galleryTrackRef.current) {
                  galleryTrackRef.current.scrollTo({
                    left: 0,
                    behavior: "smooth",
                  });
                }
              }}
              className={cn(
                "group min-h-[44px] inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-300 shrink-0 cursor-pointer border",
                isActive
                  ? "bg-fajar text-obsidian border-fajar shadow-[0_8px_24px_rgba(242,166,90,0.3)] scale-[1.02]"
                  : "surface-solid-dark border-white/15 text-kabut/85 hover:text-kabut hover:border-fajar/45"
              )}
            >
              <i
                className={cn(
                  "bi transition-transform duration-300 group-hover:scale-110",
                  cat.icon,
                  isActive ? "text-obsidian" : "text-fajar"
                )}
                aria-hidden="true"
              />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* SWIPEABLE / DRAGGABLE PHOTO CAROUSEL */}
      {filteredItems.length === 0 ? (
        <div className="surface-solid-dark p-12 text-center rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
          <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-fajar/35 bg-fajar/15 text-fajar shadow-md">
            <i className="bi bi-images text-2xl" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-kabut/80">
            {isEn
              ? "No photos available in this category yet."
              : "Belum ada foto dalam kategori ini."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            key={activeCategory}
            ref={galleryTrackRef}
            onScroll={handleTrackScroll}
            onMouseDown={(e) => {
              const el = galleryTrackRef.current;
              if (!el) return;
              trackDragStateRef.current = {
                isDown: true,
                startX: e.pageX - el.offsetLeft,
                scrollLeft: el.scrollLeft,
                moved: false,
              };
            }}
            onMouseLeave={() => {
              trackDragStateRef.current.isDown = false;
            }}
            onMouseUp={() => {
              trackDragStateRef.current.isDown = false;
            }}
            onMouseMove={(e) => {
              const el = galleryTrackRef.current;
              if (!el || !trackDragStateRef.current.isDown) return;
              const x = e.pageX - el.offsetLeft;
              const walk = x - trackDragStateRef.current.startX;
              if (Math.abs(walk) > 8) {
                trackDragStateRef.current.moved = true;
                e.preventDefault();
                el.scrollLeft =
                  trackDragStateRef.current.scrollLeft - walk * 1.2;
              }
            }}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory touch-pan-x select-none cursor-grab active:cursor-grabbing pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 custom-scroll animate-page-smooth-in"
          >
            {filteredItems.map((item) => {
              const isLoaded = Boolean(loadedMap[item.id]);
              return (
                <article
                  key={item.id}
                  data-gallery-card="true"
                  className="group surface-solid-dark w-[84vw] max-w-[335px] sm:w-[340px] lg:w-[375px] shrink-0 snap-center sm:snap-start overflow-hidden rounded-2xl border border-white/10 hover:border-fajar/45 transition-all duration-300 flex flex-col justify-between shadow-[0_18px_42px_rgba(0,0,0,0.55)]"
                >
                  {/* IMAGE WRAPPER WITH SHADOW SKELETON */}
                  <div
                    onClick={() => {
                      if (trackDragStateRef.current.moved) {
                        trackDragStateRef.current.moved = false;
                        return;
                      }
                      setModalImageLoaded(false);
                      setSelectedPhoto(item);
                    }}
                    className="relative aspect-4/3 overflow-hidden cursor-pointer bg-obsidian"
                  >
                    {/* Shadow Skeleton Saat Gambar Dimuat */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 transition-opacity duration-500",
                        isLoaded
                          ? "opacity-0 pointer-events-none"
                          : "opacity-100 skeleton-shimmer shadow-[inset_0_0_50px_rgba(0,0,0,0.85)]"
                      )}
                    />

                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      draggable={false}
                      sizes="(max-width: 640px) 84vw, (max-width: 1024px) 340px, 375px"
                      onLoad={() =>
                        setLoadedMap((prev) =>
                          prev[item.id] ? prev : { ...prev, [item.id]: true }
                        )
                      }
                      className="object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity pointer-events-none" />

                    {/* CATEGORY BADGE */}
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-obsidian/85 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-fajar uppercase tracking-wider shadow-md">
                      <i
                        className="bi bi-geo-alt-fill text-[10px]"
                        aria-hidden="true"
                      />
                      <span>{getCategoryBadgeLabel(item.category)}</span>
                    </span>

                    {/* DELETE BUTTON FOR STAFF / ADMIN */}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id, item.title);
                        }}
                        className="absolute top-3 right-3 h-9 w-9 rounded-full bg-red-950/85 border border-red-500/50 text-red-300 hover:bg-red-900 hover:text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md"
                        title={isEn ? "Delete this photo" : "Hapus foto ini"}
                      >
                        <i
                          className="bi bi-trash3-fill text-xs"
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}

                    {/* TITLE OVERLAY */}
                    <div className="absolute bottom-3 inset-x-3 pointer-events-none">
                      <h3 className="font-heading text-base font-bold text-white drop-shadow-md line-clamp-1">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  {/* CARD DETAILS */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <p className="text-xs text-kabut/85 line-clamp-2 leading-relaxed">
                      {item.caption ||
                        (isEn
                          ? "Scenic beauty of Cupang Village highlands in Cirebon."
                          : "Keindahan destinasi wisata Desa Cupang Cirebon.")}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-kabut/70">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-fajar/15 border border-fajar/30 text-fajar">
                          <i
                            className="bi bi-person-fill text-[10px]"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="font-medium">
                          {item.uploadedByName}
                        </span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-kabut/80">
                          {item.uploadedByRole}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setModalImageLoaded(false);
                          setSelectedPhoto(item);
                        }}
                        className="text-fajar font-bold hover:underline shrink-0 cursor-pointer py-1"
                      >
                        {isEn ? "View Full" : "Lihat Penuh"}{" "}
                        <i
                          className="bi bi-arrows-angle-expand ml-0.5 text-[10px]"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Indikator Posisi Geser Kartu Galeri */}
          {filteredItems.length > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-1">
              {filteredItems.map((item, idx) => {
                const isCurr = idx === activeSlideIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSlideIndex(idx)}
                    aria-label={item.title}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300 cursor-pointer",
                      isCurr
                        ? "w-7 bg-fajar shadow-[0_0_10px_rgba(242,166,90,0.5)]"
                        : "w-2 bg-white/25 hover:bg-white/45"
                    )}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {/* LIGHTBOX MODAL — Dirender via Portal ke document.body & Mengunci Scroll Halaman */}
      {selectedPhoto && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={selectedPhoto.title}
              onClick={() => setSelectedPhoto(null)}
              onTouchStart={(e) => {
                lightboxTouchStartXRef.current =
                  e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const startX = lightboxTouchStartXRef.current;
                const endX = e.changedTouches[0]?.clientX ?? null;
                lightboxTouchStartXRef.current = null;
                if (startX !== null && endX !== null) {
                  const dx = endX - startX;
                  if (dx < -45) {
                    goToRelativePhoto(1);
                  } else if (dx > 45) {
                    goToRelativePhoto(-1);
                  }
                }
              }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-obsidian/95 backdrop-blur-xl overscroll-none touch-none"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="surface-solid-dark max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden rounded-2xl border border-white/20 shadow-[0_28px_80px_rgba(0,0,0,0.95)] relative"
              >
                {/* TOP BAR LIGHTBOX: Counter + Close Button */}
                <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between pointer-events-none">
                  {filteredItems.length > 1 && selectedPhotoIndex >= 0 ? (
                    <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-obsidian/85 border border-white/20 px-3 py-1 text-xs font-mono font-bold text-kabut backdrop-blur-md shadow-lg">
                      <i
                        className="bi bi-images text-fajar text-xs"
                        aria-hidden="true"
                      />
                      <span>
                        {selectedPhotoIndex + 1} / {filteredItems.length}
                      </span>
                    </span>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(null)}
                    aria-label={isEn ? "Close photo" : "Tutup foto"}
                    className="pointer-events-auto h-10 w-10 rounded-full bg-obsidian/85 border border-white/25 text-kabut hover:bg-fajar hover:text-obsidian hover:border-fajar flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-lg"
                  >
                    <i className="bi bi-x-lg text-base" aria-hidden="true" />
                  </button>
                </div>

                {/* IMAGE VIEWPORT + PREV/NEXT SLIDE CONTROLS */}
                <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-obsidian shrink-0">
                  {!modalImageLoaded ? (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 skeleton-shimmer shadow-[inset_0_0_80px_rgba(0,0,0,0.9)]"
                    />
                  ) : null}
                  <Image
                    src={selectedPhoto.imageUrl}
                    alt={selectedPhoto.title}
                    fill
                    onLoad={() => setModalImageLoaded(true)}
                    className="object-contain select-none"
                  />

                  {filteredItems.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => goToRelativePhoto(-1)}
                        aria-label={
                          isEn ? "Previous photo" : "Foto sebelumnya"
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-obsidian/80 border border-white/20 text-kabut hover:bg-fajar hover:text-obsidian transition-all shadow-lg cursor-pointer"
                      >
                        <i
                          className="bi bi-chevron-left text-sm"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => goToRelativePhoto(1)}
                        aria-label={isEn ? "Next photo" : "Foto selanjutnya"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-obsidian/80 border border-white/20 text-kabut hover:bg-fajar hover:text-obsidian transition-all shadow-lg cursor-pointer"
                      >
                        <i
                          className="bi bi-chevron-right text-sm"
                          aria-hidden="true"
                        />
                      </button>
                    </>
                  ) : null}
                </div>

                {/* PHOTO DETAILS FOOTER */}
                <div className="p-4 sm:p-6 space-y-2.5 bg-obsidian/95 overflow-y-auto">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-heading text-lg sm:text-xl font-bold text-white">
                      {selectedPhoto.title}
                    </h3>
                    <span className="rounded-full border border-fajar/40 bg-fajar/10 px-3 py-1 text-xs font-bold text-fajar">
                      {getCategoryBadgeLabel(selectedPhoto.category)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-kabut/85 leading-relaxed">
                    {selectedPhoto.caption}
                  </p>
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs text-kabut/60">
                    <span>
                      {isEn ? "Uploaded by:" : "Diunggah oleh:"}{" "}
                      <strong>{selectedPhoto.uploadedByName}</strong> (
                      {selectedPhoto.uploadedByRole})
                    </span>
                    <span>
                      {new Date(selectedPhoto.createdAt).toLocaleDateString(
                        isEn ? "en-US" : "id-ID"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* UPLOAD MODAL FOR STAFF / ADMIN — Dirender via Portal & Mengunci Scroll */}
      {isUploadOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-obsidian/95 backdrop-blur-xl overscroll-none"
            >
              <div className="surface-solid-dark max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-white/20 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-white">
                      {isEn
                        ? "Upload Scenic Spot Photo"
                        : "Unggah Foto Spot Wisata"}
                    </h3>
                    <p className="text-xs text-kabut/70">
                      {isEn
                        ? `Spot documentation or visitor moments (Role: ${userRole})`
                        : `Dokumentasi spot atau foto pengunjung (Akses: ${userRole})`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="text-kabut/70 hover:text-white cursor-pointer"
                  >
                    <i className="bi bi-x-lg text-lg" aria-hidden="true" />
                  </button>
                </div>

                {uploadError ? (
                  <div className="p-3 rounded-xl bg-red-950/70 border border-red-700/60 text-xs text-red-200">
                    <i
                      className="bi bi-exclamation-triangle-fill mr-1.5"
                      aria-hidden="true"
                    />
                    {uploadError}
                  </div>
                ) : null}

                <form
                  onSubmit={handleUploadSubmit}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-kabut mb-1.5">
                      {isEn
                        ? "Select Photo File (JPG, PNG, WebP)"
                        : "Pilih Berkas Foto (JPG, PNG, WebP)"}
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="w-full rounded-xl border border-white/15 bg-obsidian p-2 text-kabut file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-fajar file:text-obsidian hover:file:bg-fajar-300"
                    />
                    {uploadPreview ? (
                      <div className="mt-3 relative aspect-16/9 rounded-xl overflow-hidden border border-white/20">
                        <Image
                          src={uploadPreview}
                          alt="Pratinjau Unggahan"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="block font-semibold text-kabut mb-1.5">
                      {isEn ? "Spot / Moment Title" : "Judul Spot / Momen"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isEn
                          ? "Example: Batu Lawang Dawn Cliff, Hiking Community"
                          : "Contoh: Sunrise Tebing Purba, Komunitas Hiking"
                      }
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2.5 text-kabut"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-kabut mb-1.5">
                      {isEn ? "Photo Category" : "Kategori Foto"}
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) =>
                        setUploadCategory(
                          e.target.value as
                            | "spot-foto"
                            | "pemandangan"
                            | "pengunjung"
                            | "aktivitas"
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2 text-kabut"
                    >
                      <option value="spot-foto">
                        {isEn
                          ? "Selfie Spot & Cliffs"
                          : "Spot Swafoto & Tebing"}
                      </option>
                      <option value="pemandangan">
                        {isEn
                          ? "Nature & Cloud Panorama"
                          : "Pemandangan Alam & Awan"}
                      </option>
                      <option value="pengunjung">
                        {isEn ? "Visitors & Tourists" : "Pengunjung & Wisatawan"}
                      </option>
                      <option value="aktivitas">
                        {isEn ? "Hiking & Activities" : "Aktivitas & Camping"}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-kabut mb-1.5">
                      {isEn ? "Short Caption" : "Keterangan Singkat"}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        isEn
                          ? "Describe the location, scenic highlight, or visitor activity..."
                          : "Ceritakan lokasi, daya tarik spot, atau aktivitas pengunjung..."
                      }
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2 text-kabut resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      className="btn-ui btn-glass py-2 text-xs"
                    >
                      {isEn ? "Cancel" : "Batal"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-ui btn-fajar py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <i
                            className="bi bi-arrow-repeat animate-spin"
                            aria-hidden="true"
                          />
                          <span>
                            {isEn ? "Uploading..." : "Mengunggah..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <i
                            className="bi bi-cloud-arrow-up-fill"
                            aria-hidden="true"
                          />
                          <span>
                            {isEn
                              ? "Publish to Gallery"
                              : "Publikasikan ke Galeri"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
