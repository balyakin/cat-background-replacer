import { ASPECT_RATIOS, type AspectRatioId } from "../cropUtils";

type AspectRatioPickerProps = {
  value: AspectRatioId;
  onChange: (value: AspectRatioId) => void;
};

export function AspectRatioPicker({ value, onChange }: AspectRatioPickerProps) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Формат кадра">
      {ASPECT_RATIOS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? "is-active" : ""}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          <span className="font-semibold">{option.label}</span>
          <span className="text-[11px] text-stone-500 dark:text-stone-400">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
