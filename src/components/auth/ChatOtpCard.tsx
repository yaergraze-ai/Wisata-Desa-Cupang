"use client";

import { useState, useEffect, useRef } from "react";

export type OtpChannel = "whatsapp" | "email";

interface ChatOtpCardProps {
  onSuccess: (redirectTarget?: { homePath?: string }) => void | Promise<void>;
  onError: (msg: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  initialPhone?: string;
  initialEmail?: string;
  lockChannel?: OtpChannel;
}

export function ChatOtpCard({
  onSuccess,
  onError,
  isLoading,
  setIsLoading,
  initialPhone = "",
  initialEmail = "",
  lockChannel,
}: ChatOtpCardProps) {
  const [channel, setChannel] = useState<OtpChannel>(lockChannel ?? "whatsapp");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);

  const [otpSent, setOtpSent] = useState(false);
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [isGoogleRecorded, setIsGoogleRecorded] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0")) return "62" + digits.slice(1);
    if (digits.startsWith("8")) return "62" + digits;
    return digits;
  };

  const resetOtpFlow = (nextChannel: OtpChannel) => {
    setChannel(nextChannel);
    setOtpSent(false);
    setReceivedOtp(null);
    setEmailDelivered(false);
    setIsGoogleRecorded(false);
    setOtpCode(["", "", "", "", "", ""]);
    onError(null);
  };

  const handleSendOtp = async () => {
    onError(null);

    if (channel === "whatsapp") {
      const formatted = formatPhone(phoneNumber);
      if (formatted.length < 10) {
        onError("Masukkan nomor WhatsApp yang valid (minimal 10 digit).");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/whatsapp-otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formatted,
            purpose: "LOGIN",
            locale: "id",
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          demoCode?: string;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Gagal meminta kode OTP WhatsApp.");
        }

        setOtpSent(true);
        setCountdown(60);
        setIsTyping(true);

        if (data.demoCode) {
          setTimeout(() => {
            setIsTyping(false);
            setReceivedOtp(data.demoCode!);
          }, 650);
        } else {
          setIsTyping(false);
        }
      } catch (err: unknown) {
        onError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengirim OTP."
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes("@")) {
        onError("Masukkan alamat email aktif yang valid.");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/user/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            email: cleanEmail,
            locale: "id",
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          demoCode?: string;
          delivered?: boolean;
          isGoogleRecorded?: boolean;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Gagal mengirim OTP ke alamat email.");
        }

        setOtpSent(true);
        setCountdown(60);
        setEmailDelivered(Boolean(data.delivered));
        setIsGoogleRecorded(Boolean(data.isGoogleRecorded));
        setIsTyping(true);

        if (data.demoCode) {
          setTimeout(() => {
            setIsTyping(false);
            setReceivedOtp(data.demoCode!);
          }, 550);
        } else {
          setIsTyping(false);
        }
      } catch (err: unknown) {
        onError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengirim OTP Email."
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    const fullCode = otpCode.join("");
    if (fullCode.length !== 6) {
      onError("Masukkan 6 digit kode OTP secara lengkap.");
      return;
    }

    onError(null);
    setIsLoading(true);

    try {
      if (channel === "whatsapp") {
        const formatted = formatPhone(phoneNumber);
        const res = await fetch("/api/auth/whatsapp-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formatted,
            code: fullCode,
            locale: "id",
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          homePath?: string;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Kode OTP tidak sah atau kedaluwarsa.");
        }

        await onSuccess({ homePath: data.homePath });
      } else {
        const cleanEmail = email.trim().toLowerCase();
        const res = await fetch("/api/user/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            email: cleanEmail,
            code: fullCode,
            locale: "id",
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          homePath?: string;
          error?: string;
        };

        if (!res.ok || !data.ok) {
          throw new Error(
            data.error || "Kode OTP Email tidak sah atau kedaluwarsa."
          );
        }

        await onSuccess({ homePath: data.homePath });
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Gagal memverifikasi OTP.");
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otpCode];
    nextOtp[index] = digit;
    setOtpCode(nextOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFill = () => {
    if (!receivedOtp) return;
    const digits = receivedOtp.split("").slice(0, 6);
    setOtpCode(digits);
    onError(null);
  };

  const isEmailChannel = channel === "email";

  return (
    <div className="space-y-4">
      {/* Pilihan Saluran OTP (WhatsApp vs Email) */}
      {!lockChannel && (
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-obsidian/90 p-1.5 border border-white/10">
          <button
            type="button"
            onClick={() => resetOtpFlow("whatsapp")}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              channel === "whatsapp"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                : "text-kabut/65 hover:text-kabut hover:bg-white/5"
            }`}
          >
            <i className="bi bi-whatsapp text-sm" aria-hidden="true" />
            <span>OTP WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => resetOtpFlow("email")}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              channel === "email"
                ? "bg-fajar text-obsidian shadow-md shadow-fajar/25"
                : "text-kabut/65 hover:text-kabut hover:bg-white/5"
            }`}
          >
            <i className="bi bi-envelope-check-fill text-sm" aria-hidden="true" />
            <span>OTP Email</span>
          </button>
        </div>
      )}

      {/* Header Panel Verifikasi sesuai Saluran */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-t-2xl border backdrop-blur-md ${
          isEmailChannel
            ? "bg-fajar/15 border-fajar/30"
            : "bg-emerald-950/80 border-emerald-500/30"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg ${
                isEmailChannel
                  ? "bg-gradient-to-br from-fajar to-amber-600 text-obsidian shadow-fajar/20"
                  : "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/20"
              }`}
            >
              <i
                className={`bi ${
                  isEmailChannel ? "bi-envelope-paper-fill" : "bi-whatsapp"
                } text-xl`}
                aria-hidden="true"
              />
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-obsidian" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-kabut">
                {isEmailChannel
                  ? "Verifikasi OTP Email Resmi"
                  : "Wisata Desa Cupang Bot"}
              </span>
              <i
                className={`bi bi-patch-check-fill text-xs ${
                  isEmailChannel ? "text-fajar" : "text-emerald-400"
                }`}
                title="Layanan Terverifikasi"
                aria-hidden="true"
              />
            </div>
            <p
              className={`text-[11px] font-medium ${
                isEmailChannel ? "text-fajar/90" : "text-emerald-300/80"
              }`}
            >
              {isEmailChannel
                ? "Sinkron Otomatis Akun Google & Kotak Masuk"
                : "Layanan Verifikasi Resmi • Online"}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-mono px-2.5 py-1 rounded-full border ${
            isEmailChannel
              ? "bg-fajar/15 text-fajar border-fajar/30"
              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          }`}
        >
          {isEmailChannel ? "SMTP & OAuth" : "Live Chat"}
        </span>
      </div>

      {/* Area Pesan & Kode Verifikasi */}
      <div className="relative rounded-b-2xl bg-obsidian/90 border-x border-b border-white/10 p-4 space-y-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#f2a65a 1px, #05070e 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0, 12px 12px",
          }}
        />

        <div className="relative z-10 space-y-3 min-h-[120px] flex flex-col justify-end">
          {!otpSent && !isTyping && (
            <div className="text-center py-4 space-y-1.5">
              <p className="text-xs text-kabut/70 font-medium">
                {isEmailChannel
                  ? "Masukkan alamat email Anda (termasuk email Google yang sudah pernah masuk) untuk menerima kode 6 digit."
                  : "Masukkan nomor WhatsApp aktif Anda dan klik kirim untuk menerima kode OTP."}
              </p>
            </div>
          )}

          {isTyping && (
            <div className="flex items-start gap-2.5 animate-fade-in">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-1 ${
                  isEmailChannel
                    ? "bg-fajar/20 border border-fajar/40 text-fajar"
                    : "bg-emerald-600/30 border border-emerald-500/40 text-emerald-300"
                }`}
              >
                <i
                  className={`bi ${
                    isEmailChannel ? "bi-envelope-fill" : "bi-robot"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="bg-hutan/90 border border-white/10 rounded-2xl rounded-tl-xs px-4 py-3 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-fajar animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-fajar animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-fajar animate-bounce" />
                <span className="text-xs text-kabut/70 ml-1.5">
                  {isEmailChannel
                    ? "Mengirim kode ke email & menyiapkan verifikasi..."
                    : "Menyiapkan kode verifikasi..."}
                </span>
              </div>
            </div>
          )}

          {otpSent && !isTyping && (
            <div className="flex items-start gap-2.5 animate-fade-in">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-1 ${
                  isEmailChannel
                    ? "bg-fajar/20 border border-fajar/40 text-fajar"
                    : "bg-emerald-600/30 border border-emerald-500/40 text-emerald-300"
                }`}
              >
                <i
                  className={`bi ${
                    isEmailChannel ? "bi-envelope-check-fill" : "bi-robot"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="bg-gradient-to-br from-hutan/95 to-obsidian/95 border border-white/15 rounded-2xl rounded-tl-xs p-3.5 max-w-[92%] shadow-xl space-y-2.5">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5">
                  <span
                    className={`text-[11px] font-bold flex items-center gap-1.5 ${
                      isEmailChannel ? "text-fajar" : "text-emerald-400"
                    }`}
                  >
                    <i
                      className={`bi ${
                        isEmailChannel
                          ? "bi-shield-fill-check"
                          : "bi-whatsapp"
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {isEmailChannel
                        ? isGoogleRecorded
                          ? "Email Google Terdaftar Terdeteksi"
                          : "Pesan Resmi Portal Wisata"
                        : "Pesan Resmi Wisata Cirebon"}
                    </span>
                  </span>
                  <span className="text-[10px] text-kabut/50 font-mono">
                    Baru saja
                  </span>
                </div>

                <p className="text-xs text-kabut/90 leading-relaxed">
                  {isEmailChannel ? (
                    <>
                      Kode OTP untuk{" "}
                      <strong className="text-fajar">{email.trim()}</strong>{" "}
                      {emailDelivered
                        ? "telah dikirim ke kotak masuk email Anda dan ditampilkan di bawah ini untuk kemudahan akses:"
                        : "siap digunakan untuk masuk ke akun resmi Anda:"}
                    </>
                  ) : (
                    <>
                      Berikut adalah kode verifikasi masuk Anda untuk portal
                      resmi{" "}
                      <strong className="text-emerald-300">
                        Wisata Batu Lawang &amp; Gunung Bendera
                      </strong>
                      :
                    </>
                  )}
                </p>

                {receivedOtp ? (
                  <div className="flex items-center justify-between bg-obsidian/90 border border-white/15 rounded-xl px-3.5 py-2.5">
                    <span className="font-mono text-lg font-extrabold tracking-[0.25em] text-fajar select-all">
                      {receivedOtp}
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoFill}
                      className="btn-ui text-xs font-bold bg-fajar/20 hover:bg-fajar/30 text-fajar border border-fajar/40 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer min-h-0"
                    >
                      <i
                        className="bi bi-magic"
                        aria-hidden="true"
                      />
                      <span>Isi Otomatis</span>
                    </button>
                  </div>
                ) : null}

                <p className="text-[11px] text-kabut/60 flex items-center gap-1.5">
                  <i
                    className="bi bi-clock-history text-fajar"
                    aria-hidden="true"
                  />
                  <span>
                    Berlaku 5 menit. Jangan berikan kode ini kepada siapa pun.
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Step 1: Input Nomor WhatsApp atau Email */}
        <div className="relative z-10 pt-2 border-t border-white/10 space-y-3">
          {channel === "whatsapp" ? (
            <div>
              <label
                htmlFor="otp-wa-input"
                className="block text-xs font-semibold text-kabut/85 mb-1.5"
              >
                Nomor WhatsApp Aktif
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-kabut/55 text-xs font-mono">
                    +62
                  </span>
                  <input
                    id="otp-wa-input"
                    type="tel"
                    inputMode="numeric"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isLoading}
                    placeholder="81234567890"
                    className="w-full rounded-xl border border-white/15 bg-hutan/85 pl-11 pr-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/35 focus:border-emerald-400 focus:outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading || countdown > 0 || !phoneNumber.trim()}
                  className="btn-ui px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <i className="bi bi-send-fill" aria-hidden="true" />
                  <span>
                    {countdown > 0
                      ? `Ulang (${countdown}d)`
                      : otpSent
                      ? "Kirim Ulang"
                      : "Kirim Kode OTP"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="otp-email-input"
                className="block text-xs font-semibold text-kabut/85 mb-1.5"
              >
                Alamat Email Resmi / Email Google Anda
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-fajar text-xs">
                    <i className="bi bi-envelope-at-fill" aria-hidden="true" />
                  </span>
                  <input
                    id="otp-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading || Boolean(lockChannel && initialEmail)}
                    placeholder="nama@gmail.com"
                    className="w-full rounded-xl border border-white/15 bg-hutan/85 pl-10 pr-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/35 focus:border-fajar focus:outline-none transition disabled:opacity-75"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading || countdown > 0 || !email.trim()}
                  className="btn-ui btn-fajar px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                >
                  <i className="bi bi-send-check-fill" aria-hidden="true" />
                  <span>
                    {countdown > 0
                      ? `Ulang (${countdown}d)`
                      : otpSent
                      ? "Kirim Ulang"
                      : "Kirim OTP Email"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 6-Box OTP Input (Selalu tampil begitu OTP terkirim) */}
          {(otpSent || Boolean(receivedOtp)) && !isTyping && (
            <div className="space-y-4 pt-2 border-t border-white/10 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-kabut/90">
                  Masukkan 6 Digit Kode Verifikasi
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    isEmailChannel ? "text-fajar" : "text-emerald-400"
                  }`}
                >
                  {otpCode.filter(Boolean).length}/6 digit
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit OTP ${idx + 1}`}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-full h-12 text-center font-mono text-lg font-extrabold rounded-xl border border-white/20 bg-hutan/90 text-fajar focus:border-fajar focus:ring-2 focus:ring-fajar/30 focus:outline-none transition"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isLoading || otpCode.join("").length !== 6}
                className="btn-ui btn-fajar w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    <span>Memverifikasi Kode...</span>
                  </>
                ) : (
                  <>
                    <i
                      className="bi bi-shield-check text-base"
                      aria-hidden="true"
                    />
                    <span>
                      {lockChannel
                        ? "Konfirmasi & Verifikasi Sekarang"
                        : "Verifikasi & Masuk Sekarang"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
