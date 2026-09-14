import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, PALETTE, COLOR_VARS, type TaskProject } from '../../core/types';
import { taskOpenCount, taskProjectItems, filteredTasksForProject, paymentDaysUntil, paymentDueLabel, paymentAccent } from '../../core/selectors';
import { useConfirm, useNamePrompt } from '../../ui/ConfirmDialog';
import { ChecklistIcon } from '../../ui/icons';
import { TaskDrawer } from './TaskDrawer';
import './tasks.css';

export function Tasks() {
  const { state, update } = useStore();
  const namePrompt = useNamePrompt();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const project = state.taskProjects.find((p) => p.id === state.activeTaskProjectId) ?? null;
  const projectItems = project ? taskProjectItems(state, project.id) : [];
  const doneCount = projectItems.filter((t) => t.done).length;

  const selectProject = (id: string | null) => update((draft) => {
    draft.activeTaskProjectId = id;
    draft.tasksView = 'current';
  });

  const addProject = async () => {
    const name = await namePrompt('Новый проект', 'Например, Дом');
    if (!name) return;
    const proj: TaskProject = { id: uid(), name, color: PALETTE[state.taskProjects.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => {
      draft.taskProjects.push(proj);
      draft.activeTaskProjectId = proj.id;
      draft.tasksView = 'current';
    });
  };

  return (
    <div className="tasks-wrap content-scroll">
      <div className="tasks-header">
        <div>
          <div className="tasks-kicker"><ChecklistIcon /> проекты и шаги</div>
          <h1 className="tasks-title display">Задачи</h1>
        </div>
        <div className="tasks-summary">{doneCount} / {projectItems.length} выполнено</div>
      </div>

      <div className="task-tabs" role="tablist">
        {state.taskProjects.map((p) => {
          const count = taskOpenCount(state, p.id);
          const active = p.id === state.activeTaskProjectId;
          return (
            <button
              key={p.id}
              className={'task-tab' + (active ? ' active' : '')}
              style={active ? { borderBottomColor: COLOR_VARS[p.color] || COLOR_VARS.rust } : undefined}
              onClick={() => selectProject(p.id)}
            >
              <span className="task-tab-dot" style={{ background: COLOR_VARS[p.color] || COLOR_VARS.rust }} />
              {p.name} <span>{count}</span>
            </button>
          );
        })}
        <button className="task-tab task-tab-add" onClick={addProject}>+ проект</button>
      </div>

      {!project ? (
        <div className="task-empty">
          <span className="display">Начни с проекта</span>
          Создай вкладку «Дом», «Работа» или «Личное», а потом добавь в неё шаги.
        </div>
      ) : (
        <ProjectView project={project} onOpenTask={setOpenTaskId} />
      )}

      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}

function ProjectView({ project, onOpenTask }: { project: TaskProject; onOpenTask: (id: string) => void }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [important, setImportant] = useState(false);

  const view = state.tasksView;
  const setView = (v: 'current' | 'archive') => update((draft) => { draft.tasksView = v; });

  const items = filteredTasksForProject(state, project.id, view);
  const currentCount = filteredTasksForProject(state, project.id, 'current').length;
  const archiveCount = filteredTasksForProject(state, project.id, 'archive').length;

  const renameProject = (name: string) => {
    if (!name) return;
    update((draft) => {
      const p = draft.taskProjects.find((x) => x.id === project.id);
      if (p) p.name = name;
    });
  };

  const cycleColor = () => {
    update((draft) => {
      const p = draft.taskProjects.find((x) => x.id === project.id);
      if (p) {
        const idx = PALETTE.indexOf(p.color);
        p.color = PALETTE[(idx + 1) % PALETTE.length];
      }
    });
  };

  const addTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    update((draft) => {
      draft.taskItems.unshift({ id: uid(), projectId: project.id, title: trimmed, important, done: false, createdAt: Date.now(), completedAt: null });
    });
    setTitle('');
    setImportant(false);
  };

  const toggleDone = (id: string) => {
    update((draft) => {
      const item = draft.taskItems.find((t) => t.id === id);
      if (item) { item.done = !item.done; item.completedAt = item.done ? Date.now() : null; }
    });
  };

  const toggleImportant = (id: string) => {
    update((draft) => {
      const item = draft.taskItems.find((t) => t.id === id);
      if (item) item.important = !item.important;
    });
  };

  const remove = (id: string) => {
    update((draft) => { draft.taskItems = draft.taskItems.filter((t) => t.id !== id); });
  };

  const deleteProject = async () => {
    const ok = await confirm({
      title: 'Удалить проект?',
      message: `«${project.name}» и все его шаги будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.taskProjects = draft.taskProjects.filter((p) => p.id !== project.id);
      draft.taskItems = draft.taskItems.filter((t) => t.projectId !== project.id);
      draft.activeTaskProjectId = null;
    });
  };

  return (
    <>
      <div className="task-project-title">
        <div className="task-project-head">
          <div className="subject-dot" style={{ background: COLOR_VARS[project.color] || COLOR_VARS.rust }} onClick={cycleColor} title="Сменить цвет" />
          <div>
            <span className="task-project-kicker">проект</span>
            <h2
              className="display"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={(e) => renameProject(e.currentTarget.textContent?.trim() ?? '')}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
            >
              {project.name}
            </h2>
          </div>
        </div>
        <button className="task-project-delete" title="Удалить проект" onClick={deleteProject}>×</button>
      </div>

      <div className="task-add-row">
        <input
          type="text"
          placeholder="Добавить шаг, например: наклеить обои"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <label><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> важно</label>
        <button onClick={addTask}>Добавить</button>
      </div>

      <div className="task-filter-tabs" style={{ ['--task-accent' as string]: COLOR_VARS[project.color] || COLOR_VARS.rust }}>
        <button className={'task-filter' + (view === 'current' ? ' active' : '')} onClick={() => setView('current')}>Открытые <span>{currentCount}</span></button>
        <button className={'task-filter' + (view === 'archive' ? ' active' : '')} onClick={() => setView('archive')}>Готовые <span>{archiveCount}</span></button>
      </div>

      <div className="task-list" style={{ ['--task-accent' as string]: COLOR_VARS[project.color] || COLOR_VARS.rust }}>
        {items.length === 0 && (
          <div className="task-empty task-empty-small">{view === 'archive' ? 'Готовых шагов пока нет' : 'Все шаги выполнены или список пока пуст'}</div>
        )}
        {items.map((item) => {
          const daysUntil = paymentDaysUntil(item.dueDate);
          const hasNote = !!item.note?.trim();
          return (
            <div key={item.id} className={'task-row task-row-enter' + (item.done ? ' done' : '')} style={{ ['--task-accent' as string]: COLOR_VARS[project.color] || COLOR_VARS.rust }} onClick={() => onOpenTask(item.id)}>
              <button className={'task-check' + (item.done ? ' checked' : '')} aria-label={item.done ? 'Вернуть в задачи' : 'Отметить выполненной'} onClick={(e) => { e.stopPropagation(); toggleDone(item.id); }} />
              <div className="task-row-copy">
                <strong>{item.title}</strong>
                <small>
                  <span>{item.done ? 'готово' : item.important ? 'важно' : 'шаг проекта'}</span>
                  {item.dueDate && (
                    <span className="task-row-due" style={{ color: item.done ? undefined : paymentAccent(daysUntil) }}>
                      {paymentDueLabel(daysUntil)}
                    </span>
                  )}
                  {hasNote && <span className="task-row-note">заметка</span>}
                </small>
              </div>
              <button className={'task-important' + (item.important ? ' active' : '')} title={item.important ? 'Убрать из важных' : 'Отметить важной'} onClick={(e) => { e.stopPropagation(); toggleImportant(item.id); }}>★</button>
              <button className="task-delete" title="Удалить" onClick={(e) => { e.stopPropagation(); remove(item.id); }}>×</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
