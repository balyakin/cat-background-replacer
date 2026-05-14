import { Download, History, Share2, Trash2, XCircle } from "lucide-react";
import type { HistoryItem } from "../historyStorage";

type HistorySheetProps = {
  open: boolean;
  items: HistoryItem[];
  onClose: () => void;
  onShare: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onClear: () => void;
};

export function HistorySheet({
  open,
  items,
  onClose,
  onShare,
  onDownload,
  onDelete,
  onClear
}: HistorySheetProps) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="История">
      <div className="sheet">
        <div className="sheet-header">
          <div className="section-heading m-0">
            <History size={20} />
            <div>
              <h2>История</h2>
              <p>Последние удачные результаты хранятся на устройстве.</p>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть историю" onClick={onClose}>
            <XCircle size={20} />
          </button>
        </div>

        <div className="sheet-body">
          {items.length === 0 ? (
            <p className="empty-state">Пока нет сохранённых результатов.</p>
          ) : (
            <>
              <div className="history-list">
                {items.map((item) => (
                  <article className="history-item" key={item.id}>
                    <img src={item.resultDataUrl} alt={item.backgroundName} />
                    <div className="min-w-0">
                      <h3>{item.backgroundName}</h3>
                      <p>
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(item.createdAt))}{" "}
                        · {item.aspectRatio}
                      </p>
                      {item.pinned && <span className="pin-label">В удачных</span>}
                    </div>
                    <div className="history-actions">
                      <button className="icon-button" type="button" aria-label="Поделиться" onClick={() => onShare(item)}>
                        <Share2 size={17} />
                      </button>
                      <button className="icon-button" type="button" aria-label="Скачать" onClick={() => onDownload(item)}>
                        <Download size={17} />
                      </button>
                      <button className="icon-button danger" type="button" aria-label="Удалить" onClick={() => onDelete(item)}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <button className="button button-ghost w-full" type="button" onClick={onClear}>
                <Trash2 size={18} />
                <span>Очистить незакреплённые</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
