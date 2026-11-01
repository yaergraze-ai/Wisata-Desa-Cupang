"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function ContactFormCard() {
  const tContact = useTranslations("Contact");

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusMessage(null);

    if (
      name.trim().length < 2 ||
      whatsapp.trim().length < 9 ||
      message.trim().length < 10
    ) {
      setStatusMessage({
        type: "error",
        text: tContact("errorValidation"),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          message: message.trim(),
          website: websiteHoneypot,
        }),
      });

      if (res.status === 429) {
        const text = tContact("errorRateLimit");
        setStatusMessage({ type: "error", text });
        toast.error(text);
        return;
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        const text =
          payload?.error === "INVALID_WHATSAPP" ||
          payload?.error === "VALIDATION_ERROR"
            ? tContact("errorValidation")
            : tContact("errorGeneric");
        setStatusMessage({ type: "error", text });
        toast.error(text);
        return;
      }

      const okText = tContact("successNotice");
      setStatusMessage({ type: "success", text: okText });
      toast.success(okText);
      setName("");
      setWhatsapp("");
      setMessage("");
      setWebsiteHoneypot("");
    } catch {
      const errText = tContact("errorGeneric");
      setStatusMessage({ type: "error", text: errText });
      toast.error(errText);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="surface-solid-dark p-6 sm:p-8 lg:col-span-7"
    >
      <h3 className="font-heading text-xl font-bold text-kabut">
        {tContact("formTitle")}
      </h3>

      {/* Honeypot Tersembunyi (§6.H) */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website-hp">{tContact("honeypotLabel")}</label>
        <input
          id="contact-website-hp"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={websiteHoneypot}
          onChange={(e) => setWebsiteHoneypot(e.target.value)}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contact-name"
            className="block text-xs font-semibold text-kabut"
          >
            {tContact("nameLabel")}
          </label>
          <input
            id="contact-name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tContact("nameHint")}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
          />
        </div>

        <div>
          <label
            htmlFor="contact-wa"
            className="block text-xs font-semibold text-kabut"
          >
            {tContact("whatsappInputLabel")}
          </label>
          <input
            id="contact-wa"
            type="tel"
            required
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={tContact("whatsappInputHint")}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
          />
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="contact-message"
          className="block text-xs font-semibold text-kabut"
        >
          {tContact("messageLabel")}
        </label>
        <textarea
          id="contact-message"
          rows={4}
          required
          minLength={10}
          maxLength={1500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tContact("messageHint")}
          className="mt-1.5 w-full rounded-xl border border-kabut/25 bg-obsidian px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45"
        />
      </div>

      {statusMessage ? (
        <div
          role="status"
          className={
            statusMessage.type === "success"
              ? "mt-4 rounded-xl border border-telaga bg-telaga-950 px-4 py-3 text-xs font-semibold text-kabut"
              : "mt-4 rounded-xl border border-fajar bg-fajar/15 px-4 py-3 text-xs font-semibold text-fajar"
          }
        >
          {statusMessage.text}
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-ui btn-fajar w-full sm:w-auto"
        >
          <i className="bi bi-send-fill" aria-hidden="true" />
          <span>
            {isSubmitting ? tContact("sendingBtn") : tContact("submitBtn")}
          </span>
        </button>
      </div>
    </form>
  );
}
