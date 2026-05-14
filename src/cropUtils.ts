export type AspectRatioId = "1:1" | "4:5" | "9:16" | "original";

export type AspectRatioOption = {
  id: AspectRatioId;
  label: string;
  shortLabel: string;
};

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: "1:1", label: "1:1", shortLabel: "Квадрат" },
  { id: "4:5", label: "4:5", shortLabel: "Пост" },
  { id: "9:16", label: "9:16", shortLabel: "Сторис" },
  { id: "original", label: "Исходный", shortLabel: "Оригинал" }
];

export function getAspectRatioValue(aspectRatio: AspectRatioId, sourceWidth: number, sourceHeight: number): number {
  if (aspectRatio === "1:1") return 1;
  if (aspectRatio === "4:5") return 4 / 5;
  if (aspectRatio === "9:16") return 9 / 16;
  return sourceWidth / sourceHeight;
}

export function getAspectRatioLabel(aspectRatio: AspectRatioId): string {
  return ASPECT_RATIOS.find((item) => item.id === aspectRatio)?.label ?? "4:5";
}

export function isSupportedImageConfigRatio(aspectRatio: AspectRatioId): boolean {
  return aspectRatio === "1:1" || aspectRatio === "4:5" || aspectRatio === "9:16";
}
