"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({
  smtpEnabled,
  managerWaDigits,
}: {
  smtpEnabled: boolean;
  managerWaDigits: string;
}) {
  const t = useTranslations("Auth");
  const tFooter = useTranslations("Footer");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().trim().email(t("errors.invalidEmail")),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    setServerError(null);
    const prefix = locale === "en" ? "/en" : "";
    const res = await authClient.requestPasswordReset({
      email: values.email.toLowerCase(),
      redirectTo: `${window.location.origin}${prefix}/reset-kata-sandi`,
    });
    if (res.error) {
      setServerError(
        res.error.status === 429
          ? t("errors.rateLimited")
          : t("errors.invalidEmail")
      );
      return;
    }
    setSent(true);
  }

  if (!smtpEnabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-fajar/40 bg-obsidian/80 p-4 text-sm text-kabut/90">
          <p>{t("forgotSmtpInactiveNotice")}</p>
        </div>
        <a
          href={`https://wa.me/${managerWaDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ui btn-telaga w-full"
        >
          <i className="bi bi-whatsapp" aria-hidden="true" />
          <span>{tFooter("whatsappManager")}</span>
        </a>
        <p className="text-center text-sm">
          <Link href="/masuk" className="font-semibold text-fajar hover:underline">
            {t("signInLink")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sent ? (
        <div className="rounded-xl border border-telaga bg-obsidian/80 p-4 text-sm text-kabut">
          <i className="bi bi-check-circle-fill mr-2 text-fajar" aria-hidden="true" />
          <span>{t("forgotSentSuccess")}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
            >
              {serverError}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="forgot-email"
              className="block text-sm font-semibold text-kabut"
            >
              {t("emailLabel")}
            </label>
            <input
              id="forgot-email"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-ui btn-fajar w-full"
          >
            <i className="bi bi-send" aria-hidden="true" />
            <span>{isSubmitting ? t("processing") : t("submitForgot")}</span>
          </button>
        </form>
      )}

      <p className="border-t border-kabut/15 pt-4 text-center text-sm text-kabut/85">
        <Link href="/masuk" className="font-bold text-fajar hover:underline">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
