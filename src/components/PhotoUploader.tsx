import { Camera, ImagePlus, UploadCloud } from "lucide-react";

type PhotoUploaderProps = {
  previewSrc?: string;
  cameraEnabled: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
};

export function PhotoUploader({ previewSrc, cameraEnabled, disabled, onSelect }: PhotoUploaderProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    event.target.value = "";
  };

  return (
    <section className="section">
      <div className="section-heading">
        <UploadCloud size={20} />
        <div>
          <h2>Фото</h2>
          <p>Выберите готовый снимок или сделайте новый.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="upload-zone">
          <input
            className="sr-only"
            type="file"
            accept="image/*,.heic,.heif"
            disabled={disabled}
            onChange={handleChange}
          />
          {previewSrc ? (
            <img src={previewSrc} alt="Превью выбранного фото" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-center">
              <ImagePlus size={30} />
              <span className="font-semibold">Выбрать из галереи</span>
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-2 sm:w-44 sm:grid-cols-1">
          <label className="button button-primary">
            <ImagePlus size={18} />
            <span>Галерея</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*,.heic,.heif"
              disabled={disabled}
              onChange={handleChange}
            />
          </label>
          {cameraEnabled && (
            <label className="button button-secondary">
              <Camera size={18} />
              <span>Камера</span>
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={disabled}
                onChange={handleChange}
              />
            </label>
          )}
        </div>
      </div>
    </section>
  );
}
