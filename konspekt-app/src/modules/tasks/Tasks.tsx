import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, PALETTE, type TaskProject } from '../../core/types';
import { taskOpenCount, taskProjectItems, filteredTasksForProject } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import './tasks.css';

export function Tasks() {
  const { state, update } = useStore();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(state.taskProjects[0]?.id ?? null);
  const [view, setView] = useState<'current' | 'archive'>('current');
  const [newProjectName, setNewProjectName] = useState<string | null>(null);
  const confirm = useConfirm();

  const project = state.taskProjects.find((p) => p.id === activeProjectId) ?? null;
  const projectItems = project ? taskProjectItems(state, project.id) : [];
  const doneCount = projectItems.filter((t) => t.done).length;

  const addProject = () => {
    const name = newProjectName?.trim();
    setNewProjectName(null);
    if (!name) return;
    const proj: TaskProject = { id: uid(), name, color: PALETTE[state.taskProjects.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.taskProjects.push(proj); });
    setActiveProjectId(proj.id);
    setView('current');
  };

  const deleteProject = async () => {
    if (!project) return;
    const ok = await confirm({
      title: 'Удалить проект?',
      message: `«${project.name}» и все его шаги будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    const remaining = state.taskProjects.filter((p) => p.id !== project.id);
    update((draft) => {
      draft.taskProjects = draft.taskProjects.filter((p) => p.id !== project.id);
      draft.taskItems = draft.taskItems.filter((t) => t.projectId !== project.id);
    });
    setActiveProjectId(remaining[0]?.id ?? null);
  };

  return (
    <div className="tasks-wrap">
      <div className="tasks-header">
        <h1 className="tasks-title">Задачи</h1>
        <div className="tasks-summary">{doneCount} / {projectItems.length} выполнено</div>
      </div>

      <div className="task-tabs">
        {state.taskProjects.map((p) => {
          const count = taskOpenCount(state, p.id);
          return (
            <button
              key={p.id}
              className={'task-tab' + (p.id === activeProjectId ? ' active' : '')}
              onClick={() => { setActiveProjectId(p.id); setView('current'); }}
            >
              {p.name} <span>{count}</span>
            </button>
          );
        })}
        {newProjectName === null ? (
          <button className="task-tab task-tab-add" onClick={() => setNewProjectName('')}>+ проект</button>
        ) : (
          <input
            className="task-tab-add-input"
            autoFocus
            placeholder="Например, Дом"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addProject(); if (e.key === 'Escape') setNewProjectName(null); }}
            onBlur={addProject}
          />
        )}
      </div>

      {!project ? (
        <div className="task-empty">
          <span className="task-empty-title">Начни с проекта</span>
          Создай вкладку «Дом», «Работа» или «Личное», а потом добавь в неё шаги.
        </div>
      ) : (
        <ProjectView project={project} view={view} onView={setView} onDeleteProject={deleteProject} />
      )}
    </div>
  );
}

function ProjectView({ project, view, onView, onDeleteProject }: { project: TaskProject; view: 'current' | 'archive'; onView: (v: 'current' | 'archive') => void; onDeleteProject: () => void }) {
  const { state, update } = useStore();
  const [title, setTitle] = useState('');
  const [important, setImportant] = useState(false);

  const items = filteredTasksForProject(state, project.id, view);
  const currentCount = filteredTasksForProject(state, project.id, 'current').length;
  const archiveCount = filteredTasksForProject(state, project.id, 'archive').length;

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

  return (
    <>
      <div className="task-project-title">
        <h2>{project.name}</h2>
        <button className="task-project-delete" onClick={onDeleteProject}>×</button>
      </div>

      <div className="task-add-row">
        <input
          placeholder="Добавить шаг, например: наклеить обои"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
        />
        <label><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> важно</label>
        <button onClick={addTask}>Добавить</button>
      </div>

      <div className="task-filter-tabs">
        <button className={'task-filter' + (view === 'current' ? ' active' : '')} onClick={() => onView('current')}>Открытые <span>{currentCount}</span></button>
        <button className={'task-filter' + (view === 'archive' ? ' active' : '')} onClick={() => onView('archive')}>Готовые <span>{archiveCount}</span></button>
      </div>

      <div className="task-list">
        {items.length === 0 && (
          <div className="task-empty task-empty-small">{view === 'archive' ? 'Готовых шагов пока нет' : 'Все шаги выполнены или список пока пуст'}</div>
        )}
        {items.map((item) => (
          <div key={item.id} className={'task-row task-row-enter' + (item.done ? ' done' : '')}>
            <button className={'task-check' + (item.done ? ' checked' : '')} onClick={() => toggleDone(item.id)}>{item.done ? '✓' : ''}</button>
            <div className="task-row-copy">
              <strong>{item.title}</strong>
              <small>{item.done ? 'готово' : item.important ? 'важно' : 'шаг проекта'}</small>
            </div>
            <button className={'task-important' + (item.important ? ' active' : '')} onClick={() => toggleImportant(item.id)}>★</button>
            <button className="task-delete" onClick={() => remove(item.id)}>×</button>
          </div>
        ))}
      </div>
    </>
  );
}
