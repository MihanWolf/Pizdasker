import { useEffect } from 'react';
import { useStore } from './core/store';
import { Shopping } from './modules/shopping/Shopping';
import { Notes } from './modules/notes/Notes';
import { Plants } from './modules/plants/Plants';
import { Tasks } from './modules/tasks/Tasks';
import { Finance } from './modules/finance/Finance';
import { Today } from './modules/today/Today';
import { Study } from './modules/study/Study';
import { BackupBar } from './modules/BackupBar';
import { ModeSwitch } from './app/ModeSwitch';
import { ConfirmProvider } from './ui/ConfirmDialog';

function ActiveModule() {
  const mode = useStore((s) => s.state.mode);
  if (mode === 'today') return <Today />;
  if (mode === 'shopping') return <Shopping />;
  if (mode === 'notes') return <Notes />;
  if (mode === 'plants') return <Plants />;
  if (mode === 'tasks') return <Tasks />;
  if (mode === 'finance') return <Finance />;
  if (mode === 'study') return <Study />;
  return (
    <div style={{ padding: 40, color: 'var(--ink-faint)', fontFamily: 'monospace', fontSize: 13 }}>
      Этот раздел ещё не перенесён на React — на очереди по плану миграции.
    </div>
  );
}

export default function App() {
  const { loaded, load, saveStatus } = useStore();

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return null;

  return (
    <ConfirmProvider>
      <div className="app-shell">
        <ModeSwitch />
        <div className="app-main">
          <ActiveModule />
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 16, fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-faint)' }}>
        {saveStatus.text}
      </div>
      <BackupBar />
    </ConfirmProvider>
  );
}
