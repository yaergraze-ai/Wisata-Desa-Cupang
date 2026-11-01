"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function GoogleFirstTimeSetupModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    let ignore = false;
    async function checkStatus() {
      try {
        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("dismissed_first_time_password_setup") === "1"
        ) {
          return;
        }
        const res = await fetch("/api/auth/profile-status");
        if (!res.ok) return;
        const data = (await res.json()) as {
          authenticated: boolean;
          needsInitialPasswordSetup?: boolean;
          user?: { name: string };
        };
        if (!ignore && data.authenticated && data.needsInitialPasswordSetup) {
          setUsername(data.user?.name || "");
          setIsOpen(true);
        }
      } catch {
        // Abaikan jika offline
      }
    }
    checkStatus();
    return () => {
      ignore = true;
    };
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("dismissed_first_time_password_setup", "1");
    }
    setIsOpen(false);
  }

  if (!isOpen || !mounted || typeof document === "undefined" || !document.body) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 2) {
      setError("Nama / username minimal 2 karakter.");
      return;
    }

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Kata sandi wajib mengandung kombinasi huruf dan angka.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan kata sandi.");
      }

      toast.success(
        data.message || "Kata sandi dan username berhasil disimpan!"
      );
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-[#0d1527] to-[#05070e] border border-fajar/40 p-5 sm:p-7 shadow-2xl text-kabut space-y-5">
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fajar/20 border border-fajar/40 text-fajar text-xl shadow-inner">
              <i className="bi bi-shield-lock-fill" />
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-fajar bg-fajar/10 px-2 py-0.5 rounded-full border border-fajar/30">
                Login Google Terdeteksi
              </span>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-kabut mt-1">
                Atur Username & Kata Sandi
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-kabut/60 hover:text-white hover:bg-white/10"
            title="Tutup (atur nanti)"
          >
            <i className="bi bi-x-lg text-base" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-kabut/80 leading-relaxed">
          Selamat datang! Anda masuk menggunakan Google. Agar selanjutnya Anda dapat <strong className="text-fajar font-semibold">masuk langsung menggunakan Email & Kata Sandi</strong> tanpa perlu login Google atau OTP, silakan tetapkan username dan kata sandi Anda.
        </p>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200 flex items-center gap-2"
          >
            <i className="bi bi-exclamation-octagon-fill text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="setup-username" className="block text-xs font-bold text-kabut mb-1.5">
              Nama Lengkap / Username
            </label>
            <input
              id="setup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username atau nama Anda"
              required
              className="w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
            />
          </div>

          {/* New Password */}
          <PasswordInput
            id="setup-password"
            label="Kata Sandi Baru"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 8 karakter (huruf & angka)"
            showRequirements={true}
            required
          />

          {/* Confirm Password */}
          <PasswordInput
            id="setup-confirm-password"
            label="Konfirmasi Kata Sandi"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi kata sandi di atas"
            required
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleDismiss}
              className="btn-ui rounded-xl bg-obsidian border border-kabut/30 px-4 py-2.5 text-xs font-semibold text-kabut hover:text-white"
            >
              Nanti Saja
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-ui btn-fajar rounded-xl px-5 py-2.5 text-xs font-bold shadow-lg shadow-fajar/20"
            >
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin mr-1.5" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle mr-1.5 text-sm" />
                  <span>Simpan & Amankan Akun</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
