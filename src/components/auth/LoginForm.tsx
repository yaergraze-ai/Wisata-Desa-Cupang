"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ChatOtpCard } from "@/components/auth/ChatOtpCard";

export interface LoginFormProps {
  nextPath: string | null;
  googleEnabled: boolean;
  facebookEnabled: boolean;
  whatsappEnabled: boolean;
}

export function LoginForm({
  nextPath,
  googleEnabled,
  facebookEnabled,
  whatsappEnabled,
}: LoginFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [serverError, setServerError] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t("errors.invalidEmail")),
    password: z.string().min(1, t("errors.passwordMin")),
  });

  type LoginValues = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function redirectAfterLogin(info?: { homePath?: string }) {
    const prefix = locale === "en" ? "/en" : "";
    let dest = nextPath || info?.homePath;
    if (!dest) {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const meJson = (await meRes.json()) as {
          authenticated: boolean;
          homePath?: string;
        };
        dest = meJson.homePath || "/dashboard";
      } catch {
        dest = "/dashboard";
      }
    }
    const fullDest =
      dest.startsWith("/en/") || dest === "/en" ? dest : `${prefix}${dest}`;
    window.location.assign(fullDest);
  }

  async function onSubmitEmail(values: LoginValues) {
    setServerError(null);
    const res = await authClient.signIn.email({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    });

    if (res.error) {
      const msg =
        res.error.status === 429
          ? t("errors.rateLimited")
          : t("errors.loginFailed");
      setServerError(msg);
      toast.error(msg);
      return;
    }

    // Jika akun memiliki 2FA TOTP aktif, plugin twoFactorClient menangani redirect ke /verifikasi-2fa
    const dataObj = res.data as Record<string, unknown> | null;
    if (dataObj && dataObj["twoFactorRedirect"] === true) {
      return;
    }

    await redirectAfterLogin();
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setServerError(null);
    const prefix = locale === "en" ? "/en" : "";
    const callbackURL = nextPath
      ? `${prefix}${nextPath}`
      : `${prefix}/dashboard`;
    await authClient.signIn.social({
      provider,
      callbackURL,
    });
  }

  const registerHref = nextPath
    ? `/daftar?next=${encodeURIComponent(nextPath)}`
    : "/daftar";

  return (
    <div className="space-y-5">
      {whatsappEnabled ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-obsidian/80 p-1 border border-kabut/15">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={
              activeTab === "email"
                ? "btn-ui btn-fajar"
                : "btn-ui text-kabut/85 hover:text-kabut"
            }
          >
            <i className="bi bi-envelope" aria-hidden="true" />
            <span>{t("tabEmail")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={
              activeTab === "whatsapp"
                ? "btn-ui btn-fajar"
                : "btn-ui text-kabut/85 hover:text-kabut"
            }
          >
            <i className="bi bi-whatsapp" aria-hidden="true" />
            <span>{t("tabWhatsappOtp")}</span>
          </button>
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
        >
          <i className="bi bi-exclamation-triangle-fill mr-2" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      ) : null}

      {activeTab === "email" ? (
        <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-semibold text-kabut"
            >
              {t("emailLabel")}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={t("emailHint")}
              {...register("email")}
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
            />
            {errors.email ? (
              <p className="mt-1 text-xs font-medium text-fajar">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <PasswordInput
            id="login-password"
            label={t("passwordLabel")}
            autoComplete="current-password"
            placeholder={t("passwordHint")}
            error={errors.password?.message}
            rightElement={
              <Link
                href="/lupa-kata-sandi"
                className="text-xs font-semibold text-fajar hover:underline"
              >
                {t("forgotLink")}
              </Link>
            }
            {...register("password")}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-ui btn-fajar w-full"
          >
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <span>{isSubmitting ? t("processing") : t("submitLogin")}</span>
          </button>
        </form>
      ) : (
        <ChatOtpCard
          initialPhone=""
          onSuccess={redirectAfterLogin}
          onError={(msg) => setServerError(msg || null)}
          isLoading={waLoading}
          setIsLoading={setWaLoading}
        />
      )}

      {googleEnabled || facebookEnabled ? (
        <div className="space-y-3 border-t border-kabut/15 pt-5">
          <p className="text-center text-xs text-kabut/75">
            {t("orContinueWith")}
          </p>
          <div className="grid gap-2.5">
            {googleEnabled ? (
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="btn-ui btn-glass w-full"
              >
                <i className="bi bi-google" aria-hidden="true" />
                <span>{t("continueGoogle")}</span>
              </button>
            ) : null}
            {facebookEnabled ? (
              <button
                type="button"
                onClick={() => handleOAuth("facebook")}
                className="btn-ui btn-glass w-full"
              >
                <i className="bi bi-facebook" aria-hidden="true" />
                <span>{t("continueFacebook")}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="border-t border-kabut/15 pt-4 text-center text-sm text-kabut/85">
        <span>{t("noAccountYet")}</span>{" "}
        <Link
          href={registerHref}
          className="font-bold text-fajar hover:underline"
        >
          {t("createAccountLink")}
        </Link>
      </p>
    </div>
  );
}
