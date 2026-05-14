import type { StickerSettings } from "./storage";
import { loadImageElement } from "./imageUtils";

export async function applySticker(
  imageSrc: string,
  settings: StickerSettings,
  jpegQuality: number
): Promise<string> {
  if (!settings.enabled) return imageSrc;

  const image = await loadImageElement(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");
  context.drawImage(image, 0, 0);

  const scale = Math.max(1, Math.min(canvas.width, canvas.height) / 900);
  const paddingX = Math.round(34 * scale);
  const margin = Math.round(32 * scale);
  const title = settings.enabled ? "Ищу дом" : "";
  const name = settings.name.trim();

  context.font = `700 ${Math.round(42 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const titleWidth = title ? context.measureText(title).width : 0;
  context.font = `700 ${Math.round((title ? 32 : 44) * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const nameWidth = name ? context.measureText(name).width : 0;
  const width = Math.min(
    canvas.width - margin * 2,
    Math.max(titleWidth, nameWidth) + paddingX * 2
  );
  const hasTwoLines = Boolean(title && name);
  const height = Math.round((hasTwoLines ? 104 : 76) * scale);
  const x = margin;
  const y = canvas.height - margin - height;

  context.save();
  context.shadowColor = "rgba(28, 25, 23, 0.24)";
  context.shadowBlur = 18 * scale;
  context.shadowOffsetY = 6 * scale;
  roundRect(context, x, y, width, height, 8 * scale);
  context.fillStyle = "rgba(255, 248, 240, 0.94)";
  context.fill();
  context.restore();

  context.fillStyle = "#1C1917";
  if (title) {
    context.font = `700 ${Math.round(42 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillText(title, x + paddingX, y + Math.round((hasTwoLines ? 44 : 51) * scale));
  }
  if (name) {
    context.font = `700 ${Math.round((title ? 32 : 44) * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.fillStyle = "#2F7D6D";
    context.fillText(name, x + paddingX, y + Math.round((hasTwoLines ? 84 : 53) * scale));
  }

  return canvas.toDataURL("image/jpeg", jpegQuality);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}
