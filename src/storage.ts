import type { AspectRatioId } from "./cropUtils";
import type { BackgroundId } from "./backgrounds";

const API_KEY = "kotofon.openrouter.apiKey";
const LAST_ASPECT = "kotofon.lastAspectRatio";
const LAST_BACKGROUND = "kotofon.lastBackground";
const STICKER = "kotofon.sticker";
const PRIMARY_MODEL = "kotofon.primaryModelId";
const FALLBACK_MODEL = "kotofon.fallbackModelId";
const SECONDARY_MODEL = "kotofon.secondaryModelId";
const CAMERA_ENABLED = "kotofon.cameraEnabled";

export type StickerSettings = {
  enabled: boolean;
  name: string;
};

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY) ?? "";
}

export function setStoredApiKey(value: string): void {
  if (value.trim()) {
    localStorage.setItem(API_KEY, value.trim());
  } else {
    localStorage.removeItem(API_KEY);
  }
}

export function getStoredAspectRatio(): AspectRatioId {
  const value = localStorage.getItem(LAST_ASPECT);
  return value === "1:1" || value === "4:5" || value === "9:16" || value === "original" ? value : "4:5";
}

export function setStoredAspectRatio(value: AspectRatioId): void {
  localStorage.setItem(LAST_ASPECT, value);
}

export function getStoredBackground(): BackgroundId {
  const value = localStorage.getItem(LAST_BACKGROUND);
  if (
    value === "cozy_sofa" ||
    value === "studio" ||
    value === "windowsill" ||
    value === "armchair" ||
    value === "blanket" ||
    value === "greenery" ||
    value === "random"
  ) {
    return value;
  }
  return "cozy_sofa";
}

export function setStoredBackground(value: BackgroundId): void {
  localStorage.setItem(LAST_BACKGROUND, value);
}

export function getStoredSticker(): StickerSettings {
  const raw = localStorage.getItem(STICKER);
  if (!raw) return { enabled: false, name: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<StickerSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      name: typeof parsed.name === "string" ? parsed.name : ""
    };
  } catch {
    return { enabled: false, name: "" };
  }
}

export function setStoredSticker(value: StickerSettings): void {
  localStorage.setItem(STICKER, JSON.stringify(value));
}

export function getStoredModelId(kind: "primary" | "fallback" | "secondary", fallback: string): string {
  const key = kind === "primary" ? PRIMARY_MODEL : kind === "fallback" ? FALLBACK_MODEL : SECONDARY_MODEL;
  return localStorage.getItem(key) ?? fallback;
}

export function setStoredModelId(kind: "primary" | "fallback" | "secondary", value: string): void {
  const key = kind === "primary" ? PRIMARY_MODEL : kind === "fallback" ? FALLBACK_MODEL : SECONDARY_MODEL;
  if (value.trim()) {
    localStorage.setItem(key, value.trim());
  } else {
    localStorage.removeItem(key);
  }
}

export function getStoredCameraEnabled(fallback: boolean): boolean {
  const value = localStorage.getItem(CAMERA_ENABLED);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function setStoredCameraEnabled(value: boolean): void {
  localStorage.setItem(CAMERA_ENABLED, String(value));
}
