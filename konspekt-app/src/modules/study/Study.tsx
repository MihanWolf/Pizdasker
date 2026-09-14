import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, PALETTE, type Subject, type TopicGroup, type Topic } from '../../core/types';
import { subjectProgress, subjectGroups, ungroupedTopics, groupTopics, filteredTopicsForSubject } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import { DetailDrawer } from './DetailDrawer';
import './study.css';

export function Study() {
  const { state, update } = useStore();
  const [search, setSearch] = useState('');
  const [newSubjectName, setNewSubjectName] = useState<string | null>(null);
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const confirm = useConfirm();

  const subject = state.subjects.find((s) => s.id === state.activeSubjectId) ?? null;

  const selectSubject = (id: string | null) => update((draft) => { draft.activeSubjectId = id; });

  const addSubject = () => {
    const name = newSubjectName?.trim();
    setNewSubjectName(null);
    if (!name) return;
    const sub: Subject = { id: uid(), name, color: PALETTE[state.subjects.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => {
      draft.subjects.push(sub);
      draft.activeSubjectId = sub.id;
    });
  };

  const deleteSubject = async (sub: Subject) => {
    const ok = await confirm({ title: 'Удалить предмет?', message: `«${sub.name}» и все его темы и группы будут удалены безвозвратно.`, confirmLabel: 'Удалить' });
    if (!ok) return;
    update((draft) => {
      draft.subjects = draft.subjects.filter((s) => s.id !== sub.id);
      draft.groups = draft.groups.filter((g) => g.subjectId !== sub.id);
      draft.topics = draft.topics.filter((t) => t.subjectId !== sub.id);
    });
  };

  return (
    <div className="study-layout">
      <aside className="study-shelf">
        {state.subjects.map((sub) => {
          const { done, total } = subjectProgress(state, sub.id);
          return (
            <div
              key={sub.id}
              className={'study-spine' + (sub.id === state.activeSubjectId ? ' active' : '')}
              style={{ background: COLOR_VARS[sub.color] }}
              onClick={() => { selectSubject(sub.id); setSearch(''); }}
            >
              <div className="study-spine-label">{sub.name}</div>
              <div className="study-spine-count">{done}/{total}</div>
            </div>
          );
        })}
        {newSubjectName === null ? (
          <button className="study-add" onClick={() => setNewSubjectName('')}>+</button>
        ) : (
          <input
            className="study-add-input"
            autoFocus
            placeholder="Например, История"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSubject(); if (e.key === 'Escape') setNewSubjectName(null); }}
            onBlur={addSubject}
          />
        )}
      </aside>

      <main className="study-main">
        {!subject ? (
          <div className="study-welcome">
            <div className="study-welcome-title">Пока пусто</div>
            <div>Добавь первый предмет через «+» слева — например, «Математика»</div>
          </div>
        ) : (
          <SubjectView subject={subject} search={search} onSearch={setSearch} onDeleteSubject={() => deleteSubject(subject)} onOpenTopic={setOpenTopicId} />
        )}
      </main>

      {openTopicId && <DetailDrawer topicId={openTopicId} onClose={() => setOpenTopicId(null)} />}
    </div>
  );
}

