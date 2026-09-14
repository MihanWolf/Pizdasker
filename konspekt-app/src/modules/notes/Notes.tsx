import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, PALETTE, type NotePage } from '../../core/types';
import { filteredNotesForPage, noteCountLabel } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import './notes.css';

export function Notes() {
  const { state, update } = useStore();
  const [search, setSearch] = useState('');
  const [newPageName, setNewPageName] = useState<string | null>(null);
  const confirm = useConfirm();

  const activePage = state.notePages.find((p) => p.id === state.activeNotePageId) ?? null;

  const selectPage = (id: string | null) => update((draft) => { draft.activeNotePageId = id; });

  const addPage = () => {
    const name = newPageName?.trim();
    setNewPageName(null);
    if (!name) return;
    const page: NotePage = { id: uid(), name, color: PALETTE[state.notePages.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => {
      draft.notePages.push(page);
      draft.activeNotePageId = page.id;
    });
  };

  const deletePage = async (page: NotePage) => {
    const ok = await confirm({
      title: 'Удалить страницу?',
      message: `«${page.name}» и все записи на ней будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.notePages = draft.notePages.filter((p) => p.id !== page.id);
      draft.noteEntries = draft.noteEntries.filter((e) => e.pageId !== page.id);
    });
  };

  return (
    <div className="notes-layout">
      <aside className="notes-shelf">
        {state.notePages.map((page) => {
          const count = state.noteEntries.filter((e) => e.pageId === page.id).length;
          return (
            <div
              key={page.id}
              className={'notes-spine' + (page.id === state.activeNotePageId ? ' active' : '')}
              style={{ background: COLOR_VARS[page.color] }}
              onClick={() => { selectPage(page.id); setSearch(''); }}
            >
              <div className="notes-spine-label">{page.name}</div>
              <div className="notes-spine-count">{count}</div>
            </div>
          );
        })}
        {newPageName === null ? (
          <button className="notes-add-page" onClick={() => setNewPageName('')}>+</button>
        ) : (
          <div className="notes-add-page-form">
            <input
              autoFocus
              placeholder="Например, Идеи"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addPage(); if (e.key === 'Escape') setNewPageName(null); }}
              onBlur={addPage}
            />
          </div>
        )}
      </aside>

      <main className="notes-main">
        {!activePage ? (
          <div className="notes-welcome">
            <div className="notes-welcome-title">Пока пусто</div>
            <div>Добавь первую страницу заметок через «+» слева — например, «Идеи» или «Цитаты»</div>
          </div>
        ) : (
          <NotesPageView page={activePage} search={search} onSearch={setSearch} onDeletePage={() => deletePage(activePage)} />
        )}
      </main>
    </div>
  );
}

function NotesPageView({ page, search, onSearch, onDeletePage }: { page: NotePage; search: string; onSearch: (v: string) => void; onDeletePage: () => void }) {
  const { state, update } = useStore();
  const [draftContent, setDraftContent] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const confirm = useConfirm();

  const entries = filteredNotesForPage(state, page.id, search);

  const addEntry = () => {
    const content = draftContent.trim();
    if (!content) return;
    update((draft) => {
      draft.noteEntries.unshift({ id: uid(), pageId: page.id, content, source: draftSource.trim(), important: false, createdAt: Date.now() });
    });
    setDraftContent('');
    setDraftSource('');
  };

  const toggleImportant = (id: string) => {
    update((draft) => {
      const entry = draft.noteEntries.find((e) => e.id === id);
      if (entry) entry.important = !entry.important;
    });
  };

  const updateEntry = (id: string, field: 'content' | 'source', value: string) => {
    update((draft) => {
      const entry = draft.noteEntries.find((e) => e.id === id);
      if (entry) entry[field] = value;
    });
  };

  const deleteEntry = async (id: string) => {
    const ok = await confirm({ title: 'Удалить запись?', message: 'Эта заметка будет удалена безвозвратно.', confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.noteEntries = draft.noteEntries.filter((e) => e.id !== id); });
  };

  return (
    <>
      <div className="notes-topbar" style={{ borderBottomColor: COLOR_VARS[page.color] }}>
        <div className="notes-title">{page.name}</div>
        <div className="notes-meta">
          <span>{entries.length} {noteCountLabel(entries.length)}</span>
          <button className="notes-delete-page" onClick={onDeletePage}>удалить страницу</button>
        </div>
      </div>

      <input
        className="notes-search"
        placeholder="Поиск по записям..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      {!search && (
        <div className="notes-quick-add">
          <textarea
            rows={2}
            placeholder="Мысль, цитата, наблюдение... что угодно"
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addEntry(); }}
          />
          <div className="notes-add-row">
            <input
              placeholder="источник / кто сказал (необязательно)"
              value={draftSource}
              onChange={(e) => setDraftSource(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addEntry(); }}
            />
            <button onClick={addEntry}>Добавить</button>
            <span className="notes-hint">Ctrl+Enter</span>
          </div>
        </div>
      )}

      <div className="notes-quotes-list">
        {entries.length === 0 && (
          <div className="notes-empty">{search ? 'Ничего не найдено' : 'Впиши мысль или цитату выше'}</div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="quote-card quote-card-enter" style={{ borderLeftColor: COLOR_VARS[page.color] }}>
            <div className="quote-mark" style={{ color: COLOR_VARS[page.color] }}>&ldquo;</div>
            <div
              className="quote-content"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateEntry(entry.id, 'content', e.currentTarget.textContent?.trim() ?? '')}
            >
              {entry.content}
            </div>
            <div className="quote-footer">
              <div
                className="quote-source"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="+ источник"
                onBlur={(e) => updateEntry(entry.id, 'source', e.currentTarget.textContent?.trim() ?? '')}
              >
                {entry.source}
              </div>
              <div className="quote-meta">
                <span className="quote-date">{new Date(entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <button className={'quote-important' + (entry.important ? ' active' : '')} onClick={() => toggleImportant(entry.id)}>★</button>
                <button className="quote-del" onClick={() => deleteEntry(entry.id)}>×</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
