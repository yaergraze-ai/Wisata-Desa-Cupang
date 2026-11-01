import "server-only";
import { getEnv, getIntegrationFlags } from "@/server/env";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";

export interface WhatsappSendResult {
  delivered: boolean;
  configured: boolean;
  provider: "fonnte" | "meta" | null;
  error?: string;
}

export interface WhatsappProviderAdapter {
  readonly name: "fonnte" | "meta";
  sendText(toE164: string, message: string): Promise<WhatsappSendResult>;
  testConnection(): Promise<{ status: "connected" | "error"; detail: string }>;
}

class FonnteAdapter implements WhatsappProviderAdapter {
  readonly name = "fonnte" as const;
  constructor(private readonly token: string) {}

  async sendText(toE164: string, message: string): Promise<WhatsappSendResult> {
    const target = toE164.replace(/^\+/, "");
    const form = new URLSearchParams();
    form.set("target", target);
    form.set("message", message);
    form.set("countryCode", "62");

    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: this.token,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const json = (await res.json()) as { status?: boolean; reason?: string };
      if (!res.ok || json.status === false) {
        return {
          delivered: false,
          configured: true,
          provider: "fonnte",
          error: json.reason || `Fonnte HTTP ${res.status}`,
        };
      }
      return { delivered: true, configured: true, provider: "fonnte" };
    } catch (err) {
      return {
        delivered: false,
        configured: true,
        provider: "fonnte",
        error: err instanceof Error ? err.message : "Fonnte network error",
      };
    }
  }

  async testConnection(): Promise<{ status: "connected" | "error"; detail: string }> {
    try {
      const res = await fetch("https://api.fonnte.com/validate", {
        method: "POST",
        headers: {
          Authorization: this.token,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "target=6281200000000",
      });
      if (!res.ok) {
        return { status: "error", detail: `Fonnte HTTP ${res.status}` };
      }
      return { status: "connected", detail: "Token Fonnte aktif & merespons." };
    } catch (err) {
      return {
        status: "error",
        detail: err instanceof Error ? err.message : "Gagal menghubungi API Fonnte.",
      };
    }
  }
}

class MetaCloudWaAdapter implements WhatsappProviderAdapter {
  readonly name = "meta" as const;
  constructor(
    private readonly token: string,
    private readonly phoneId: string
  ) {}

  async sendText(toE164: string, message: string): Promise<WhatsappSendResult> {
    const toDigits = toE164.replace(/^\+/, "");
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(this.phoneId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toDigits,
            type: "text",
            text: { body: message },
          }),
        }
      );
      if (!res.ok) {
        const errBody = await res.text();
        return {
          delivered: false,
          configured: true,
          provider: "meta",
          error: `Meta WA HTTP ${res.status}: ${errBody.slice(0, 160)}`,
        };
      }
      return { delivered: true, configured: true, provider: "meta" };
    } catch (err) {
      return {
        delivered: false,
        configured: true,
        provider: "meta",
        error: err instanceof Error ? err.message : "Meta WA network error",
      };
    }
  }

  async testConnection(): Promise<{ status: "connected" | "error"; detail: string }> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(this.phoneId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );
      if (!res.ok) {
        return { status: "error", detail: `Meta Graph HTTP ${res.status}` };
      }
      return {
        status: "connected",
        detail: "Meta WhatsApp Cloud API terverifikasi.",
      };
    } catch (err) {
      return {
        status: "error",
        detail: err instanceof Error ? err.message : "Gagal menghubungi Meta Cloud API.",
      };
    }
  }
}

export function getWhatsappAdapter(): WhatsappProviderAdapter | null {
  const env = getEnv();
  const flags = getIntegrationFlags();
  if (flags.whatsappProvider === "fonnte" && env.FONNTE_TOKEN) {
    return new FonnteAdapter(env.FONNTE_TOKEN);
  }
  if (
    flags.whatsappProvider === "meta" &&
    env.META_WA_TOKEN &&
    env.META_WA_PHONE_ID
  ) {
    return new MetaCloudWaAdapter(env.META_WA_TOKEN, env.META_WA_PHONE_ID);
  }
  return null;
}

export async function sendWhatsappMessage(
  rawPhone: string,
  message: string
): Promise<WhatsappSendResult> {
  const adapter = getWhatsappAdapter();
  if (!adapter) {
    return { delivered: false, configured: false, provider: null };
  }
  const normalized = normalizeIndonesianWhatsapp(rawPhone);
  if (!normalized) {
    return {
      delivered: false,
      configured: true,
      provider: adapter.name,
      error: "Nomor WhatsApp Indonesia tidak valid.",
    };
  }
  return adapter.sendText(normalized, message);
}

export async function testWhatsappConnection(): Promise<{
  status: "connected" | "unconfigured" | "error";
  detail: string;
}> {
  const adapter = getWhatsappAdapter();
  if (!adapter) {
    return {
      status: "unconfigured",
      detail: "WA_PROVIDER dan kredensial WhatsApp belum diatur.",
    };
  }
  return adapter.testConnection();
}
