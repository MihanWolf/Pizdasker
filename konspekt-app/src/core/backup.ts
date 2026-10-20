import type { AppMode, AppState } from './types';
import { createEmptyState, normalizeSettings } from './types';

export const DASHBOARD_MODES = ['finance', 'tasks', 'shopping', 'notes', 'plants', 'study'] as const satisfies readonly AppMode[];
export type DashboardMode = typeof DASHBOARD_MODES[number];

export const DASHBOARD_LABELS: Record<DashboardMode, string> = {
  finance: 'Финансы',
  tasks: 'Задачи',
  shopping: 'Покупки',
  notes: 'Заметки',
  plants: 'Полив',
  study: 'Учёба',
};

const DASHBOARD_FORMAT = 'pizdasker-dashboard';
const DASHBOARD_VERSION = 1;

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
    s.financeOperations.length ||
    s.plants.length ||
    s.environmentReadings.length ||
    s.shoppingItems.length ||
    s.taskProjects.length ||
    s.taskItems.length
  );
}

export interface ImportResult {
  state: AppState;
  exportedAt: string | null;
}

export interface DashboardImportResult extends ImportResult {
  mode: DashboardMode;
  scope: 'dashboard';
}

export interface FullBackupImportResult extends ImportResult {
  scope: 'all';
}

export type BackupFileImportResult = DashboardImportResult | FullBackupImportResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dashboardData(state: AppState, mode: DashboardMode): Partial<AppState> {
  switch (mode) {
    case 'finance':
      return {
        financeItems: state.financeItems,
        financeOperations: state.financeOperations,
        currency: state.currency,
        balance: state.balance,
      };
    case 'tasks':
      return {
        taskProjects: state.taskProjects,
        taskItems: state.taskItems,
        activeTaskProjectId: state.activeTaskProjectId,
        tasksView: state.tasksView,
      };
    case 'shopping':
      return { shoppingItems: state.shoppingItems, shoppingView: state.shoppingView };
    case 'notes':
      return {
        notePages: state.notePages,
        noteEntries: state.noteEntries,
        activeNotePageId: state.activeNotePageId,
        notesSearch: state.notesSearch,
      };
    case 'plants':
      return {
        plants: state.plants,
        waterings: state.waterings,
        environmentReadings: state.environmentReadings,
        activePlantId: state.activePlantId,
        plantsSearch: state.plantsSearch,
        plantsView: state.plantsView,
      };
    case 'study':
      return {
        subjects: state.subjects,
        groups: state.groups,
        topics: state.topics,
        activeSubjectId: state.activeSubjectId,
        studySearch: state.studySearch,
      };
  }
}

function requiredDashboardKeys(mode: DashboardMode): string[] {
  switch (mode) {
    case 'finance': return ['financeItems', 'financeOperations', 'currency', 'balance'];
    case 'tasks': return ['taskProjects', 'taskItems', 'activeTaskProjectId', 'tasksView'];
    case 'shopping': return ['shoppingItems', 'shoppingView'];
    case 'notes': return ['notePages', 'noteEntries', 'activeNotePageId', 'notesSearch'];
    case 'plants': return ['plants', 'waterings', 'environmentReadings', 'activePlantId', 'plantsSearch', 'plantsView'];
    case 'study': return ['subjects', 'groups', 'topics', 'activeSubjectId', 'studySearch'];
  }
}

function parseDashboardBackup(parsed: unknown): DashboardImportResult {
  if (!isRecord(parsed) || parsed.format !== DASHBOARD_FORMAT || parsed.version !== DASHBOARD_VERSION) {
    throw new Error('Файл не является поддерживаемым бэкапом отдельного раздела.');
  }
  if (!DASHBOARD_MODES.includes(parsed.mode as DashboardMode)) {
    throw new Error('В файле указан неизвестный раздел.');
  }

  const mode = parsed.mode as DashboardMode;
  if (!isRecord(parsed.data)) throw new Error('В файле отсутствуют данные раздела.');
  const data = parsed.data;
  for (const key of requiredDashboardKeys(mode)) {
    if (!(key in data)) throw new Error(`В файле отсутствует обязательное поле «${key}».`);
  }
  const arrayKeys = mode === 'finance'
    ? ['financeItems', 'financeOperations']
    : mode === 'tasks'
      ? ['taskProjects', 'taskItems']
      : mode === 'shopping'
        ? ['shoppingItems']
        : mode === 'notes'
          ? ['notePages', 'noteEntries']
          : mode === 'plants'
            ? ['plants', 'waterings', 'environmentReadings']
            : ['subjects', 'groups', 'topics'];
  for (const key of arrayKeys) {
    if (!Array.isArray(data[key])) throw new Error(`Поле «${key}» в файле должно быть списком.`);
  }
  if (mode === 'finance' && (typeof data.currency !== 'string' || typeof data.balance !== 'number' || !Number.isFinite(data.balance))) {
    throw new Error('Данные финансового раздела повреждены.');
  }
  if (mode === 'notes' && typeof data.notesSearch !== 'string') throw new Error('Данные раздела «Заметки» повреждены.');
  if (mode === 'plants' && typeof data.plantsSearch !== 'string') throw new Error('Данные раздела «Полив» повреждены.');
  if (mode === 'study' && typeof data.studySearch !== 'string') throw new Error('Данные раздела «Учёба» повреждены.');

  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  const normalized = importBackup(JSON.stringify({ ...data, exportedAt }));
  return { state: normalized.state, exportedAt, mode, scope: 'dashboard' };
}

