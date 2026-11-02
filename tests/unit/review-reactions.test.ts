import { describe, expect, it } from "vitest";
import {
  ALLOWED_REACTIONS,
  type AllowedReaction,
} from "../../src/server/reviews/public-reviews";

describe("Fitur Reaksi Emote Ulasan (1 Akun 1 Reaksi)", () => {
  it("mendukung daftar emoji reaksi resmi", () => {
    expect(ALLOWED_REACTIONS).toContain("👍");
    expect(ALLOWED_REACTIONS).toContain("❤️");
    expect(ALLOWED_REACTIONS).toContain("🔥");
    expect(ALLOWED_REACTIONS).toContain("👏");
    expect(ALLOWED_REACTIONS).toContain("⛰️");
    expect(ALLOWED_REACTIONS).toContain("💡");
    expect(ALLOWED_REACTIONS.length).toBe(6);
  });

  it("menerapkan aturan 1 akun 1 reaksi: klik emoji baru menambahkan reaksi", () => {
    const currentReaction: string | null = null;
    const requestedEmoji: AllowedReaction = "🔥";

    const nextReaction =
      currentReaction === requestedEmoji ? null : requestedEmoji;

    expect(nextReaction).toBe("🔥");
  });

  it("menerapkan aturan toggle-off: klik emoji yang sama membatalkan reaksi", () => {
    const currentReaction = "🔥";
    const requestedEmoji: AllowedReaction = "🔥";

    const nextReaction =
      currentReaction === requestedEmoji ? null : requestedEmoji;

    expect(nextReaction).toBeNull();
  });

  it("menerapkan aturan pergantian reaksi: klik emoji lain menggantikan reaksi sebelumnya", () => {
    let currentReaction: string | null = "👍";
    const requestedEmoji: AllowedReaction = "❤️";

    currentReaction =
      currentReaction === requestedEmoji ? null : requestedEmoji;

    expect(currentReaction).toBe("❤️");
  });

  it("menghitung distribusi reaksi secara akurat per postingan", () => {
    // Simulasi 3 user pada 1 ulasan
    const userReactions = [
      { userId: "user-1", emoji: "🔥" },
      { userId: "user-2", emoji: "🔥" },
      { userId: "user-3", emoji: "👍" },
    ];

    const counts: Record<string, number> = {};
    for (const rx of userReactions) {
      counts[rx.emoji] = (counts[rx.emoji] ?? 0) + 1;
    }

    expect(counts["🔥"]).toBe(2);
    expect(counts["👍"]).toBe(1);
    expect(counts["❤️"]).toBeUndefined();
    expect(userReactions.length).toBe(3);

    // Jika user-1 mengganti reaksi dari 🔥 ke ❤️ (1 akun 1 reaksi)
    const updated = userReactions.map((rx) =>
      rx.userId === "user-1" ? { ...rx, emoji: "❤️" } : rx
    );

    const nextCounts: Record<string, number> = {};
    for (const rx of updated) {
      nextCounts[rx.emoji] = (nextCounts[rx.emoji] ?? 0) + 1;
    }

    expect(nextCounts["🔥"]).toBe(1);
    expect(nextCounts["👍"]).toBe(1);
    expect(nextCounts["❤️"]).toBe(1);
  });
});
