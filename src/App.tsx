import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, History, Settings, Wand2 } from "lucide-react";
import { DEFAULT_APP_CONFIG, loadAppConfig, type AppConfig, type OpenRouterModelConfig } from "./config";
import { type BackgroundId, buildBackgroundPrompt, resolveBackground } from "./backgrounds";
import { type AspectRatioId } from "./cropUtils";
import { createAiForegroundMask } from "./aiSegmentation";
import {
  createForegroundLayer,
  downloadDataUrl,
  prepareImageFile,
  shareDataUrl,
  type CroppedImage,
  type PreparedImage
} from "./imageUtils";
import { createInitialMaskDataUrl, getMaskBounds, maskTouchesEdge, type MaskBounds } from "./maskUtils";
import { generateBackgroundWithFallback } from "./api";
import { compositeBackgroundWithForeground } from "./compositeUtils";
import { applySticker } from "./stickerUtils";
import { createLocalStudioBackground } from "./localBackgrounds";
import {
  clearHistoryItems,
  getHistoryItems,
  pinHistoryItem,
  removeHistoryItem,
  saveHistoryItem,
  type HistoryItem
} from "./historyStorage";
import {
  getStoredApiKey,
  getStoredAspectRatio,
  getStoredBackground,
  getStoredCameraEnabled,
  getStoredModelId,
  getStoredSticker,
  setStoredApiKey,
  setStoredAspectRatio,
  setStoredBackground,
  setStoredCameraEnabled,
  setStoredModelId,
  setStoredSticker,
  type StickerSettings
} from "./storage";
import { PhotoUploader } from "./components/PhotoUploader";
import { CropEditor } from "./components/CropEditor";
import { MaskEditor } from "./components/MaskEditor";
import { BackgroundPicker } from "./components/BackgroundPicker";
import { StickerControls } from "./components/StickerControls";
import { ProcessingState } from "./components/ProcessingState";
import { ResultView } from "./components/ResultView";
import { SettingsSheet } from "./components/SettingsSheet";
import { HistorySheet } from "./components/HistorySheet";