function SubjectView({ subject, search, onSearch, onDeleteSubject, onOpenTopic }: {
  subject: Subject; search: string; onSearch: (v: string) => void; onDeleteSubject: () => void; onOpenTopic: (id: string) => void;
}) {
  const { state } = useStore();
  const { done, total } = subjectProgress(state, subject.id);
  const searchResults = filteredTopicsForSubject(state, subject.id, search);

  return (
    <>
      <div className="study-topbar" style={{ borderBottomColor: COLOR_VARS[subject.color] }}>
        <div className="study-title">{subject.name}</div>
        <div className="study-meta">
          <span>{total > 0 ? `${done} / ${total} выучено` : 'тем пока нет'}</span>
          <button className="study-delete" onClick={onDeleteSubject}>удалить предмет</button>
        </div>
      </div>

      <input className="study-search" placeholder="Поиск по темам и разборам..." value={search} onChange={(e) => onSearch(e.target.value)} />

      {search.trim() ? (
        <div className="topics-list">
          {searchResults.length === 0 && <div className="study-empty">Ничего не найдено</div>}
          {searchResults.map((t) => {
            const group = state.groups.find((g) => g.id === t.groupId);
            return <TopicCard key={t.id} topic={t} accent={group ? COLOR_VARS[group.color ?? 'teal'] : COLOR_VARS[subject.color]} groupTag={group ? group.name : (subject.ungroupedName || 'Общее')} onOpen={() => onOpenTopic(t.id)} />;
          })}
        </div>
      ) : (
        <GroupedTopics subject={subject} onOpenTopic={onOpenTopic} />
      )}
    </>
  );
}

function GroupedTopics({ subject, onOpenTopic }: { subject: Subject; onOpenTopic: (id: string) => void }) {
  const { state, update } = useStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState<string | null>(null);
  const confirm = useConfirm();

  const ungrouped = ungroupedTopics(state, subject.id);
  const groups = subjectGroups(state, subject.id);
  const ungroupedName = subject.ungroupedName || 'Общее';

  const addGroup = () => {
    const name = newGroupName?.trim();
    setNewGroupName(null);
    if (!name) return;
    const group: TopicGroup = { id: uid(), subjectId: subject.id, name, color: PALETTE[groups.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.groups.push(group); });
  };

  const deleteGroup = async (group: TopicGroup) => {
    const ok = await confirm({ title: 'Удалить группу?', message: `«${group.name}» будет удалена. Темы из неё переедут в «${ungroupedName}».`, confirmLabel: 'Удалить' });
    if (!ok) return;
    update((draft) => {
      draft.topics.forEach((t) => { if (t.groupId === group.id) t.groupId = null; });
      draft.groups = draft.groups.filter((g) => g.id !== group.id);
    });
  };

  return (
    <>
      <TopicGroupSection
        title={ungroupedName}
        color={null}
        collapsed={!!collapsed['__ungrouped']}
        onToggleCollapse={() => setCollapsed((c) => ({ ...c, __ungrouped: !c.__ungrouped }))}
        onRename={(name) => update((draft) => {
          const s = draft.subjects.find((x) => x.id === subject.id);
          if (s) s.ungroupedName = name || 'Общее';
        })}
        topics={ungrouped}
        subjectColor={COLOR_VARS[subject.color]}
        placeholder={`Новая тема в «${ungroupedName}»... и Enter`}
        onAddTopic={(title) => update((draft) => {
          draft.topics.unshift({ id: uid(), subjectId: subject.id, groupId: null, title, note: '', why: '', links: [], done: false, urgent: false, createdAt: Date.now() });
        })}
        onOpenTopic={onOpenTopic}
      />

      {groups.map((group) => (
        <TopicGroupSection
          key={group.id}
          title={group.name}
          color={COLOR_VARS[group.color ?? 'teal']}
          collapsed={!!collapsed[group.id]}
          onToggleCollapse={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
          onRename={(name) => update((draft) => {
            const g = draft.groups.find((x) => x.id === group.id);
            if (g) g.name = name || g.name;
          })}
          onCycleColor={() => update((draft) => {
            const g = draft.groups.find((x) => x.id === group.id);
            if (g) { const idx = PALETTE.indexOf(g.color ?? 'teal'); g.color = PALETTE[(idx + 1) % PALETTE.length]; }
          })}
          onDelete={() => deleteGroup(group)}
          topics={groupTopics(state, subject.id, group.id)}
          subjectColor={COLOR_VARS[subject.color]}
          placeholder={`Новая тема в «${group.name}»... и Enter`}
          onAddTopic={(title) => update((draft) => {
            draft.topics.unshift({ id: uid(), subjectId: subject.id, groupId: group.id, title, note: '', why: '', links: [], done: false, urgent: false, createdAt: Date.now() });
          })}
          onOpenTopic={onOpenTopic}
        />
      ))}

      <div className="add-group-row">
        {newGroupName === null ? (
          <button id="add-group-btn" onClick={() => setNewGroupName('')}>+ добавить группу</button>
        ) : (
          <input
            autoFocus
            placeholder="Например, Геометрия"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setNewGroupName(null); }}
            onBlur={addGroup}
          />
        )}
      </div>
    </>
  );
}

