import type { AppConfig, OpenRouterModelConfig } from "./config";
import { GENERATION_SYSTEM_PROMPT } from "./backgrounds";
import { isSupportedImageConfigRatio, type AspectRatioId } from "./cropUtils";

const OPENROUTER_CHAT_URL = "/api/openrouter/chat/completions";
const OPENROUTER_MODELS_URL = "/api/openrouter/models?output_modalities=image";
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

let availableImageModelsCache: {
  key: string;
  expiresAt: number;
  models: string[];
} | null = null;

type GenerateBackgroundOptions = {
  apiKey: string;
  appConfig: AppConfig;
  prompt: string;
  aspectRatio: AspectRatioId;
  primaryModel: OpenRouterModelConfig;
  fallbackModel: OpenRouterModelConfig;
  secondaryFallbackModel?: OpenRouterModelConfig;
};

export type GenerateBackgroundResult = {
  imageUrl: string;
  modelId: string;
  usedFallback: boolean;
};

export class OpenRouterRequestError extends Error {
  status?: number;
  details?: string;

  constructor(message: string, status?: number, details?: string) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function fetchAvailableImageModels(apiKey: string, timeoutMs = 20000): Promise<string[]> {
  const cacheKey = apiKey.trim() ? `custom:${apiKey.trim()}` : "server-token";
  if (
    availableImageModelsCache?.key === cacheKey &&
    availableImageModelsCache.expiresAt > Date.now()
  ) {
    return availableImageModelsCache.models;
  }

  const response = await fetchWithTimeout(
    OPENROUTER_MODELS_URL,
    {
      headers: openRouterProxyHeaders(apiKey)
    },
    timeoutMs
  );
  const data = await safeJson(response);
  if (!response.ok) {
    const upstreamMessage = extractTextMessage(data);
    throw new OpenRouterRequestError(
      upstreamMessage || mapOpenRouterStatus(response.status),
      response.status,
      upstreamMessage
    );
  }

  const modelsData = data as { data?: Array<{ id?: string }> };
  const models = (modelsData.data ?? []).map((model) => model.id).filter(Boolean) as string[];
  availableImageModelsCache = {
    key: cacheKey,
    expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
    models
  };
  return models;
}

export async function testOpenRouterKey(apiKey: string): Promise<void> {
  await fetchAvailableImageModels(apiKey, 20000);
}

export async function generateBackgroundWithFallback(
  options: GenerateBackgroundOptions
): Promise<GenerateBackgroundResult> {
  if (!navigator.onLine) {
    throw new OpenRouterRequestError("Нет подключения к интернету. Для обработки нужен интернет.");
  }

  const available = new Set(await fetchAvailableImageModels(options.apiKey, options.appConfig.openRouter.timeoutMs));
  const candidates = uniqueModels([
    options.primaryModel,
    options.fallbackModel,
    options.secondaryFallbackModel
  ]);

  let lastError: unknown = null;
  let attempted = 0;
  for (const model of candidates) {
    if (!available.has(model.id)) {
      lastError = new OpenRouterRequestError(`Модель ${model.id} недоступна для генерации изображений.`, 404);
      continue;
    }
    attempted += 1;
    try {
      const imageUrl = await requestBackground({
        apiKey: options.apiKey,
        appConfig: options.appConfig,
        model,
        prompt: options.prompt,
        aspectRatio: options.aspectRatio
      });
      return {
        imageUrl,
        modelId: model.id,
        usedFallback: attempted > 1
      };
    } catch (error) {
      lastError = error;
      const status = error instanceof OpenRouterRequestError ? error.status : undefined;
      if (status === 401 || status === 402) break;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new OpenRouterRequestError("Ни одна модель генерации фона не сработала.");
}

async function requestBackground(options: {
  apiKey: string;
  appConfig: AppConfig;
  model: OpenRouterModelConfig;
  prompt: string;
  aspectRatio: AspectRatioId;
}): Promise<string> {
  const imageConfig = isSupportedImageConfigRatio(options.aspectRatio) && supportsImageConfig(options.model.id)
    ? {
        aspect_ratio: options.aspectRatio,
        image_size: options.appConfig.openRouter.imageSize
      }
    : undefined;

  const response = await fetchWithTimeout(
    OPENROUTER_CHAT_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...openRouterProxyHeaders(options.apiKey)
      },
      body: JSON.stringify({
        model: options.model.id,
        messages: [
          {
            role: "system",
            content: GENERATION_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt
              }
            ]
          }
        ],
        modalities: options.model.modalities,
        ...(imageConfig ? { image_config: imageConfig } : {})
      })
    },
    options.appConfig.openRouter.timeoutMs
  );

  const body = await safeJson(response);
  if (!response.ok) {
    const upstreamMessage = extractTextMessage(body);
    throw new OpenRouterRequestError(
      upstreamMessage || mapOpenRouterStatus(response.status),
      response.status,
      upstreamMessage
    );
  }

  const imageUrl = extractOpenRouterImage(body);
  if (!imageUrl) {
    const textMessage = extractTextMessage(body);
    throw new OpenRouterRequestError(
      textMessage
        ? `OpenRouter вернул текст вместо изображения: ${truncateMessage(textMessage)}`
        : "OpenRouter вернул ответ без изображения. Попробуйте другой фон или модель.",
      undefined,
      textMessage
    );
  }
  return imageUrl;
}

