"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";

export interface GoogleFirstTimeSetupModalProps {
  initialNeedsSetup?: boolean;
  initialUsername?: string;
}

export function GoogleFirstTimeSetupModal({
  initialNeedsSetup,
  initialUsername = "",
}: GoogleFirstTimeSetupModalProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [fetchedSetup, setFetchedSetup] = useState<{
    needsSetup: boolean;
    username: string;
  } | null>(null);

  const [usernameOverride, setUsernameOverride] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Hanya jalankan pengecekan jaringan bila prop SSR initialNeedsSetup belum diberikan
  useEffect(() => {
    if (initialNeedsSetup !== undefined) {
      return;
    }

    let cancelled = false;
    async function checkStatus() {
      try {
        const res = await fetch("/api/auth/profile-status", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          needsSetup?: boolean;
          user?: { name?: string };
        };
        if (!cancelled && data.authenticated) {
          setFetchedSetup({
            needsSetup: Boolean(data.needsSetup),
            username: data.user?.name ?? "",
          });
        }
      } catch {
        // Abaikan jika gagal memuat status jaringan
      }
    }

    void checkStatus();
    return () => {
      cancelled = true;
    };
  }, [initialNeedsSetup]);

  const shouldOpen =
    !dismissed &&
    (initialNeedsSetup !== undefined
      ? initialNeedsSetup
      : Boolean(fetchedSetup?.needsSetup));

  const username =
    usernameOverride !== null
      ? usernameOverride
      : initialUsername || fetchedSetup?.username || "";

  if (!shouldOpen) return null;

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordStrong =
    hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canSubmit =
    username.trim().length >= 2 &&
    isPasswordStrong &&
    passwordsMatch &&
    !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/setup-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal menyimpan pengaturan akun.");
      }

      setSuccess(true);
      setTimeout(() => {
        setDismissed(true);
        router.refresh();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-credentials-heading"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-obsidian/88 backdrop-blur-xl p-4 animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-fajar/35 bg-gradient-to-b from-hutan/98 to-obsidian p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.85)] space-y-5">
        {/* Lencana Atas */}
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-fajar to-amber-600 flex items-center justify-center text-obsidian shadow-lg shadow-fajar/25 shrink-0">
            <i className="bi bi-shield-lock-fill text-2xl" aria-hidden="true" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <i className="bi bi-google text-[10px]" aria-hidden="true" />
              <span>Email Google Terverifikasi</span>
            </span>
            <h2
              id="setup-credentials-heading"
              className="text-lg sm:text-xl font-bold text-kabut font-heading mt-1"
            >
              Atur Username &amp; Kata Sandi
            </h2>
          </div>
        </div>

        <p className="text-xs text-kabut/80 leading-relaxed">
          Selamat datang di portal resmi{" "}
          <strong className="text-fajar">Wisata Cirebon</strong>! Email Google
          Anda telah tercatat otomatis. Lengkapi nama pengguna dan kata sandi
          agar Anda juga dapat masuk kapan saja menggunakan email atau OTP.
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-xs text-red-100 flex items-center gap-2"
          >
            <i
              className="bi bi-exclamation-triangle-fill text-red-400 shrink-0"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 p-6 text-center space-y-2 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto text-2xl">
              <i className="bi bi-check-lg" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-emerald-300">
              Kredensial Akun Tersimpan!
            </h3>
            <p className="text-xs text-kabut/75">
              Username dan kata sandi Anda telah diaktifkan untuk akun ini.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="setup-username"
                className="block text-xs font-semibold text-kabut/90 mb-1.5"
              >
                Username / Nama Lengkap Wisatawan
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-kabut/50">
                  <i className="bi bi-person-badge" aria-hidden="true" />
                </span>
                <input
                  id="setup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsernameOverride(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                  minLength={2}
                  className="w-full rounded-xl border border-kabut/20 bg-obsidian/90 pl-10 pr-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/35 focus:border-fajar focus:outline-none transition"
                />
              </div>
            </div>

            <PasswordInput
              id="setup-password"
              label="Buat Kata Sandi Akun"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter kombinasi"
              showRequirements={true}
            />

            <div>
              <PasswordInput
                id="setup-confirm-password"
                label="Ulangi Kata Sandi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi"
                error={
                  confirmPassword.length > 0 && !passwordsMatch
                    ? "Konfirmasi kata sandi belum cocok."
                    : undefined
                }
              />
              {passwordsMatch && (
                <p className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Kata sandi cocok</span>
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-ui btn-fajar w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    <span>Menyimpan Kredensial...</span>
                  </>
                ) : (
                  <>
                    <i
                      className="bi bi-check2-circle text-base"
                      aria-hidden="true"
                    />
                    <span>Simpan Username &amp; Kata Sandi</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="btn-ui btn-glass w-full py-2 text-xs text-kabut/75 hover:text-kabut"
              >
                <span>Atur Nanti di Menu Profil</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
