import { useStore } from '../core/store';
import type { AppMode } from '../core/types';
import './sidebar.css';

const ICONS: Record<AppMode, string> = {
  today: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>',
  tasks: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/></svg>',
  finance: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M16.5 13a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" fill="currentColor" stroke="none"/></svg>',
  shopping: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l1 13H4L5 8z"/><path d="M8 8a4 4 0 0 1 8 0"/></svg>',
  notes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7c-2.2 0-4 1.8-4 4.5S4.8 16 7 16c.3 0 .6 0 .9-.1C7.4 18 5.7 19.4 3 19.9v2C7.4 21.4 10 18.7 10 14 10 10.1 8.7 7 7 7zm10.3 0c-2.2 0-4 1.8-4 4.5S15.1 16 17.3 16c.3 0 .6 0 .9-.1-.5 2.1-2.2 3.5-4.9 4v2c4.4-.5 7-3.2 7-7.9 0-3.9-1.3-7-3-7z"/></svg>',
  plants: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/></svg>',
  study: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>',
};

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
          aria-label={label}
          disabled={!ready}
          onClick={() => update((draft) => { draft.mode = mode; })}
          dangerouslySetInnerHTML={{ __html: ICONS[mode] }}
        />
      ))}
    </nav>
  );
}