import heic2any from "heic2any";

export type PreparedImage = {
  originalDataUrl: string;
  workingDataUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  warnings: string[];
};

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CroppedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type.includes("heic") || file.type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

export async function prepareImageFile(file: File, maxSide: number, jpegQuality: number): Promise<PreparedImage> {
  let sourceBlob: Blob = file;
  const warnings: string[] = [];

  if (isHeicFile(file)) {
    try {
      const converted = (await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: jpegQuality
      })) as Blob | Blob[];
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error("Не удалось прочитать HEIC. Экспортируйте фото как JPEG и попробуйте ещё раз.");
    }
  }

  const originalDataUrl = await blobToDataUrl(sourceBlob);
  const image = await loadImageElement(originalDataUrl);

  if (image.naturalWidth < 200 || image.naturalHeight < 200) {
    warnings.push("Фото слишком маленькое, результат может быть плохим.");
  }

  const resized = await resizeImage(originalDataUrl, maxSide, jpegQuality);
  return {
    originalDataUrl,
    workingDataUrl: resized.dataUrl,
    width: resized.width,
    height: resized.height,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    warnings
  };
}

export async function resizeImage(dataUrl: string, maxSide: number, jpegQuality: number): Promise<CroppedImage> {
  const image = await loadImageElement(dataUrl);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > maxSide ? maxSide / longestSide : 1;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");
  context.drawImage(image, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", jpegQuality),
    width,
    height
  };
}

export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: PixelCrop,
  jpegQuality: number
): Promise<CroppedImage> {
  const image = await loadImageElement(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    dataUrl: canvas.toDataURL("image/jpeg", jpegQuality),
    width: canvas.width,
    height: canvas.height
  };
}

export async function createForegroundLayer(imageSrc: string, maskSrc: string): Promise<string> {
  const [image, mask] = await Promise.all([loadImageElement(imageSrc), loadImageElement(maskSrc)]);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(mask, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-over";
  return canvas.toDataURL("image/png");
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const normalizedSrc = src.startsWith("http://") || src.startsWith("https://") ? await urlToDataUrl(src) : src;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение."));
    image.src = normalizedSrc;
  });
}

export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось скачать изображение результата.");
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export function downloadDataUrl(dataUrl: string, filename = "kotofon_result.jpg"): void {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function shareDataUrl(dataUrl: string, filename = "kotofon.jpg"): Promise<boolean> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const title = "Фото от КотоФон";
  const text = "Посмотри, какой красивый кот! 🐱";
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title,
      text
    });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return true;
  }
  downloadDataUrl(dataUrl, filename);
  return false;
}
