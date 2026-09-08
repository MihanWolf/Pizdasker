import { useStore } from '../core/store';
import type { AppMode } from '../core/types';
import './sidebar.css';

const MODE_LABELS: { mode: AppMode; label: string; ready: boolean }[] = [
  { mode: 'today', label: 'Сегодня', ready: true },
  { mode: 'tasks', label: 'Задачи', ready: true },
  { mode: 'finance', label: 'Финансы', ready: true },
  { mode: 'shopping', label: 'Покупки', ready: true },
  { mode: 'notes', label: 'Заметки', ready: true },
  { mode: 'plants', label: 'Полив', ready: true },
  { mode: 'study', label: 'Учёба', ready: true },
];

export function ModeSwitch() {
  const { state, update } = useStore();

  return (
    <nav className="mode-switch">
      {MODE_LABELS.map(({ mode, label, ready }) => (
        <button
          key={mode}
          className={'mode-switch-btn' + (state.mode === mode ? ' active' : '') + (!ready ? ' pending' : '')}
          title={ready ? label : `${label} — переносится на одном из следующих этапов`}
          disabled={!ready}
          onClick={() => update((draft) => { draft.mode = mode; })}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
