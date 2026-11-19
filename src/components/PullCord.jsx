import { useEffect, useRef, useState } from 'react';

export default function PullCord({ isNight, onToggle, compact = false }) {
  const [pulling, setPulling] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function pull(event) {
    window.clearTimeout(timer.current);
    setPulling(true);
    onToggle(event.currentTarget);
    timer.current = window.setTimeout(() => setPulling(false), 650);
  }

  return (
    <button
      className={`lamp-control pull-cord-control${compact ? ' is-compact' : ''}${isNight ? ' is-night' : ''}${pulling ? ' is-pulling' : ''}`}
      type="button"
      aria-pressed={isNight}
      aria-label={`Сейчас ${isNight ? 'ночной' : 'дневной'} режим. Нажмите, чтобы включить ${isNight ? 'дневной' : 'ночной'}`}
      title="Потяните за шнур, чтобы сменить свет"
      onClick={pull}
    >
      <span className="pull-cord-illustration" aria-hidden="true">
        <span className="cord-ceiling" />
        <span className="cord-lamp-shade"><i /></span>
        <span className="cord-wire"><i /></span>
        <span className="cord-knob" />
      </span>
      {!compact && <span className="pull-cord-copy">
        <strong>Торшер</strong>
        <small>{pulling ? 'шнур качнулся' : isNight ? 'в комнате тихий вечер' : 'в комнате дневной свет'}</small>
      </span>}
      {!compact && <span className="pull-cord-hint" aria-hidden="true">Потянуть</span>}
    </button>
  );
}
