"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ALLOWED_REACTIONS,
  type AllowedReaction,
  type PublicReviewReactionsDto,
} from "@/lib/reviews/reactions";

const REACTION_LABELS: Record<AllowedReaction, string> = {
  "👍": "Suka",
  "❤️": "Cinta",
  "🔥": "Keren",
  "👏": "Mantap",
  "⛰️": "Petualang",
  "💡": "Bermanfaat",
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

          return (
            <motion.button
              key={emoji}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleToggleReaction(emoji)}
              aria-label={`Reaksi ${REACTION_LABELS[emoji]} (${count})`}
              title={`${REACTION_LABELS[emoji]} (${count})`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? "bg-fajar/20 border-2 border-fajar text-fajar shadow-md scale-105"
                  : "bg-obsidian/70 border border-telaga-700/80 text-kabut hover:border-telaga-500 hover:text-fajar"
              }`}
            >
              <span className="text-sm select-none">{emoji}</span>
              <span
                className={`text-[11px] font-mono ${
                  isSelected ? "text-fajar font-extrabold" : "text-kabut/75"
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
            aria-label="Tambah reaksi emote"
            aria-expanded={isPickerOpen}
            className="inline-flex items-center gap-1 rounded-full bg-obsidian/60 border border-telaga-700/60 px-2.5 py-1 text-xs font-medium text-kabut/80 hover:text-fajar hover:border-fajar/50 transition cursor-pointer hover:bg-obsidian"
          >
            <i
              className={`bi ${
                isPickerOpen ? "bi-x" : "bi-emoji-smile"
              } text-xs text-fajar`}
              aria-hidden="true"
            />
            {!compact ? (
              <span className="text-[11px]">
                {reactions.total === 0 ? "Beri Reaksi" : "+"}
              </span>
            ) : null}
          </button>

          {/* DOCK POPUP PEMILIH REAKSI EMOTE */}
          <AnimatePresence>
            {isPickerOpen ? (
              <>
                {/* Backdrop transparan untuk menutup saat klik luar */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsPickerOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 8 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  className="absolute bottom-full left-0 mb-2 z-40 flex items-center gap-1.5 rounded-2xl bg-obsidian/95 border border-fajar/40 p-2 shadow-2xl backdrop-blur-md"
                >
                  {ALLOWED_REACTIONS.map((emoji) => {
                    const isSelected = reactions.userReaction === emoji;
                    return (
                      <motion.button
                        key={emoji}
                        type="button"
                        whileHover={{ scale: 1.3, y: -3 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleReaction(emoji)}
                        title={REACTION_LABELS[emoji]}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-fajar/25 border border-fajar shadow"
                            : "hover:bg-hutan"
                        }`}
                      >
                        <span className="select-none">{emoji}</span>
                      </motion.button>
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
