import { blobToDataUrl, dataUrlToBlob } from "./imageUtils";

export type AiMaskProgress = {
  key: string;
  current: number;
  total: number;
  label: string;
};

export async function createAiForegroundMask(
  imageSrc: string,
  onProgress?: (progress: AiMaskProgress) => void
): Promise<string> {
  const { segmentForeground } = await import("@imgly/background-removal");
  const blob = dataUrlToBlob(imageSrc);
  const maskBlob = await segmentForeground(blob, {
    model: "isnet_fp16",
    device: "cpu",
    proxyToWorker: true,
    output: {
      format: "image/png",
      quality: 1
    },
    progress: (key, current, total) => {
      onProgress?.({
        key,
        current,
        total,
        label: formatProgressLabel(key, current, total)
      });
    }
  });

  return blobToDataUrl(maskBlob);
}

function formatProgressLabel(key: string, current: number, total: number): string {
  if (key.startsWith("download:")) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    return percent > 0 ? `Загружаем AI-модель: ${percent}%` : "Загружаем AI-модель...";
  }
  if (key === "compute:decode") return "AI читает фото...";
  if (key === "compute:inference") return "AI ищет кошку...";
  if (key === "compute:mask") return "AI собирает маску...";
  if (key === "compute:encode") return "AI готовит маску...";
  return `AI-маска: ${current}/${total}`;
}
