"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function RegisterForm({ nextPath }: { nextPath: string | null }) {
  const t = useTranslations("Auth");
  const tFooter = useTranslations("Footer");
  const locale = useLocale();
  const [serverError, setServerError] = useState<string | null>(null);

  const registerSchema = z
    .object({
      name: z.string().trim().min(2, t("errors.nameMin")).max(100),
      email: z.string().trim().email(t("errors.invalidEmail")),
      whatsapp: z
        .string()
        .trim()
        .refine(
          (val) => Boolean(normalizeIndonesianWhatsapp(val)),
          t("errors.invalidWhatsapp")
        ),
      password: z
        .string()
        .min(8, t("errors.passwordMin"))
        .max(128)
        .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
          message: "Kata sandi wajib mengandung kombinasi huruf dan angka.",
        }),
      confirmPassword: z.string().min(8, t("errors.passwordMin")),
      consent: z.boolean().refine((v) => v === true, t("errors.consentRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: t("errors.passwordMismatch"),
    });

  type RegisterValues = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      whatsapp: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    const normalizedWa = normalizeIndonesianWhatsapp(values.whatsapp);
    if (!normalizedWa) {
      setServerError(t("errors.invalidWhatsapp"));
      return;
    }

    const payload: {
      name: string;
      email: string;
      password: string;
      locale?: string;
      whatsapp?: string;
    } = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      locale: locale === "en" ? "en" : "id",
      whatsapp: normalizedWa,
    };

    const res = await authClient.signUp.email(
      payload as Parameters<typeof authClient.signUp.email>[0]
    );

    if (res.error) {
      const msg =
        res.error.status === 429
          ? t("errors.rateLimited")
          : t("errors.registerFailed");
      setServerError(msg);
      toast.error(msg);
      return;
    }

    const prefix = locale === "en" ? "/en" : "";
    const dest = nextPath || "/dashboard";
    const fullDest =
      dest.startsWith("/en/") || dest === "/en" ? dest : `${prefix}${dest}`;
    window.location.assign(fullDest);
  }

  const loginHref = nextPath
    ? `/masuk?next=${encodeURIComponent(nextPath)}`
    : "/masuk";

  return (
    <div className="space-y-5">
      {serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
        >
          <i className="bi bi-exclamation-triangle-fill mr-2" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="reg-name"
            className="block text-sm font-semibold text-kabut"
          >
            {t("nameLabel")}
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder={t("nameHint")}
            {...register("name")}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
          />
          {errors.name ? (
            <p className="mt-1 text-xs font-medium text-fajar">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="block text-sm font-semibold text-kabut"
          >
            {t("emailLabel")}
          </label>
          <input
            id="reg-email"
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

        <div>
          <label
            htmlFor="reg-whatsapp"
            className="block text-sm font-semibold text-kabut"
          >
            {t("whatsappLabel")}
          </label>
          <input
            id="reg-whatsapp"
            type="tel"
            autoComplete="tel"
            placeholder={t("whatsappHint")}
            {...register("whatsapp")}
            className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
          />
          {errors.whatsapp ? (
            <p className="mt-1 text-xs font-medium text-fajar">
              {errors.whatsapp.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <PasswordInput
            id="reg-password"
            label={t("passwordLabel")}
            autoComplete="new-password"
            placeholder={t("passwordHint")}
            showRequirements={true}
            error={errors.password?.message}
            {...register("password")}
          />

          <PasswordInput
            id="reg-confirm"
            label={t("confirmPasswordLabel")}
            autoComplete="new-password"
            placeholder={t("passwordHint")}
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>

        <div className="rounded-xl border border-kabut/15 bg-obsidian/70 p-3.5">
          <label className="flex items-start gap-3 text-xs text-kabut/90 cursor-pointer">
            <input
              id="reg-consent"
              type="checkbox"
              {...register("consent")}
              className="mt-0.5 h-5 w-5 rounded border-kabut/40 accent-fajar"
            />
            <span>
              {t("consentPrefix")}{" "}
              <Link
                href="/kebijakan-privasi"
                className="font-semibold text-fajar underline"
              >
                {tFooter("privacy")}
              </Link>{" "}
              {t("consentAnd")}{" "}
              <Link
                href="/syarat-ketentuan"
                className="font-semibold text-fajar underline"
              >
                {tFooter("terms")}
              </Link>
              .
            </span>
          </label>
          {errors.consent ? (
            <p className="mt-1.5 text-xs font-medium text-fajar">
              {errors.consent.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-ui btn-fajar w-full"
        >
          <i className="bi bi-person-plus-fill" aria-hidden="true" />
          <span>{isSubmitting ? t("processing") : t("submitRegister")}</span>
        </button>
      </form>

      <p className="border-t border-kabut/15 pt-4 text-center text-sm text-kabut/85">
        <span>{t("alreadyHaveAccount")}</span>{" "}
        <Link href={loginHref} className="font-bold text-fajar hover:underline">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
