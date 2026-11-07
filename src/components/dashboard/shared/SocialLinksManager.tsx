"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";

interface SocialRequest {
  id: string;
  staffId: string;
  staffName: string;
  platform: string;
  proposedUrl: string;
  note?: string | null;
  status: string;
  createdAt: string;
}

interface SocialLinksManagerProps {
  userRole: Role;
}

export function SocialLinksManager({ userRole }: SocialLinksManagerProps) {
  const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [requests, setRequests] = useState<SocialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form pengajuan staff
  const [proposeUrl, setProposeUrl] = useState("");
  const [proposePlatform, setProposePlatform] = useState<"TIKTOK" | "INSTAGRAM">("INSTAGRAM");
  const [proposeNote, setProposeNote] = useState("");
  const [isProposing, setIsProposing] = useState(false);

  async function refreshData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/social-links");
      const data = (await res.json()) as {
        tiktokUrl: string;
        instagramUrl: string;
        requests: SocialRequest[];
      };
      if (res.ok) {
        setTiktokUrl(data.tiktokUrl);
        setInstagramUrl(data.instagramUrl);
        setRequests(data.requests || []);
      }
    } catch {
      setError("Gagal memuat data tautan media sosial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function initLoad() {
      try {
        const res = await fetch("/api/admin/settings/social-links");
        const data = (await res.json()) as {
          tiktokUrl: string;
          instagramUrl: string;
          requests: SocialRequest[];
        };
        if (!ignore && res.ok) {
          setTiktokUrl(data.tiktokUrl);
          setInstagramUrl(data.instagramUrl);
          setRequests(data.requests || []);
        }
      } catch {
        if (!ignore) setError("Gagal memuat data tautan media sosial.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    initLoad();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleAdminSave(platform: "TIKTOK" | "INSTAGRAM") {
    setSavingPlatform(platform);
    setMessage(null);
    setError(null);
    const url = platform === "TIKTOK" ? tiktokUrl : instagramUrl;

    try {
      const res = await fetch("/api/admin/settings/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, url }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan tautan.");
      setMessage(data.message || "Tautan berhasil disimpan!");
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tautan.");
    } finally {
      setSavingPlatform(null);
    }
  }

  async function handleStaffPropose(e: React.FormEvent) {
    e.preventDefault();
    setIsProposing(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: proposePlatform,
          url: proposeUrl,
          note: proposeNote,
        }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Gagal mengajukan tautan.");
      setMessage(data.message || "Pengajuan berhasil dikirim ke Admin!");
      setProposeUrl("");
      setProposeNote("");
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengajukan tautan.");
    } finally {
      setIsProposing(false);
    }
  }

  async function handleReviewRequest(requestId: string, decision: "APPROVE" | "REJECT") {
    try {
      const res = await fetch("/api/admin/settings/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memproses pengajuan.");
      setMessage(data.message || "Keputusan berhasil disimpan!");
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses pengajuan.");
    }
  }

  if (loading) {
    return (
      <div className="surface-solid-dark p-6 rounded-2xl text-center text-xs text-kabut/60">
        <i className="bi bi-arrow-repeat animate-spin text-lg" aria-hidden="true" />
        <p className="mt-2">Memuat konfigurasi media sosial...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
            <i className="bi bi-share-fill text-fajar" aria-hidden="true" />
            <span>Pengelolaan Tautan Media Sosial Resmi</span>
          </h2>
          <p className="mt-1 text-xs text-kabut/70">
            {isAdmin
              ? "Kelola tautan TikTok dan Instagram resmi yang tampil pada footer dan beranda pengunjung wisata."
              : "Petugas dapat melihat tautan aktif dan mengajukan perubahan tautan resmi dengan persetujuan Admin."}
          </p>
        </div>

        <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-mono font-bold text-fajar w-fit">
          {isAdmin ? "Akses: Editor Penuh (Admin)" : "Akses: Pengajuan Izin (Petugas)"}
        </span>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200 flex items-center gap-2">
          <i className="bi bi-check-circle-fill text-emerald-400" aria-hidden="true" />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200 flex items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill text-red-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* KARTU PENGATURAN TAUTAN AKTIF (ADMIN LANGSUNG SIMPAN / PETUGAS PREVIEW) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* INSTAGRAM */}
        <div className="surface-solid-dark p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 text-lg border border-pink-500/30">
                <i className="bi bi-instagram" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-sm font-bold text-kabut">Akun Instagram Resmi</h3>
                <p className="text-[11px] text-kabut/60">Tampil di navigasi & footer</p>
              </div>
            </div>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1"
            >
              <span>Uji Buka</span>
              <i className="bi bi-box-arrow-up-right text-[10px]" aria-hidden="true" />
            </a>
          </div>

          <div>
            <label className="block text-xs font-bold text-kabut/90 mb-1">
              URL Profil Instagram
            </label>
            <input
              type="url"
              disabled={!isAdmin}
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://www.instagram.com/wisatadesacupang"
              className="w-full rounded-xl border border-white/15 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>

          {isAdmin ? (
            <button
              type="button"
              disabled={savingPlatform === "INSTAGRAM"}
              onClick={() => handleAdminSave("INSTAGRAM")}
              className="btn-ui btn-fajar w-full py-2 text-xs font-bold"
            >
              {savingPlatform === "INSTAGRAM" ? "Menyimpan..." : "Simpan Link Instagram"}
            </button>
          ) : (
            <p className="text-[11px] text-kabut/50 italic">
              * Perubahan memerlukan pengajuan izin ke Admin di bawah.
            </p>
          )}
        </div>

        {/* TIKTOK */}
        <div className="surface-solid-dark p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 text-lg border border-sky-500/30">
                <i className="bi bi-tiktok" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-sm font-bold text-kabut">Akun TikTok Resmi</h3>
                <p className="text-[11px] text-kabut/60">Tampil di navigasi & footer</p>
              </div>
            </div>
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
            >
              <span>Uji Buka</span>
              <i className="bi bi-box-arrow-up-right text-[10px]" aria-hidden="true" />
            </a>
          </div>

          <div>
            <label className="block text-xs font-bold text-kabut/90 mb-1">
              URL Profil TikTok
            </label>
            <input
              type="url"
              disabled={!isAdmin}
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@desacupang_official"
              className="w-full rounded-xl border border-white/15 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>

          {isAdmin ? (
            <button
              type="button"
              disabled={savingPlatform === "TIKTOK"}
              onClick={() => handleAdminSave("TIKTOK")}
              className="btn-ui btn-fajar w-full py-2 text-xs font-bold"
            >
              {savingPlatform === "TIKTOK" ? "Menyimpan..." : "Simpan Link TikTok"}
            </button>
          ) : (
            <p className="text-[11px] text-kabut/50 italic">
              * Perubahan memerlukan pengajuan izin ke Admin di bawah.
            </p>
          )}
        </div>
      </div>

      {/* FORM PENGAJUAN KHUSUS PETUGAS / STAFF */}
      {!isAdmin && (
        <section className="surface-solid-dark p-5 rounded-2xl border border-telaga-500/30 space-y-4">
          <h3 className="font-heading text-sm font-bold text-kabut flex items-center gap-2">
            <i className="bi bi-send-fill text-fajar" aria-hidden="true" />
            <span>Ajukan Perubahan Tautan Medsos ke Admin</span>
          </h3>

          <form onSubmit={handleStaffPropose} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-kabut/90 mb-1">Platform</label>
                <select
                  value={proposePlatform}
                  onChange={(e) => setProposePlatform(e.target.value as "TIKTOK" | "INSTAGRAM")}
                  className="w-full rounded-xl border border-white/15 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                >
                  <option value="INSTAGRAM">Instagram Resmi</option>
                  <option value="TIKTOK">TikTok Resmi</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-kabut/90 mb-1">URL Baru (Wajib https://)</label>
                <input
                  type="url"
                  required
                  value={proposeUrl}
                  onChange={(e) => setProposeUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/15 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-kabut/90 mb-1">Alasan / Catatan Pembaruan</label>
              <input
                type="text"
                value={proposeNote}
                onChange={(e) => setProposeNote(e.target.value)}
                placeholder="Contoh: Perubahan username akun baru pengelola desa"
                className="w-full rounded-xl border border-white/15 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isProposing}
              className="btn-ui btn-fajar py-2.5 px-4 text-xs font-bold"
            >
              {isProposing ? "Mengirimkan Pengajuan..." : "Kirim Pengajuan ke Admin"}
            </button>
          </form>
        </section>
      )}

      {/* DAFTAR PENGAJUAN STAFF (ADMIN DAPAT MENYETUJUI / MENOLAK) */}
      <section className="surface-solid-dark p-5 rounded-2xl border border-white/10 space-y-4">
        <h3 className="font-heading text-sm font-bold text-kabut flex items-center justify-between">
          <span className="flex items-center gap-2">
            <i className="bi bi-clock-history text-fajar" aria-hidden="true" />
            <span>Riwayat & Persetujuan Pengajuan Petugas</span>
          </span>
          <span className="text-[11px] font-mono text-kabut/50">
            {requests.length} Pengajuan
          </span>
        </h3>

        {requests.length === 0 ? (
          <p className="text-xs text-kabut/50 py-3 text-center">
            Belum ada pengajuan perubahan tautan dari petugas.
          </p>
        ) : (
          <div className="space-y-2.5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-white/10 bg-obsidian/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-fajar">
                      {req.platform}
                    </span>
                    <span className="font-bold text-kabut truncate">{req.staffName}</span>
                    <span
                      className={`rounded-full px-2 py-0.2 text-[9px] font-bold ${
                        req.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : req.status === "REJECTED"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {req.status === "APPROVED"
                        ? "Disetujui"
                        : req.status === "REJECTED"
                        ? "Ditolak"
                        : "Menunggu Persetujuan"}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-kabut/75 truncate">{req.proposedUrl}</p>
                  {req.note ? <p className="text-[11px] text-kabut/50 italic">&ldquo;{req.note}&rdquo;</p> : null}
                </div>

                {isAdmin && req.status === "PENDING" ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req.id, "APPROVE")}
                      className="btn-ui py-1.5 px-3 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req.id, "REJECT")}
                      className="btn-ui btn-glass py-1.5 px-2.5 text-[11px] font-bold text-red-300 hover:text-red-200 cursor-pointer"
                    >
                      Tolak
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
