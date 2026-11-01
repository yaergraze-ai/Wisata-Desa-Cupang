"use client";

import React, { useState, forwardRef, useId } from "react";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showRequirements?: boolean;
  rightElement?: React.ReactNode;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error,
      showRequirements = false,
      rightElement,
      className,
      value,
      defaultValue,
      onChange,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [visible, setVisible] = useState(false);
    const [currentValue, setCurrentValue] = useState<string>(
      (value as string) || (defaultValue as string) || ""
    );

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setCurrentValue(e.target.value);
      if (onChange) {
        onChange(e);
      }
    }

    // Perhitungan kriteria password
    const text = typeof value === "string" ? value : currentValue;
    const hasMinLength = text.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(text);
    const hasNumber = /[0-9]/.test(text);
    const hasSymbol = /[^a-zA-Z0-9]/.test(text);

    // Hitung kekuatan kata sandi (0-100%)
    let strengthScore = 0;
    if (hasMinLength) strengthScore += 35;
    if (hasLetter) strengthScore += 25;
    if (hasNumber) strengthScore += 25;
    if (hasSymbol) strengthScore += 15;

    const strengthLabel =
      text.length === 0
        ? ""
        : strengthScore < 50
        ? "Lemah"
        : strengthScore < 85
        ? "Sedang"
        : "Kuat & Aman";

    const strengthColor =
      strengthScore < 50
        ? "bg-red-500"
        : strengthScore < 85
        ? "bg-amber-400"
        : "bg-emerald-400";

    return (
      <div className="space-y-1.5 w-full">
        {label || rightElement ? (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <label
                htmlFor={inputId}
                className="block text-sm font-semibold text-kabut"
              >
                {label}
              </label>
            ) : null}
            {rightElement}
          </div>
        ) : null}

        <div className="relative">
          <input
            {...props}
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            className={`w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian pl-3.5 pr-11 py-2.5 text-sm text-kabut placeholder:text-kabut/45 focus:border-fajar focus:outline-none focus:ring-1 focus:ring-fajar/40 transition-colors ${
              error ? "border-red-500/80 focus:border-red-500" : ""
            } ${className || ""}`}
          />

          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            title={visible ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-kabut/60 hover:text-fajar hover:bg-white/10 active:scale-95 transition-all"
          >
            <i
              className={`bi ${visible ? "bi-eye-slash-fill" : "bi-eye-fill"} text-base`}
              aria-hidden="true"
            />
          </button>
        </div>

        {error ? (
          <p className="mt-1 text-xs font-medium text-fajar">{error}</p>
        ) : null}

        {showRequirements ? (
          <div className="mt-2.5 space-y-2 rounded-xl bg-obsidian/60 border border-white/10 p-3 text-xs">
            {/* Strength Meter Bar */}
            {text.length > 0 ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-kabut/60">Kekuatan Kata Sandi:</span>
                  <span
                    className={`font-bold ${
                      strengthScore < 50
                        ? "text-red-400"
                        : strengthScore < 85
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: `${strengthScore}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Syarat Kata Sandi */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-kabut/60">
              Ketentuan Kata Sandi (Wajib):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  hasMinLength
                    ? "text-emerald-400 font-semibold"
                    : "text-kabut/60"
                }`}
              >
                <i
                  className={`bi ${
                    hasMinLength
                      ? "bi-check-circle-fill text-emerald-400"
                      : "bi-circle text-kabut/40"
                  } text-xs`}
                  aria-hidden="true"
                />
                <span>Minimal 8 karakter</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  hasLetter
                    ? "text-emerald-400 font-semibold"
                    : "text-kabut/60"
                }`}
              >
                <i
                  className={`bi ${
                    hasLetter
                      ? "bi-check-circle-fill text-emerald-400"
                      : "bi-circle text-kabut/40"
                  } text-xs`}
                  aria-hidden="true"
                />
                <span>Mengandung huruf (A-Z, a-z)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  hasNumber
                    ? "text-emerald-400 font-semibold"
                    : "text-kabut/60"
                }`}
              >
                <i
                  className={`bi ${
                    hasNumber
                      ? "bi-check-circle-fill text-emerald-400"
                      : "bi-circle text-kabut/40"
                  } text-xs`}
                  aria-hidden="true"
                />
                <span>Mengandung angka (0-9)</span>
              </div>

              <div
                className={`flex items-center gap-1.5 transition-colors ${
                  hasSymbol
                    ? "text-emerald-400 font-semibold"
                    : "text-kabut/50"
                }`}
              >
                <i
                  className={`bi ${
                    hasSymbol
                      ? "bi-check-circle-fill text-emerald-400"
                      : "bi-info-circle text-kabut/30"
                  } text-xs`}
                  aria-hidden="true"
                />
                <span>Simbol (@, #, $, dll - bonus)</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
