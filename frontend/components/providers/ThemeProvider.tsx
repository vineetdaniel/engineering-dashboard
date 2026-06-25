"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    defaultTheme === "system" ? getSystemTheme() : defaultTheme
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== "undefined" ? (localStorage.getItem("cto-dash-theme") as Theme | null) : null;
    const initial = stored || defaultTheme;
    setThemeState(initial);
    applyTheme(initial);

    const listener = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        const next = e.matches ? "dark" : "light";
        setResolvedTheme(next);
        document.documentElement.classList.toggle("dark", next === "dark");
      }
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [theme]);

  function applyTheme(next: Theme) {
    const resolved = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }

  function setTheme(next: Theme) {
    setThemeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("cto-dash-theme", next);
    }
  }

  function toggleTheme() {
    const next = resolvedTheme === "light" ? "dark" : "light";
    setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export type { Theme };
