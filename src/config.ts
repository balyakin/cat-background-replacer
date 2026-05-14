export type OpenRouterModelConfig = {
  id: string;
  modalities: string[];
};

export type AppConfig = {
  openRouter: {
    primaryBackgroundModel: OpenRouterModelConfig;
    fallbackBackgroundModel: OpenRouterModelConfig;
    secondaryFallbackBackgroundModel?: OpenRouterModelConfig;
    imageSize: string;
    timeoutMs: number;
  };
  camera: {
    enabled: boolean;
  };
  imageProcessing: {
    maxSourceSidePx: number;
    jpegQuality: number;
  };
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  openRouter: {
    primaryBackgroundModel: {
      id: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"]
    },
    fallbackBackgroundModel: {
      id: "black-forest-labs/flux.2-klein-4b",
      modalities: ["image"]
    },
    secondaryFallbackBackgroundModel: {
      id: "sourceful/riverflow-v2-fast",
      modalities: ["image"]
    },
    imageSize: "1K",
    timeoutMs: 60000
  },
  camera: {
    enabled: true
  },
  imageProcessing: {
    maxSourceSidePx: 2000,
    jpegQuality: 0.88
  }
};

export async function loadAppConfig(): Promise<AppConfig> {
  const response = await fetch("/app-config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить public/app-config.json");
  }

  const parsed = (await response.json()) as Partial<AppConfig>;
  return {
    openRouter: {
      ...DEFAULT_APP_CONFIG.openRouter,
      ...parsed.openRouter
    },
    camera: {
      ...DEFAULT_APP_CONFIG.camera,
      ...parsed.camera
    },
    imageProcessing: {
      ...DEFAULT_APP_CONFIG.imageProcessing,
      ...parsed.imageProcessing
    }
  };
}
