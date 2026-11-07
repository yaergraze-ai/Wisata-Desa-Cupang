"use client";

import { createContext, useContext, useEffect } from "react";

export type ThemeMode = "dark";

interface ThemeContextValue {
  theme: "dark";
  resolvedTheme: "dark";
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem("wdc_theme");
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.setAttribute("data-theme", "dark");

      const cookieSeen = document.cookie.includes("wdc_intro_seen=true");
      const localSeen = localStorage.getItem("wdc_cinematic_intro_seen") === "true";
      const sessionSeen = sessionStorage.getItem("wdc_cinematic_intro_seen") === "true";
      if (cookieSeen || localSeen || sessionSeen) {
        document.documentElement.classList.add("wdc-intro-dismissed");
        document.documentElement.style.overflow = "";
        if (!cookieSeen) {
          const isHttps = window.location.protocol === "https:";
          document.cookie = `wdc_intro_seen=true; path=/; max-age=31536000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
        }
      }
    } catch {
      // ignore
    }
  });

  return (
    <ThemeContext.Provider
      value={{
        theme: "dark",
        resolvedTheme: "dark",
        setTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
