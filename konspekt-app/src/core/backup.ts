import type { AppState } from './types';
import { createEmptyState } from './types';

// Формат бэкапа не менялся между версиями: это тот же снимок, что делает
// snapshotState() в старом app.js (+ exportedAt). Поэтому JSON, выгруженный
// из vanilla-версии, читается новым приложением без какой-либо миграции.
export interface LegacyBackup extends Partial<AppState> {
  exportedAt?: string;
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

export interface ImportResult {
  state: AppState;
  exportedAt: string | null;
}

// Разбирает файл бэкапа (строка JSON) в типизированный AppState.
// Отсутствующие поля подставляются из createEmptyState() — так же, как
// storage.js в старой версии подставлял `|| []` на каждое поле при загрузке.
export function importBackup(raw: string): ImportResult {
  const parsed = JSON.parse(raw) as LegacyBackup;
  const empty = createEmptyState();

  const state: AppState = {
    mode: (['today', 'notes', 'finance', 'plants', 'shopping', 'tasks', 'study'] as const).includes(
      parsed.mode as AppState['mode']
    )
      ? (parsed.mode as AppState['mode'])
      : 'today',
    subjects: parsed.subjects ?? empty.subjects,
    groups: parsed.groups ?? empty.groups,
    topics: parsed.topics ?? empty.topics,
    activeSubjectId: parsed.activeSubjectId ?? empty.activeSubjectId,
    notePages: parsed.notePages ?? empty.notePages,
    noteEntries: parsed.noteEntries ?? empty.noteEntries,
    activeNotePageId: parsed.activeNotePageId ?? empty.activeNotePageId,
    financeItems: parsed.financeItems ?? empty.financeItems,
    currency: parsed.currency ?? empty.currency,
    plants: parsed.plants ?? empty.plants,
    waterings: parsed.waterings ?? empty.waterings,
    activePlantId: parsed.activePlantId ?? empty.activePlantId,
    shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : empty.shoppingItems,
    shoppingView: parsed.shoppingView === 'archive' ? 'archive' : 'current',
    taskProjects: Array.isArray(parsed.taskProjects) ? parsed.taskProjects : empty.taskProjects,
    taskItems: Array.isArray(parsed.taskItems) ? parsed.taskItems : empty.taskItems,
    activeTaskProjectId: parsed.activeTaskProjectId ?? (parsed.taskProjects?.[0]?.id ?? null),
    tasksView: parsed.tasksView === 'archive' ? 'archive' : 'current',
    onboarding:
      parsed.onboarding && typeof parsed.onboarding.active === 'boolean'
        ? parsed.onboarding
        : { active: false, scene: 'done' }, // импортированный бэкап = данные уже есть, обряд первого запуска не нужен
  };

  if (!parsed.onboarding && !hasAnyUserData(state)) {
    state.onboarding = { active: true, scene: 'birth' };
  }

  return { state, exportedAt: parsed.exportedAt ?? null };
}

// Сериализация — та же форма, что читает importBackup, плюс exportedAt.
export function exportBackup(state: AppState): string {
  const payload: LegacyBackup = { ...state, exportedAt: new Date().toISOString() };
  return JSON.stringify(payload, null, 2);
}
