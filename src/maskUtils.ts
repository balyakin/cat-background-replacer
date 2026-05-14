import { loadImageElement } from "./imageUtils";

export type MaskPoint = {
  x: number;
  y: number;
};

export async function createInitialMaskDataUrl(
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");

  paintEmptyMask(context, width, height);

  return canvas.toDataURL("image/png");
}

export function paintFullMask(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
}

export function paintEmptyMask(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.clearRect(0, 0, width, height);
}

export function eraseConnectedSimilarColor(
  maskCanvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement,
  seed: MaskPoint,
  tolerance: number
): number {
  const width = maskCanvas.width;
  const height = maskCanvas.height;
  const seedX = clamp(Math.round(seed.x), 0, width - 1);
  const seedY = clamp(Math.round(seed.y), 0, height - 1);
  const total = width * height;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !maskContext) return 0;

  sourceContext.drawImage(sourceImage, 0, 0, width, height);
  const sourceData = sourceContext.getImageData(0, 0, width, height).data;
  const maskImageData = maskContext.getImageData(0, 0, width, height);
  const maskData = maskImageData.data;
  const seedIndex = (seedY * width + seedX) * 4;
  const seedR = sourceData[seedIndex];
  const seedG = sourceData[seedIndex + 1];
  const seedB = sourceData[seedIndex + 2];
  const toleranceSq = tolerance * tolerance;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  let removed = 0;

  const push = (index: number) => {
    if (index < 0 || index >= total || visited[index]) return;
    visited[index] = 1;
    const maskAlpha = maskData[index * 4 + 3];
    if (maskAlpha <= 8) return;
    if (!isSimilar(index)) return;
    maskData[index * 4] = 0;
    maskData[index * 4 + 1] = 0;
    maskData[index * 4 + 2] = 0;
    maskData[index * 4 + 3] = 0;
    queue[tail] = index;
    tail += 1;
    removed += 1;
  };

  const isSimilar = (index: number) => {
    const offset = index * 4;
    const dr = sourceData[offset] - seedR;
    const dg = sourceData[offset + 1] - seedG;
    const db = sourceData[offset + 2] - seedB;
    return dr * dr + dg * dg + db * db <= toleranceSq;
  };

  push(seedY * width + seedX);

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (index >= width) push(index - width);
    if (index < total - width) push(index + width);
  }

  maskContext.putImageData(maskImageData, 0, 0);
  return removed;
}

export async function maskTouchesEdge(maskSrc: string, threshold = 0.05): Promise<boolean> {
  const image = await loadImageElement(maskSrc);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const sample = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * threshold));

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const nearEdge = x < sample || y < sample || x >= canvas.width - sample || y >= canvas.height - sample;
      if (!nearEdge) continue;
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 16) return true;
    }
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type MaskBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function getMaskBounds(maskSrc: string): Promise<MaskBounds | null> {
  const image = await loadImageElement(maskSrc);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}
