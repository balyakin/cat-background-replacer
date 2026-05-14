import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Settings, XCircle } from "lucide-react";
import type { AppConfig, OpenRouterModelConfig } from "../config";
import { testOpenRouterKey } from "../api";

type SettingsSheetProps = {
  open: boolean;
  appConfig: AppConfig;
  apiKey: string;
  primaryModelId: string;
  fallbackModelId: string;
  secondaryModelId: string;
  cameraEnabled: boolean;
  onClose: () => void;
  onApiKeyChange: (value: string) => void;
  onPrimaryModelChange: (value: string) => void;
  onFallbackModelChange: (value: string) => void;
  onSecondaryModelChange: (value: string) => void;
  onCameraEnabledChange: (value: boolean) => void;
};

export function SettingsSheet({
  open,
  appConfig,
  apiKey,
  primaryModelId,
  fallbackModelId,
  secondaryModelId,
  cameraEnabled,
  onClose,
  onApiKeyChange,
  onPrimaryModelChange,
  onFallbackModelChange,
  onSecondaryModelChange,
  onCameraEnabledChange
}: SettingsSheetProps) {
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setKeyStatus("idle");
      setMessage("");
    }
  }, [open]);

  if (!open) return null;

  const models = [
    appConfig.openRouter.primaryBackgroundModel,
    appConfig.openRouter.fallbackBackgroundModel,
    appConfig.openRouter.secondaryFallbackBackgroundModel
  ].filter(Boolean) as OpenRouterModelConfig[];

  const checkKey = async () => {
    setKeyStatus("checking");
    setMessage("");
    try {
      await testOpenRouterKey(apiKey);
      setKeyStatus("ok");
      setMessage("Работает");
    } catch (error) {
      setKeyStatus("error");
      setMessage(error instanceof Error ? error.message : "Ошибка проверки ключа");
    }
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Настройки">
      <div className="sheet">
        <div className="sheet-header">
          <div className="section-heading m-0">
            <Settings size={20} />
            <div>
              <h2>Настройки</h2>
              <p>Ключ хранится только в localStorage этого браузера.</p>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть настройки" onClick={onClose}>
            <XCircle size={20} />
          </button>
        </div>

        <div className="sheet-body">
          <label className="field-label">
            <span>OpenRouter API Key</span>
            <input
              type="password"
              value={apiKey}
              placeholder="sk-or-..."
              onChange={(event) => onApiKeyChange(event.target.value)}
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button className="button button-secondary" type="button" onClick={checkKey} disabled={keyStatus === "checking"}>
              <KeyRound size={18} />
              <span>{keyStatus === "checking" ? "Проверяем..." : "Проверить ключ"}</span>
            </button>
            <div className={`key-status status-${keyStatus}`}>
              {keyStatus === "ok" && <CheckCircle2 size={16} />}
              {keyStatus === "error" && <XCircle size={16} />}
              <span>{message || "Не проверен"}</span>
            </div>
          </div>

          <ModelField
            label="Основная модель фона"
            value={primaryModelId}
            models={models}
            onChange={onPrimaryModelChange}
          />
          <ModelField
            label="Fallback-модель фона"
            value={fallbackModelId}
            models={models}
            onChange={onFallbackModelChange}
          />
          <ModelField
            label="Дополнительный fallback"
            value={secondaryModelId}
            models={models}
            onChange={onSecondaryModelChange}
          />

          <label className="toggle-line">
            <input
              type="checkbox"
              checked={cameraEnabled}
              onChange={(event) => onCameraEnabledChange(event.target.checked)}
            />
            <span>Камера</span>
          </label>
        </div>
      </div>
    </div>
  );
}

type ModelFieldProps = {
  label: string;
  value: string;
  models: OpenRouterModelConfig[];
  onChange: (value: string) => void;
};

function ModelField({ label, value, models, onChange }: ModelFieldProps) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input list={`${label}-models`} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={`${label}-models`}>
        {models.map((model) => (
          <option key={model.id} value={model.id} />
        ))}
      </datalist>
    </label>
  );
}
