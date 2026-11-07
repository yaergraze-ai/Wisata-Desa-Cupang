"use client";

import React, { useState, useEffect, useRef } from "react";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";

export interface ChatOtpCardProps {
  initialPhone?: string;
  initialEmail?: string;
  lockChannel?: "whatsapp" | "email";
  onSuccess: (info?: { homePath?: string }) => Promise<void> | void;
  onError: (msg: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

export function ChatOtpCard({
  initialPhone = "",
  initialEmail = "",
  lockChannel,
  onSuccess,
  onError,
  isLoading,
  setIsLoading,
}: ChatOtpCardProps) {
  const [channel, setChannel] = useState<"whatsapp" | "email">(lockChannel ?? "whatsapp");
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Handle single digit input
  function handleDigitChange(index: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  }

  async function handleSendOtp() {
    onError("");
    if (channel === "whatsapp") {
      const normalized = normalizeIndonesianWhatsapp(phone);
      if (!normalized) {
        onError("Masukkan nomor WhatsApp Indonesia yang valid (08... atau 628...).");
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/whatsapp-otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string; demoCode?: string };
        if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP WhatsApp.");

        setOtpSent(true);
        setCountdown(60);
        if (data.demoCode) setDemoCode(data.demoCode);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : "Gagal mengirim OTP.");
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
        onError("Masukkan alamat email yang valid.");
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch("/api/user/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request" }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; demoCode?: string };
        if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP Email.");

        setOtpSent(true);
        setCountdown(60);
        if (data.demoCode) setDemoCode(data.demoCode);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : "Gagal mengirim OTP Email.");
      } finally {
        setIsLoading(false);
      }
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = otpDigits.join("");
    if (fullCode.length !== 6) {
      onError("Kode OTP harus terdiri dari 6 angka.");
      return;
    }

