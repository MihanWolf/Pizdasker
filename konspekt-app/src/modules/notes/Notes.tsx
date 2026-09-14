import { useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, type NotePage, type NoteEntry } from '../../core/types';
import { filteredNotesForPage, noteCountLabel } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import { TopBar, useCycleColor } from '../../app/TopBar';
import './notes.css';

export function Notes() {
  const { state } = useStore();
  const activePage = state.notePages.find((p) => p.id === state.activeNotePageId) ?? null;

  if (!activePage) {
    return (
      <div className="content-scroll">
        <div className="welcome">
          <div className="display">Пока пусто</div>
          <div>Добавь первую страницу заметок через «+» слева — например, «Идеи» или «Цитаты»</div>
        </div>
      </div>
    );
  }

  return <NotesPageView key={activePage.id} page={activePage} />;
}

function NotesPageView({ page }: { page: NotePage }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const cycleColor = useCycleColor();

  const search = state.notesSearch;
  const entries = filteredNotesForPage(state, page.id, search);
  const totalCount = state.noteEntries.filter((e) => e.pageId === page.id).length;

  const deletePage = async () => {
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: `«${page.name}» и все записи на ней будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.notePages = draft.notePages.filter((p) => p.id !== page.id);
      draft.noteEntries = draft.noteEntries.filter((e) => e.pageId !== page.id);
      draft.activeNotePageId = null;
    });
  };

  return (
    <>
      <TopBar
        name={page.name}
        color={page.color}
        onRename={(name) => { if (name) update((draft) => { const p = draft.notePages.find((x) => x.id === page.id); if (p) p.name = name; }); }}
        onCycleColor={() => cycleColor('page', page.id)}
        deleteLabel="удалить страницу"
        deleteTitle="Удалить страницу?"
        deleteMessage={`«${page.name}» и все записи на ней будут удалены безвозвратно.`}
        onDelete={deletePage}
        meta={<span className="mono">{totalCount} {noteCountLabel(totalCount)}</span>}
      />

      <div className="searchbar">
        <input
          className="search-input"
          placeholder="Поиск по записям..."
          value={search}
          onChange={(e) => update((draft) => { draft.notesSearch = e.target.value; })}
        />
      </div>

      <div className="content-scroll">
        {!search && <QuickAddNote pageId={page.id} />}
        <NotesList page={page} entries={entries} search={search} />
      </div>
    </>
  );
}

function QuickAddNote({ pageId }: { pageId: string }) {
  const { update } = useStore();
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    update((draft) => {
      draft.noteEntries.unshift({ id: uid(), pageId, content: trimmed, source: source.trim(), important: false, createdAt: Date.now() });
    });
    setContent('');
    setSource('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  return (
    <div className="notes-quick-add">
      <textarea
        ref={textareaRef}
        rows={2}
        placeholder="Мысль, цитата, наблюдение... что угодно"
        value={content}
        onChange={(e) => { setContent(e.target.value); autoResize(e.target); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
      />
      <div className="note-add-row">
        <input
          placeholder="источник / кто сказал (необязательно)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button onClick={submit}>Добавить</button>
        <span className="note-add-hint">Ctrl+Enter</span>
      </div>
    </div>
  );
}

function NotesList({ page, entries, search }: { page: NotePage; entries: NoteEntry[]; search: string }) {
  const { update } = useStore();
  const confirm = useConfirm();

  const deleteEntry = async (id: string) => {
    const ok = await confirm({ title: 'Удалить запись?', message: 'Эта заметка будет удалена безвозвратно.', confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.noteEntries = draft.noteEntries.filter((e) => e.id !== id); });
  };

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <span className="display">{search ? 'Ничего не найдено' : 'Пока пусто'}</span>
        {search ? 'Попробуй другой запрос' : 'Впиши мысль или цитату выше'}
      </div>
    );
  }

  return (
    <div className="notes-quotes-list">
      {entries.map((entry) => (
        <div key={entry.id} className="quote-card quote-card-enter" style={{ ['--card-accent' as string]: COLOR_VARS[page.color] }}>
          <div className="quote-mark">&ldquo;</div>
          <div
            className="quote-content"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => {
              const value = e.currentTarget.textContent?.trim() ?? '';
              update((draft) => { const x = draft.noteEntries.find((n) => n.id === entry.id); if (x) x.content = value; });
            }}
          >
            {entry.content}
          </div>
          <div className="quote-footer">
            <div
              className="quote-source"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              data-role="source"
              onBlur={(e) => {
                const value = e.currentTarget.textContent?.trim() ?? '';
                update((draft) => { const x = draft.noteEntries.find((n) => n.id === entry.id); if (x) x.source = value; });
              }}
            >
              {entry.source}
            </div>
            <div className="quote-meta">
              <span className="quote-date">{new Date(entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <button
                className={'quote-important' + (entry.important ? ' active' : '')}
                title={entry.important ? 'Убрать из важных' : 'Отметить важной'}
                onClick={() => update((draft) => { const x = draft.noteEntries.find((n) => n.id === entry.id); if (x) x.important = !x.important; })}
              >
                ★
              </button>
              <button className="quote-del" title="Удалить" onClick={() => deleteEntry(entry.id)}>×</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
