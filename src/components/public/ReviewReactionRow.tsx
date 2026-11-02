"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ALLOWED_REACTIONS,
  type AllowedReaction,
  type PublicReviewReactionsDto,
} from "@/lib/reviews/reactions";

export const REACTION_BOOTSTRAP_ICONS: Record<
  AllowedReaction,
  { icon: string; label: string; color: string }
> = {
  "👍": { icon: "bi-hand-thumbs-up-fill", label: "Suka", color: "text-blue-400" },
  "❤️": { icon: "bi-heart-fill", label: "Cinta", color: "text-rose-500" },
  "🔥": { icon: "bi-fire", label: "Keren", color: "text-amber-500" },
  "👏": { icon: "bi-emoji-smile-fill", label: "Mantap", color: "text-emerald-400" },
  "⛰️": { icon: "bi-geo-alt-fill", label: "Petualang", color: "text-teal-400" },
  "💡": { icon: "bi-lightbulb-fill", label: "Bermanfaat", color: "text-yellow-400" },
};

interface ReviewReactionRowProps {
  reviewId: string;
  initialReactions?: PublicReviewReactionsDto;
  locale?: string;
  compact?: boolean;
}

export function ReviewReactionRow({
  reviewId,
  initialReactions,
  locale = "id",
  compact = false,
}: ReviewReactionRowProps) {
  const [reactions, setReactions] = useState<{
    counts: Record<string, number>;
    total: number;
    userReaction: string | null;
  }>(() => ({
    counts: initialReactions?.counts ?? {},
    total: initialReactions?.total ?? 0,
    userReaction: initialReactions?.userReaction ?? null,
  }));

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Daftar emote yang sudah punya > 0 hitungan
  const activeEmojiList = ALLOWED_REACTIONS.filter(
    (emoji) => (reactions.counts[emoji] ?? 0) > 0 || reactions.userReaction === emoji
  );

  async function handleToggleReaction(emoji: AllowedReaction) {
    if (isSubmitting) return;

    // Simpan snapshot untuk rollback jika request gagal
    const previousState = { ...reactions, counts: { ...reactions.counts } };

    // Update optimis langsung di UI
    const isSame = reactions.userReaction === emoji;
    const nextUserReaction = isSame ? null : emoji;
    const nextCounts = { ...reactions.counts };

    if (isSame) {
      // Toggle off
      nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 1) - 1);
    } else {
      // Tambah emoji baru
      nextCounts[emoji] = (nextCounts[emoji] ?? 0) + 1;
      // Kurangi emoji lama jika sebelumnya sudah pilih
      if (reactions.userReaction && nextCounts[reactions.userReaction] !== undefined) {
        const prevCount = nextCounts[reactions.userReaction] ?? 0;
        nextCounts[reactions.userReaction] = Math.max(0, prevCount - 1);
      }
    }

    const nextTotal = Object.values(nextCounts).reduce((a, b) => a + b, 0);

    setReactions({
      counts: nextCounts,
      total: nextTotal,
      userReaction: nextUserReaction,
    });
    setIsPickerOpen(false);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (res.status === 401) {
        // Unauthenticated -> kembalikan ke state semula dan munculkan prompt login
        setReactions(previousState);
        setAuthPromptOpen(true);
        return;
      }

      if (!res.ok) {
        // Error server -> kembalikan ke state semula
        setReactions(previousState);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setReactions({
          counts: data.counts ?? {},
          total: data.total ?? 0,
          userReaction: data.userReaction ?? null,
        });
      }
    } catch {
      setReactions(previousState);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative pt-2">
      {/* BARIS REAKSI & TOMBOL TAMBAH */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Chips reaksi aktif yang sudah ada */}
        {activeEmojiList.map((emoji) => {
          const count = reactions.counts[emoji] ?? 0;
          const isSelected = reactions.userReaction === emoji;
          const cfg = REACTION_BOOTSTRAP_ICONS[emoji];

          return (
            <motion.button
              key={emoji}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleToggleReaction(emoji)}
              aria-label={`Reaksi ${cfg.label} (${count})`}
              title={`${cfg.label} (${count})`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                isSelected
                  ? "bg-fajar/20 border border-fajar text-fajar"
                  : "bg-obsidian/70 border border-telaga-700/80 text-kabut hover:border-telaga-500 hover:text-fajar"
              }`}
            >
              <i className={`bi ${cfg.icon} text-xs ${cfg.color}`} aria-hidden="true" />
              <span
                className={`text-[11px] font-mono ${
                  isSelected ? "text-fajar font-bold" : "text-kabut/75"
                }`}
              >
                {count}
              </span>
            </motion.button>
          );
        })}

        {/* Tombol pemicu pemilih emote (+ Reaksi) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPickerOpen((prev) => !prev)}
            aria-label="Tambah reaksi"
            aria-expanded={isPickerOpen}
            className="inline-flex items-center gap-1 rounded-full bg-obsidian/60 border border-telaga-700/60 px-2.5 py-1 text-xs font-medium text-kabut/80 hover:text-fajar hover:border-fajar/50 transition cursor-pointer hover:bg-obsidian"
          >
            <i
              className={`bi ${
                isPickerOpen ? "bi-x-lg" : "bi-emoji-smile"
              } text-xs text-fajar`}
              aria-hidden="true"
            />
            {!compact ? (
              <span className="text-[11px]">
                {reactions.total === 0 ? "Beri Reaksi" : "+"}
              </span>
            ) : null}
          </button>

          {/* DOCK POPUP PEMILIH REAKSI BOOTSTRAP ICONS */}
          <AnimatePresence>
            {isPickerOpen ? (
              <>
                {/* Backdrop transparan untuk menutup saat klik luar */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsPickerOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 z-40 flex items-center gap-1 rounded-xl bg-obsidian/95 border border-telaga-700/80 p-1.5 shadow-xl backdrop-blur-md"
                >
                  {ALLOWED_REACTIONS.map((emoji) => {
                    const isSelected = reactions.userReaction === emoji;
                    const cfg = REACTION_BOOTSTRAP_ICONS[emoji];
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleToggleReaction(emoji)}
                        title={cfg.label}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-fajar/20 border border-fajar"
                            : "hover:bg-hutan/80"
                        }`}
                      >
                        <i className={`bi ${cfg.icon} text-sm ${cfg.color}`} aria-hidden="true" />
                      </button>
                    );
                  })}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* PROMPT MODAL / TOAST JIKA BELUM LOGIN */}
      <AnimatePresence>
        {authPromptOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-obsidian border border-fajar/40 p-2.5 text-xs text-kabut shadow-lg"
          >
            <div className="flex items-center gap-2">
              <i className="bi bi-info-circle-fill text-fajar text-sm" aria-hidden="true" />
              <span>Masuk akun untuk memberikan reaksi (1 akun, 1 reaksi).</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/${locale}/masuk`}
                className="rounded-lg bg-fajar px-2.5 py-1 text-[11px] font-bold text-obsidian hover:bg-fajar-hover transition"
              >
                Masuk
              </Link>
              <button
                type="button"
                onClick={() => setAuthPromptOpen(false)}
                className="text-kabut/60 hover:text-kabut p-1"
                aria-label="Tutup notifikasi"
              >
                <i className="bi bi-x text-sm" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