// Разбирает файл бэкапа (строка JSON) в типизированный AppState.
// Отсутствующие поля подставляются из createEmptyState() — так же, как
// storage.js в старой версии подставлял `|| []` на каждое поле при загрузке.
export function importBackup(raw: string): ImportResult {
  const parsed = JSON.parse(raw) as LegacyBackup;
  const empty = createEmptyState();

  const state: AppState = {
    mode: (['today', 'notes', 'finance', 'plants', 'shopping', 'tasks', 'study', 'settings'] as const).includes(
      parsed.mode as AppState['mode']
    )
      ? (parsed.mode as AppState['mode'])
      : 'today',
    subjects: parsed.subjects ?? empty.subjects,
    groups: parsed.groups ?? empty.groups,
    topics: parsed.topics ?? empty.topics,
    activeSubjectId: parsed.activeSubjectId ?? empty.activeSubjectId,
    studySearch: parsed.studySearch ?? '',
    notePages: parsed.notePages ?? empty.notePages,
    noteEntries: parsed.noteEntries ?? empty.noteEntries,
    activeNotePageId: parsed.activeNotePageId ?? empty.activeNotePageId,
    notesSearch: parsed.notesSearch ?? '',
    financeItems: parsed.financeItems ?? empty.financeItems,
    financeOperations: parsed.financeOperations ?? empty.financeOperations,
    currency: parsed.currency ?? empty.currency,
    balance: typeof parsed.balance === 'number' ? parsed.balance : empty.balance,
    plants: parsed.plants ?? empty.plants,
    waterings: parsed.waterings ?? empty.waterings,
    environmentReadings: Array.isArray(parsed.environmentReadings) ? parsed.environmentReadings : empty.environmentReadings,
    activePlantId: parsed.activePlantId ?? empty.activePlantId,
    plantsSearch: parsed.plantsSearch ?? '',
    plantsView: parsed.plantsView === 'climate' || parsed.plantsView === 'gallery' ? parsed.plantsView : 'watering',
    shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : empty.shoppingItems,
    shoppingView: parsed.shoppingView === 'archive' ? 'archive' : 'current',
    taskProjects: Array.isArray(parsed.taskProjects) ? parsed.taskProjects : empty.taskProjects,
    taskItems: Array.isArray(parsed.taskItems) ? parsed.taskItems : empty.taskItems,
    activeTaskProjectId: parsed.activeTaskProjectId ?? (parsed.taskProjects?.[0]?.id ?? null),
    tasksView: parsed.tasksView === 'archive' ? 'archive' : 'current',
    settings: normalizeSettings(parsed.settings),
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

export function exportDashboardBackup(state: AppState, mode: DashboardMode): string {
  return JSON.stringify({
    format: DASHBOARD_FORMAT,
    version: DASHBOARD_VERSION,
    mode,
    exportedAt: new Date().toISOString(),
    data: dashboardData(state, mode),
  }, null, 2);
}

export function importDashboardBackup(raw: string): DashboardImportResult {
  return parseDashboardBackup(JSON.parse(raw) as unknown);
}

export function importBackupFile(raw: string): BackupFileImportResult {
  const parsed = JSON.parse(raw) as unknown;
  if (isRecord(parsed) && parsed.format === DASHBOARD_FORMAT) return parseDashboardBackup(parsed);
  return { ...importBackup(raw), scope: 'all' };
}

export function replaceDashboardData(current: AppState, imported: AppState, mode: DashboardMode): AppState {
  switch (mode) {
    case 'finance':
      return { ...current, financeItems: imported.financeItems, financeOperations: imported.financeOperations, currency: imported.currency, balance: imported.balance };
    case 'tasks':
      return { ...current, taskProjects: imported.taskProjects, taskItems: imported.taskItems, activeTaskProjectId: imported.activeTaskProjectId, tasksView: imported.tasksView };
    case 'shopping':
      return { ...current, shoppingItems: imported.shoppingItems, shoppingView: imported.shoppingView };
    case 'notes':
      return { ...current, notePages: imported.notePages, noteEntries: imported.noteEntries, activeNotePageId: imported.activeNotePageId, notesSearch: imported.notesSearch };
    case 'plants':
      return { ...current, plants: imported.plants, waterings: imported.waterings, environmentReadings: imported.environmentReadings, activePlantId: imported.activePlantId, plantsSearch: imported.plantsSearch, plantsView: imported.plantsView };
    case 'study':
      return { ...current, subjects: imported.subjects, groups: imported.groups, topics: imported.topics, activeSubjectId: imported.activeSubjectId, studySearch: imported.studySearch };
  }
}

// Сериализация — та же форма, что читает importBackup, плюс exportedAt.
export function exportBackup(state: AppState): string {
  const payload: LegacyBackup = { ...state, exportedAt: new Date().toISOString() };
  return JSON.stringify(payload, null, 2);
}