type ResultState = {
  baseDataUrl: string;
  backgroundSrc: string;
  historyId: string;
  backgroundId: BackgroundId;
  backgroundName: string;
  modelId: string;
  pinned: boolean;
};

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [configError, setConfigError] = useState("");
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [primaryModelId, setPrimaryModelId] = useState(DEFAULT_APP_CONFIG.openRouter.primaryBackgroundModel.id);
  const [fallbackModelId, setFallbackModelId] = useState(DEFAULT_APP_CONFIG.openRouter.fallbackBackgroundModel.id);
  const [secondaryModelId, setSecondaryModelId] = useState(
    DEFAULT_APP_CONFIG.openRouter.secondaryFallbackBackgroundModel?.id ?? ""
  );
  const [cameraEnabled, setCameraEnabled] = useState(DEFAULT_APP_CONFIG.camera.enabled);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>(() => getStoredAspectRatio());
  const [backgroundId, setBackgroundId] = useState<BackgroundId>(() => getStoredBackground());
  const [sticker, setSticker] = useState<StickerSettings>(() => getStoredSticker());

  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [cropped, setCropped] = useState<CroppedImage | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState("");
  const [maskEdited, setMaskEdited] = useState(false);
  const [aiMaskRunning, setAiMaskRunning] = useState(false);
  const [aiMaskStatus, setAiMaskStatus] = useState("");
  const [maskWarning, setMaskWarning] = useState("");
  const [edgeWarning, setEdgeWarning] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Выберите фото");
  const [error, setError] = useState("");
  const maskSectionRef = useRef<HTMLDivElement | null>(null);
  const maskJobRef = useRef(0);
  const maskUserEditedRef = useRef(false);

  useEffect(() => {
    loadAppConfig()
      .then((config) => {
        setAppConfig(config);
        setPrimaryModelId(getStoredModelId("primary", config.openRouter.primaryBackgroundModel.id));
        setFallbackModelId(getStoredModelId("fallback", config.openRouter.fallbackBackgroundModel.id));
        setSecondaryModelId(
          getStoredModelId("secondary", config.openRouter.secondaryFallbackBackgroundModel?.id ?? "")
        );
        setCameraEnabled(getStoredCameraEnabled(config.camera.enabled));
      })
      .catch((caught) => {
        setConfigError(caught instanceof Error ? caught.message : "Не удалось загрузить конфигурацию.");
      });
  }, []);

  useEffect(() => {
    getHistoryItems().then(setHistoryItems).catch(() => setHistoryItems([]));
  }, []);

  const primaryModel = useMemo(
    () => ({ ...appConfig.openRouter.primaryBackgroundModel, id: primaryModelId }),
    [appConfig.openRouter.primaryBackgroundModel, primaryModelId]
  );
  const fallbackModel = useMemo(
    () => ({ ...appConfig.openRouter.fallbackBackgroundModel, id: fallbackModelId }),
    [appConfig.openRouter.fallbackBackgroundModel, fallbackModelId]
  );
  const secondaryModel = useMemo<OpenRouterModelConfig | undefined>(() => {
    const base = appConfig.openRouter.secondaryFallbackBackgroundModel;
    if (!base || !secondaryModelId.trim()) return undefined;
    return { ...base, id: secondaryModelId };
  }, [appConfig.openRouter.secondaryFallbackBackgroundModel, secondaryModelId]);

  const headerStatus = processing
    ? "генерируем фон"
    : result
      ? "проверьте результат"
      : cropped
        ? "маска и фон"
        : photo
          ? "кадрирование"
          : "выберите фото";

  const selectFile = async (file: File) => {
    setError("");
    setStatusMessage("Готовим фото...");
    setResult(null);
    setCropped(null);
    setMaskDataUrl("");
    setMaskEdited(false);
    setAiMaskRunning(false);
    setAiMaskStatus("");
    setMaskWarning("");
    maskJobRef.current += 1;
    maskUserEditedRef.current = false;
    setEdgeWarning(false);
    try {
      const prepared = await prepareImageFile(
        file,
        appConfig.imageProcessing.maxSourceSidePx,
        appConfig.imageProcessing.jpegQuality
      );
      setPhoto(prepared);
      setStatusMessage("Выберите кадр");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось открыть фото.");
      setStatusMessage("Выберите фото");
    }
  };

  const applyCrop = async (image: CroppedImage) => {
    setError("");
    setCropped(image);
    setResult(null);
    setMaskEdited(false);
    setMaskWarning("");
    setEdgeWarning(false);
    const mask = await createInitialMaskDataUrl(image.width, image.height);
    setMaskDataUrl(mask);
    maskUserEditedRef.current = false;
    setStatusMessage("AI ищет кошку...");
    window.setTimeout(() => maskSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    runAiMask(image, false);
  };

  const updateMask = async (mask: string) => {
    setMaskDataUrl(mask);
    setMaskEdited(true);
    maskUserEditedRef.current = true;
    setMaskWarning("");
    setEdgeWarning(await maskTouchesEdge(mask));
  };

  const runAiMask = async (image = cropped, forceReplace = true) => {
    if (!image) return;
    const jobId = maskJobRef.current + 1;
    maskJobRef.current = jobId;
    if (forceReplace) {
      maskUserEditedRef.current = false;
      setMaskEdited(false);
    }
    setAiMaskRunning(true);
    setAiMaskStatus("AI ищет кошку...");
    setMaskWarning("");
    setStatusMessage("AI ищет кошку...");

    try {
      const mask = await createAiForegroundMask(image.dataUrl, (progress) => {
        if (maskJobRef.current !== jobId) return;
        setAiMaskStatus(progress.label);
      });

      if (maskJobRef.current !== jobId) return;
      if (!forceReplace && maskUserEditedRef.current) {
        setMaskWarning("AI-маска готова, но не применена: маску уже начали править вручную.");
        return;
      }

      setMaskDataUrl(mask);
      setMaskEdited(false);
      maskUserEditedRef.current = false;
      const touchesEdge = await maskTouchesEdge(mask);
      setEdgeWarning(touchesEdge);
      setMaskWarning(await getMaskQualityWarning(mask, image, touchesEdge));
      setAiMaskStatus("AI-маска готова.");
      setStatusMessage("Проверьте AI-маску");
    } catch (caught) {
      if (maskJobRef.current !== jobId) return;
      setMaskWarning(
        caught instanceof Error
          ? `AI-маска не сработала: ${caught.message}`
          : "AI-маска не сработала. Можно пользоваться ластиком и кистью."
      );
      setStatusMessage("Проверьте маску");
    } finally {
      if (maskJobRef.current === jobId) {
        setAiMaskRunning(false);
      }
    }
  };

  const updateAspectRatio = (value: AspectRatioId) => {
    setAspectRatio(value);
    setStoredAspectRatio(value);
    setResult(null);
  };

  const updateBackground = (value: BackgroundId) => {
    setBackgroundId(value);
    setStoredBackground(value);
  };

  const updateSticker = (value: StickerSettings) => {
    setSticker(value);
    setStoredSticker(value);
  };

  const updateApiKey = (value: string) => {
    setApiKey(value);
    setStoredApiKey(value);
  };

  const runGeneration = async (forceNewBackground = false) => {
    if (!cropped || !maskDataUrl) {
      setError("Сначала примените кроп и подготовьте маску.");
      return;
    }
    if (aiMaskRunning) {
      setError("Дождитесь окончания AI-маски или поправьте маску вручную.");
      return;
    }
    navigator.vibrate?.(50);
    setProcessing(true);
    setError("");
    setStatusMessage("Генерируем фон...");

    const preset = resolveBackground(backgroundId);
    try {
      const maskBounds = await getMaskBounds(maskDataUrl);
      if (!maskBounds) {
        const message = "Похоже, кошку не удалось найти. Попробуйте другое фото или выделите кошку кистью.";
        setMaskWarning(message);
        throw new Error(message);
      }
      const foreground = await createForegroundLayer(cropped.dataUrl, maskDataUrl);
      const placement = maskBounds
        ? {
            leftPct: Math.round((maskBounds.x / cropped.width) * 100),
            topPct: Math.round((maskBounds.y / cropped.height) * 100),
            rightPct: Math.round(((maskBounds.x + maskBounds.width) / cropped.width) * 100),
            bottomPct: Math.round(((maskBounds.y + maskBounds.height) / cropped.height) * 100),
            centerXPct: Math.round(((maskBounds.x + maskBounds.width / 2) / cropped.width) * 100),
            centerYPct: Math.round(((maskBounds.y + maskBounds.height / 2) / cropped.height) * 100),
            widthPct: Math.round((maskBounds.width / cropped.width) * 100),
            heightPct: Math.round((maskBounds.height / cropped.height) * 100)
          }
        : undefined;
      const canReuseBackground =
        !forceNewBackground && result?.backgroundSrc && result.backgroundId === preset.id;
      const prompt = buildBackgroundPrompt(preset.prompt, aspectRatio, placement);
      const generated = canReuseBackground
        ? {
            imageUrl: result.backgroundSrc,
            modelId: result.modelId,
            usedFallback: false,
            reused: true
          }
        : preset.id === "studio"
          ? {
              imageUrl: createLocalStudioBackground(
                cropped.width,
                cropped.height,
                appConfig.imageProcessing.jpegQuality
              ),
              modelId: "local/studio-sweep",
              usedFallback: false,
              reused: false
            }
            : {
                ...(await generateBackgroundWithFallback({
                  apiKey,
                  appConfig,
                  prompt,
                  aspectRatio,
                  primaryModel,
                  fallbackModel,
                  secondaryFallbackModel: secondaryModel
                })),
                reused: false
              };
      const baseDataUrl = await compositeBackgroundWithForeground({
        backgroundSrc: generated.imageUrl,
        foregroundSrc: foreground,
        maskSrc: maskDataUrl,
        maskBounds,
        foregroundOffsetY: getForegroundOffsetY(preset.id, maskBounds, cropped.height),
        width: cropped.width,
        height: cropped.height,
        jpegQuality: appConfig.imageProcessing.jpegQuality
      });
      const fallbackHistoryId = `unsaved-${Date.now().toString(36)}`;
      let historyId = fallbackHistoryId;
      let historySaved = false;
      try {
        const saved = await saveHistoryItem({
          resultDataUrl: baseDataUrl,
          aspectRatio,
          backgroundId: preset.id,
          backgroundName: preset.name
        });
        historyId = saved.id;
        historySaved = true;
        const latest = await getHistoryItems();
        setHistoryItems(latest);
      } catch (historyError) {
        console.warn("KotoFon history save failed", historyError);
      }
      setResult({
        baseDataUrl,
        backgroundSrc: generated.imageUrl,
        historyId,
        backgroundId: preset.id,
        backgroundName: preset.name,
        modelId: generated.modelId,
        pinned: false
      });
      setStatusMessage(
        generated.reused
          ? "Готово с прежним фоном"
          : historySaved
          ? generated.usedFallback
            ? "Готово через fallback"
            : "Готово"
          : "Готово, но история не сохранилась"
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сделать фон.");
      setStatusMessage("Можно попробовать ещё раз");
    } finally {
      setProcessing(false);
    }
  };

  const pinResult = async () => {
    if (!result) return;
    if (result.historyId.startsWith("unsaved-")) {
      setError("Этот результат не сохранился в историю, закрепить его нельзя.");
      return;
    }
    const latest = await pinHistoryItem(result.historyId);
    setHistoryItems(latest);
    setResult({ ...result, pinned: true });
  };

  const shareResult = async (dataUrl = result?.baseDataUrl) => {
    if (!dataUrl) return;
    const exportDataUrl = await applySticker(dataUrl, sticker, appConfig.imageProcessing.jpegQuality);
    await shareDataUrl(exportDataUrl);
  };

  const downloadResult = async (dataUrl = result?.baseDataUrl) => {
    if (!dataUrl) return;
    const exportDataUrl = await applySticker(dataUrl, sticker, appConfig.imageProcessing.jpegQuality);
    downloadDataUrl(exportDataUrl);
  };

  const clearForNewAttempt = () => {
    setResult(null);
    setError("");
    setStatusMessage(cropped ? "Можно выбрать другой фон" : "Выберите фото");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeHistory = async (item: HistoryItem) => {
    const latest = await removeHistoryItem(item.id);
    setHistoryItems(latest);
  };

  const clearHistory = async () => {
    const latest = await clearHistoryItems();
    setHistoryItems(latest);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">КотоФон</p>
          <h1>{headerStatus}</h1>
          <p>{statusMessage}</p>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" aria-label="История" onClick={() => setHistoryOpen(true)}>
            <History size={20} />
          </button>
          <button className="icon-button" type="button" aria-label="Настройки" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="main-flow">
        {configError && <Notice kind="error" text={configError} />}
        {error && <Notice kind="error" text={error} />}
        {maskWarning && <Notice kind="warning" text={maskWarning} />}
        {photo?.warnings.map((warning) => <Notice key={warning} kind="warning" text={warning} />)}
        {edgeWarning && (
          <Notice kind="warning" text="Кошка близко к краю, лучше оставить больше воздуха вокруг." />
        )}

        <PhotoUploader
          previewSrc={photo?.workingDataUrl}
          cameraEnabled={cameraEnabled}
          disabled={processing}
          onSelect={selectFile}
        />

        {photo && (
          <CropEditor
            imageSrc={photo.workingDataUrl}
            imageWidth={photo.width}
            imageHeight={photo.height}
            aspectRatio={aspectRatio}
            jpegQuality={appConfig.imageProcessing.jpegQuality}
            onAspectRatioChange={updateAspectRatio}
            onApply={applyCrop}
          />
        )}

        {cropped && maskDataUrl && (
          <div ref={maskSectionRef}>
            <MaskEditor
              imageSrc={cropped.dataUrl}
              initialMaskSrc={maskDataUrl}
              aiBusy={aiMaskRunning}
              aiStatus={aiMaskStatus}
              onMaskChange={updateMask}
              onRequestAiMask={() => runAiMask(cropped, true)}
            />
          </div>
        )}

        {cropped && maskDataUrl && (
          <>
            <BackgroundPicker value={backgroundId} onChange={updateBackground} />
            <StickerControls value={sticker} onChange={updateSticker} />
            <section className="primary-action-section">
              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {error}
                </div>
              )}
              <button
                className="button button-primary big-action"
                type="button"
                disabled={processing || aiMaskRunning}
                onClick={() => runGeneration(false)}
              >
                <Wand2 size={20} />
                <span>{processing ? "Делаем..." : aiMaskRunning ? "Ждём AI-маску..." : "Сделать красиво!"}</span>
              </button>
            </section>
          </>
        )}

        <ProcessingState active={processing} />

        {result && cropped && (
          <ResultView
            beforeSrc={cropped.dataUrl}
            resultSrc={result.baseDataUrl}
            modelId={result.modelId}
            pinned={result.pinned}
            onDownload={() => downloadResult()}
            onShare={() => shareResult()}
            onPin={pinResult}
            onAgain={clearForNewAttempt}
            onOtherBackground={() => runGeneration(true)}
            onFixMask={() => maskSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        appConfig={appConfig}
        apiKey={apiKey}
        primaryModelId={primaryModelId}
        fallbackModelId={fallbackModelId}
        secondaryModelId={secondaryModelId}
        cameraEnabled={cameraEnabled}
        onClose={() => setSettingsOpen(false)}
        onApiKeyChange={updateApiKey}
        onPrimaryModelChange={(value) => {
          setPrimaryModelId(value);
          setStoredModelId("primary", value);
        }}
        onFallbackModelChange={(value) => {
          setFallbackModelId(value);
          setStoredModelId("fallback", value);
        }}
        onSecondaryModelChange={(value) => {
          setSecondaryModelId(value);
          setStoredModelId("secondary", value);
        }}
        onCameraEnabledChange={(value) => {
          setCameraEnabled(value);
          setStoredCameraEnabled(value);
        }}
      />

      <HistorySheet
        open={historyOpen}
        items={historyItems}
        onClose={() => setHistoryOpen(false)}
        onShare={(item) => shareDataUrl(item.resultDataUrl)}
        onDownload={(item) => downloadDataUrl(item.resultDataUrl)}
        onDelete={removeHistory}
        onClear={clearHistory}
      />
    </div>
  );
}

async function getMaskQualityWarning(
  maskSrc: string,
  image: CroppedImage,
  touchesEdge: boolean
): Promise<string> {
  const bounds = await getMaskBounds(maskSrc);
  const frameArea = image.width * image.height;
  if (!bounds || frameArea <= 0) {
    return "Похоже, кошку не удалось найти. Попробуйте другое фото или выделите кошку кистью.";
  }

  const boundsAreaRatio = (bounds.width * bounds.height) / frameArea;
  if (boundsAreaRatio < 0.015) {
    return "Маска получилась слишком маленькой. AI мог не найти кошку, проверьте выделение перед генерацией.";
  }
  if (boundsAreaRatio > 0.92) {
    return "Маска похожа почти на весь кадр. Лучше запустить AI-маску ещё раз или стереть лишний фон.";
  }

  const centerX = (bounds.x + bounds.width / 2) / image.width;
  const centerY = (bounds.y + bounds.height / 2) / image.height;
  if (Math.abs(centerX - 0.5) > 0.28 || Math.abs(centerY - 0.5) > 0.28) {
    return "Кошка заметно смещена от центра. Для лучшего результата поправьте кроп перед генерацией.";
  }

  const shortestSide = Math.min(image.width, image.height);
  const nearestEdge = Math.min(
    bounds.x,
    bounds.y,
    image.width - bounds.x - bounds.width,
    image.height - bounds.y - bounds.height
  );
  if (!touchesEdge && shortestSide > 0 && nearestEdge / shortestSide < 0.08) {
    return "Кошка почти у края кадра. Лучше оставить немного больше воздуха вокруг.";
  }

  return "";
}

function getForegroundOffsetY(backgroundId: BackgroundId, bounds: MaskBounds, frameHeight: number): number {
  const liftRatio = getForegroundLiftRatio(backgroundId);
  if (!liftRatio) return 0;

  const frameLift = frameHeight * liftRatio;
  const subjectLift = bounds.height * (liftRatio + 0.04);
  const safeTopLift = Math.max(0, bounds.y - frameHeight * 0.025);
  const lift = Math.min(safeTopLift, Math.max(frameLift, subjectLift));
  return -Math.round(lift);
}

function getForegroundLiftRatio(backgroundId: BackgroundId): number {
  if (backgroundId === "armchair") return 0.24;
  if (backgroundId === "blanket") return 0.13;
  if (backgroundId === "cozy_sofa") return 0.12;
  if (backgroundId === "windowsill") return 0.08;
  return 0;
}

function Notice({ kind, text }: { kind: "error" | "warning"; text: string }) {
  return (
    <div className={`notice notice-${kind}`}>
      <AlertCircle size={18} />
      <span>{text}</span>
    </div>
  );
}