function extractOpenRouterImage(data: unknown): string | null {
  const message = (data as { choices?: Array<{ message?: unknown }> }).choices?.[0]?.message as
    | {
        images?: Array<{ image_url?: { url?: string } }>;
        content?: unknown;
      }
    | undefined;

  const firstImage = message?.images?.[0]?.image_url?.url;
  if (firstImage) return firstImage;

  const content = Array.isArray(message?.content) ? message.content : [];
  for (const part of content) {
    const typed = part as { type?: string; image_url?: string | { url?: string } };
    if (typed.type !== "image_url") continue;
    if (typeof typed.image_url === "string") return typed.image_url;
    if (typed.image_url?.url) return typed.image_url.url;
  }
  return null;
}

function extractTextMessage(data: unknown): string | undefined {
  const errorMessage = (data as { error?: { message?: string } }).error?.message;
  if (errorMessage) return errorMessage;
  const message = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message;
  if (typeof message?.content === "string") return message.content;
  return undefined;
}

function mapOpenRouterStatus(status: number): string {
  if (status === 401) return "Проверьте API-ключ в настройках.";
  if (status === 402) return "Пополните баланс на OpenRouter.";
  if (status === 404) return "Модель недоступна или переименована. Выберите другую модель в настройках.";
  if (status === 413) return "Фото слишком большое, уменьшаем и пробуем ещё раз.";
  if (status === 429) return "Слишком много запросов, подождите минуту.";
  if (status >= 500) return "Ошибка провайдера. Попробуйте ещё раз через минуту.";
  return "OpenRouter вернул ошибку. Проверьте настройки и попробуйте ещё раз.";
}

function openRouterProxyHeaders(apiKey: string): HeadersInit {
  return apiKey.trim() ? { "X-OpenRouter-Key": apiKey.trim() } : {};
}

function supportsImageConfig(modelId: string): boolean {
  return /(^google\/gemini-|^openai\/.*image|^recraft\/)/.test(modelId);
}

function truncateMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 420)}...` : normalized;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OpenRouterRequestError("Сервер не ответил, попробуйте ещё раз.");
    }
    throw new OpenRouterRequestError("Не удалось связаться с OpenRouter. Проверьте интернет.");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function uniqueModels(models: Array<OpenRouterModelConfig | undefined>): OpenRouterModelConfig[] {
  const seen = new Set<string>();
  return models.filter((model): model is OpenRouterModelConfig => {
    if (!model?.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}
