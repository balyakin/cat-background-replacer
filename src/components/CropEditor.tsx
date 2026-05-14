import { useCallback, useMemo, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { RefreshCcw, Scissors } from "lucide-react";
import { getAspectRatioValue, type AspectRatioId } from "../cropUtils";
import { getCroppedImage, type CroppedImage } from "../imageUtils";
import { AspectRatioPicker } from "./AspectRatioPicker";

type CropEditorProps = {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: AspectRatioId;
  jpegQuality: number;
  onAspectRatioChange: (value: AspectRatioId) => void;
  onApply: (image: CroppedImage) => void;
};

export function CropEditor({
  imageSrc,
  imageWidth,
  imageHeight,
  aspectRatio,
  jpegQuality,
  onAspectRatioChange,
  onApply
}: CropEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const aspect = useMemo(
    () => getAspectRatioValue(aspectRatio, imageWidth, imageHeight),
    [aspectRatio, imageHeight, imageWidth]
  );

  const handleComplete = useCallback((_area: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);

  const applyCrop = async () => {
    setBusy(true);
    try {
      const cropPixels = pixels ?? { x: 0, y: 0, width: imageWidth, height: imageHeight };
      const cropped = await getCroppedImage(imageSrc, cropPixels, jpegQuality);
      onApply(cropped);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="section-heading">
        <Scissors size={20} />
        <div>
          <h2>Кадрирование</h2>
          <p>Подберите формат публикации и оставьте воздух вокруг краёв.</p>
        </div>
      </div>

      <AspectRatioPicker value={aspectRatio} onChange={onAspectRatioChange} />

      <div className="crop-shell" style={{ aspectRatio: String(aspect) }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleComplete}
          minZoom={1}
          maxZoom={4}
          showGrid={false}
        />
      </div>

      <div className="control-row">
        <label className="range-label">
          <span>Масштаб</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <button
          className="button button-ghost"
          type="button"
          aria-label="Сбросить кадрирование"
          title="Сбросить"
          onClick={() => {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
          }}
        >
          <RefreshCcw size={18} />
          <span>Сбросить</span>
        </button>
        <button className="button button-primary min-w-36" type="button" onClick={applyCrop} disabled={busy}>
          <Scissors size={18} />
          <span>{busy ? "Готовим..." : "Применить"}</span>
        </button>
      </div>
    </section>
  );
}
