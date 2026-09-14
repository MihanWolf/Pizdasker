import { create } from 'zustand';
import type { AppState } from './types';
import { createEmptyState } from './types';
import { loadRawState, saveRawState } from './storage';

interface SaveStatus {
  kind: 'idle' | 'saving' | 'saved' | 'error';
  text: string;
}

interface Store {
  state: AppState;
  loaded: boolean;
  saveStatus: SaveStatus;

  load: () => Promise<void>;
  // Мутирует state через Immer-подобный updater и ставит сохранение в очередь.
  // Компоненты вызывают update(draft => { draft.shoppingItems.unshift(...) })
  update: (mutator: (draft: AppState) => void) => void;
  importState: (next: AppState) => void;
  retrySave: () => Promise<void>;
}

let saveChain: Promise<void> = Promise.resolve();

function queueSave(get: () => Store, set: (partial: Partial<Store>) => void) {
  saveChain = saveChain.then(() => persist(get, set));
  return saveChain;
}

async function persist(get: () => Store, set: (partial: Partial<Store>) => void) {
  set({ saveStatus: { kind: 'saving', text: 'Сохранение…' } });
  const payload = JSON.stringify(get().state);
  const result = await saveRawState(payload);
  if (result.ok) {
    set({ saveStatus: { kind: 'saved', text: 'Сохранено' } });
  } else {
    console.error('Не удалось сохранить данные', result.error);
    set({ saveStatus: { kind: 'error', text: 'Ошибка сохранения — данные пока только в этой вкладке' } });
  }
}

function hasAnyUserData(s: AppState): boolean {
  return !!(
    s.subjects.length ||
    s.notePages.length ||
    s.financeItems.length ||
    s.plants.length ||
    s.shoppingItems.length ||
    s.taskProjects.length ||
    s.taskItems.length
  );
}

// Активный элемент должен всегда указывать на существующую запись.
// Если id пуст или ссылается на удалённый элемент — берём первый из списка.
function pickActive<T extends { id: string }>(items: T[], activeId: string | null): string | null {
  if (activeId && items.some((i) => i.id === activeId)) return activeId;
  return items[0]?.id ?? null;
}

export function withActiveIdFallbacks(s: AppState): AppState {
  return {
    ...s,
    activeSubjectId: pickActive(s.subjects, s.activeSubjectId),
    activeNotePageId: pickActive(s.notePages, s.activeNotePageId),
    activePlantId: pickActive(s.plants, s.activePlantId),
    activeTaskProjectId: pickActive(s.taskProjects, s.activeTaskProjectId),
  };
}

export const useStore = create<Store>((set, get) => ({
  state: createEmptyState(),
  loaded: false,
  saveStatus: { kind: 'idle', text: '—' },

  load: async () => {
    const raw = await loadRawState();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        const merged: AppState = { ...createEmptyState(), ...parsed };
        // онбординг включаем только если данных реально ещё нет — как в текущей логике storage.js
        if (!parsed.onboarding || typeof parsed.onboarding.active !== 'boolean') {
          merged.onboarding = { active: !hasAnyUserData(merged), scene: 'birth' };
        }
        set({ state: withActiveIdFallbacks(merged), saveStatus: { kind: 'saved', text: 'Данные загружены' } });
      } catch {
        set({ saveStatus: { kind: 'idle', text: 'Новый список' } });
      }
    } else {
      set({ saveStatus: { kind: 'idle', text: 'Новый список' } });
    }
    set({ loaded: true });
  },

  update: (mutator) => {
    const draft = structuredClone(get().state);
    mutator(draft);
    set({ state: withActiveIdFallbacks(draft) });
    queueSave(get, set);
  },

  importState: (next) => {
    set({ state: withActiveIdFallbacks(next) });
    queueSave(get, set);
  },

  retrySave: () => queueSave(get, set),
}));
