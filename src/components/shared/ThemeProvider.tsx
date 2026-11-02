"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = (localStorage.getItem("wdc_theme") as ThemeMode) || "system";
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function applyTheme() {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;

      setResolvedTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
      if (resolved === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    }

    applyTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme();
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, mounted]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem("wdc_theme", mode);
    } catch {
      // ignore
    }
  };

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
