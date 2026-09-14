import { useStore } from '../core/store';
import { uid, COLOR_VARS, PALETTE, type AppMode } from '../core/types';
import { subjectProgress } from '../core/selectors';
import { useNamePrompt } from '../ui/ConfirmDialog';
import { SunIcon, ChecklistIcon, WalletIcon, BagIcon, QuoteIcon, DropletIcon, BookIcon } from '../ui/icons';

const MODE_BUTTONS: { mode: AppMode; title: string; icon: React.ReactNode }[] = [
  { mode: 'today', title: 'Главная', icon: <SunIcon /> },
  { mode: 'finance', title: 'Финансы', icon: <WalletIcon /> },
  { mode: 'tasks', title: 'Задачи', icon: <ChecklistIcon /> },
  { mode: 'shopping', title: 'Покупки', icon: <BagIcon /> },
  { mode: 'notes', title: 'Заметки', icon: <QuoteIcon /> },
  { mode: 'plants', title: 'Полив', icon: <DropletIcon /> },
  { mode: 'study', title: 'Учёба', icon: <BookIcon /> },
];

export function Shelf() {
  const { state, update } = useStore();
  const namePrompt = useNamePrompt();

  const addSubject = async () => {
    const name = await namePrompt('Новый предмет', 'Например, История');
    if (!name) return;
    const sub = { id: uid(), name, color: PALETTE[state.subjects.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.subjects.push(sub); draft.activeSubjectId = sub.id; });
  };

  const addNotePage = async () => {
    const name = await namePrompt('Новая страница заметок', 'Например, Стоицизм');
    if (!name) return;
    const page = { id: uid(), name, color: PALETTE[state.notePages.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.notePages.push(page); draft.activeNotePageId = page.id; });
  };

  const addPlant = async () => {
    const name = await namePrompt('Новое растение', 'Например, Монстера');
    if (!name) return;
    const plant = { id: uid(), name, color: PALETTE[state.plants.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.plants.push(plant); draft.activePlantId = plant.id; });
  };

  return (
    <aside className="shelf">
      <nav className="mode-switch">
        {MODE_BUTTONS.map(({ mode, title, icon }) => (
          <button
            key={mode}
            className={'mode-btn' + (state.mode === mode ? ' active' : '')}
            title={title}
            aria-label={title}
            onClick={() => update((draft) => { draft.mode = mode; })}
          >
            {icon}
          </button>
        ))}
      </nav>

      <div className="shelf-divider" />

      {state.mode === 'study' && (
        <>
          {state.subjects.map((sub) => {
            const { done, total } = subjectProgress(state, sub.id);
            return (
              <div
                key={sub.id}
                className={'spine' + (sub.id === state.activeSubjectId ? ' active' : '')}
                style={{ background: COLOR_VARS[sub.color] || COLOR_VARS.teal }}
                onClick={() => update((draft) => { draft.activeSubjectId = sub.id; draft.studySearch = ''; })}
              >
                <div className="spine-label">{sub.name}</div>
                <div className="spine-count">{done}/{total}</div>
              </div>
            );
          })}
          <button className="add-subject-btn" title="Добавить предмет" onClick={addSubject}>+</button>
        </>
      )}

      {state.mode === 'notes' && (
        <>
          {state.notePages.map((page) => {
            const count = state.noteEntries.filter((e) => e.pageId === page.id).length;
            return (
              <div
                key={page.id}
                className={'spine' + (page.id === state.activeNotePageId ? ' active' : '')}
                style={{ background: COLOR_VARS[page.color] || COLOR_VARS.plum }}
                onClick={() => update((draft) => { draft.activeNotePageId = page.id; draft.notesSearch = ''; })}
              >
                <div className="spine-label">{page.name}</div>
                <div className="spine-count">{count}</div>
              </div>
            );
          })}
          <button className="add-subject-btn" title="Добавить страницу заметок" onClick={addNotePage}>+</button>
        </>
      )}

      {state.mode === 'plants' && (
        <>
          {state.plants.map((plant) => {
            const count = state.waterings.filter((w) => w.plantId === plant.id).length;
            return (
              <div
                key={plant.id}
                className={'spine' + (plant.id === state.activePlantId ? ' active' : '')}
                style={{ background: COLOR_VARS[plant.color] || COLOR_VARS.forest }}
                onClick={() => update((draft) => { draft.activePlantId = plant.id; draft.plantsSearch = ''; })}
              >
                <div className="spine-label">{plant.name}</div>
                <div className="spine-count">{count}</div>
              </div>
            );
          })}
          <button className="add-subject-btn" title="Добавить растение" onClick={addPlant}>+</button>
        </>
      )}
    </aside>
  );
}