    setIsLoading(true);
    onError("");
    try {
      let redirectTarget: { homePath?: string } | undefined;
      if (channel === "whatsapp") {
        const normalized = normalizeIndonesianWhatsapp(phone);
        const res = await fetch("/api/auth/whatsapp-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ whatsapp: normalized, code: fullCode }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; homePath?: string };
        if (!res.ok) throw new Error(data.error || "Kode OTP salah atau kedaluwarsa.");
        if (data.homePath) {
          redirectTarget = { homePath: data.homePath };
        }
      } else {
        const res = await fetch("/api/user/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", code: fullCode }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || "Kode OTP email salah atau kedaluwarsa.");
      }
      await onSuccess(redirectTarget);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Verifikasi OTP gagal.");
    } finally {
      setIsLoading(false);
    }
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Switch Channel: WhatsApp vs Email (hanya jika channel tidak dikunci) */}
      {!lockChannel && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-obsidian/80 p-1 border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setChannel("whatsapp");
              setOtpSent(false);
            }}
            className={`btn-ui py-2 rounded-lg transition-all ${
              channel === "whatsapp"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-kabut/70 hover:text-white"
            }`}
          >
            <i className="bi bi-whatsapp mr-1.5 text-sm" />
            <span>OTP WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setChannel("email");
              setOtpSent(false);
            }}
            className={`btn-ui py-2 rounded-lg transition-all ${
              channel === "email"
                ? "bg-fajar text-obsidian shadow-md font-bold"
                : "text-kabut/70 hover:text-white"
            }`}
          >
            <i className="bi bi-envelope-fill mr-1.5 text-sm" />
            <span>OTP Email</span>
          </button>
        </div>
      )}

      {!otpSent ? (
        <div className="space-y-3.5">
          {channel === "whatsapp" ? (
            <div>
              <label htmlFor="wa-input" className="block text-xs font-semibold text-kabut mb-1.5">
                Nomor WhatsApp Aktif
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                  +62
                </span>
                <input
                  id="wa-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="81234567890"
                  className="w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian pl-12 pr-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/40 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-kabut/60">
                Kode verifikasi 6 digit akan dikirim instan melalui WhatsApp resmi Desa Cupang.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="email-otp-input" className="block text-xs font-semibold text-kabut mb-1.5">
                Alamat Email Terdaftar
              </label>
              <input
                id="email-otp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-kabut/60">
                Kode keamanan 6 digit akan dikirim ke kotak masuk atau folder spam surel Anda.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={handleSendOtp}
            className={`btn-ui w-full font-bold ${
              channel === "whatsapp"
                ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:brightness-110 shadow-lg shadow-emerald-950/40"
                : "btn-fajar"
            }`}
          >
            {isLoading ? (
              <>
                <i className="bi bi-arrow-repeat animate-spin mr-1.5" />
                <span>Mengirim Kode...</span>
              </>
            ) : (
              <>
                <i className={`bi ${channel === "whatsapp" ? "bi-whatsapp" : "bi-send-fill"} mr-1.5`} />
                <span>Kirim Kode OTP {channel === "whatsapp" ? "WhatsApp" : "Email"}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* DESAIN INTERAKTIF CHAT OTP CARD */
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3 sm:p-4 backdrop-blur-md shadow-xl overflow-hidden">
            {/* Header Chat */}
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs shadow-sm">
                  <i className="bi bi-compass" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-obsidian" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-xs font-bold text-emerald-200">
                      Wisata Desa Cupang Official
                    </span>
                    <i className="bi bi-patch-check-fill text-xs text-emerald-400" title="Akun Resmi Terverifikasi" />
                  </div>
                  <span className="text-[10px] text-emerald-400/80">Online • Layanan Otentikasi Resmi</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-kabut/60">{timeStr}</span>
            </div>

            {/* Bubble Pesan WhatsApp */}
            <div className="mt-3.5 flex flex-col items-start">
              <div className="relative max-w-[90%] rounded-2xl rounded-tl-none bg-emerald-900/60 border border-emerald-500/30 p-3.5 text-xs text-emerald-100 shadow-md space-y-2">
                <p className="font-medium leading-relaxed">
                  Halo Wisatawan! 👋 Berikut adalah kode OTP verifikasi masuk akun Wisata Cirebon Anda:
                </p>

                {demoCode ? (
                  <div className="my-1.5 inline-flex items-center gap-2 rounded-xl bg-obsidian/90 border border-emerald-400/50 px-3 py-1.5">
                    <span className="font-mono text-base font-bold tracking-widest text-emerald-300">
                      {demoCode}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                      OTP DEMO
                    </span>
                  </div>
                ) : null}

                <p className="text-[11px] text-emerald-200/80">
                  ⚠️ Kode ini bersifat rahasia dan hanya berlaku selama <strong className="text-white">5 menit</strong>. Jangan bagikan kepada siapa pun demi keamanan.
                </p>

                <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-300/70 pt-1">
                  <span>{timeStr}</span>
                  <i className="bi bi-check2-all text-xs text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Form Input 6 Digit OTP */}
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-center text-kabut/90 mb-2">
                Masukkan 6 Digit Kode OTP
              </label>
              <div className="flex justify-center items-center gap-2" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border border-white/20 bg-obsidian/90 text-fajar focus:border-fajar focus:ring-2 focus:ring-fajar/30 focus:outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpDigits.join("").length !== 6}
              className="btn-ui btn-fajar w-full font-bold shadow-lg shadow-fajar/20"
            >
              {isLoading ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin mr-1.5" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-shield-check mr-1.5" />
                  <span>Verifikasi & Masuk Akun</span>
                </>
              )}
            </button>

            {/* Countdown & Kirim Ulang */}
            <div className="flex items-center justify-between text-xs pt-1 text-kabut/75">
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="hover:text-white underline underline-offset-2"
              >
                Ganti Nomor / Email
              </button>
              {countdown > 0 ? (
                <span className="font-mono text-kabut/60">
                  Kirim ulang dalam <strong className="text-fajar">{countdown}d</strong>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSendOtp}
                  className="font-bold text-fajar hover:underline"
                >
                  Kirim Ulang Kode OTP
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
