import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, PALETTE, type Subject, type TopicGroup, type Topic } from '../../core/types';
import { subjectProgress, subjectGroups, ungroupedTopics, groupTopics, filteredTopicsForSubject } from '../../core/selectors';
import { useConfirm, useNamePrompt } from '../../ui/ConfirmDialog';
import { TopBar, useCycleColor } from '../../app/TopBar';
import { CheckStamp, FlagIcon } from '../../ui/icons';
import { DetailDrawer } from './DetailDrawer';
import './study.css';

export function Study() {
  const { state } = useStore();
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);

  const subject = state.subjects.find((s) => s.id === state.activeSubjectId) ?? null;

  if (!subject) {
    return (
      <div className="content-scroll">
        <div className="welcome">
          <div className="display">Пока пусто</div>
          <div>Добавь первый предмет через «+» слева — например, «Математика»</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SubjectView key={subject.id} subject={subject} onOpenTopic={setOpenTopicId} />
      {openTopicId && <DetailDrawer topicId={openTopicId} onClose={() => setOpenTopicId(null)} />}
    </>
  );
}

function SubjectView({ subject, onOpenTopic }: { subject: Subject; onOpenTopic: (id: string) => void }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const cycleColor = useCycleColor();
  const search = state.studySearch;
  const { done, total } = subjectProgress(state, subject.id);
  const searchResults = filteredTopicsForSubject(state, subject.id, search);

  const deleteSubject = async () => {
    const ok = await confirm({
      title: 'Удалить предмет?',
      message: `«${subject.name}» и все его темы и группы будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.subjects = draft.subjects.filter((s) => s.id !== subject.id);
      draft.groups = draft.groups.filter((g) => g.subjectId !== subject.id);
      draft.topics = draft.topics.filter((t) => t.subjectId !== subject.id);
      draft.activeSubjectId = null;
    });
  };

  const meta = total > 0 ? (
    <>
      <span className="mono">{done} / {total} выучено</span>
      <div className="progress-track">
        {Array.from({ length: total }).map((_, i) => <div key={i} className={'tick' + (i < done ? ' filled' : '')} />)}
      </div>
    </>
  ) : <span className="mono">тем пока нет</span>;

  return (
    <>
      <TopBar
        name={subject.name}
        color={subject.color}
        onRename={(name) => { if (name) update((draft) => { const s = draft.subjects.find((x) => x.id === subject.id); if (s) s.name = name; }); }}
        onCycleColor={() => cycleColor('subject', subject.id)}
        deleteLabel="удалить предмет"
        deleteTitle="Удалить предмет?"
        deleteMessage={`«${subject.name}» и все его темы и группы будут удалены безвозвратно.`}
        onDelete={deleteSubject}
        meta={meta}
      />

      <div className="searchbar">
        <input
          className="search-input"
          placeholder="Поиск по темам и разборам..."
          value={search}
          onChange={(e) => update((draft) => { draft.studySearch = e.target.value; })}
        />
      </div>

      <div className="content-scroll">
        {search.trim() ? (
          searchResults.length === 0 ? (
            <div className="empty-state"><span className="display">Ничего не найдено</span>Попробуй другой запрос</div>
          ) : (
            <div className="topics-list">
              {searchResults.map((t) => {
                const group = state.groups.find((g) => g.id === t.groupId);
                return (
                  <TopicCard
                    key={t.id}
                    topic={t}
                    accent={group ? COLOR_VARS[group.color ?? 'teal'] : COLOR_VARS[subject.color]}
                    groupTag={group ? group.name : (subject.ungroupedName || 'Общее')}
                    onOpen={() => onOpenTopic(t.id)}
                  />
                );
              })}
            </div>
          )
        ) : (
          <GroupedTopics subject={subject} onOpenTopic={onOpenTopic} />
        )}
      </div>
    </>
  );
}

function GroupedTopics({ subject, onOpenTopic }: { subject: Subject; onOpenTopic: (id: string) => void }) {
  const { state, update } = useStore();
  const namePrompt = useNamePrompt();
  const confirm = useConfirm();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const ungrouped = ungroupedTopics(state, subject.id);
  const groups = subjectGroups(state, subject.id);
  const ungroupedName = subject.ungroupedName || 'Общее';

  const addGroup = async () => {
    const name = await namePrompt('Новая группа', 'Например, Геометрия');
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
        <button className="add-group-btn" onClick={addGroup}>+ добавить группу</button>
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
        <div className={'group-pill' + (color ? '' : ' neutral')} style={color ? { background: color } : undefined}>
          {onCycleColor && <div className="group-dot" onClick={onCycleColor} title="Сменить цвет" />}
          <div className="group-name" contentEditable suppressContentEditableWarning spellCheck={false} onBlur={(e) => onRename(e.currentTarget.textContent?.trim() ?? '')}>{title}</div>
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
    <div className={'card' + (topic.done ? ' done' : '')} style={{ ['--card-accent' as string]: accent }} onClick={onOpen}>
      <div className="card-row">
        <div className={'stamp' + (topic.done ? ' checked' : '')} onClick={toggleDone}><CheckStamp /></div>
        <div className="card-body">
          <span className="card-title">{topic.title}</span>
          {groupTag && <span className="card-group-tag">{groupTag}</span>}
          <div className={'card-note-preview' + (!previewText ? ' placeholder' : '')}>{previewText || 'Нет разбора — нажми, чтобы добавить'}</div>
        </div>
        <div className="card-actions">
          <span className="card-open-hint">›</span>
          <button className={'flag-btn' + (topic.urgent ? ' active' : '')} title="Срочно" onClick={toggleUrgent}><FlagIcon /></button>
          <button className="del-btn" title="Удалить" onClick={remove}>×</button>
        </div>
      </div>
    </div>
  );
}
