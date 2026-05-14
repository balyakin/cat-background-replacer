import { loadImageElement } from "./imageUtils";
import { getMaskBounds, type MaskBounds } from "./maskUtils";

export async function compositeBackgroundWithForeground(options: {
  backgroundSrc: string;
  foregroundSrc: string;
  maskSrc: string;
  maskBounds?: MaskBounds | null;
  foregroundOffsetY?: number;
  width: number;
  height: number;
  jpegQuality: number;
}): Promise<string> {
  const {
    backgroundSrc,
    foregroundSrc,
    maskSrc,
    maskBounds,
    foregroundOffsetY = 0,
    width,
    height,
    jpegQuality
  } = options;
  const [background, foreground, bounds] = await Promise.all([
    loadImageElement(backgroundSrc),
    loadImageElement(foregroundSrc),
    maskBounds === undefined ? getMaskBounds(maskSrc) : Promise.resolve(maskBounds)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");

  drawCover(context, background, width, height);
  adjustBackgroundTone(context, width, height);

  const adjustedBounds = bounds ? shiftBounds(bounds, foregroundOffsetY) : null;
  if (adjustedBounds) {
    drawContactShadow(context, adjustedBounds, width, height);
  }

  context.drawImage(foreground, 0, foregroundOffsetY, width, height);
  return canvas.toDataURL("image/jpeg", jpegQuality);
}

function shiftBounds(bounds: MaskBounds, offsetY: number): MaskBounds {
  return {
    ...bounds,
    y: bounds.y + offsetY
  };
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function adjustBackgroundTone(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = 0.16;
  const warmOverlay = context.createLinearGradient(0, 0, width, height);
  warmOverlay.addColorStop(0, "#fff8f0");
  warmOverlay.addColorStop(0.55, "#f8fafc");
  warmOverlay.addColorStop(1, "#dbeafe");
  context.fillStyle = warmOverlay;
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.08;
  context.fillStyle = "#1c1917";
  context.fillRect(0, height * 0.72, width, height * 0.28);
  context.restore();
}

function drawContactShadow(
  context: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  width: number,
  height: number
): void {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = Math.min(height - bounds.height * 0.025, bounds.y + bounds.height * 0.98);
  const radiusX = Math.max(width * 0.15, bounds.width * 0.5);
  const radiusY = Math.max(height * 0.024, bounds.height * 0.068);

  context.save();
  context.filter = `blur(${Math.max(10, Math.round(width * 0.018))}px)`;
  context.globalAlpha = 0.34;
  context.fillStyle = "rgba(28, 25, 23, 0.55)";
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.filter = `blur(${Math.max(4, Math.round(width * 0.006))}px)`;
  context.globalAlpha = 0.16;
  context.fillStyle = "rgba(28, 25, 23, 0.72)";
  context.beginPath();
  context.ellipse(
    centerX,
    Math.min(height - 2, bounds.y + bounds.height * 0.995),
    Math.max(width * 0.08, bounds.width * 0.28),
    Math.max(3, height * 0.008),
    0,
    0,
    Math.PI * 2
  );
  context.fill();
  context.restore();
}
