import { BACKGROUNDS, type BackgroundId } from "../backgrounds";

type BackgroundPickerProps = {
  value: BackgroundId;
  onChange: (value: BackgroundId) => void;
};

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  return (
    <section className="section">
      <div>
        <h2>Фон</h2>
        <p className="section-copy">Выберите стиль, который OpenRouter сгенерирует без кошки и людей.</p>
      </div>
      <div className="background-scroll">
        {BACKGROUNDS.map((background) => (
          <button
            key={background.id}
            type="button"
            className={background.id === value ? "background-card is-active" : "background-card"}
            onClick={() => onChange(background.id)}
          >
            <span className={`background-swatch swatch-${background.id}`} />
            <span className="font-semibold">{background.name}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">{background.short}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
