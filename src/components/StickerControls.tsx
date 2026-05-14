import { Home } from "lucide-react";
import type { StickerSettings } from "../storage";

type StickerControlsProps = {
  value: StickerSettings;
  onChange: (value: StickerSettings) => void;
};

export function StickerControls({ value, onChange }: StickerControlsProps) {
  return (
    <section className="section">
      <div className="section-heading">
        <Home size={20} />
        <div>
          <h2>Плашка</h2>
          <p>Добавляется локально на готовое фото.</p>
        </div>
      </div>
      <label className="toggle-line">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        <span>Ищу дом</span>
      </label>
      <label className="field-label">
        <span>Имя</span>
        <input
          type="text"
          placeholder="Например, Мурка"
          value={value.name}
          maxLength={24}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
    </section>
  );
}
