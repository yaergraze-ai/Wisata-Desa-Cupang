"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
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
  const [items, setItems] = useState<GallerySpotItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedPhoto, setSelectedPhoto] = useState<GallerySpotItem | null>(null);

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
    { id: "all", label: "Semua Spot & Foto", icon: "bi-grid-fill" },
    { id: "spot-foto", label: "Spot Selfie & Tebing", icon: "bi-camera-fill" },
    { id: "pemandangan", label: "Pemandangan Puncak", icon: "bi-image-fill" },
    { id: "pengunjung", label: "Pengunjung & Komunitas", icon: "bi-people-fill" },
    { id: "aktivitas", label: "Aktivitas Pendakian", icon: "bi-compass-fill" },
  ];

  const filteredItems = items.filter((item) => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

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
      setUploadError("Pilih berkas foto terlebih dahulu.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Judul foto wajib diisi.");
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
          throw new Error(errData.error || "Gagal mengunggah foto.");
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
          err instanceof Error ? err.message : "Gagal mengunggah foto."
        );
      }
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Hapus foto '${title}' dari galeri wisata?`)) return;

    try {
      const res = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || "Gagal menghapus foto.");
      }

      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedPhoto?.id === id) setSelectedPhoto(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus foto.");
    }
  }

  return (
    <section
      id="galeri-wisata"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-24 space-y-10"
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-telaga/30 bg-telaga/10 px-3.5 py-1 text-xs font-bold text-telaga uppercase tracking-widest shadow-sm">
            <i className="bi bi-camera-reels-fill text-fajar" aria-hidden="true" />
            <span>Spot & Galeri Foto Wisata</span>
          </div>
          <h2 className="mt-3 font-heading text-2xl font-bold text-kabut sm:text-4xl drop-shadow-md">
            Sudut Estetik & Keindahan Desa Cupang
          </h2>
          <p className="mt-2 text-sm text-kabut/80 leading-relaxed">
            Abadikan momen terbaik di spot swafoto tebing purba Batu Lawang,
            jalur hutan kanopi, dan puncak Gunung Bendera.
          </p>
        </div>

        {/* Action Button for Staff / Admin */}
        {canManage ? (
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="btn-ui btn-fajar self-start md:self-auto shrink-0 shadow-lg shadow-fajar/20"
          >
            <i className="bi bi-cloud-arrow-up-fill text-base" aria-hidden="true" />
            <span>Unggah Foto Spot Baru</span>
          </button>
        ) : null}
      </div>

      {/* CATEGORY FILTER TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                isActive
                  ? "bg-fajar text-obsidian shadow-lg shadow-fajar/25 scale-[1.02]"
                  : "surface-solid-dark text-kabut/75 hover:text-kabut hover:border-white/25"
              }`}
            >
              <i className={`bi ${cat.icon}`} aria-hidden="true" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* PHOTO GRID */}
      {filteredItems.length === 0 ? (
        <div className="surface-solid-dark p-12 text-center rounded-2xl">
          <i className="bi bi-images text-4xl text-kabut/40 mb-3 block" aria-hidden="true" />
          <p className="text-sm font-semibold text-kabut/75">
            Belum ada foto dalam kategori ini.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group surface-solid-dark overflow-hidden rounded-2xl border border-white/10 hover:border-white/25 transition-all duration-300 flex flex-col justify-between"
            >
              {/* IMAGE WRAPPER */}
              <div
                onClick={() => setSelectedPhoto(item)}
                className="relative aspect-4/3 overflow-hidden cursor-pointer bg-obsidian"
              >
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                {/* CATEGORY BADGE */}
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-obsidian/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-fajar uppercase tracking-wider shadow-sm">
                  <i className="bi bi-geo-alt-fill text-[10px]" aria-hidden="true" />
                  <span>
                    {item.category === "spot-foto"
                      ? "Spot Swafoto"
                      : item.category === "pemandangan"
                      ? "Panorama Alam"
                      : item.category === "pengunjung"
                      ? "Wisatawan"
                      : "Aktivitas"}
                  </span>
                </span>

                {/* DELETE BUTTON FOR STAFF / ADMIN */}
                {canManage ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id, item.title);
                    }}
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 hover:bg-red-900 hover:text-white flex items-center justify-center backdrop-blur-md transition-all shadow-md"
                    title="Hapus foto ini"
                  >
                    <i className="bi bi-trash3-fill text-xs" aria-hidden="true" />
                  </button>
                ) : null}

                {/* TITLE OVERLAY */}
                <div className="absolute bottom-3 inset-x-3">
                  <h3 className="font-heading text-base font-bold text-white drop-shadow-md line-clamp-1">
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* CARD DETAILS */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <p className="text-xs text-kabut/80 line-clamp-2 leading-relaxed">
                  {item.caption || "Keindahan destinasi wisata Desa Cupang Cirebon."}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-kabut/60">
                  <span className="inline-flex items-center gap-1 truncate">
                    <i className="bi bi-person-fill text-fajar" aria-hidden="true" />
                    <span>{item.uploadedByName}</span>
                    <span className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] text-kabut/75">
                      {item.uploadedByRole}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(item)}
                    className="text-fajar font-bold hover:underline shrink-0"
                  >
                    Lihat Penuh <i className="bi bi-arrow-right" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {selectedPhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-solid-dark max-w-4xl w-full overflow-hidden rounded-2xl border border-white/20 shadow-2xl relative"
          >
            {/* CLOSE BUTTON */}
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-obsidian/80 border border-white/20 text-kabut hover:text-white flex items-center justify-center backdrop-blur-md transition-all"
            >
              <i className="bi bi-x-lg text-lg" aria-hidden="true" />
            </button>

            <div className="relative aspect-16/10 w-full bg-obsidian">
              <Image
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.title}
                fill
                className="object-contain"
              />
            </div>

            <div className="p-6 space-y-3 bg-obsidian/95">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-heading text-xl font-bold text-white">
                  {selectedPhoto.title}
                </h3>
                <span className="rounded-full border border-fajar/40 bg-fajar/10 px-3 py-1 text-xs font-bold text-fajar">
                  {selectedPhoto.category.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-kabut/85 leading-relaxed">
                {selectedPhoto.caption}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-kabut/60">
                <span>
                  Diunggah oleh: <strong>{selectedPhoto.uploadedByName}</strong> ({selectedPhoto.uploadedByRole})
                </span>
                <span>{new Date(selectedPhoto.createdAt).toLocaleDateString("id-ID")}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* UPLOAD MODAL FOR STAFF / ADMIN */}
      {isUploadOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md"
        >
          <div className="surface-solid-dark max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-white/20 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-white">
                  Unggah Foto Spot Wisata
                </h3>
                <p className="text-xs text-kabut/70">
                  Dokumentasi spot atau foto pengunjung (Akses: {userRole})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-kabut/70 hover:text-white"
              >
                <i className="bi bi-x-lg text-lg" aria-hidden="true" />
              </button>
            </div>

            {uploadError ? (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-700/60 text-xs text-red-200">
                <i className="bi bi-exclamation-triangle-fill mr-1.5" aria-hidden="true" />
                {uploadError}
              </div>
            ) : null}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* FILE PICKER */}
              <div>
                <label className="block font-semibold text-kabut mb-1.5">
                  Pilih Berkas Foto (JPG, PNG, WebP)
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

              {/* TITLE */}
              <div>
                <label className="block font-semibold text-kabut mb-1.5">
                  Judul Spot / Momen
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sunrise Tebing Purba, Komunitas Hiking"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2.5 text-kabut"
                  required
                />
              </div>

              {/* CATEGORY */}
              <div>
                <label className="block font-semibold text-kabut mb-1.5">
                  Kategori Foto
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(
                      e.target.value as "spot-foto" | "pemandangan" | "pengunjung" | "aktivitas"
                    )
                  }
                  className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2 text-kabut"
                >
                  <option value="spot-foto">Spot Swafoto & Tebing</option>
                  <option value="pemandangan">Pemandangan Alam & Awan</option>
                  <option value="pengunjung">Pengunjung & Wisatawan</option>
                  <option value="aktivitas">Aktivitas & Camping</option>
                </select>
              </div>

              {/* CAPTION */}
              <div>
                <label className="block font-semibold text-kabut mb-1.5">
                  Keterangan Singkat
                </label>
                <textarea
                  rows={2}
                  placeholder="Ceritakan lokasi, daya tarik spot, atau aktivitas pengunjung..."
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-obsidian px-3.5 py-2 text-kabut resize-none"
                />
              </div>

              {/* SUBMIT BUTTON */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="btn-ui btn-glass py-2 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-ui btn-fajar py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-arrow-up-fill" aria-hidden="true" />
                      <span>Publikasikan ke Galeri</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
