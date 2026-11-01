"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface TotpStepUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TotpStepUpModal({
  isOpen,
  onClose,
  onSuccess,
}: TotpStepUpModalProps) {
  const t = useTranslations("SuperAdminDashboard");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Kode TOTP harus terdiri dari 6 digit angka.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { message?: string };
        throw new Error(errJson.message || "Kode autentikasi salah atau kadaluarsa.");
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi kode.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fajar/20 border border-fajar/40 text-fajar">
            <i className="bi bi-shield-lock text-2xl" aria-hidden="true" />
          </div>
          <h3 className="font-heading text-lg font-bold text-kabut">
            {t("totpStepUpTitle")}
          </h3>
          <p className="text-xs text-kabut/70">
            {t("totpStepUpDesc")}
          </p>
        </div>

        {error ? (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-700/60 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-kabut mb-1.5 text-center">
              {t("totpCodeLabel")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center tracking-widest font-mono text-xl rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2.5 text-fajar focus:ring-2 focus:ring-fajar"
              autoFocus
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
            >
              {t("cancelTotpModalBtn")}
            </button>
            <button
              type="submit"
              disabled={isVerifying || code.trim().length !== 6}
              className="w-1/2 btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {isVerifying ? t("verifyingTotpBtn") : t("verifyTotpBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
