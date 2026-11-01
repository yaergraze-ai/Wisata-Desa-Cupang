"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export interface TwoFactorClientProps {
  mode: "setup" | "verify";
  isMandatoryAdmin: boolean;
  nextPath: string | null;
}

function extractSecretFromTotpUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    return parsed.searchParams.get("secret") || "";
  } catch {
    return "";
  }
}

export function TwoFactorClient({
  mode,
  isMandatoryAdmin,
  nextPath,
}: TwoFactorClientProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [backupInput, setBackupInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function finishRedirect() {
    const prefix = locale === "en" ? "/en" : "";
    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    const meJson = (await meRes.json()) as {
      authenticated: boolean;
      homePath?: string;
    };
    const dest = nextPath || meJson.homePath || "/dashboard";
    const fullDest =
      dest.startsWith("/en/") || dest === "/en" ? dest : `${prefix}${dest}`;
    window.location.assign(fullDest);
  }

  async function handleEnableSetup(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!password) {
      setErrorMsg(t("errors.passwordMin"));
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.twoFactor.enable({
        password,
        method: "totp",
      });
      if (res.error || !res.data || !("totpURI" in res.data)) {
        setErrorMsg(t("errors.loginFailed"));
        return;
      }

      const dataUrl = await QRCode.toDataURL(res.data.totpURI, {
        width: 240,
        margin: 2,
        color: {
          dark: "#08110E",
          light: "#FFFFFF",
        },
      });
      setQrDataUrl(dataUrl);
      setManualSecret(extractSecretFromTotpUri(res.data.totpURI));
      setBackupCodes(res.data.backupCodes ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (useBackup) {
        const res = await authClient.twoFactor.verifyBackupCode({
          code: backupInput.trim(),
        });
        if (res.error) {
          setErrorMsg(t("errors.invalidTotp"));
          return;
        }
      } else {
        if (!/^\d{6}$/.test(totpCode.trim())) {
          setErrorMsg(t("errors.invalidTotp"));
          return;
        }
        const res = await authClient.twoFactor.verifyTotp({
          code: totpCode.trim(),
        });
        if (res.error) {
          setErrorMsg(t("errors.invalidTotp"));
          toast.error(t("errors.invalidTotp"));
          return;
        }
      }

      await finishRedirect();
    } finally {
      setLoading(false);
    }
  }

  if (mode === "setup" && !qrDataUrl) {
    return (
      <form onSubmit={handleEnableSetup} className="space-y-4">
        {isMandatoryAdmin ? (
          <div className="rounded-xl border border-fajar/45 bg-obsidian/80 p-3.5 text-xs text-fajar font-semibold">
            <i className="bi bi-shield-lock-fill mr-2" aria-hidden="true" />
            <span>{t("twoFactorSetupMandatory")}</span>
          </div>
        ) : null}

        {errorMsg ? (
          <div
            role="alert"
            className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
          >
            {errorMsg}
          </div>
        ) : null}

        <p className="text-sm text-kabut/85">{t("twoFactorSetupStep1")}</p>

        <div>
          <label
            htmlFor="tf-password"
            className="block text-sm font-semibold text-kabut"
          >
            {t("passwordLabel")}
          </label>
          <input
            id="tf-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordHint")}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-ui btn-fajar w-full"
        >
          <i className="bi bi-qr-code" aria-hidden="true" />
          <span>{loading ? t("processing") : t("twoFactorGenerateBtn")}</span>
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {qrDataUrl ? (
        <div className="space-y-4">
          <p className="text-sm text-kabut/90">{t("twoFactorScanInstruction")}</p>
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 text-hutan">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={t("twoFactorManualSecret")}
              width={220}
              height={220}
              className="rounded-lg"
            />
            {manualSecret ? (
              <div className="text-center">
                <p className="text-xs font-semibold text-batu-700">
                  {t("twoFactorManualSecret")}
                </p>
                <code className="mt-0.5 block rounded bg-kabut px-2.5 py-1 font-mono text-xs font-bold text-hutan select-all">
                  {manualSecret}
                </code>
              </div>
            ) : null}
          </div>

          {backupCodes.length > 0 ? (
            <div className="rounded-xl border border-fajar/40 bg-obsidian/85 p-4">
              <p className="text-xs font-bold text-fajar">
                <i className="bi bi-key-fill mr-1.5" aria-hidden="true" />
                <span>{t("twoFactorBackupCodesTitle")}</span>
              </p>
              <p className="mt-1 text-xs text-kabut/80">
                {t("twoFactorBackupCodesDesc")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-kabut">
                {backupCodes.map((bc) => (
                  <span
                    key={bc}
                    className="rounded-md border border-kabut/15 bg-hutan/60 px-2.5 py-1 text-center select-all"
                  >
                    {bc}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
        >
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleVerifyTotp} className="space-y-4">
        {!useBackup ? (
          <div>
            <label
              htmlFor="tf-totp-code"
              className="block text-sm font-semibold text-kabut"
            >
              {t("otpCodeLabel")}
            </label>
            <input
              id="tf-totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder={t("otpCodeHint")}
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-kabut/25 bg-obsidian px-4 py-2.5 text-center font-mono text-xl tracking-widest text-kabut"
            />
          </div>
        ) : (
          <div>
            <label
              htmlFor="tf-backup-code"
              className="block text-sm font-semibold text-kabut"
            >
              {t("backupCodeLabel")}
            </label>
            <input
              id="tf-backup-code"
              type="text"
              value={backupInput}
              onChange={(e) => setBackupInput(e.target.value)}
              placeholder={t("backupCodeHint")}
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-kabut/25 bg-obsidian px-4 py-2.5 text-center font-mono text-base text-kabut"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-ui btn-fajar w-full"
        >
          <i className="bi bi-shield-check" aria-hidden="true" />
          <span>{loading ? t("processing") : t("twoFactorVerifyBtn")}</span>
        </button>

        {mode === "verify" ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setUseBackup((prev) => !prev)}
              className="text-xs font-semibold text-fajar hover:underline cursor-pointer"
            >
              {useBackup
                ? t("twoFactorUseTotpToggle")
                : t("twoFactorUseBackupToggle")}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
