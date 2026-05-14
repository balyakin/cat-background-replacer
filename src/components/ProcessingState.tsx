import { useEffect, useState } from "react";

const MESSAGES = [
  "Готовим фон...",
  "Расставляем софтбоксы...",
  "Подбираем мягкий свет...",
  "Собираем финальное фото..."
];

type ProcessingStateProps = {
  active: boolean;
};

export function ProcessingState({ active }: ProcessingStateProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setMessageIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % MESSAGES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <section className="section">
      <div className="progress-line">
        <span />
      </div>
      <p className="text-center font-semibold text-kotofon-primary dark:text-orange-300">
        {MESSAGES[messageIndex]}
      </p>
    </section>
  );
}
