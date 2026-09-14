import { useStore } from '../../core/store';
import { COLOR_VARS, type TaskItem } from '../../core/types';
import { useConfirm } from '../../ui/ConfirmDialog';
import { CheckStroke, FlagIcon } from '../../ui/icons';
import { paymentDaysUntil, paymentDueLabel } from '../../core/selectors';
import '../../ui/drawer.css';
import './task-drawer.css';

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state, update } = useStore();
  const confirm = useConfirm();

  const task = state.taskItems.find((t) => t.id === taskId);
  const project = task ? state.taskProjects.find((p) => p.id === task.projectId) : null;
  if (!task || !project) return null;

  const accent = COLOR_VARS[project.color] || COLOR_VARS.rust;
  const dateStr = new Date(task.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const daysUntil = paymentDaysUntil(task.dueDate);

  const patch = (fn: (t: TaskItem) => void) => {
    update((draft) => {
      const t = draft.taskItems.find((x) => x.id === taskId);
      if (t) fn(t);
    });
  };

  const deleteTask = async () => {
    const ok = await confirm({ title: 'Удалить задачу?', message: `«${task.title}» будет удалена безвозвратно.`, confirmLabel: 'Удалить' });
    if (!ok) return;
    update((draft) => { draft.taskItems = draft.taskItems.filter((t) => t.id !== taskId); });
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay show" onClick={onClose} />
      <div className="drawer-panel show">
        <div className="drawer-accent" style={{ background: accent }} />
        <div className="drawer-header">
          <div className="drawer-breadcrumb">Задачи › {project.name}</div>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div
            className="drawer-title"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => patch((t) => { t.title = e.currentTarget.textContent?.trim() || t.title; })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
          >
            {task.title}
          </div>

          <div className="status-row">
            <button className={'status-pill' + (task.done ? ' on-done' : '')} onClick={() => patch((t) => { t.done = !t.done; t.completedAt = t.done ? Date.now() : null; })}>
              <CheckStroke />
              {task.done ? 'Выполнено' : 'Отметить выполненной'}
            </button>
            <button className={'status-pill' + (task.important ? ' on-urgent' : '')} onClick={() => patch((t) => { t.important = !t.important; })}>
              <FlagIcon />
              Важно
            </button>
          </div>

          <div className="drawer-section">
            <span className="drawer-label">Дедлайн</span>
            <div className="task-due-row">
              <input
                type="date"
                className="task-due-input"
                value={task.dueDate || ''}
                onChange={(e) => patch((t) => { t.dueDate = e.target.value || undefined; })}
              />
              {task.dueDate && (
                <span className="task-due-label mono">{paymentDueLabel(daysUntil)}</span>
              )}
              {task.dueDate && (
                <button className="task-due-clear" title="Убрать дедлайн" onClick={() => patch((t) => { t.dueDate = undefined; })}>×</button>
              )}
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-label">Заметки</span>
            <div
              className="drawer-text big"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              data-placeholder="Детали, шаги, ссылки, что угодно..."
              onBlur={(e) => patch((t) => { t.note = e.currentTarget.textContent?.trim() ?? ''; })}
            >
              {task.note}
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <span className="drawer-meta">Добавлено {dateStr}</span>
          <button className="drawer-delete" onClick={deleteTask}>Удалить задачу</button>
        </div>
      </div>
    </>
  );
}
