"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
const storageKey = "rental-ledger-theme";

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const choose = (value: Theme) => { localStorage.setItem(storageKey, value); setTheme(value); };
  return <div className="theme-switch" role="group" aria-label="Color theme">
    <button aria-label="Light theme" title="Light theme" className={theme === "light" ? "active" : ""} onClick={() => choose("light")}><Sun size={15}/></button>
    <button aria-label="Dark theme" title="Dark theme" className={theme === "dark" ? "active" : ""} onClick={() => choose("dark")}><Moon size={15}/></button>
    <button aria-label="System theme" title="System theme" className={theme === "system" ? "active" : ""} onClick={() => choose("system")}><Monitor size={15}/></button>
  </div>;
}
