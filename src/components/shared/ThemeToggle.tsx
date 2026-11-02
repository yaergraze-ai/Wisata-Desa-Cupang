"use client";

import { useTheme, type ThemeMode } from "./ThemeProvider";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options: Array<{
    mode: ThemeMode;
    label: string;
    icon: string;
    title: string;
  }> = [
    {
      mode: "light",
      label: "Terang",
      icon: "bi-sun-fill",
      title: "Mode Terang (Light Mode)",
    },
    {
      mode: "dark",
      label: "Gelap",
      icon: "bi-moon-stars-fill",
      title: "Mode Gelap (Dark Mode)",
    },
    {
      mode: "system",
      label: "Sistem",
      icon: "bi-display",
      title: "Mengikuti Sistem Perangkat",
    },
  ];

  return (
    <div
      role="group"
      aria-label="Pilihan Tema Tampilan"
      className={cn(
        "inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xs",
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setTheme(opt.mode)}
            title={opt.title}
            aria-pressed={isSelected}
            aria-label={opt.title}
            className={cn(
              "relative flex items-center justify-center rounded-md text-xs transition-all duration-200 cursor-pointer",
              compact
                ? "h-6 w-6 p-0"
                : "gap-1.5 px-2 py-1 font-medium",
              isSelected
                ? "bg-fajar text-obsidian font-bold shadow-xs"
                : "text-kabut/60 hover:text-kabut hover:bg-white/5"
            )}
          >
            <i className={cn("bi text-[11px]", opt.icon)} aria-hidden="true" />
            {!compact ? <span>{opt.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
