import { useEffect, useRef, useState } from "react";
import { Check, Eraser, MousePointer2, Paintbrush, Redo2, Sparkles, Square, Undo2 } from "lucide-react";
import { loadImageElement } from "../imageUtils";
import { eraseConnectedSimilarColor, paintEmptyMask, paintFullMask } from "../maskUtils";

type MaskTool = "keep" | "erase" | "smart";

type MaskEditorProps = {
  imageSrc: string;
  initialMaskSrc: string;
  aiBusy: boolean;
  aiStatus: string;
  onMaskChange: (maskDataUrl: string) => void;
  onRequestAiMask: () => void;
};

export function MaskEditor({
  imageSrc,
  initialMaskSrc,
  aiBusy,
  aiStatus,
  onMaskChange,
  onRequestAiMask
}: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<MaskTool>("erase");
  const [brushSize, setBrushSize] = useState(42);
  const [smartTolerance, setSmartTolerance] = useState(38);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("Клетчатая область станет новым фоном.");

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      setReady(false);
      const [image, maskImage] = await Promise.all([loadImageElement(imageSrc), loadImageElement(initialMaskSrc)]);
      if (cancelled) return;

      imageRef.current = image;
      const visible = canvasRef.current;
      if (!visible) return;
      visible.width = image.naturalWidth;
      visible.height = image.naturalHeight;

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = image.naturalWidth;
      maskCanvas.height = image.naturalHeight;
      const maskContext = maskCanvas.getContext("2d");
      if (!maskContext) return;
      maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
      maskCanvasRef.current = maskCanvas;
      setUndoStack([]);
      setRedoStack([]);
      render();
      setReady(true);
    };

    setup().catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [imageSrc, initialMaskSrc]);

  const render = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !image || !maskCanvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    drawChecker(context, canvas.width, canvas.height);

    const clipped = document.createElement("canvas");
    clipped.width = canvas.width;
    clipped.height = canvas.height;
    const clippedContext = clipped.getContext("2d");
    if (!clippedContext) return;
    clippedContext.drawImage(image, 0, 0, canvas.width, canvas.height);
    clippedContext.globalCompositeOperation = "destination-in";
    clippedContext.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);

    context.drawImage(clipped, 0, 0);
  };

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "smart") {
      pushUndo();
      smartErase(getCanvasPoint(event));
      return;
    }
    drawingRef.current = true;
    lastPointRef.current = getCanvasPoint(event);
    pushUndo();
    drawStroke(lastPointRef.current, lastPointRef.current);
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const point = getCanvasPoint(event);
    drawStroke(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) onMaskChange(maskCanvas.toDataURL("image/png"));
  };

  const pushUndo = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    setUndoStack((current) => [...current.slice(-19), maskCanvas.toDataURL("image/png")]);
    setRedoStack([]);
  };

  const drawStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const context = maskCanvas.getContext("2d");
    if (!context) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = tool === "keep" ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
    context.fillStyle = context.strokeStyle;
    context.globalCompositeOperation = tool === "keep" ? "source-over" : "destination-out";
    context.lineWidth = brushSize;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    render();
  };

  const smartErase = (point: { x: number; y: number }) => {
    const maskCanvas = maskCanvasRef.current;
    const image = imageRef.current;
    if (!maskCanvas || !image) return;
    const removed = eraseConnectedSimilarColor(maskCanvas, image, point, smartTolerance);
    render();
    onMaskChange(maskCanvas.toDataURL("image/png"));
    setHint(
      removed > 0
        ? `Удалено похожих пикселей: ${removed.toLocaleString("ru-RU")}.`
        : "Похожая область не найдена, увеличьте допуск или используйте ластик."
    );
  };

  const restoreSnapshot = async (snapshot: string) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const image = await loadImageElement(snapshot);
    const context = maskCanvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    context.drawImage(image, 0, 0, maskCanvas.width, maskCanvas.height);
    render();
    onMaskChange(maskCanvas.toDataURL("image/png"));
  };

  const undo = async () => {
    const current = maskCanvasRef.current?.toDataURL("image/png");
    const snapshot = undoStack.at(-1);
    if (!snapshot || !current) return;
    setUndoStack((items) => items.slice(0, -1));
    setRedoStack((items) => [...items, current]);
    await restoreSnapshot(snapshot);
  };

  const redo = async () => {
    const current = maskCanvasRef.current?.toDataURL("image/png");
    const snapshot = redoStack.at(-1);
    if (!snapshot || !current) return;
    setRedoStack((items) => items.slice(0, -1));
    setUndoStack((items) => [...items, current]);
    await restoreSnapshot(snapshot);
  };

  const keepEverything = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    pushUndo();
    const context = maskCanvas.getContext("2d");
    if (!context) return;
    paintFullMask(context, maskCanvas.width, maskCanvas.height);
    render();
    onMaskChange(maskCanvas.toDataURL("image/png"));
    setHint("Весь исходный кадр оставлен поверх нового фона.");
  };

  const clearEverything = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    pushUndo();
    const context = maskCanvas.getContext("2d");
    if (!context) return;
    paintEmptyMask(context, maskCanvas.width, maskCanvas.height);
    render();
    onMaskChange(maskCanvas.toDataURL("image/png"));
    setHint("Маска очищена. Верните кошку кистью.");
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  return (
    <section className="section">
      <div className="section-heading">
        <Paintbrush size={20} />
        <div>
          <h2>Маска</h2>
          <p>Клетчатая область станет новым фоном. Сначала удалите фон, потом верните кошку кистью.</p>
        </div>
      </div>

      <div className="mask-toolbar">
        <button
          type="button"
          className={tool === "keep" ? "tool-button is-active" : "tool-button"}
          onClick={() => setTool("keep")}
        >
          <Paintbrush size={18} />
          <span>Вернуть</span>
        </button>
        <button
          type="button"
          className={tool === "erase" ? "tool-button is-active" : "tool-button"}
          onClick={() => setTool("erase")}
        >
          <Eraser size={18} />
          <span>Убрать</span>
        </button>
        <button
          type="button"
          className={tool === "smart" ? "tool-button is-active" : "tool-button"}
          onClick={() => setTool("smart")}
        >
          <MousePointer2 size={18} />
          <span>Фон по тапу</span>
        </button>
        <button className="icon-button" type="button" title="Undo" aria-label="Undo" onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-button" type="button" title="Redo" aria-label="Redo" onClick={redo}>
          <Redo2 size={18} />
        </button>
      </div>

      <div className="mask-quick-actions">
        <button className="button button-secondary" type="button" onClick={onRequestAiMask} disabled={aiBusy}>
          <Sparkles size={18} />
          <span>{aiBusy ? "AI..." : "AI-маска"}</span>
        </button>
        <button className="button button-ghost" type="button" onClick={clearEverything}>
          <Square size={18} />
          <span>Пустая</span>
        </button>
        <button className="button button-ghost" type="button" onClick={keepEverything}>
          <Square size={18} />
          <span>Весь кадр</span>
        </button>
      </div>

      <label className="range-label">
        <span>{tool === "smart" ? "Допуск похожего фона" : "Размер кисти"}</span>
        <input
          type="range"
          min={tool === "smart" ? 12 : 8}
          max={tool === "smart" ? 90 : 120}
          value={tool === "smart" ? smartTolerance : brushSize}
          onChange={(event) =>
            tool === "smart"
              ? setSmartTolerance(Number(event.target.value))
              : setBrushSize(Number(event.target.value))
          }
        />
      </label>

      <div className="mask-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="mask-canvas"
          onPointerDown={beginStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
      </div>

      <div className="inline-status">
        <Check size={16} />
        <span>{aiBusy ? aiStatus || "AI ищет кошку..." : ready ? hint : "Готовим редактор маски..."}</span>
      </div>
    </section>
  );
}

function drawChecker(context: CanvasRenderingContext2D, width: number, height: number): void {
  const size = Math.max(12, Math.round(Math.min(width, height) / 36));
  context.fillStyle = "#f3f4f6";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#d6d3d1";
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((x / size + y / size) % 2 === 0) {
        context.fillRect(x, y, size, size);
      }
    }
  }
}
