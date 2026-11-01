"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  phoneNumberClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        const isEn = window.location.pathname.startsWith("/en");
        const prefix = isEn ? "/en" : "";
        const target = next
          ? `${prefix}/verifikasi-2fa?next=${encodeURIComponent(next)}`
          : `${prefix}/verifikasi-2fa`;
        window.location.assign(target);
      },
    }),
    phoneNumberClient(),
    adminClient(),
  ],
});