function TopicGroupSection({ title, color, collapsed, onToggleCollapse, onRename, onCycleColor, onDelete, topics, subjectColor, placeholder, onAddTopic, onOpenTopic }: {
  title: string; color: string | null; collapsed: boolean; onToggleCollapse: () => void; onRename: (name: string) => void;
  onCycleColor?: () => void; onDelete?: () => void; topics: Topic[]; subjectColor: string; placeholder: string;
  onAddTopic: (title: string) => void; onOpenTopic: (id: string) => void;
}) {
  const done = topics.filter((t) => t.done).length;
  const [quickAdd, setQuickAdd] = useState('');

  const submit = () => {
    const v = quickAdd.trim();
    if (!v) return;
    onAddTopic(v);
    setQuickAdd('');
  };

  return (
    <div className="group-section">
      <div className="group-header">
        <button className="group-collapse" onClick={onToggleCollapse}>{collapsed ? '▸' : '▾'}</button>
        <div className="group-pill" style={{ background: color ?? '#9A9C8F' }}>
          {onCycleColor && <div className="group-dot" onClick={onCycleColor} />}
          <div className="group-name" contentEditable suppressContentEditableWarning onBlur={(e) => onRename(e.currentTarget.textContent?.trim() ?? '')}>{title}</div>
        </div>
        <div className="group-meta">{topics.length ? `${done}/${topics.length}` : ''}</div>
        {onDelete && <button className="group-del" onClick={onDelete}>удалить группу</button>}
      </div>
      {!collapsed && (
        <div>
          <div className="quick-add">
            <span>+</span>
            <input placeholder={placeholder} value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
          {topics.length > 0 && (
            <div className="topics-list">
              {topics.map((t) => <TopicCard key={t.id} topic={t} accent={color ?? subjectColor} onOpen={() => onOpenTopic(t.id)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, accent, groupTag, onOpen }: { topic: Topic; accent: string; groupTag?: string; onOpen: () => void }) {
  const { update } = useStore();
  const confirm = useConfirm();
  const previewText = (topic.note || topic.why || '').trim();

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    update((draft) => { const t = draft.topics.find((x) => x.id === topic.id); if (t) t.done = !t.done; });
  };
  const toggleUrgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    update((draft) => { const t = draft.topics.find((x) => x.id === topic.id); if (t) t.urgent = !t.urgent; });
  };
  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({ title: 'Удалить тему?', message: `«${topic.title}» будет удалена безвозвратно.`, confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.topics = draft.topics.filter((x) => x.id !== topic.id); });
  };

  return (
    <div className={'topic-card' + (topic.done ? ' done' : '')} style={{ borderLeftColor: accent }} onClick={onOpen}>
      <button className={'stamp' + (topic.done ? ' checked' : '')} onClick={toggleDone}>{topic.done ? '✓' : ''}</button>
      <div className="topic-card-body">
        <span className="topic-title">{topic.title}</span>
        {groupTag && <span className="topic-group-tag">{groupTag}</span>}
        <div className={'topic-note-preview' + (!previewText ? ' placeholder' : '')}>{previewText || 'Нет разбора — нажми, чтобы добавить'}</div>
      </div>
      <div className="topic-actions">
        <span className="topic-open-hint">›</span>
        <button className={'flag-btn' + (topic.urgent ? ' active' : '')} onClick={toggleUrgent}>⚑</button>
        <button className="del-btn" onClick={remove}>×</button>
      </div>
    </div>
  );
}
