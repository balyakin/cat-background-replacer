import { Download, History, RefreshCcw, Share2, SlidersHorizontal, Wand2 } from "lucide-react";
import { CompareSlider } from "./CompareSlider";

type ResultViewProps = {
  beforeSrc: string;
  resultSrc: string;
  modelId?: string;
  pinned: boolean;
  onDownload: () => void;
  onShare: () => void;
  onPin: () => void;
  onAgain: () => void;
  onOtherBackground: () => void;
  onFixMask: () => void;
};

export function ResultView({
  beforeSrc,
  resultSrc,
  modelId,
  pinned,
  onDownload,
  onShare,
  onPin,
  onAgain,
  onOtherBackground,
  onFixMask
}: ResultViewProps) {
  return (
    <section className="section result-section">
      <div>
        <h2>Результат</h2>
        {modelId && <p className="section-copy">Фон сгенерирован моделью {modelId}</p>}
      </div>

      <img src={resultSrc} alt="Готовый результат" className="result-image" />
      <CompareSlider beforeSrc={beforeSrc} afterSrc={resultSrc} />

      <div className="action-grid">
        <button className="button button-primary" type="button" onClick={onShare}>
          <Share2 size={18} />
          <span>Поделиться</span>
        </button>
        <button className="button button-secondary" type="button" onClick={onDownload}>
          <Download size={18} />
          <span>Скачать</span>
        </button>
        <button className="button button-secondary" type="button" onClick={onPin} disabled={pinned}>
          <History size={18} />
          <span>{pinned ? "В удачных" : "В удачные"}</span>
        </button>
        <button className="button button-ghost" type="button" onClick={onOtherBackground}>
          <Wand2 size={18} />
          <span>Другой фон</span>
        </button>
        <button className="button button-ghost" type="button" onClick={onFixMask}>
          <SlidersHorizontal size={18} />
          <span>Поправить маску</span>
        </button>
        <button className="button button-ghost" type="button" onClick={onAgain}>
          <RefreshCcw size={18} />
          <span>Ещё раз</span>
        </button>
      </div>
    </section>
  );
}
