"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/providers";

export type AppearancePreset = "chill" | "focus" | "sunset" | "light";
export type BackgroundStyle = "aurora" | "paper" | "minimal";

type Palette = {
  background: string;
  foreground: string;
  primaryRgb: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryGlow: string;
  focus: string;
  glassBg: string;
  glassBorder: string;
};

type AppearanceSettings = {
  preset: AppearancePreset;
  backgroundStyle: BackgroundStyle;
  accentColor: string | null;
  textColor: string | null;
  backgroundColor: string | null;
};

type AppearanceContextType = {
  settings: AppearanceSettings;
  setPreset: (preset: AppearancePreset) => void;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  setAccentColor: (hex: string | null) => void;
  setTextColor: (hex: string | null) => void;
  setBackgroundColor: (hex: string | null) => void;
  resetAppearance: () => void;
  isLoaded: boolean;
};

const PRESET_PALETTES: Record<AppearancePreset, Palette> = {
  chill: {
    background: "#0f172a",
    foreground: "#e2e8f0",
    primaryRgb: "56, 189, 248",
    surface: "rgba(15, 23, 42, 0.68)",
    surfaceElevated: "rgba(15, 23, 42, 0.82)",
    primary: "#38bdf8",
    primaryGlow: "rgba(56, 189, 248, 0.32)",
    focus: "#7dd3fc",
    glassBg: "rgba(15, 23, 42, 0.68)",
    glassBorder: "rgba(186, 230, 253, 0.16)",
  },
  focus: {
    background: "#0b1020",
    foreground: "#dbeafe",
    primaryRgb: "96, 165, 250",
    surface: "rgba(15, 23, 42, 0.76)",
    surfaceElevated: "rgba(15, 23, 42, 0.88)",
    primary: "#60a5fa",
    primaryGlow: "rgba(96, 165, 250, 0.3)",
    focus: "#93c5fd",
    glassBg: "rgba(15, 23, 42, 0.76)",
    glassBorder: "rgba(147, 197, 253, 0.2)",
  },
  sunset: {
    background: "#1f1630",
    foreground: "#f8e8ff",
    primaryRgb: "245, 158, 11",
    surface: "rgba(44, 24, 64, 0.7)",
    surfaceElevated: "rgba(44, 24, 64, 0.86)",
    primary: "#f59e0b",
    primaryGlow: "rgba(245, 158, 11, 0.35)",
    focus: "#fcd34d",
    glassBg: "rgba(44, 24, 64, 0.72)",
    glassBorder: "rgba(253, 230, 138, 0.2)",
  },
  light: {
    background: "#f4f8ff",
    foreground: "#0f172a",
    primaryRgb: "37, 99, 235",
    surface: "rgba(255, 255, 255, 0.72)",
    surfaceElevated: "rgba(255, 255, 255, 0.9)",
    primary: "#2563eb",
    primaryGlow: "rgba(37, 99, 235, 0.28)",
    focus: "#3b82f6",
    glassBg: "rgba(255, 255, 255, 0.75)",
    glassBorder: "rgba(15, 23, 42, 0.12)",
  },
};

const DEFAULT_SETTINGS: AppearanceSettings = {
  preset: "chill",
  backgroundStyle: "aurora",
  accentColor: null,
  textColor: null,
  backgroundColor: null,
};

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

