import { useState } from "react";

type CompareSliderProps = {
  beforeSrc: string;
  afterSrc: string;
};

export function CompareSlider({ beforeSrc, afterSrc }: CompareSliderProps) {
  const [value, setValue] = useState(50);

  return (
    <div className="compare">
      <div className="compare-frame">
        <img src={beforeSrc} alt="До обработки" className="compare-img" />
        <div className="compare-after" style={{ width: `${value}%` }}>
          <img src={afterSrc} alt="После обработки" className="compare-img" />
        </div>
        <span className="compare-label compare-label-before">До</span>
        <span className="compare-label compare-label-after">После</span>
        <div className="compare-divider" style={{ left: `${value}%` }} />
      </div>
      <input
        aria-label="Сравнение до и после"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    </div>
  );
}
