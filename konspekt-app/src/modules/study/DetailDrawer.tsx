import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, type Topic } from '../../core/types';
import { useConfirm } from '../../ui/ConfirmDialog';
import { CheckStroke, FlagIcon } from '../../ui/icons';
import './detail-drawer.css';

export function DetailDrawer({ topicId, onClose }: { topicId: string; onClose: () => void }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const topic = state.topics.find((t) => t.id === topicId);
  const subject = topic ? state.subjects.find((s) => s.id === topic.subjectId) : null;
  if (!topic || !subject) return null;

  const group = state.groups.find((g) => g.id === topic.groupId);
  const accent = group ? COLOR_VARS[group.color ?? 'teal'] : COLOR_VARS[subject.color];
  const groupLabel = group ? group.name : (subject.ungroupedName || 'Общее');
  const dateStr = new Date(topic.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const patch = (fn: (t: Topic) => void) => {
    update((draft) => {
      const t = draft.topics.find((x) => x.id === topicId);
      if (t) fn(t);
    });
  };

  const addLink = () => {
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const label = linkLabel.trim();
    patch((t) => { t.links.push({ id: uid(), url, label }); });
    setLinkUrl(''); setLinkLabel('');
  };

  const deleteTopic = async () => {
    const ok = await confirm({ title: 'Удалить тему?', message: `«${topic.title}» будет удалена безвозвратно.`, confirmLabel: 'Удалить' });
    if (!ok) return;
    update((draft) => { draft.topics = draft.topics.filter((t) => t.id !== topicId); });
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay show" onClick={onClose} />
      <div className="drawer-panel show">
        <div className="drawer-accent" style={{ background: accent }} />
        <div className="drawer-header">
          <div className="drawer-breadcrumb">{subject.name} › {groupLabel}</div>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div
            className="drawer-title"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => patch((t) => { t.title = e.currentTarget.textContent?.trim() || t.title; })}
          >
            {topic.title}
          </div>

          <div className="status-row">
            <button className={'status-pill' + (topic.done ? ' on-done' : '')} onClick={() => patch((t) => { t.done = !t.done; })}>
              <CheckStroke />
              {topic.done ? 'Выучено' : 'Отметить выученным'}
            </button>
            <button className={'status-pill' + (topic.urgent ? ' on-urgent' : '')} onClick={() => patch((t) => { t.urgent = !t.urgent; })}>
              <FlagIcon />
              Срочно
            </button>
          </div>

          <div className="drawer-section">
            <span className="drawer-label">Зачем это нужно</span>
            <div
              className="drawer-text"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Например: без этого не пойму дальнейшие темы..."
              onBlur={(e) => patch((t) => { t.why = e.currentTarget.textContent?.trim() ?? ''; })}
            >
              {topic.why}
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-label">Разбор и материал</span>
            <div
              className="drawer-text big"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Конспект, ключевые формулы, объяснение своими словами..."
              onBlur={(e) => patch((t) => { t.note = e.currentTarget.textContent?.trim() ?? ''; })}
            >
              {topic.note}
            </div>
          </div>

          <div className="drawer-section">
            <span className="drawer-label">Ссылки</span>
            <div className="links-list">
              {topic.links.map((link) => (
                <div className="link-chip" key={link.id}>
                  <div className="link-dot" />
                  <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label || link.url}</a>
                  <button className="link-del" onClick={() => patch((t) => { t.links = t.links.filter((l) => l.id !== link.id); })}>×</button>
                </div>
              ))}
            </div>
            <div className="add-link-row">
              <input className="link-label" placeholder="Название (необязательно)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <input className="link-url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <button onClick={addLink}>+</button>
            </div>
          </div>
        </div>
        <div className="drawer-footer">
          <span className="drawer-meta">Добавлено {dateStr}</span>
          <button className="drawer-delete" onClick={deleteTopic}>Удалить тему</button>
        </div>
      </div>
    </>
  );
}