function isHexColor(value: string) {
  return /^#([0-9a-f]{6})$/i.test(value);
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function toRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function blendWithWhite(hex: string, ratio: number) {
  const { r, g, b } = hexToRgb(hex);
  const next = (channel: number) => Math.round(channel + (255 - channel) * ratio)
    .toString(16)
    .padStart(2, "0");
  return `#${next(r)}${next(g)}${next(b)}`;
}

function applyPalette(
  palette: Palette,
  backgroundStyle: BackgroundStyle,
  accentColor: string | null,
  textColor: string | null,
  backgroundColor: string | null
) {
  if (typeof document === "undefined") return;

  const safeAccent = accentColor && isHexColor(accentColor) ? accentColor : null;
  const safeText = textColor && isHexColor(textColor) ? textColor : null;
  const safeBackground = backgroundColor && isHexColor(backgroundColor) ? backgroundColor : null;
  const primary = safeAccent ?? palette.primary;
  const primaryRgb = safeAccent
    ? (() => {
        const { r, g, b } = hexToRgb(safeAccent);
        return `${r}, ${g}, ${b}`;
      })()
    : palette.primaryRgb;
  const focus = safeAccent ? blendWithWhite(safeAccent, 0.25) : palette.focus;
  const primaryGlow = safeAccent ? toRgba(safeAccent, 0.32) : palette.primaryGlow;

  const root = document.documentElement;
  // Centralize runtime theming through CSS variables for consistent app styling.
  root.style.setProperty("--background", safeBackground ?? palette.background);
  root.style.setProperty("--foreground", safeText ?? palette.foreground);
  root.style.setProperty("--primary-rgb", primaryRgb);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--surface-elevated", palette.surfaceElevated);
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-glow", primaryGlow);
  root.style.setProperty("--focus", focus);
  root.style.setProperty("--glass-bg", palette.glassBg);
  root.style.setProperty("--glass-border", palette.glassBorder);
  document.body.dataset.bgStyle = backgroundStyle;
  document.documentElement.dataset.bgStyle = backgroundStyle;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoaded: isSessionLoaded } = useSession();
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKey = useMemo(() => {
    const user = session.userId || "guest";
    return `myuni.appearance.${user}`;
  }, [session.userId]);

  useEffect(() => {
    if (!isSessionLoaded) return;

    setIsLoaded(false);
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as AppearanceSettings;
      setSettings({
        preset: parsed.preset || DEFAULT_SETTINGS.preset,
        backgroundStyle: parsed.backgroundStyle || DEFAULT_SETTINGS.backgroundStyle,
        accentColor: parsed.accentColor && isHexColor(parsed.accentColor) ? parsed.accentColor : null,
        textColor: parsed.textColor && isHexColor(parsed.textColor) ? parsed.textColor : null,
        backgroundColor: parsed.backgroundColor && isHexColor(parsed.backgroundColor) ? parsed.backgroundColor : null,
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, [isSessionLoaded, storageKey]);

  useEffect(() => {
    const palette = PRESET_PALETTES[settings.preset];
    applyPalette(
      palette,
      settings.backgroundStyle,
      settings.accentColor,
      settings.textColor,
      settings.backgroundColor
    );
  }, [settings]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey, isLoaded]);

  const setPreset = (preset: AppearancePreset) => {
    setSettings((prev) => ({ ...prev, preset }));
  };

  const setBackgroundStyle = (backgroundStyle: BackgroundStyle) => {
    setSettings((prev) => ({ ...prev, backgroundStyle }));
  };

  const setAccentColor = (hex: string | null) => {
    if (!hex) {
      setSettings((prev) => ({ ...prev, accentColor: null }));
      return;
    }

    const normalized = hex.trim().toLowerCase();
    if (!isHexColor(normalized)) return;
    setSettings((prev) => ({ ...prev, accentColor: normalized }));
  };

  const setTextColor = (hex: string | null) => {
    if (!hex) {
      setSettings((prev) => ({ ...prev, textColor: null }));
      return;
    }

    const normalized = hex.trim().toLowerCase();
    if (!isHexColor(normalized)) return;
    setSettings((prev) => ({ ...prev, textColor: normalized }));
  };

  const setBackgroundColor = (hex: string | null) => {
    if (!hex) {
      setSettings((prev) => ({ ...prev, backgroundColor: null }));
      return;
    }

    const normalized = hex.trim().toLowerCase();
    if (!isHexColor(normalized)) return;
    setSettings((prev) => ({ ...prev, backgroundColor: normalized }));
  };

  const resetAppearance = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <AppearanceContext.Provider
      value={{
        settings,
        setPreset,
        setBackgroundStyle,
        setAccentColor,
        setTextColor,
        setBackgroundColor,
        resetAppearance,
        isLoaded,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within an AppearanceProvider");
  return context;
};
