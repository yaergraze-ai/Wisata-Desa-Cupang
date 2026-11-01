"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z
    .object({
      password: z.string().min(10, t("errors.passwordMin")).max(128),
      confirmPassword: z.string().min(10, t("errors.passwordMin")),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ["confirmPassword"],
      message: t("errors.passwordMismatch"),
    });

  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm text-red-100"
        >
          {t("resetInvalidToken")}
        </div>
        <Link href="/lupa-kata-sandi" className="btn-ui btn-fajar w-full">
          {t("forgotHeading")}
        </Link>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    setServerError(null);
    const res = await authClient.resetPassword({
      newPassword: values.password,
      token: token!,
    });
    if (res.error) {
      setServerError(t("resetInvalidToken"));
      return;
    }
    toast.success(t("resetSuccess"));
    router.replace("/masuk");
  }

  return (
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
          htmlFor="reset-password"
          className="block text-sm font-semibold text-kabut"
        >
          {t("passwordLabel")}
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordHint")}
          {...register("password")}
          className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
        />
        {errors.password ? (
          <p className="mt-1 text-xs font-medium text-fajar">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="reset-confirm"
          className="block text-sm font-semibold text-kabut"
        >
          {t("confirmPasswordLabel")}
        </label>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordHint")}
          {...register("confirmPassword")}
          className="mt-1.5 w-full min-h-[44px] rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
        />
        {errors.confirmPassword ? (
          <p className="mt-1 text-xs font-medium text-fajar">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-ui btn-fajar w-full"
      >
        <i className="bi bi-key-fill" aria-hidden="true" />
        <span>{isSubmitting ? t("processing") : t("submitReset")}</span>
      </button>
    </form>
  );
}
